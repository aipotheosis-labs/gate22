"""
Authentication utility functions for token generation, validation, and hashing.
"""

import datetime
import hashlib
import hmac
from typing import Any
from uuid import UUID

import jwt

from aci.common.logging_setup import get_logger
from aci.control_plane import config

logger = get_logger(__name__)


def generate_verification_token(
    user_id: UUID,
    email: str,
    verification_type: str = "email_verification",
    expires_in_hours: int = 24,
) -> tuple[str, str, datetime.datetime]:
    """Generate a JWT verification token and its hash."""
    now = datetime.datetime.now(datetime.UTC)
    expires_at = now + datetime.timedelta(hours=expires_in_hours)

    payload = {
        "type": verification_type,
        "email": email,
        "user_id": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    token = jwt.encode(payload, config.JWT_SIGNING_KEY, algorithm=config.JWT_ALGORITHM)
    token_hash = hash_token(token)

    return token, token_hash, expires_at


def hash_token(token: str) -> str:
    """Hash a token using HMAC-SHA256."""
    return hmac.new(config.JWT_SIGNING_KEY.encode(), token.encode(), hashlib.sha256).hexdigest()


def validate_token(token: str) -> dict[str, Any] | None:
    """Validate and decode a JWT token."""
    try:
        payload = jwt.decode(
            token,
            config.JWT_SIGNING_KEY,
            algorithms=[config.JWT_ALGORITHM],
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {e}")
        return None


