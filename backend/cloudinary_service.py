import os
import requests
import cloudinary
import cloudinary.uploader
import cloudinary.utils
from datetime import datetime, timezone, timedelta

cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True,
)


def upload_pdf(data: bytes, public_id: str) -> dict:
    result = cloudinary.uploader.upload(
        data, resource_type="raw", type="authenticated",
        public_id=public_id, overwrite=False,
    )
    return {"public_id": result["public_id"], "resource_type": result["resource_type"],
            "bytes": result.get("bytes"), "format": result.get("format")}


def delete_asset(public_id: str, resource_type: str = "raw") -> None:
    cloudinary.uploader.destroy(public_id, resource_type=resource_type, type="authenticated", invalidate=True)


def signed_preview_url(public_id: str, resource_type: str = "raw", minutes: int = 10) -> str:
    expires_at = int((datetime.now(timezone.utc) + timedelta(minutes=minutes)).timestamp())
    url, _ = cloudinary.utils.cloudinary_url(
        public_id, resource_type=resource_type, type="authenticated",
        sign_url=True, expires_at=expires_at,
    )
    return url


def download_asset_bytes(public_id: str, resource_type: str = "raw") -> bytes:
    url = signed_preview_url(public_id, resource_type, minutes=5)
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content
