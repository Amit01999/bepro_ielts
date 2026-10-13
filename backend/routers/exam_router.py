import base64
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from database import db
from models import StartExamInput, SaveAnswersInput, ViolationInput, now_iso, new_id
from security import get_current_user
from entitlements import check_entitlement, consume_entitlement, get_settings
from scoring import score_objective_section, raw_to_band, overall_band
from ai_service import transcribe_audio

router = APIRouter(prefix="/api", tags=["exam"])

OBJECTIVE = ("listening", "reading")


def student_safe_exam(exam: dict) -> dict:
    e = dict(exam)
    secs = []
    for s in e.get("sections", []):
        s = dict(s)
        qs = []
        for q in s.get("questions", []):
            q = dict(q)
            q.pop("accepted_answers", None)
            q.pop("explanation", None)
            qs.append(q)
        s["questions"] = qs
        secs.append(s)
    e["sections"] = secs
    return e


def _usage_type(exam: dict) -> str:
    return "full_mock" if exam.get("kind") == "full" else "skill_mock"


# --------------------- Student exam listing ---------------------
@router.get("/student/exams")
async def student_exams(user: dict = Depends(get_current_user), kind: str = ""):
    q = {"status": "published"}
    if kind:
        q["kind"] = kind
    rows = await db.exams.find(q, {"_id": 0, "sections.questions.accepted_answers": 0,
                                   "sections.questions.explanation": 0}).sort("created_at", -1).to_list(200)
    out = []
    for e in rows:
        ent = await check_entitlement(user["id"], _usage_type(e))
        section_skills = list({s["skill"] for s in e.get("sections", [])})
        qcount = sum(len(s.get("questions", [])) for s in e.get("sections", []))
        out.append({
            "id": e["id"], "title": e["title"], "kind": e["kind"], "ielts_type": e["ielts_type"],
            "description": e.get("description"), "duration_minutes": e["duration_minutes"],
            "is_free": e.get("is_free"), "skills": section_skills, "question_count": qcount,
            "ai_evaluation": e.get("ai_evaluation"),
            "access": {"allowed": ent["allowed"], "reason": None if ent["allowed"] else ent["reason"],
                       "remaining": ent["remaining"], "unlimited": ent["unlimited"]},
        })
    return {"items": out}


@router.post("/exams/enter")
async def enter_by_code(payload: dict, user: dict = Depends(get_current_user)):
    code = (payload.get("exam_code") or "").strip().upper()
    assignment = await db.exam_assignments.find_one({"exam_code": code}, {"_id": 0})
    if not assignment:
        raise HTTPException(404, "No exam found with this Exam ID.")
    if assignment.get("access_pin") and assignment["access_pin"] != payload.get("access_pin"):
        raise HTTPException(403, "Incorrect access PIN.")
    now = now_iso()
    if assignment.get("start_time") and now < assignment["start_time"]:
        raise HTTPException(403, "This exam has not started yet.")
    if assignment.get("close_time") and now > assignment["close_time"]:
        raise HTTPException(403, "This exam is no longer available.")
    if assignment.get("batch_id") and assignment["batch_id"] not in user.get("batch_ids", []):
        raise HTTPException(403, "You are not assigned to this exam.")
    exam = await db.exams.find_one({"id": assignment["exam_id"], "status": "published"}, {"_id": 0})
    if not exam:
        raise HTTPException(404, "Exam not available.")
    attempts = await db.attempts.count_documents({"user_id": user["id"], "exam_code": code})
    if attempts >= assignment.get("attempt_limit", 1):
        raise HTTPException(403, "You have already used your allowed attempts for this exam.")
    return {"exam_id": exam["id"], "exam_code": code, "title": exam["title"],
            "instructions": exam.get("instructions"), "duration_minutes": exam["duration_minutes"]}


# --------------------------- Start ------------------------------
@router.post("/exams/{eid}/start")
async def start_exam(eid: str, payload: StartExamInput, user: dict = Depends(get_current_user)):
    exam = await db.exams.find_one({"id": eid, "status": "published"}, {"_id": 0})
    if not exam:
        raise HTTPException(404, "Exam not available.")
    if not payload.agreed:
        raise HTTPException(400, "You must accept the exam rules to begin.")
    # resume active attempt if any
    active = await db.attempts.find_one({"user_id": user["id"], "exam_id": eid,
                                         "status": {"$in": ["IN_PROGRESS"]}}, {"_id": 0})
    if active:
        return {"attempt_id": active["id"], "resumed": True}
    usage_type = _usage_type(exam)
    ent = await check_entitlement(user["id"], usage_type)
    if not ent["allowed"]:
        raise HTTPException(403, detail="You have used all your available mock tests on this plan. Upgrade your plan to continue.")
    await consume_entitlement(user["id"], usage_type)
    settings = await get_settings()
    anti = settings.get("anti_cheat", {"enabled": True, "warnings": 1})
    duration = exam.get("duration_minutes", 60)
    started = datetime.now(timezone.utc)
    attempt = {
        "id": new_id(), "user_id": user["id"], "exam_id": eid,
        "exam_code": payload.exam_code, "exam_snapshot": exam, "exam_version": exam.get("version", 1),
        "status": "IN_PROGRESS", "started_at": started.isoformat(),
        "server_expires_at": (started + timedelta(minutes=duration)).isoformat(),
        "submitted_at": None, "answers": {}, "section_index": 0, "violations": [],
        "anti_cheat": anti, "autosave_at": started.isoformat(),
    }
    await db.attempts.insert_one(attempt)
    return {"attempt_id": attempt["id"], "resumed": False}


@router.get("/attempts/{aid}")
async def get_attempt(aid: str, user: dict = Depends(get_current_user)):
    att = await db.attempts.find_one({"id": aid, "user_id": user["id"]}, {"_id": 0})
    if not att:
        raise HTTPException(404, "Attempt not found.")
    remaining = 0
    if att["status"] == "IN_PROGRESS":
        expires = datetime.fromisoformat(att["server_expires_at"])
        remaining = int((expires - datetime.now(timezone.utc)).total_seconds())
        if remaining <= 0:
            result = await _finalize_attempt(att, auto=True)
            return {"attempt": {**att, "status": "AUTO_SUBMITTED"}, "remaining_seconds": 0,
                    "exam": student_safe_exam(att["exam_snapshot"]), "result_id": result["id"], "expired": True}
    return {"attempt": att, "remaining_seconds": max(0, remaining),
            "exam": student_safe_exam(att["exam_snapshot"]),
            "result_id": None}


@router.post("/attempts/{aid}/answers")
async def save_answers(aid: str, payload: SaveAnswersInput, user: dict = Depends(get_current_user)):
    att = await db.attempts.find_one({"id": aid, "user_id": user["id"]}, {"_id": 0})
    if not att:
        raise HTTPException(404, "Attempt not found.")
    if att["status"] != "IN_PROGRESS":
        raise HTTPException(409, "This attempt is no longer active.")
    upd = {f"answers.{k}": v for k, v in payload.answers.items()}
    upd["autosave_at"] = now_iso()
    if payload.section_index is not None:
        upd["section_index"] = payload.section_index
    await db.attempts.update_one({"id": aid}, {"$set": upd})
    return {"ok": True, "saved_at": upd["autosave_at"]}


@router.post("/attempts/{aid}/violation")
async def record_violation(aid: str, payload: ViolationInput, user: dict = Depends(get_current_user)):
    att = await db.attempts.find_one({"id": aid, "user_id": user["id"]}, {"_id": 0})
    if not att or att["status"] != "IN_PROGRESS":
        return {"ok": True, "action": "none"}
    v = {"type": payload.type, "question_number": payload.question_number, "timestamp": now_iso()}
    await db.attempts.update_one({"id": aid}, {"$push": {"violations": v}})
    violations = att.get("violations", []) + [v]
    warnings = att.get("anti_cheat", {}).get("warnings", 1)
    enabled = att.get("anti_cheat", {}).get("enabled", True)
    if enabled and len(violations) > warnings:
        result = await _finalize_attempt(att, auto=True, invalidated=True)
        return {"ok": True, "action": "auto_submit", "result_id": result["id"],
                "message": "Your exam has been automatically submitted due to repeated violations."}
    remaining_warnings = max(0, warnings - len(violations) + 1) if enabled else 0
    return {"ok": True, "action": "warn", "violation_count": len(violations),
            "message": "Leaving the exam window is not allowed. Another violation may automatically submit your exam."}


@router.post("/attempts/{aid}/submit")
async def submit_attempt(aid: str, user: dict = Depends(get_current_user)):
    att = await db.attempts.find_one({"id": aid, "user_id": user["id"]}, {"_id": 0})
    if not att:
        raise HTTPException(404, "Attempt not found.")
    if att["status"] != "IN_PROGRESS":
        existing = await db.results.find_one({"attempt_id": aid}, {"_id": 0})
        if existing:
            return {"result_id": existing["id"], "already": True}
        raise HTTPException(409, "This attempt has already been submitted.")
    result = await _finalize_attempt(att, auto=False)
    return {"result_id": result["id"], "already": False}


async def recompute_overall(result_id: str):
    r = await db.results.find_one({"id": result_id}, {"_id": 0})
    if not r:
        return
    bands = [v.get("band") for v in r.get("skills", {}).values() if v.get("band") is not None]
    ov = overall_band(bands) if bands else None
    statuses = [v.get("status") for v in r.get("skills", {}).values()]
    pending = any(s in ("QUEUED", "PROCESSING") for s in statuses)
    failed = any(s == "FAILED" for s in statuses)
    new_status = "EVALUATING" if pending else ("PARTIAL" if failed else "COMPLETED")
    await db.results.update_one({"id": result_id},
                                {"$set": {"overall_band": ov, "status": new_status}})


async def _finalize_attempt(att: dict, auto: bool, invalidated: bool = False):
    # idempotency guard
    guard = await db.attempts.find_one_and_update(
        {"id": att["id"], "status": "IN_PROGRESS"},
        {"$set": {"status": "EVALUATING", "submitted_at": now_iso()}})
    if guard is None:
        existing = await db.results.find_one({"attempt_id": att["id"]}, {"_id": 0})
        if existing:
            return existing
    from routers.ai_router import create_and_run_writing_eval  # local import to avoid cycle
    exam = att["exam_snapshot"]
    att_full = await db.attempts.find_one({"id": att["id"]}, {"_id": 0})
    answers = att_full.get("answers", {})
    speaking_recs = att_full.get("speaking_recordings", [])
    skills = {}
    has_pending = False
    for sec in exam.get("sections", []):
        skill = sec["skill"]
        if skill in OBJECTIVE:
            correct, total, details = score_objective_section(sec.get("questions", []), answers)
            prev = skills.get(skill, {"raw": 0, "total": 0, "details": []})
            correct += prev["raw"]; total += prev["total"]; details = prev["details"] + details
            scaled = round(correct / total * 40) if total else 0
            band = raw_to_band(scaled, skill, exam.get("ielts_type", "academic"))
            skills[skill] = {"raw": correct, "total": total, "scaled_40": scaled, "band": band,
                             "details": details, "status": "COMPLETED"}
    result = {
        "id": new_id(), "attempt_id": att["id"], "user_id": att["user_id"],
        "exam_id": att["exam_id"], "exam_title": exam.get("title"),
        "ielts_type": exam.get("ielts_type"), "kind": exam.get("kind"),
        "exam_version": att.get("exam_version"), "skills": skills,
        "overall_band": None, "status": "COMPLETED",
        "total_time_seconds": _elapsed(att), "answers_snapshot": answers,
        "violations": att.get("violations", []), "result_visible": True,
        "created_at": now_iso(),
    }
    # writing / speaking sections -> AI eval
    for sec in exam.get("sections", []):
        if sec["skill"] == "writing":
            tasks = []
            for q in sec.get("questions", []):
                text = answers.get(str(q["number"]), "")
                tasks.append({"number": q["number"], "prompt": q["prompt"], "response": text,
                              "task_type": "Task 1" if q["number"] == 1 else "Task 2"})
            result["skills"]["writing"] = {"band": None, "status": "QUEUED", "tasks": tasks, "evaluation_ids": []}
            has_pending = True
        if sec["skill"] == "speaking":
            result["skills"]["speaking"] = {"band": None, "status": "QUEUED", "evaluation_id": None,
                "recordings": [{"question_number": r.get("question_number"), "part": r.get("part")} for r in speaking_recs]}
            has_pending = True
    bands = [v.get("band") for v in skills.values() if v.get("band") is not None]
    result["overall_band"] = None if has_pending else (overall_band(bands) if bands else None)
    if has_pending:
        result["status"] = "EVALUATING"
    if invalidated:
        result["invalidated"] = True
    await db.results.insert_one(result)
    final_status = "AUTO_SUBMITTED" if auto else "SUBMITTED"
    if invalidated:
        final_status = "INVALIDATED"
    await db.attempts.update_one({"id": att["id"]}, {"$set": {"status": final_status, "result_id": result["id"]}})
    # kick off writing eval
    for sec in exam.get("sections", []):
        if sec["skill"] == "writing":
            for q in sec.get("questions", []):
                text = answers.get(str(q["number"]), "")
                if text.strip():
                    await create_and_run_writing_eval(att["user_id"], att["id"], result["id"], q, text)
    if any(sec["skill"] == "speaking" for sec in exam.get("sections", [])):
        from routers.ai_router import create_and_run_speaking_eval_attempt
        transcript = "\n".join(f"[Part {r.get('part')}] {r.get('transcript','')}" for r in speaking_recs if r.get("transcript"))
        await create_and_run_speaking_eval_attempt(att["user_id"], att["id"], result["id"], transcript or "(no speech recorded)")
    await db.notifications.insert_one({
        "id": new_id(), "user_id": att["user_id"], "title": "Result available",
        "body": f"Your result for {exam.get('title')} is ready.", "kind": "success",
        "read": False, "created_at": now_iso()})
    result.pop("_id", None)
    return result


def _elapsed(att: dict) -> int:
    try:
        start = datetime.fromisoformat(att["started_at"])
        return int((datetime.now(timezone.utc) - start).total_seconds())
    except Exception:
        return 0


@router.post("/attempts/{aid}/speaking/upload")
async def speaking_upload(aid: str, audio: UploadFile = File(...), question_number: int = Form(...),
                          part: str = Form("1"), user: dict = Depends(get_current_user)):
    att = await db.attempts.find_one({"id": aid, "user_id": user["id"]}, {"_id": 0})
    if not att:
        raise HTTPException(404, "Attempt not found.")
    if att["status"] != "IN_PROGRESS":
        raise HTTPException(409, "This attempt is no longer active.")
    data = await audio.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Recording too large (max 25MB).")
    audio_id = new_id()
    await db.speaking_audio.insert_one({"id": audio_id, "attempt_id": aid, "question_number": question_number,
                                        "mime": audio.content_type or "audio/webm",
                                        "b64": base64.b64encode(data).decode()})
    transcript = ""
    tstatus = "uploaded"
    try:
        fn = audio.filename or "rec.webm"
        suffix = "." + (fn.rsplit(".", 1)[-1] if "." in fn else "webm")
        transcript = await transcribe_audio(data, suffix=suffix)
    except Exception:
        transcript = ""
        tstatus = "transcribe_failed"
    rec = {"question_number": question_number, "part": part, "transcript": transcript,
           "audio_id": audio_id, "status": tstatus, "created_at": now_iso()}
    await db.attempts.update_one({"id": aid}, {"$pull": {"speaking_recordings": {"question_number": question_number}}})
    await db.attempts.update_one({"id": aid}, {"$push": {"speaking_recordings": rec}})
    return {"ok": True, "transcript": transcript}


@router.get("/attempts/{aid}/speaking/audio/{qnum}")
async def get_speaking_audio(aid: str, qnum: int, user: dict = Depends(get_current_user)):
    att = await db.attempts.find_one({"id": aid}, {"_id": 0, "user_id": 1})
    if not att:
        raise HTTPException(404, "Not found.")
    if att["user_id"] != user["id"] and user.get("role") == "student":
        raise HTTPException(403, "Not allowed.")
    doc = await db.speaking_audio.find_one({"attempt_id": aid, "question_number": qnum}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Recording not found.")
    return {"mime": doc["mime"], "b64": doc["b64"]}
