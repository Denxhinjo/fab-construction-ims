import cloudinary
import cloudinary.uploader
from fastapi import UploadFile, HTTPException

# Cloudinary SDK auto-reads CLOUDINARY_URL environment variable
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


def upload_image(file: UploadFile) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type. Use JPEG, PNG, or WebP.")

    result = cloudinary.uploader.upload(
        file.file,
        folder="fab-ims/products",
        resource_type="image",
        transformation=[{"width": 800, "height": 800, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
    )
    return result["secure_url"]
