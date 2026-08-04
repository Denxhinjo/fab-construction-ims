from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from ..dependencies import get_current_user
from ..models.user import User
from ..services.storage import upload_image

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

# Whitelisted so the folder can't be used to write outside the app's own
# Cloudinary namespace -- it's a display grouping, not a free-form path.
ALLOWED_FOLDERS = {"products", "work-processes"}


@router.post("/image")
def upload_image_endpoint(
    file: UploadFile = File(...),
    folder: str = Form("products"),
    _: User = Depends(get_current_user),
):
    """
    Single upload path for both clients (web and Android). Neither ever talks
    to Cloudinary directly or holds its credentials -- the backend is the
    only thing that knows the cloud name/API secret, and every upload is
    behind normal auth instead of an unsigned client-side preset.
    """
    if folder not in ALLOWED_FOLDERS:
        raise HTTPException(status_code=400, detail="Invalid upload folder")
    url = upload_image(file, folder=folder)
    return {"url": url}
