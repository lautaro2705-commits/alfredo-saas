"""Tests for file upload magic byte validation."""
import pytest
from app.core.security.file_validator import validate_file_content


class TestFileValidator:
    """Server-side file content validation via magic bytes."""

    def test_valid_jpeg(self):
        content = b"\xff\xd8\xff\xe0" + b"\x00" * 100
        assert validate_file_content(content, "image/jpeg") is True

    def test_valid_png(self):
        content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        assert validate_file_content(content, "image/png") is True

    def test_valid_gif(self):
        content = b"GIF89a" + b"\x00" * 100
        assert validate_file_content(content, "image/gif") is True

    def test_valid_pdf(self):
        content = b"%PDF-1.4" + b"\x00" * 100
        assert validate_file_content(content, "application/pdf") is True

    def test_valid_webp(self):
        content = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBP" + b"\x00" * 100
        assert validate_file_content(content, "image/webp") is True

    def test_spoofed_jpeg(self):
        """Executable disguised as JPEG is rejected."""
        content = b"MZ" + b"\x00" * 100  # PE executable header
        assert validate_file_content(content, "image/jpeg") is False

    def test_spoofed_png(self):
        """Non-PNG bytes with PNG MIME type rejected."""
        content = b"\xff\xd8\xff" + b"\x00" * 100  # JPEG bytes, not PNG
        assert validate_file_content(content, "image/png") is False

    def test_unknown_mime_type_rejected(self):
        """Unsupported MIME types are rejected."""
        content = b"\x00" * 100
        assert validate_file_content(content, "application/x-executable") is False

    def test_empty_content_rejected(self):
        """Empty files are rejected."""
        assert validate_file_content(b"", "image/jpeg") is False

    def test_word_doc_accepted(self):
        """Word .docx (ZIP-based) passes validation."""
        content = b"PK\x03\x04" + b"\x00" * 100  # ZIP magic bytes
        assert validate_file_content(
            content,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ) is True

    def test_word_doc_old_format(self):
        """Word .doc (OLE2) passes validation."""
        content = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 100
        assert validate_file_content(content, "application/msword") is True
