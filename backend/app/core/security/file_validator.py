"""
File content validator via magic bytes.
Verifies that file content matches the declared MIME type.
"""
from typing import Dict, List

# Magic byte signatures for allowed file types
MAGIC_BYTES: Dict[str, List[bytes]] = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],  # + check for WEBP at offset 8
    "application/pdf": [b"%PDF"],
    # Word .docx is ZIP-based
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        b"PK\x03\x04",
    ],
    # Word .doc is OLE2
    "application/msword": [
        b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",
    ],
}


def validate_file_content(content: bytes, declared_mime: str) -> bool:
    """Check if file content matches the declared MIME type.

    Returns True if valid, False if spoofed or unsupported.
    """
    if not content:
        return False

    signatures = MAGIC_BYTES.get(declared_mime)
    if signatures is None:
        return False  # Unsupported MIME type

    for sig in signatures:
        if content[: len(sig)] == sig:
            # Extra check for WebP: bytes 8-12 must be "WEBP"
            if declared_mime == "image/webp":
                if len(content) >= 12 and content[8:12] == b"WEBP":
                    return True
                continue
            return True

    return False
