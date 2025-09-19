class ACICommonError(Exception):
    def __init__(
        self,
        title: str,
        message: str | None = None,
    ):
        super().__init__(title, message)
        self.title = title
        self.message = message

    def __str__(self) -> str:
        """
        String representation that combines title and message (if available)
        """
        if self.message:
            return f"{self.title}: {self.message}"
        return self.title


class OAuth2ManagerError(ACICommonError):
    """
    Exception raised when an OAuth2 manager error occurs
    """

    def __init__(self, message: str | None = None):
        super().__init__(title="OAuth2 manager error", message=message)


class AuthCredentialsManagerError(ACICommonError):
    """
    Exception raised when an auth credentials manager error occurs
    """

    def __init__(self, message: str | None = None):
        super().__init__(title="Auth credentials manager error", message=message)


class OAuth2ClientRegistrationError(ACICommonError):
    """
    Exception raised when an OAuth registration error occurs
    """

    def __init__(self, message: str | None = None):
        super().__init__(title="OAuth registration error", message=message)


class OAuth2MetadataDiscoveryError(ACICommonError):
    """
    Exception raised when an OAuth2 discovery error occurs
    """

    def __init__(self, message: str | None = None):
        super().__init__(title="OAuth2 discovery error", message=message)
