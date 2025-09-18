from fastapi import status


class ControlPlaneException(Exception):  # noqa: N818
    """
    Base class for all Control Plane exceptions with consistent structure.

    Attributes:
        title (str): error title.
        message (str): an optional detailed error message.
        error_code (int): HTTP status code to identify the error type.
    """

    def __init__(
        self,
        title: str,
        message: str | None = None,
        error_code: int = status.HTTP_400_BAD_REQUEST,
    ):
        super().__init__(title, message, error_code)
        self.title = title
        self.message = message
        self.error_code = error_code

    def __str__(self) -> str:
        """
        String representation that combines title and message (if available)
        """
        if self.message:
            return f"{self.title}: {self.message}"
        return self.title


class OAuth2Error(ControlPlaneException):
    """
    Exception raised when an OAuth2 error occurs
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="OAuth2 error",
            message=message,
            error_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class NoImplementationFound(ControlPlaneException):
    """
    Exception raised when a feature or function is not implemented
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="No implementation found",
            message=message,
            error_code=status.HTTP_501_NOT_IMPLEMENTED,
        )


class MCPServerConfigurationNotFound(ControlPlaneException):
    """
    Exception raised when an mcp server configuration is not found
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="MCP server configuration not found",
            message=message,
            error_code=status.HTTP_404_NOT_FOUND,
        )


class NotPermittedError(ControlPlaneException):
    """
    Exception raised when a user is not permitted to act as the requested organization and role.
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Not permitted",
            message=message,
            error_code=status.HTTP_403_FORBIDDEN,
        )


class UnexpectedError(ControlPlaneException):
    """
    Exception raised when an unexpected error occurs
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Unexpected error",
            message=message,
            error_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class AccountDeletionInProgressError(ControlPlaneException):
    """
    Exception raised when an account is under deletion process.
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Account deletion in progress",
            message=message,
            error_code=status.HTTP_409_CONFLICT,
        )


class EmailAlreadyExistsError(ControlPlaneException):
    """
    Exception raised when an email is already associated with an existing account.
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Email already exists",
            message=message,
            error_code=status.HTTP_400_BAD_REQUEST,
        )


class ThirdPartyIdentityExistsError(ControlPlaneException):
    """
    Exception raised when an email is already registered with a third-party identity provider.
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Third-party identity exists",
            message=message,
            error_code=status.HTTP_409_CONFLICT,
        )


class EmailSendError(ControlPlaneException):
    def __init__(self, message: str | None = None):
        super().__init__(
            title="Email send failed",
            message=message,
            error_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class InvalidEmailVerificationTokenError(ControlPlaneException):
    """Email verification token is invalid or malformed."""

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Invalid or expired email verification token",
            message=message,
            error_code=status.HTTP_400_BAD_REQUEST,
        )


class InvalidEmailVerificationTokenTypeError(ControlPlaneException):
    """Email verification token type doesn't match expected type."""

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Invalid email verification token type",
            message=message,
            error_code=status.HTTP_400_BAD_REQUEST,
        )


class EmailVerificationTokenNotFoundError(ControlPlaneException):
    """Email verification token is missing or already used."""

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Email verification token not found or already used",
            message=message,
            error_code=status.HTTP_404_NOT_FOUND,
        )


class EmailVerificationTokenExpiredError(ControlPlaneException):
    """Email verification token has expired."""

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Email verification token expired",
            message=message,
            error_code=status.HTTP_400_BAD_REQUEST,
        )


class EmailVerificationTokenMismatchError(ControlPlaneException):
    """Email verification token does not match the user."""

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Email verification token mismatch",
            message=message,
            error_code=status.HTTP_400_BAD_REQUEST,
        )


class UserNotFoundError(ControlPlaneException):
    """
    Exception raised when user is not found.
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="User not found",
            message=message,
            error_code=status.HTTP_404_NOT_FOUND,
        )
