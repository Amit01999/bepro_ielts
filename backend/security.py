import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException, Depends
from database import db

JWT_ALGORITHM = "HS256"

# ----------------------------- RBAC -----------------------------
ALL_PERMISSIONS = [
    "students.view", "students.create", "students.edit", "students.delete",
    "batches.manage", "packages.manage", "payments.view", "payments.manage",
    "exams.create", "exams.publish", "questions.manage", "results.view",
    "results.override", "writing.review", "speaking.review", "ai.configure",
    "teachers.manage", "admins.manage", "reports.view", "settings.manage",
    "practice.manage", "materials.manage", "announcements.manage",
]

ROLE_PERMISSIONS = {
    "super_admin": list(ALL_PERMISSIONS),
    "admin": [p for p in ALL_PERMISSIONS if p != "admins.manage"] + ["admins.manage"],
    "sub_admin": [],  # explicit per-user permissions
    "content_manager": ["questions.manage", "practice.manage", "exams.create", "materials.manage", "results.view"],
    "teacher": ["writing.review", "speaking.review", "results.view", "students.view", "materials.manage"],
    "examiner": ["writing.review", "speaking.review", "results.view", "results.override"],
    "student": [],
}


def user_permissions(user: dict) -> set:
    role = user.get("role", "student")
    perms = set(ROLE_PERMISSIONS.get(role, []))
    perms.update(user.get("permissions", []) or [])
    return perms


def has_permission(user: dict, permission: str) -> bool:
    if user.get("role") == "super_admin":
        return True
    return permission in user_permissions(user)


# ------------------------- Passwords ----------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# --------------------------- JWT --------------------------------
def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=12)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])


# --------------------- Auth dependencies ------------------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Your account has been suspended.")
    return user


def require_permission(permission: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if not has_permission(user, permission):
            raise HTTPException(status_code=403, detail="You do not have permission to perform this action.")
        return user
    return dep


def require_staff(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") == "student":
        raise HTTPException(status_code=403, detail="Staff access required.")
    return user
