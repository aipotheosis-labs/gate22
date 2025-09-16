import asyncio

import pytest

from aci.control_plane import config
from aci.control_plane.external_services.email_service import EmailService

# Test email address for integration tests (should be verified in SES)
TEST_EMAIL = "ji-weiyuan@outlook.com"


@pytest.mark.integration
@pytest.mark.skipif(
    not (config.AWS_ACCESS_KEY_ID and config.AWS_SECRET_ACCESS_KEY),
    reason="AWS credentials not configured",
)
class TestEmailService:
    """Integration tests with real AWS SES service"""

    def test_send_email(self) -> None:
        """Test sending a real email through AWS SES"""
        service = EmailService()

        result = asyncio.run(
            service.send_email(
                recipient=TEST_EMAIL,
                subject="[TEST] MCP Gateway Email Service Test",
                body_text="This is a test email from the MCP Gateway test suite.\n\nPlease ignore.",
                body_html="""
                <html>
                    <body>
                        <h2>Test Email</h2>
                        <p>This is a test email from the MCP Gateway test suite.</p>
                        <p><strong>Please ignore this message.</strong></p>
                    </body>
                </html>
                """,
            )
        )

        if result:
            assert result["email_provider"] == "aws"
            assert "email_send_at" in result
            assert "email_reference_id" in result
        else:
            pytest.skip(f"Could not send to {TEST_EMAIL}. Ensure it's verified in SES.")

    def test_send_verification_email(self) -> None:
        """Test sending a verification email through AWS SES"""
        service = EmailService()

        result = asyncio.run(
            service.send_verification_email(
                recipient=TEST_EMAIL,
                user_name="Test User",
                verification_url="https://example.com/verify?token=test123",
            )
        )

        if result:
            assert result["email_provider"] == "aws"
            assert "email_send_at" in result
            assert "email_reference_id" in result
        else:
            pytest.skip(f"Could not send to {TEST_EMAIL}. Ensure it's verified in SES.")

    def test_send_to_invalid_email(self) -> None:
        """Test that sending to an invalid email returns None"""
        service = EmailService()

        result = asyncio.run(
            service.send_email(
                recipient="invalid-email-address-@-@-@.com",
                subject="Test",
                body_text="Test",
                body_html="<p>Test</p>",
            )
        )

        assert result is None
