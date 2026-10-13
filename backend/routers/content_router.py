import re
from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import (ExamInput, PracticeInput, ExamAssignmentInput, Question, now_iso, new_id)
from security import get_current_user, require_permission, require_staff
from routers.admin_router import audit

router = APIRouter(prefix="/api", tags=["content"])


def _validate_exam(exam: dict):
    errors = []
    if not exam.get("sections"):
        errors.append("Exam has no sections.")
    for sec in exam.get("sections", []):
        skill = sec.get("skill")
        if skill in ("listening", "reading"):
            if not sec.get("questions"):
                errors.append(f"{skill} section has no questions.")
            for q in sec.get("questions", []):
                if q.get("type") not in ("essay", "letter") and not q.get("accepted_answers"):
                    errors.append(f"{skill} Q{q.get('number')} missing accepted answers.")
        if skill == "listening" and not sec.get("audio_url"):
            errors.append("Listening section missing audio.")
        if skill == "reading" and not sec.get("passages"):
            errors.append("Reading section missing passage.")
    return errors


# ------------------------ Question Bank -------------------------
@router.get("/questions")
async def list_questions(user: dict = Depends(require_permission("questions.manage")),
                         skill: str = "", ielts_type: str = "", status: str = "", search: str = ""):
    q = {}
    if skill:
        q["skill"] = skill
    if ielts_type:
        q["ielts_type"] = ielts_type
    if status:
        q["status"] = status
    if search:
        q["prompt"] = {"$regex": re.escape(search), "$options": "i"}
    rows = await db.question_bank.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return {"items": rows}


@router.post("/questions")
async def create_question(payload: dict, user: dict = Depends(require_permission("questions.manage"))):
    q = Question(**{**payload, "number": payload.get("number", 1)}).model_dump()
    q["created_at"] = now_iso()
    q["author_id"] = user["id"]
    await db.question_bank.insert_one(q)
    q.pop("_id", None)
    return q


# --------------------------- Exams ------------------------------
@router.get("/exams")
async def list_exams(user: dict = Depends(require_staff), status: str = "", kind: str = ""):
    q = {}
    if status:
        q["status"] = status
    if kind:
        q["kind"] = kind
    rows = await db.exams.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": rows}


@router.post("/exams")
async def create_exam(payload: ExamInput, user: dict = Depends(require_permission("exams.create"))):
    doc = payload.model_dump()
    doc.update({"id": new_id(), "version": 1, "created_at": now_iso(), "author_id": user["id"]})
    await db.exams.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "exam.create", "exam", doc["id"], payload.title)
    return doc


@router.get("/exams/{eid}")
async def get_exam(eid: str, user: dict = Depends(require_staff)):
    e = await db.exams.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Exam not found")
    return e


@router.put("/exams/{eid}")
async def update_exam(eid: str, payload: ExamInput, user: dict = Depends(require_permission("exams.create"))):
    existing = await db.exams.find_one({"id": eid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Exam not found")
    doc = payload.model_dump()
    doc["version"] = existing.get("version", 1) + 1
    await db.exams.update_one({"id": eid}, {"$set": doc})
    await audit(user, "exam.update", "exam", eid, payload.title)
    return {"ok": True}


@router.post("/exams/{eid}/validate")
async def validate_exam(eid: str, user: dict = Depends(require_permission("exams.create"))):
    e = await db.exams.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Exam not found")
    return {"errors": _validate_exam(e)}


@router.post("/exams/{eid}/publish")
async def publish_exam(eid: str, user: dict = Depends(require_permission("exams.publish"))):
    e = await db.exams.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Exam not found")
    errors = _validate_exam(e)
    if errors:
        raise HTTPException(400, detail="Cannot publish: " + "; ".join(errors))
    await db.exams.update_one({"id": eid}, {"$set": {"status": "published"}})
    await audit(user, "exam.publish", "exam", eid, e["title"])
    return {"ok": True}


@router.delete("/exams/{eid}")
async def archive_exam(eid: str, user: dict = Depends(require_permission("exams.create"))):
    e = await db.exams.find_one({"id": eid}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Exam not found")
    await db.exams.update_one({"id": eid}, {"$set": {"status": "archived"}})
    await audit(user, "exam.archive", "exam", eid, e["title"])
    return {"ok": True}


# ----------------------- Exam Assignments (Exam ID) --------------
@router.get("/exam-assignments")
async def list_assignments(user: dict = Depends(require_staff)):
    rows = await db.exam_assignments.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": rows}


@router.post("/exam-assignments")
async def create_assignment(payload: ExamAssignmentInput, user: dict = Depends(require_permission("exams.publish"))):
    if await db.exam_assignments.find_one({"exam_code": payload.exam_code}):
        raise HTTPException(400, "Exam ID already exists.")
    doc = payload.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.exam_assignments.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "assignment.create", "exam_assignment", doc["id"], payload.exam_code)
    return doc


# -------------------------- Practice ----------------------------
@router.get("/practice")
async def list_practice_admin(user: dict = Depends(require_permission("practice.manage")), skill: str = ""):
    q = {}
    if skill:
        q["skill"] = skill
    rows = await db.practice_sets.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": rows}


@router.post("/practice")
async def create_practice(payload: PracticeInput, user: dict = Depends(require_permission("practice.manage"))):
    doc = payload.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso(), "author_id": user["id"]})
    await db.practice_sets.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "practice.create", "practice", doc["id"], payload.title)
    return doc


@router.put("/practice/{pid}")
async def update_practice(pid: str, payload: PracticeInput, user: dict = Depends(require_permission("practice.manage"))):
    await db.practice_sets.update_one({"id": pid}, {"$set": payload.model_dump()})
    return {"ok": True}
