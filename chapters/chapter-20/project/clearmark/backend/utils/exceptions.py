"""
Custom exceptions
"""
from fastapi import HTTPException, status


class ClearMarkException(HTTPException):
    """Base exception for ClearMark"""
    pass


class AuthenticationError(ClearMarkException):
    """Authentication error"""
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail
        )


class NotFoundError(ClearMarkException):
    """Resource not found error"""
    def __init__(self, resource: str = "Resource"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found"
        )


class PermissionDeniedError(ClearMarkException):
    """Permission denied error"""
    def __init__(self, detail: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class ValidationError(ClearMarkException):
    """Validation error"""
    def __init__(self, detail: str = "Validation failed"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

