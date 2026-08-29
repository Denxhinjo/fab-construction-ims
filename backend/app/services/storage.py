import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
from ..config import settings

# Magic bytes for each allowed image format.
# We read the actual file bytes instead of trusting the client-supplied
# Content-Type header, which anyone can forge.
_MAGIC: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "JPEG"),
    (b"\x89PNG\r\n\x1a\n", "PNG"),
    # WebP: "RIFF" at 0 and "WEBP" at 8
    (b"RIFF", "WebP"),
]
_PEEK = 12  # bytes needed to detect all formats above


def _detect_image_type(header: bytes) -> str | None:
    """Return the image format name if `header` matches a known magic sequence, else None."""
    for magic, fmt in _MAGIC:
        if fmt == "WebP":
            if header[:4] == b"RIFF" and header[8:12] == b"WEBP":
                return fmt
        elif header[:len(magic)] == magic:
            return fmt
    return None


def _configure():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_image(file: UploadFile, folder: str = "products") -> str:
    # Read the first bytes to check magic signature, then seek back so
    # Cloudinary receives the complete file.
    header = file.file.read(_PEEK)
    file.file.seek(0)

    if _detect_image_type(header) is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid image file. Only JPEG, PNG, and WebP are accepted.",
        )

    _configure()
    result = cloudinary.uploader.upload(
        file.file,
        folder=f"fab-ims/{folder}",
        resource_type="image",
        transformation=[{"width": 800, "height": 800, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
    )
    return result["secure_url"]
