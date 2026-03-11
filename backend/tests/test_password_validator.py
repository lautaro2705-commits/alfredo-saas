"""Tests for password complexity validation."""
import pytest
from app.core.security.password_validator import validate_password_strength


class TestPasswordValidator:
    """Passwords must meet complexity requirements."""

    def test_valid_password(self):
        errors = validate_password_strength("MyStr0ng!Pass")
        assert errors == []

    def test_too_short(self):
        errors = validate_password_strength("Ab1!")
        assert any("12 caracteres" in e for e in errors)

    def test_no_uppercase(self):
        errors = validate_password_strength("mystr0ng!pass")
        assert any("mayúscula" in e for e in errors)

    def test_no_digit(self):
        errors = validate_password_strength("MyStrong!Pass")
        assert any("dígito" in e for e in errors)

    def test_no_special_char(self):
        errors = validate_password_strength("MyStr0ngPassw")
        assert any("especial" in e for e in errors)

    def test_equals_email(self):
        errors = validate_password_strength("MyStr0ng!Pass", email="MyStr0ng!Pass")
        assert any("email" in e for e in errors)

    def test_multiple_errors(self):
        errors = validate_password_strength("short")
        assert len(errors) >= 3  # too short + no uppercase + no digit + no special

    def test_exactly_12_chars_valid(self):
        errors = validate_password_strength("Abcdefghij1!")
        assert errors == []

    def test_all_special_chars_accepted(self):
        for char in "!@#$%^&*()_+-=[]{}|;:,.<>?":
            errors = validate_password_strength(f"MyStr0ngPass{char}")
            assert not any("especial" in e for e in errors)


class TestPasswordValidatorIntegration:
    """Onboarding rejects weak passwords."""

    @pytest.mark.asyncio
    async def test_onboarding_rejects_weak_password(self, client):
        resp = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": "Test Agency",
            "email_contacto": "contact@test.com",
            "admin_nombre": "Test",
            "admin_apellido": "User",
            "admin_email": "weak@test.com",
            "admin_password": "short",
        })
        assert resp.status_code == 422
        assert "12 char" in resp.text or "12 caracteres" in resp.text

    @pytest.mark.asyncio
    async def test_onboarding_accepts_strong_password(self, client):
        resp = await client.post("/api/v1/auth/onboarding", json={
            "nombre_agencia": "Str0ng Agency",
            "email_contacto": "contact@strong.com",
            "admin_nombre": "Test",
            "admin_apellido": "User",
            "admin_email": f"strong-pwd-test@test.com",
            "admin_password": "MyStr0ng!Password",
        })
        # 200 = created successfully (might be 409 if email exists, but not 422)
        assert resp.status_code != 422
