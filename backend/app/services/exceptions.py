"""Custom exceptions for Nautobot GraphQL client."""


class NautobotClientError(Exception):
    """Base exception for Nautobot client errors."""

    def __init__(self, message: str, details: dict = None) -> None:
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(NautobotClientError):
    """Raised when authentication with Nautobot fails."""

    def __init__(
        self, message: str = "Authentication failed", details: dict = None
    ) -> None:
        super().__init__(message, details)


class ConnectionTimeoutError(NautobotClientError):
    """Raised when connection to Nautobot times out."""

    def __init__(
        self, message: str = "Connection timeout", details: dict = None
    ) -> None:
        super().__init__(message, details)


class InvalidSchemaError(NautobotClientError):
    """Raised when schema response is invalid or malformed."""

    def __init__(
        self, message: str = "Invalid schema response", details: dict = None
    ) -> None:
        super().__init__(message, details)


class GraphQLError(NautobotClientError):
    """Raised when GraphQL query returns errors."""

    def __init__(
        self,
        message: str = "GraphQL query error",
        errors: list = None,
        details: dict = None,
    ) -> None:
        self.errors = errors or []
        if details is None:
            details = {}
        details["graphql_errors"] = self.errors
        super().__init__(message, details)
