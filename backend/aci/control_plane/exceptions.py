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
