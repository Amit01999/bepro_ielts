import asyncio
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import db
from models import ExamInput, now_iso, new_id
from security import require_permission
from routers.admin_router import audit
from cloudinary_service import upload_pdf, delete_asset, signed_preview_url, download_asset_bytes
from ai_service import extract_exam_structure

router = APIRouter(prefix="/api/admin/source-documents", tags=["source-documents"])

MAX_PDF_BYTES = 20 * 1024 * 1024


def _public(doc: dict) -> dict:
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


@router.get("")
async def list_source_documents(user: dict = Depends(require_permission("exams.create"))):
    rows = await db.source_documents.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": rows}


@router.post("")
async def upload_source_document(file: UploadFile = File(...), user: dict = Depends(require_permission("exams.create"))):
    data = await file.read()
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(400, "File too large (max 20MB).")
    if not data[:5] == b"%PDF-":
        raise HTTPException(400, "File is not a valid PDF.")
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only .pdf files are accepted.")

    doc_id = new_id()
    try:
        asset = upload_pdf(data, public_id=f"source-documents/{doc_id}")
    except Exception as e:
        raise HTTPException(502, f"Upload to storage failed: {e}")

    doc = {
        "id": doc_id, "filename": file.filename, "size_bytes": len(data), "mime_type": "application/pdf",
        "cloudinary_public_id": asset["public_id"], "cloudinary_resource_type": asset["resource_type"],
        "status": "uploaded", "extraction_warnings": [], "exam_id": None,
        "uploader_id": user["id"], "created_at": now_iso(),
    }
    try:
        await db.source_documents.insert_one(doc)
    except Exception:
        delete_asset(asset["public_id"], asset["resource_type"])
        raise HTTPException(500, "Failed to save upload record.")

    await audit(user, "source_document.upload", "source_document", doc_id, file.filename)
    return _public(doc)


@router.get("/{doc_id}/preview-url")
async def preview_url(doc_id: str, user: dict = Depends(require_permission("exams.create"))):
    doc = await db.source_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found.")
    url = signed_preview_url(doc["cloudinary_public_id"], doc["cloudinary_resource_type"])
    return {"url": url}


@router.delete("/{doc_id}")
async def delete_source_document(doc_id: str, user: dict = Depends(require_permission("exams.create"))):
    doc = await db.source_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found.")
    delete_asset(doc["cloudinary_public_id"], doc["cloudinary_resource_type"])
    await db.source_documents.delete_one({"id": doc_id})
    await audit(user, "source_document.delete", "source_document", doc_id, doc["filename"])
    return {"ok": True}


@router.post("/{doc_id}/extract")
async def extract_source_document(doc_id: str, user: dict = Depends(require_permission("exams.create"))):
    doc = await db.source_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found.")
    if doc["status"] == "extracting":
        raise HTTPException(409, "Extraction already in progress.")
    await db.source_documents.update_one({"id": doc_id}, {"$set": {"status": "extracting"}})
    asyncio.create_task(_run_extraction(doc, user))
    return {"ok": True, "status": "extracting"}


def _normalize_extracted(data: dict) -> dict:
    """Fill in the fields the extraction prompt deliberately omits (per-question `skill`,
    per-section `order`) so the result constructs cleanly through the existing ExamInput model —
    the same model/defaulting path manual exam creation already goes through."""
    sections = []
    for i, sec in enumerate(data.get("sections") or []):
        sec = dict(sec)
        sec["order"] = i
        questions = []
        for q in sec.get("questions") or []:
            q = dict(q)
            q.setdefault("skill", sec.get("skill"))
            q.setdefault("ielts_type", data.get("ielts_type", "academic"))
            questions.append(q)
        sec["questions"] = questions
        sections.append(sec)
    data = dict(data)
    data["sections"] = sections
    data.pop("warnings", None)
    return data


async def _run_extraction(doc: dict, user: dict):
    doc_id = doc["id"]
    try:
        pdf_bytes = download_asset_bytes(doc["cloudinary_public_id"], doc["cloudinary_resource_type"])
        result = await extract_exam_structure(pdf_bytes, doc["filename"])
        raw = result["raw"]
        warnings = list(raw.get("warnings") or [])
        normalized = _normalize_extracted(raw)
        exam_fields = ExamInput(
            title=normalized.get("title") or doc["filename"],
            ielts_type=normalized.get("ielts_type", "academic"),
            kind=normalized.get("kind", "full"),
            duration_minutes=normalized.get("duration_minutes", 60),
            instructions=normalized.get("instructions", ""),
            sections=normalized.get("sections", []),
            status="draft",
            source_document_id=doc_id,
        ).model_dump()
        exam_fields.update({"id": new_id(), "version": 1, "created_at": now_iso(), "author_id": user["id"]})
        await db.exams.insert_one(exam_fields)
        await db.source_documents.update_one({"id": doc_id}, {"$set": {
            "status": "extracted", "extraction_warnings": warnings, "exam_id": exam_fields["id"]}})
    except Exception as e:
        await db.source_documents.update_one({"id": doc_id}, {"$set": {
            "status": "extraction_failed", "extraction_warnings": [f"Extraction failed: {e}"]}})
