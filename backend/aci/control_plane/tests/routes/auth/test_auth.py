import datetime
from collections.abc import Generator
from typing import cast
from unittest.mock import MagicMock, patch

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from aci.common import utils
from aci.common.db import crud
from aci.common.db.sql_models import User, Verification
from aci.common.enums import UserIdentityProvider
from aci.control_plane import config
from aci.control_plane import token_utils as token_utils


@pytest.fixture
def unverified_user(db_session: Session) -> User:
    """Create an unverified user for testing."""
    password_hash = utils.hash_user_password("TestPassword123!")
    user = crud.users.create_user(
        db_session=db_session,
        name="Unverified User",
        email="unverified@example.com",
        password_hash=password_hash,
        identity_provider=UserIdentityProvider.EMAIL,
    )
    user.email_verified = False
    db_session.commit()
    return user


@pytest.fixture
def mock_email_service() -> Generator[MagicMock, None, None]:
    """Mock the email service to avoid actual AWS SES calls."""
    with patch("aci.control_plane.routes.auth.email_service") as mock_service:
        # Create an async mock that returns the email metadata
        async def mock_send_verification_email(
            recipient: str, user_name: str, verification_url: str
        ) -> dict[str, str]:
            return {
                "email_recipient": recipient,
                "email_provider": "aws",
                "email_send_at": "2025-01-17T12:00:00Z",
                "email_reference_id": "test-message-id",
            }

        mock_service.send_verification_email = MagicMock(side_effect=mock_send_verification_email)
        yield mock_service


def extract_token_from_mock(mock_email_service: MagicMock) -> str:
    """Extract verification token from mocked email service call."""
    call_args = mock_email_service.send_verification_email.call_args
    if call_args:
        verification_url = cast(str, call_args[1]["verification_url"])
        token = verification_url.split("token=")[-1]
        return token
    return ""


class TestEmailRegistration:
    def test_register_with_email_sends_verification(
        self,
        test_client: TestClient,
        db_session: Session,
        mock_email_service: MagicMock,
    ) -> None:
        """Test that registration sends verification email and sets email_verified=False."""
        response = test_client.post(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/register/email",
            json={
                "name": "Test User",
                "email": "newuser@example.com",
                "password": "SecurePass123!",
            },
        )

        assert response.status_code == 201

        # Check email service was called
        mock_email_service.send_verification_email.assert_called_once()
        call_args = mock_email_service.send_verification_email.call_args
        assert call_args[1]["recipient"] == "newuser@example.com"
        assert call_args[1]["user_name"] == "Test User"

        # Check user was created with email_verified=False
        user = crud.users.get_user_by_email(db_session, "newuser@example.com")
        assert user is not None
        assert user.email_verified is False
        assert user.identity_provider == UserIdentityProvider.EMAIL

        # Check verification record was created
        verification = (
            db_session.query(Verification).filter(Verification.user_id == user.id).first()
        )
        assert verification is not None
        assert verification.type == "email_verification"
        assert verification.used_at is None

    def test_register_existing_unverified_email(
        self,
        test_client: TestClient,
        db_session: Session,
        unverified_user: User,
        mock_email_service: MagicMock,
    ) -> None:
        """Test re-registration with unverified email updates info and resends verification."""
        # Try to register again with same email
        response = test_client.post(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/register/email",
            json={
                "name": "Updated Name",
                "email": unverified_user.email,
                "password": "NewPassword123!",
            },
        )

        assert response.status_code == 201

        # Check email service was called
        mock_email_service.send_verification_email.assert_called_once()

        # Check user info was updated
        db_session.refresh(unverified_user)
        assert unverified_user.name == "Updated Name"
        # Password update is tested by successful login in other tests

        # Check new verification was created
        new_verifications = (
            db_session.query(Verification)
            .filter(
                Verification.user_id == unverified_user.id,
                Verification.type == "email_verification",
                Verification.used_at.is_(None),
            )
            .all()
        )
        assert len(new_verifications) >= 1

    def test_register_existing_verified_email(
        self, test_client: TestClient, db_session: Session
    ) -> None:
        """Test registration fails for already verified emails."""
        # Create a verified user
        password_hash = utils.hash_user_password("ExistingPass123!")
        verified_user = crud.users.create_user(
            db_session=db_session,
            name="Verified User",
            email="verified@example.com",
            password_hash=password_hash,
            identity_provider=UserIdentityProvider.EMAIL,
        )
        verified_user.email_verified = True
        db_session.commit()

        # Try to register with same email
        response = test_client.post(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/register/email",
            json={
                "name": "Another User",
                "email": "verified@example.com",
                "password": "NewPassword123!",
            },
        )

        assert response.status_code == 400
        # Check error message exists in response
        error_response = response.json()
        assert (
            "error" in error_response or "message" in error_response or "detail" in error_response
        )
        # The error indicates the email is already in use


class TestEmailLogin:
    def test_login_blocked_for_unverified_email(
        self, test_client: TestClient, unverified_user: User
    ) -> None:
        """Test that login is blocked for unverified email accounts."""
        response = test_client.post(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/login/email",
            json={
                "email": unverified_user.email,
                "password": "TestPassword123!",
            },
        )

        assert response.status_code == 403
        assert "Email not verified" in response.json()["detail"]

    def test_login_allowed_for_verified_email(
        self, test_client: TestClient, db_session: Session
    ) -> None:
        """Test that login works for verified email accounts."""
        # Create a verified user
        password = "VerifiedPass123!"
        password_hash = utils.hash_user_password(password)
        verified_user = crud.users.create_user(
            db_session=db_session,
            name="Verified Login User",
            email="verified_login@example.com",
            password_hash=password_hash,
            identity_provider=UserIdentityProvider.EMAIL,
        )
        verified_user.email_verified = True
        db_session.commit()

        response = test_client.post(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/login/email",
            json={
                "email": verified_user.email,
                "password": password,
            },
        )

        assert response.status_code == 200  # Successful login
        assert "refresh_token" in response.cookies


class TestEmailVerification:
    def test_verify_email_valid_token(
        self, test_client: TestClient, db_session: Session, unverified_user: User
    ) -> None:
        """Test successful email verification with valid token."""
        # Generate a valid token
        token, token_hash, expires_at = token_utils.generate_verification_token(
            user_id=unverified_user.id,
            email=unverified_user.email,
            verification_type="email_verification",
        )

        # Create verification record
        verification = Verification(
            user_id=unverified_user.id,
            type="email_verification",
            token_hash=token_hash,
            expires_at=expires_at,
            email_metadata=None,
        )
        db_session.add(verification)
        db_session.commit()

        # Verify email
        response = test_client.get(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/verify-email",
            params={"token": token},
        )

        assert response.status_code == 302  # Redirect
        assert "/auth/verify-success" in response.headers["location"]

        # Check user is now verified
        db_session.refresh(unverified_user)
        assert unverified_user.email_verified is True

        # Check verification is marked as used
        db_session.refresh(verification)
        assert verification.used_at is not None

    def test_verify_email_invalid_token(self, test_client: TestClient) -> None:
        """Test email verification fails with invalid token."""
        response = test_client.get(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/verify-email",
            params={"token": "invalid-token-12345"},
        )

        assert response.status_code == 302
        assert "/auth/verify-error" in response.headers["location"]
        assert "invalid_or_expired_token" in response.headers["location"]

    def test_verify_email_expired_token(
        self, test_client: TestClient, db_session: Session, unverified_user: User
    ) -> None:
        """Test email verification fails with expired token."""
        # Generate an expired token
        now = datetime.datetime.now(datetime.UTC)
        expired_at = now - datetime.timedelta(hours=25)

        payload = {
            "type": "email_verification",
            "email": unverified_user.email,
            "user_id": str(unverified_user.id),
            "iat": int((now - datetime.timedelta(hours=26)).timestamp()),
            "exp": int(expired_at.timestamp()),
        }

        # Create token with expired timestamp
        token = jwt.encode(payload, config.JWT_SIGNING_KEY, algorithm=config.JWT_ALGORITHM)
        token_hash = token_utils.hash_token(token)

        # Create verification record
        verification = Verification(
            user_id=unverified_user.id,
            type="email_verification",
            token_hash=token_hash,
            expires_at=expired_at,
            email_metadata=None,
        )
        db_session.add(verification)
        db_session.commit()

        # Try to verify with expired token
        response = test_client.get(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/verify-email",
            params={"token": token},
        )

        assert response.status_code == 302
        assert "/auth/verify-error" in response.headers["location"]

        # User should still be unverified
        db_session.refresh(unverified_user)
        assert unverified_user.email_verified is False

    def test_verify_email_already_used_token(
        self, test_client: TestClient, db_session: Session, unverified_user: User
    ) -> None:
        """Test that verification token can't be reused."""
        # Generate a valid token
        token, token_hash, expires_at = token_utils.generate_verification_token(
            user_id=unverified_user.id,
            email=unverified_user.email,
            verification_type="email_verification",
        )

        # Create verification record already marked as used
        verification = Verification(
            user_id=unverified_user.id,
            type="email_verification",
            token_hash=token_hash,
            expires_at=expires_at,
            email_metadata=None,
        )
        verification.used_at = datetime.datetime.now(datetime.UTC)
        db_session.add(verification)
        db_session.commit()

        # Try to use the already-used token
        response = test_client.get(
            f"{config.APP_ROOT_PATH}{config.ROUTER_PREFIX_AUTH}/verify-email",
            params={"token": token},
        )

        assert response.status_code == 302
        assert "/auth/verify-error" in response.headers["location"]
        assert "token_not_found_or_already_used" in response.headers["location"]
