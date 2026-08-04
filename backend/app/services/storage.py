import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException
from ..config import settings

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def _configure():
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


def upload_image(file: UploadFile, folder: str = "products") -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type. Use JPEG, PNG, or WebP.")

    _configure()
    result = cloudinary.uploader.upload(
        file.file,
        folder=f"fab-ims/{folder}",
        resource_type="image",
        transformation=[{"width": 800, "height": 800, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
    )
    return result["secure_url"]
