import re
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone, timedelta
from database import db
from models import (StudentCreate, StaffCreate, UserUpdate, PackageInput, BatchInput,
                    AssignPackageInput, SettingsInput, now_iso, new_id)
from security import (hash_password, get_current_user, require_permission, require_staff,
                      has_permission, ALL_PERMISSIONS, ROLE_PERMISSIONS, user_permissions)
from entitlements import ensure_free_subscription, active_subscription
from routers.auth_router import _gen_student_id, public_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def audit(actor, action, entity, entity_id, summary=""):
    await db.audit_logs.insert_one({
        "id": new_id(), "actor_id": actor.get("id"), "actor_name": actor.get("name"),
        "action": action, "entity": entity, "entity_id": entity_id, "summary": summary,
        "timestamp": now_iso()})


async def notify(user_id, title, body, kind="info"):
    await db.notifications.insert_one({
        "id": new_id(), "user_id": user_id, "title": title, "body": body,
        "kind": kind, "read": False, "created_at": now_iso()})


# ------------------------- Dashboard ----------------------------
@router.get("/dashboard")
async def dashboard(user: dict = Depends(require_staff)):
    today = datetime.now(timezone.utc).date().isoformat()
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    total_students = await db.users.count_documents({"role": "student"})
    active_students = await db.users.count_documents({"role": "student", "status": "active"})
    paid_subs = await db.subscriptions.count_documents({"status": "ACTIVE", "source": {"$ne": "free"}})
    batches = await db.batches.count_documents({"status": "active"})
    teachers = await db.users.count_documents({"role": "teacher"})
    exams = await db.exams.count_documents({"status": "published"})
    tests_today = await db.attempts.count_documents({"submitted_at": {"$gte": today}})
    pending_ai = await db.ai_evaluations.count_documents({"status": {"$in": ["QUEUED", "PROCESSING"]}})
    pending_reviews = await db.ai_evaluations.count_documents({"reviewed": False, "status": "COMPLETED"})
    # registration trend (last 7 days)
    reg_trend = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        c = await db.users.count_documents({"role": "student", "created_at": {"$regex": f"^{d}"}})
        reg_trend.append({"date": d[5:], "count": c})
    recent = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).to_list(8)
    return {
        "cards": {
            "total_students": total_students, "active_students": active_students,
            "paid_subscriptions": paid_subs, "free_students": total_students - paid_subs,
            "active_batches": batches, "teachers": teachers, "mock_tests": exams,
            "tests_today": tests_today, "pending_ai": pending_ai, "pending_reviews": pending_reviews,
        },
        "registration_trend": reg_trend, "recent_activity": recent,
    }


# -------------------------- Students ----------------------------
@router.get("/students")
async def list_students(user: dict = Depends(require_permission("students.view")),
                        search: str = "", status: str = "", batch_id: str = "",
                        page: int = 1, page_size: int = 20):
    q = {"role": "student"}
    if search:
        q["$or"] = [{"name": {"$regex": re.escape(search), "$options": "i"}},
                    {"email": {"$regex": re.escape(search), "$options": "i"}},
                    {"student_id": {"$regex": re.escape(search), "$options": "i"}}]
    if status:
        q["status"] = status
    if batch_id:
        q["batch_ids"] = batch_id
    total = await db.users.count_documents(q)
    skip = (page - 1) * page_size
    rows = await db.users.find(q, {"password_hash": 0, "_id": 0}).sort("created_at", -1).skip(skip).limit(page_size).to_list(page_size)
    for r in rows:
        sub = await active_subscription(r["id"])
        r["package_name"] = sub.get("package_name")
        r["subscription_end"] = sub.get("end_date")
        r["tests_taken"] = await db.attempts.count_documents({"user_id": r["id"], "status": {"$in": ["COMPLETED", "SUBMITTED", "AUTO_SUBMITTED"]}})
    return {"items": rows, "total": total, "page": page, "page_size": page_size}


@router.post("/students")
async def create_student(payload: StudentCreate, user: dict = Depends(require_permission("students.create"))):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already in use.")
    temp_password = payload.password or "Student@123"
    uid = new_id()
    doc = {
        "id": uid, "email": email, "password_hash": hash_password(temp_password),
        "name": payload.name, "role": "student", "permissions": [],
        "student_id": await _gen_student_id(), "phone": payload.phone,
        "country": payload.country, "target_ielts_type": payload.target_ielts_type,
        "target_band": payload.target_band, "current_band": None,
        "status": "active", "must_change_password": True, "batch_ids": [],
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    await ensure_free_subscription(uid)
    if payload.package_id:
        await _assign_package(uid, payload.package_id, "admin", user)
    if payload.batch_id:
        await _add_to_batch(uid, payload.batch_id, user)
    await audit(user, "student.create", "user", uid, f"Created student {payload.name}")
    return {"user": public_user(doc), "temp_password": temp_password}


@router.get("/students/{sid}")
async def get_student(sid: str, user: dict = Depends(require_permission("students.view"))):
    s = await db.users.find_one({"id": sid, "role": "student"}, {"password_hash": 0, "_id": 0})
    if not s:
        raise HTTPException(404, "Student not found")
    subs = await db.subscriptions.find({"user_id": sid}, {"_id": 0}).to_list(50)
    results = await db.results.find({"user_id": sid}, {"_id": 0, "answers_snapshot": 0}).sort("created_at", -1).to_list(50)
    batches = await db.batches.find({"id": {"$in": s.get("batch_ids", [])}}, {"_id": 0}).to_list(50)
    return {"student": s, "subscriptions": subs, "results": results, "batches": batches}


@router.patch("/students/{sid}")
async def update_student(sid: str, payload: UserUpdate, user: dict = Depends(require_permission("students.edit"))):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not upd:
        raise HTTPException(400, "Nothing to update")
    await db.users.update_one({"id": sid}, {"$set": upd})
    await audit(user, "student.update", "user", sid, str(list(upd.keys())))
    return {"ok": True}


@router.post("/students/{sid}/reset-password")
async def reset_student_password(sid: str, user: dict = Depends(require_permission("students.edit"))):
    temp = "Reset@123"
    await db.users.update_one({"id": sid}, {"$set": {"password_hash": hash_password(temp), "must_change_password": True}})
    await audit(user, "student.reset_password", "user", sid)
    return {"temp_password": temp}


@router.post("/students/{sid}/assign-package")
async def assign_pkg(sid: str, payload: AssignPackageInput, user: dict = Depends(require_permission("packages.manage"))):
    await _assign_package(sid, payload.package_id, "admin", user)
    return {"ok": True}


async def _assign_package(user_id, package_id, source, actor):
    pkg = await db.packages.find_one({"id": package_id}, {"_id": 0})
    if not pkg:
        raise HTTPException(404, "Package not found")
    ent = pkg.get("entitlements", {})
    sub = {
        "id": new_id(), "user_id": user_id, "package_id": package_id,
        "package_name": pkg["name"], "source": source, "status": "ACTIVE",
        "start_date": now_iso(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=ent.get("validity_days", 30))).isoformat(),
        "entitlements": ent, "usage": {"full_mock": 0, "skill_mock": 0, "practice": 0, "ai": 0},
        "created_at": now_iso(),
    }
    await db.subscriptions.insert_one(sub)
    await notify(user_id, "Subscription activated", f"Your '{pkg['name']}' package is now active.", "success")
    await audit(actor, "subscription.assign", "subscription", sub["id"], f"{pkg['name']} -> {user_id}")


# -------------------------- Staff -------------------------------
@router.get("/staff")
async def list_staff(user: dict = Depends(require_staff)):
    rows = await db.users.find({"role": {"$in": ["admin", "sub_admin", "teacher", "examiner", "content_manager"]}},
                               {"password_hash": 0, "_id": 0}).to_list(200)
    return {"items": rows}


@router.post("/staff")
async def create_staff(payload: StaffCreate, user: dict = Depends(get_current_user)):
    if payload.role in ("admin", "sub_admin") and not has_permission(user, "admins.manage"):
        raise HTTPException(403, "You cannot manage admins.")
    if payload.role in ("teacher", "examiner", "content_manager") and not has_permission(user, "teachers.manage"):
        raise HTTPException(403, "You cannot manage teachers.")
    # prevent privilege escalation: sub_admin cannot grant perms they lack
    if user.get("role") != "super_admin":
        mine = user_permissions(user)
        for p in payload.permissions:
            if p not in mine:
                raise HTTPException(403, f"You cannot grant permission you don't own: {p}")
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already in use.")
    uid = new_id()
    doc = {"id": uid, "email": email, "password_hash": hash_password(payload.password),
           "name": payload.name, "role": payload.role,
           "permissions": payload.permissions if payload.role == "sub_admin" else [],
           "status": "active", "created_at": now_iso()}
    await db.users.insert_one(doc)
    await audit(user, "staff.create", "user", uid, f"{payload.role}: {payload.name}")
    return public_user(doc)


@router.patch("/staff/{uid}/permissions")
async def update_perms(uid: str, payload: dict, user: dict = Depends(require_permission("admins.manage"))):
    perms = payload.get("permissions", [])
    if user.get("role") != "super_admin":
        mine = user_permissions(user)
        for p in perms:
            if p not in mine:
                raise HTTPException(403, f"You cannot grant permission you don't own: {p}")
    await db.users.update_one({"id": uid}, {"$set": {"permissions": perms}})
    await audit(user, "staff.permissions", "user", uid, str(perms))
    return {"ok": True}


@router.get("/permissions")
async def permissions_catalog(user: dict = Depends(require_staff)):
    return {"all": ALL_PERMISSIONS, "role_defaults": ROLE_PERMISSIONS}


# ------------------------- Packages -----------------------------
@router.get("/packages")
async def admin_packages(user: dict = Depends(require_permission("packages.manage"))):
    rows = await db.packages.find({}, {"_id": 0}).sort("display_order", 1).to_list(100)
    return {"items": rows}


@router.post("/packages")
async def create_package(payload: PackageInput, user: dict = Depends(require_permission("packages.manage"))):
    slug = payload.slug or re.sub(r"[^a-z0-9]+", "-", payload.name.lower()).strip("-")
    doc = payload.model_dump()
    doc.update({"id": new_id(), "slug": slug, "created_at": now_iso()})
    await db.packages.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "package.create", "package", doc["id"], payload.name)
    return doc


@router.patch("/packages/{pid}")
async def update_package(pid: str, payload: PackageInput, user: dict = Depends(require_permission("packages.manage"))):
    doc = payload.model_dump()
    await db.packages.update_one({"id": pid}, {"$set": doc})
    await audit(user, "package.update", "package", pid, payload.name)
    return {"ok": True}


@router.delete("/packages/{pid}")
async def delete_package(pid: str, user: dict = Depends(require_permission("packages.manage"))):
    await db.packages.update_one({"id": pid}, {"$set": {"active": False}})
    return {"ok": True}


# -------------------------- Batches -----------------------------
@router.get("/batches")
async def list_batches(user: dict = Depends(require_staff)):
    rows = await db.batches.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for r in rows:
        r["student_count"] = await db.users.count_documents({"batch_ids": r["id"]})
        if r.get("teacher_id"):
            t = await db.users.find_one({"id": r["teacher_id"]}, {"name": 1, "_id": 0})
            r["teacher_name"] = t["name"] if t else None
        if r.get("package_id"):
            p = await db.packages.find_one({"id": r["package_id"]}, {"name": 1, "_id": 0})
            r["package_name"] = p["name"] if p else None
    return {"items": rows}


@router.post("/batches")
async def create_batch(payload: BatchInput, user: dict = Depends(require_permission("batches.manage"))):
    if await db.batches.find_one({"batch_code": payload.batch_code}):
        raise HTTPException(400, "Batch code already exists.")
    doc = payload.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.batches.insert_one(doc)
    doc.pop("_id", None)
    await audit(user, "batch.create", "batch", doc["id"], payload.name)
    return doc


@router.get("/batches/{bid}")
async def batch_detail(bid: str, user: dict = Depends(require_staff)):
    b = await db.batches.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Batch not found")
    students = await db.users.find({"batch_ids": bid}, {"password_hash": 0, "_id": 0}).to_list(500)
    return {"batch": b, "students": students}


@router.post("/batches/{bid}/add-student")
async def add_student_to_batch(bid: str, payload: dict, user: dict = Depends(require_permission("batches.manage"))):
    await _add_to_batch(payload["user_id"], bid, user)
    return {"ok": True}


async def _add_to_batch(user_id, bid, actor):
    batch = await db.batches.find_one({"id": bid}, {"_id": 0})
    if not batch:
        raise HTTPException(404, "Batch not found")
    await db.users.update_one({"id": user_id}, {"$addToSet": {"batch_ids": bid}})
    if batch.get("package_id"):
        await _assign_package(user_id, batch["package_id"], "batch", actor)
    await notify(user_id, "Added to batch", f"You have been added to batch {batch['name']}.", "info")


@router.post("/batches/{bid}/remove-student")
async def remove_student(bid: str, payload: dict, user: dict = Depends(require_permission("batches.manage"))):
    await db.users.update_one({"id": payload["user_id"]}, {"$pull": {"batch_ids": bid}})
    return {"ok": True}


# ------------------------- Settings -----------------------------
@router.get("/settings")
async def get_settings_ep(user: dict = Depends(require_staff)):
    s = await db.settings.find_one({"id": "system"}, {"_id": 0})
    return s or {}


@router.put("/settings")
async def update_settings(payload: SettingsInput, user: dict = Depends(require_permission("settings.manage"))):
    await db.settings.update_one({"id": "system"}, {"$set": payload.data}, upsert=True)
    await audit(user, "settings.update", "settings", "system", str(list(payload.data.keys())))
    return {"ok": True}


# --------------------------- Audit ------------------------------
@router.get("/audit-logs")
async def audit_logs(user: dict = Depends(require_permission("settings.manage")), page: int = 1, page_size: int = 30):
    total = await db.audit_logs.count_documents({})
    rows = await db.audit_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip((page-1)*page_size).limit(page_size).to_list(page_size)
    return {"items": rows, "total": total}
