import html
import textwrap
from typing import Any

import anyio
import boto3  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]

from aci.common import utils
from aci.common.logging_setup import get_logger
from aci.control_plane import config
from aci.control_plane.exceptions import EmailSendError

logger = get_logger(__name__)


class EmailService:
    def __init__(self) -> None:
        self.charset = "UTF-8"
        self._client = boto3.client("ses")
        self._sender = f"{config.SENDER_NAME} <{config.SENDER_EMAIL}>"

    async def send_email(
        self,
        recipient: str,
        subject: str,
        body_text: str,
        body_html: str,
    ) -> dict[str, Any]:
        try:
            response = await anyio.to_thread.run_sync(
                lambda: self._client.send_email(
                    Destination={
                        "ToAddresses": [recipient],
                    },
                    Message={
                        "Body": {
                            "Html": {
                                "Charset": self.charset,
                                "Data": body_html,
                            },
                            "Text": {
                                "Charset": self.charset,
                                "Data": body_text,
                            },
                        },
                        "Subject": {
                            "Charset": self.charset,
                            "Data": subject,
                        },
                    },
                    Source=self._sender,
                )
            )
            logger.info("Email sent via SES. MessageId=%s", response.get("MessageId"))
            send_at = response.get("ResponseMetadata", {}).get("HTTPHeaders", {}).get("date")
            return {
                "email_recipient": recipient,
                "email_provider": "aws",
                "email_send_at": send_at,
                "email_reference_id": response.get("MessageId"),
            }
        except ClientError as e:
            logger.error(
                "SES send_email failed: %s",
                e.response.get("Error", {}).get("Message"),
            )
            raise EmailSendError("email provider error") from e
        except Exception as e:
            logger.error("Unexpected error sending email: %s", e)
            raise EmailSendError("unexpected error sending email") from e

    async def send_verification_email(
        self,
        recipient: str,
        user_name: str,
        verification_url: str,
    ) -> dict[str, Any] | None:
        subject = "Verify Your Email Address"

        expires_label = utils.format_duration_from_minutes(config.EMAIL_VERIFICATION_EXPIRE_MINUTES)

        body_text = textwrap.dedent(
            f"""
            Hi {user_name},

            Thank you for signing up! Please verify your email address by clicking the
            link below:

            {verification_url}

            This link will expire in {expires_label}.

            If you didn't create an account, you can safely ignore this email.

            Best regards,
            The Aipolabs Team
            """
        ).strip()

        safe_name = html.escape(user_name)
        safe_url = html.escape(verification_url, quote=True)

        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                        'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background-color: #ffffff;
                    border-radius: 8px;
                    padding: 40px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .button {{
                    display: inline-block;
                    padding: 14px 30px;
                    background-color: #007bff;
                    color: #ffffff !important;
                    text-decoration: none;
                    border-radius: 6px;
                    font-weight: 600;
                    margin: 20px 0;
                }}
                .button:hover {{
                    background-color: #0056b3;
                }}
                .footer {{
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e0e0e0;
                    font-size: 14px;
                    color: #666;
                    text-align: center;
                }}
                .link {{
                    color: #007bff;
                    word-break: break-all;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Verify Your Email Address</h2>
                </div>

                <p>Hi {safe_name},</p>

                <p>Thank you for signing up! Please verify your email address to complete
                   your registration.</p>

                <div style="text-align: center;">
                    <a href="{safe_url}" class="button">Verify Email Address</a>
                </div>

                <p>Or copy and paste this link into your browser:</p>
                <p class="link">{safe_url}</p>

                <p><strong>This link will expire in {html.escape(expires_label)}.</strong></p>

                <p>If you didn't create an account, you can safely ignore this email.</p>

                <div class="footer">
                    <p>Best regards,<br>The Aipolabs Team</p>
                    <p>© 2025 Aipolabs. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """

        return await self.send_email(recipient, subject, body_text, body_html)
