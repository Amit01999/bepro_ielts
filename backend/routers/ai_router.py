import asyncio
import base64
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from database import db
from models import TeacherReviewInput, now_iso, new_id
from security import get_current_user, require_permission
from ai_service import (evaluate_writing, evaluate_speaking, transcribe_audio,
                        WRITING_RUBRIC_VERSION, GEMINI_MODEL)
from scoring import overall_band

router = APIRouter(prefix="/api/ai", tags=["ai"])


async def _recompute_result_overall(result_id: str):
    r = await db.results.find_one({"id": result_id}, {"_id": 0})
    if not r:
        return
    bands = [v.get("band") for v in r.get("skills", {}).values() if v.get("band") is not None]
    statuses = [v.get("status") for v in r.get("skills", {}).values()]
    pending = any(s in ("QUEUED", "PROCESSING") for s in statuses)
    failed = any(s == "FAILED" for s in statuses)
    new_status = "EVALUATING" if pending else ("PARTIAL" if failed else "COMPLETED")
    await db.results.update_one({"id": result_id},
                                {"$set": {"overall_band": overall_band(bands) if bands else None,
                                          "status": new_status}})


async def create_and_run_writing_eval(user_id, attempt_id, result_id, question, response_text):
    ev_id = new_id()
    await db.ai_evaluations.insert_one({
        "id": ev_id, "type": "writing", "user_id": user_id, "attempt_id": attempt_id,
        "result_id": result_id, "question_number": question["number"], "prompt": question["prompt"],
        "response_text": response_text, "status": "QUEUED", "provider": "gemini",
        "model": GEMINI_MODEL, "rubric_version": WRITING_RUBRIC_VERSION, "prompt_version": "v1",
        "raw": None, "ai_score": None, "reviewer_score": None, "reviewed": False,
        "created_at": now_iso()})
    if result_id:
        await db.results.update_one({"id": result_id}, {"$push": {"skills.writing.evaluation_ids": ev_id}})
    asyncio.create_task(_run_writing(ev_id, question, response_text, result_id))
    return ev_id


async def _run_writing(ev_id, question, response_text, result_id):
    await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {"status": "PROCESSING"}})
    try:
        task_type = "Task 1" if question.get("number") == 1 else "Task 2"
        res = await evaluate_writing(question["prompt"], response_text, task_type)
        raw = res["raw"]
        await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {
            "status": "COMPLETED", "raw": raw, "ai_score": raw.get("overall_band"),
            "updated_at": now_iso()}})
        if result_id:
            await _update_writing_band(result_id)
    except Exception as e:
        await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {"status": "FAILED", "error": str(e)}})
        if result_id:
            await db.results.update_one({"id": result_id}, {"$set": {"skills.writing.status": "FAILED"}})
            await _recompute_result_overall(result_id)


async def _update_writing_band(result_id):
    r = await db.results.find_one({"id": result_id}, {"_id": 0})
    ev_ids = r.get("skills", {}).get("writing", {}).get("evaluation_ids", [])
    evals = await db.ai_evaluations.find({"id": {"$in": ev_ids}}, {"_id": 0}).to_list(10)
    done = [e for e in evals if e["status"] == "COMPLETED"]
    if len(done) < len(ev_ids):
        return
    # Task 2 double-weighted
    total_w = 0; acc = 0
    for e in done:
        w = 2 if e["question_number"] != 1 else 1
        acc += (e["ai_score"] or 0) * w; total_w += w
    band = round((acc / total_w) * 2) / 2 if total_w else None
    await db.results.update_one({"id": result_id}, {"$set": {
        "skills.writing.band": band, "skills.writing.ai_band": band, "skills.writing.status": "COMPLETED"}})
    await _recompute_result_overall(result_id)


@router.get("/evaluations/{ev_id}")
async def get_eval(ev_id: str, user: dict = Depends(get_current_user)):
    ev = await db.ai_evaluations.find_one({"id": ev_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Evaluation not found.")
    if ev["user_id"] != user["id"] and user.get("role") == "student":
        raise HTTPException(403, "Not allowed.")
    return ev


# ------------------ Practice writing (direct AI) ----------------
@router.post("/writing/evaluate")
async def evaluate_writing_direct(payload: dict, user: dict = Depends(get_current_user)):
    from entitlements import check_entitlement, consume_entitlement
    ent = await check_entitlement(user["id"], "ai")
    if not ent["allowed"]:
        raise HTTPException(403, "You have used all your AI evaluations. Upgrade your plan to continue.")
    await consume_entitlement(user["id"], "ai")
    q = {"number": payload.get("task_number", 2), "prompt": payload.get("prompt", "")}
    ev_id = await create_and_run_writing_eval(user["id"], None, None, q, payload.get("response", ""))
    return {"evaluation_id": ev_id, "status": "QUEUED"}


# ------------------------ Speaking ------------------------------
@router.post("/speaking/submit")
async def speaking_submit(audio: UploadFile = File(...), result_id: str = Form(None),
                          part: str = Form("1"), user: dict = Depends(get_current_user)):
    from entitlements import check_entitlement, consume_entitlement
    ent = await check_entitlement(user["id"], "ai")
    if not ent["allowed"]:
        raise HTTPException(403, "You have used all your AI evaluations. Upgrade your plan to continue.")
    data = await audio.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "Recording too large (max 25MB).")
    await consume_entitlement(user["id"], "ai")
    ev_id = new_id()
    await db.ai_evaluations.insert_one({
        "id": ev_id, "type": "speaking", "user_id": user["id"], "result_id": result_id,
        "part": part, "status": "QUEUED", "provider": "gemini", "model": GEMINI_MODEL,
        "rubric_version": "speaking-v1", "transcript": None, "raw": None, "ai_score": None,
        "reviewer_score": None, "reviewed": False, "created_at": now_iso()})
    asyncio.create_task(_run_speaking(ev_id, data, audio.filename or "rec.webm", audio.content_type))
    return {"evaluation_id": ev_id, "status": "QUEUED"}


async def create_and_run_speaking_eval_attempt(user_id, attempt_id, result_id, transcript):
    ev_id = new_id()
    await db.ai_evaluations.insert_one({
        "id": ev_id, "type": "speaking", "user_id": user_id, "attempt_id": attempt_id,
        "result_id": result_id, "status": "QUEUED", "provider": "gemini", "model": GEMINI_MODEL,
        "rubric_version": "speaking-v1", "transcript": transcript, "raw": None, "ai_score": None,
        "reviewer_score": None, "reviewed": False, "created_at": now_iso()})
    if result_id:
        await db.results.update_one({"id": result_id}, {"$set": {"skills.speaking.evaluation_id": ev_id}})
    asyncio.create_task(_run_speaking_from_transcript(ev_id, attempt_id, transcript, result_id))
    return ev_id


async def _run_speaking_from_transcript(ev_id, attempt_id, transcript, result_id):
    await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {"status": "PROCESSING"}})
    try:
        audio_parts = []
        if attempt_id:
            recs = await db.speaking_audio.find({"attempt_id": attempt_id}, {"_id": 0}).to_list(50)
            audio_parts = [(base64.b64decode(r["b64"]), r.get("mime") or "audio/webm") for r in recs]
        res = await evaluate_speaking(transcript, audio_parts=audio_parts)
        raw = res["raw"]
        band = raw.get("overall_band")
        await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {
            "status": "COMPLETED", "raw": raw, "ai_score": band, "updated_at": now_iso()}})
        if result_id:
            await db.results.update_one({"id": result_id}, {"$set": {
                "skills.speaking.band": band, "skills.speaking.ai_band": band, "skills.speaking.status": "COMPLETED"}})
            await _recompute_result_overall(result_id)
    except Exception as e:
        await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {"status": "FAILED", "error": str(e)}})
        if result_id:
            await db.results.update_one({"id": result_id}, {"$set": {"skills.speaking.status": "FAILED"}})
            await _recompute_result_overall(result_id)



async def _run_speaking(ev_id, data, filename, content_type=None):
    await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {"status": "PROCESSING"}})
    try:
        suffix = "." + filename.rsplit(".", 1)[-1] if "." in filename else ".webm"
        transcript = await transcribe_audio(data, suffix=suffix)
        res = await evaluate_speaking(transcript or "(no speech detected)",
                                      audio_parts=[(data, content_type or "audio/webm")])
        raw = res["raw"]
        await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {
            "status": "COMPLETED", "transcript": transcript, "raw": raw,
            "ai_score": raw.get("overall_band"), "updated_at": now_iso()}})
    except Exception as e:
        await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {"status": "FAILED", "error": str(e)}})


# ------------------- Teacher / Examiner reviews -----------------
@router.get("/reviews/pending")
async def pending_reviews(user: dict = Depends(get_current_user)):
    if user.get("role") not in ("teacher", "examiner", "admin", "super_admin"):
        raise HTTPException(403, "Not allowed.")
    rows = await db.ai_evaluations.find({"status": "COMPLETED", "reviewed": False},
                                        {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"items": rows}


@router.post("/reviews/{ev_id}")
async def submit_review(ev_id: str, payload: TeacherReviewInput, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("teacher", "examiner", "admin", "super_admin"):
        raise HTTPException(403, "Not allowed.")
    ev = await db.ai_evaluations.find_one({"id": ev_id}, {"_id": 0})
    if not ev:
        raise HTTPException(404, "Evaluation not found.")
    review = {"reviewer_id": user["id"], "reviewer_name": user["name"],
              "criteria_scores": payload.criteria_scores, "overall_band": payload.overall_band,
              "comments": payload.comments, "approved": payload.approved, "reviewed_at": now_iso()}
    await db.ai_evaluations.update_one({"id": ev_id}, {"$set": {
        "reviewed": True, "reviewer_score": payload.overall_band, "review": review}})
    # apply override to result if provided
    if ev.get("result_id") and payload.overall_band is not None and ev["type"] == "writing":
        await db.results.update_one({"id": ev["result_id"]}, {"$set": {
            "skills.writing.reviewer_band": payload.overall_band, "skills.writing.band": payload.overall_band}})
        await _recompute_result_overall(ev["result_id"])
    return {"ok": True}
