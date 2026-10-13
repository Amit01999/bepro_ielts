from fastapi import APIRouter, HTTPException, Depends
from database import db
from models import SubscribeInput, now_iso, new_id
from security import get_current_user
from entitlements import (entitlement_summary, check_entitlement, consume_entitlement,
                          active_subscription)
from scoring import score_objective_section, raw_to_band
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api", tags=["student"])


# ----------------------- Public packages ------------------------
@router.get("/packages")
async def public_packages():
    rows = await db.packages.find({"active": True}, {"_id": 0}).sort("display_order", 1).to_list(100)
    return {"items": rows}


# ------------------------- Dashboard ----------------------------
@router.get("/student/dashboard")
async def student_dashboard(user: dict = Depends(get_current_user)):
    uid = user["id"]
    summary = await entitlement_summary(uid)
    results = await db.results.find({"user_id": uid}, {"_id": 0, "answers_snapshot": 0}).sort("created_at", -1).to_list(100)
    completed = [r for r in results if r.get("status") == "COMPLETED"]
    # latest band per skill
    skill_bands = {}
    for r in results:
        for sk, v in r.get("skills", {}).items():
            if v.get("band") is not None and sk not in skill_bands:
                skill_bands[sk] = v["band"]
    band_history = [{"date": r["created_at"][:10], "overall": r.get("overall_band")}
                    for r in reversed(completed) if r.get("overall_band") is not None]
    practice_done = await db.practice_attempts.count_documents({"user_id": uid})
    tests_done = len(completed)
    notifs = await db.notifications.find({"user_id": uid}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    ann = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    # weak skill
    weak = None
    if skill_bands:
        weak = min(skill_bands, key=skill_bands.get)
    return {
        "user": {"name": user["name"], "student_id": user.get("student_id"),
                 "target_band": user.get("target_band"), "target_ielts_type": user.get("target_ielts_type")},
        "subscription": summary, "skill_bands": skill_bands, "band_history": band_history,
        "tests_completed": tests_done, "practice_completed": practice_done,
        "current_band": max(skill_bands.values()) if skill_bands else None,
        "recent_results": results[:5], "notifications": notifs, "announcements": ann,
        "weak_skill": weak,
    }


@router.get("/student/entitlements")
async def my_entitlements(user: dict = Depends(get_current_user)):
    return await entitlement_summary(user["id"])


# ------------------------ Subscriptions -------------------------
@router.get("/student/subscriptions")
async def my_subscriptions(user: dict = Depends(get_current_user)):
    rows = await db.subscriptions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"items": rows}


@router.post("/student/subscribe")
async def subscribe(payload: SubscribeInput, user: dict = Depends(get_current_user)):
    """Simulated activation (payments skipped for v1)."""
    pkg = await db.packages.find_one({"id": payload.package_id, "active": True}, {"_id": 0})
    if not pkg:
        raise HTTPException(404, "Package not found.")
    price = pkg.get("sale_price") or pkg.get("regular_price", 0)
    discount = 0
    if payload.coupon_code:
        coupon = await db.coupons.find_one({"code": payload.coupon_code.upper(), "active": True}, {"_id": 0})
        if not coupon:
            raise HTTPException(400, "Invalid coupon code.")
        if coupon.get("percent"):
            discount = price * coupon["percent"] / 100
        else:
            discount = coupon.get("amount", 0)
    ent = pkg.get("entitlements", {})
    sub = {"id": new_id(), "user_id": user["id"], "package_id": pkg["id"], "package_name": pkg["name"],
           "source": "purchase", "status": "ACTIVE", "start_date": now_iso(),
           "end_date": (datetime.now(timezone.utc) + timedelta(days=ent.get("validity_days", 30))).isoformat(),
           "entitlements": ent, "usage": {"full_mock": 0, "skill_mock": 0, "practice": 0, "ai": 0},
           "amount": max(0, price - discount), "created_at": now_iso()}
    await db.subscriptions.insert_one(sub)
    payment = {"id": new_id(), "user_id": user["id"], "package_id": pkg["id"], "subscription_id": sub["id"],
               "amount": sub["amount"], "currency": pkg.get("currency", "BDT"), "status": "PAID",
               "method": "simulated", "transaction_id": f"SIM-{new_id()[:8].upper()}",
               "created_at": now_iso(), "verified_at": now_iso()}
    await db.payments.insert_one(payment)
    await db.notifications.insert_one({"id": new_id(), "user_id": user["id"], "title": "Subscription activated",
                                       "body": f"'{pkg['name']}' is now active. Enjoy your premium content!",
                                       "kind": "success", "read": False, "created_at": now_iso()})
    sub.pop("_id", None)
    return {"subscription": sub, "note": "Payment simulated for demo (real gateways integrate later)."}


# --------------------------- Results ----------------------------
@router.get("/student/results")
async def my_results(user: dict = Depends(get_current_user)):
    rows = await db.results.find({"user_id": user["id"]}, {"_id": 0, "answers_snapshot": 0}).sort("created_at", -1).to_list(100)
    return {"items": rows}


@router.get("/student/results/{rid}")
async def result_detail(rid: str, user: dict = Depends(get_current_user)):
    r = await db.results.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Result not found.")
    if r["user_id"] != user["id"] and user.get("role") == "student":
        raise HTTPException(403, "Not allowed.")
    # attach writing evaluations
    ev_ids = r.get("skills", {}).get("writing", {}).get("evaluation_ids", [])
    if ev_ids:
        evs = await db.ai_evaluations.find({"id": {"$in": ev_ids}}, {"_id": 0}).to_list(10)
        r["writing_evaluations"] = evs
    sp = r.get("skills", {}).get("speaking", {})
    if sp.get("evaluation_id"):
        sev = await db.ai_evaluations.find_one({"id": sp["evaluation_id"]}, {"_id": 0})
        if sev:
            r["speaking_evaluation"] = sev
    return r


# --------------------- Practice (student) -----------------------
@router.get("/student/practice")
async def list_practice(user: dict = Depends(get_current_user), skill: str = ""):
    q = {}
    if skill:
        q["skill"] = skill
    rows = await db.practice_sets.find(q, {"_id": 0, "questions.accepted_answers": 0,
                                           "questions.explanation": 0}).sort("created_at", -1).to_list(200)
    ent = await check_entitlement(user["id"], "practice")
    out = []
    for p in rows:
        allowed = ent["allowed"]
        out.append({"id": p["id"], "title": p["title"], "skill": p["skill"], "level": p["level"],
                    "ielts_type": p["ielts_type"], "topic": p.get("topic"),
                    "estimated_minutes": p["estimated_minutes"], "is_free": p.get("is_free"),
                    "question_count": len(p.get("questions", [])),
                    "access": {"allowed": allowed, "remaining": ent["remaining"], "unlimited": ent["unlimited"]}})
    return {"items": out, "practice_remaining": ent["remaining"], "unlimited": ent["unlimited"]}


@router.get("/student/practice/{pid}")
async def get_practice(pid: str, user: dict = Depends(get_current_user)):
    p = await db.practice_sets.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Practice set not found.")
    ent = await check_entitlement(user["id"], "practice")
    if not ent["allowed"]:
        raise HTTPException(403, "You have used all your practice sets on this plan. Upgrade your plan to continue.")
    safe = dict(p)
    safe["questions"] = [{k: v for k, v in q.items() if k not in ("accepted_answers", "explanation")}
                         for q in p.get("questions", [])]
    return safe


@router.post("/student/practice/{pid}/submit")
async def submit_practice(pid: str, payload: dict, user: dict = Depends(get_current_user)):
    p = await db.practice_sets.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Practice set not found.")
    ent = await check_entitlement(user["id"], "practice")
    if not ent["allowed"]:
        raise HTTPException(403, "You have used all your practice sets on this plan. Upgrade your plan to continue.")
    answers = payload.get("answers", {})
    objective = [q for q in p.get("questions", []) if q.get("type") not in ("essay", "letter")]
    correct, total, details = score_objective_section(objective, answers)
    scaled = round(correct / total * 40) if total else 0
    band = raw_to_band(scaled, p["skill"], p.get("ielts_type", "academic")) if total else None
    await consume_entitlement(user["id"], "practice")
    reveal = p.get("reveal_answers", True)
    if not reveal:
        for d in details:
            d.pop("correct_answer", None)
    attempt = {"id": new_id(), "user_id": user["id"], "practice_id": pid, "skill": p["skill"],
               "raw": correct, "total": total, "band": band, "created_at": now_iso()}
    await db.practice_attempts.insert_one(attempt)
    explanations = {str(q["number"]): q.get("explanation") for q in p.get("questions", [])} if reveal else {}
    return {"raw": correct, "total": total, "band": band, "details": details,
            "explanations": explanations, "reveal": reveal}


# ----------------------- Notifications --------------------------
@router.get("/student/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    rows = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": rows, "unread": unread}


@router.post("/student/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ------------------------- Analytics ----------------------------
@router.get("/student/analytics")
async def analytics(user: dict = Depends(get_current_user)):
    uid = user["id"]
    results = await db.results.find({"user_id": uid, "status": "COMPLETED"},
                                    {"_id": 0}).sort("created_at", 1).to_list(200)
    trends = {"listening": [], "reading": [], "writing": [], "speaking": []}
    for r in results:
        d = r["created_at"][:10]
        for sk in trends:
            v = r.get("skills", {}).get(sk, {})
            if v.get("band") is not None:
                trends[sk].append({"date": d, "band": v["band"]})
    # question-type accuracy from practice + reading/listening details
    type_stats = {}
    for r in results:
        for sk in ("listening", "reading"):
            for d in r.get("skills", {}).get(sk, {}).get("details", []):
                t = d.get("type", "other")
                type_stats.setdefault(t, {"correct": 0, "total": 0})
                type_stats[t]["total"] += 1
                if d.get("is_correct"):
                    type_stats[t]["correct"] += 1
    qtype_accuracy = [{"type": t, "accuracy": round(s["correct"] / s["total"] * 100) if s["total"] else 0,
                       "total": s["total"]} for t, s in type_stats.items()]
    qtype_accuracy.sort(key=lambda x: x["accuracy"])
    return {"trends": trends, "question_type_accuracy": qtype_accuracy,
            "weakest_types": qtype_accuracy[:3], "target_band": user.get("target_band")}
