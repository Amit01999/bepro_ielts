import os
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends, Response
from database import db
from models import (RegisterInput, LoginInput, ForgotPasswordInput, ResetPasswordInput,
                    ChangePasswordInput, now_iso, new_id)
from security import (hash_password, verify_password, create_access_token, create_refresh_token,
                      decode_token, get_current_user, user_permissions)
from entitlements import ensure_free_subscription
import jwt as pyjwt

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


async def _gen_student_id() -> str:
    year = datetime.now(timezone.utc).year
    count = await db.users.count_documents({"role": "student"})
    return f"STU-{year}-{count + 1:06d}"


def public_user(u: dict) -> dict:
    u = dict(u)
    u.pop("password_hash", None)
    u.pop("_id", None)
    u["permissions_effective"] = sorted(user_permissions(u))
    return u


@router.post("/register")
async def register(payload: RegisterInput):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    uid = new_id()
    user = {
        "id": uid, "email": email, "password_hash": hash_password(payload.password),
        "name": payload.name, "role": "student", "permissions": [],
        "student_id": await _gen_student_id(), "phone": payload.phone,
        "target_ielts_type": payload.target_ielts_type, "target_band": payload.target_band,
        "current_band": None, "status": "active", "must_change_password": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    await ensure_free_subscription(uid)
    token = create_access_token(uid, email)
    return {"user": public_user(user), "access_token": token, "refresh_token": create_refresh_token(uid)}


@router.post("/login")
async def login(payload: LoginInput, request: Request):
    email = payload.email.lower()
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{email}"
    rec = await db.login_attempts.find_one({"identifier": ident})
    if rec and rec.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = rec.get("locked_until")
        if locked_until and locked_until > now_iso():
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat()}},
            upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    await db.login_attempts.delete_one({"identifier": ident})
    token = create_access_token(user["id"], email)
    return {"user": public_user(user), "access_token": token,
            "refresh_token": create_refresh_token(user["id"]),
            "must_change_password": user.get("must_change_password", False)}


@router.post("/refresh")
async def refresh(request: Request):
    body = await request.json()
    rt = body.get("refresh_token") or request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(rt)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"access_token": create_access_token(user["id"], user["email"])}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.post("/logout")
async def logout():
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordInput):
    user = await db.users.find_one({"email": payload.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "id": new_id(), "token": token, "user_id": user["id"],
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "used": False})
        print(f"[PASSWORD RESET] link token for {payload.email}: {token}")
    return {"message": "If an account exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordInput):
    rec = await db.password_reset_tokens.find_one({"token": payload.token})
    if not rec or rec.get("used") or rec["expires_at"] < now_iso():
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    await db.users.update_one({"id": rec["user_id"]},
                              {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"message": "Password updated successfully."}


@router.post("/change-password")
async def change_password(payload: ChangePasswordInput, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(payload.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    await db.users.update_one({"id": user["id"]},
                              {"$set": {"password_hash": hash_password(payload.new_password),
                                        "must_change_password": False}})
    return {"message": "Password changed successfully."}
