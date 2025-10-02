from fastapi import status


class SubscriptionException(Exception):  # noqa: N818
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


class OrganizationNotFound(SubscriptionException):
    """
    Exception raised when an organization is not found
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Organization not found",
            message=message,
            error_code=status.HTTP_404_NOT_FOUND,
        )


class OrganizationSubscriptionNotFound(SubscriptionException):
    """
    Exception raised when an organization subscription is not found
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Organization subscription not found",
            message=message,
            error_code=status.HTTP_404_NOT_FOUND,
        )


class RequestedSubscriptionInvalid(SubscriptionException):
    """
    Exception raised when a requested subscription is invalid
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Requested subscription invalid",
            message=message,
            error_code=status.HTTP_400_BAD_REQUEST,
        )


class RequestedSubscriptionNotAvailable(SubscriptionException):
    """
    Exception raised when a subscription plan is not available for subscription
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Subscription plan not available for subscription",
            message=message,
            error_code=status.HTTP_404_NOT_FOUND,
        )


class StripeOperationError(SubscriptionException):
    """
    Exception raised when a stripe operation error occurs
    """

    def __init__(self, message: str | None = None):
        super().__init__(
            title="Stripe operation error",
            message=message,
            error_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
