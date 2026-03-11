"""
Password complexity validator.
Returns a list of human-readable error messages (empty = valid).
"""
import re
from typing import List, Optional

SPECIAL_CHARS = r"[!@#$%^&*()\-_=+\[\]{}|;:,.<>?/\\~`'\"]"
MIN_LENGTH = 12


def validate_password_strength(
    password: str, *, email: Optional[str] = None
) -> List[str]:
    """Validate password complexity. Returns list of error messages."""
    errors: List[str] = []

    if len(password) < MIN_LENGTH:
        errors.append(f"La contraseña debe tener al menos {MIN_LENGTH} caracteres.")

    if not re.search(r"[A-Z]", password):
        errors.append("La contraseña debe contener al menos una letra mayúscula.")

    if not re.search(r"\d", password):
        errors.append("La contraseña debe contener al menos un dígito.")

    if not re.search(SPECIAL_CHARS, password):
        errors.append(
            "La contraseña debe contener al menos un carácter especial "
            "(!@#$%^&*()_+-=[]{}|;:,.<>?)."
        )

    if email and password == email:
        errors.append("La contraseña no puede ser igual al email.")

    return errors
