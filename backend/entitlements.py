from datetime import datetime, timezone, timedelta
from database import db
from models import now_iso, new_id

DEFAULT_FREE_PLAN = {
    "full_mock_attempts": 1,
    "skill_mock_attempts": 3,
    "practice_sets": 10,
    "ai_evaluations": 3,
    "notes_access": True,
    "analytics_access": True,
    "unlimited": False,
    "validity_days": 3650,
}

USAGE_KEYS = {
    "full_mock": "full_mock_attempts",
    "skill_mock": "skill_mock_attempts",
    "practice": "practice_sets",
    "ai": "ai_evaluations",
}


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "system"}, {"_id": 0})
    return s or {}


async def ensure_free_subscription(user_id: str):
    existing = await db.subscriptions.find_one({"user_id": user_id, "source": "free"}, {"_id": 0})
    if existing:
        return existing
    settings = await get_settings()
    free_plan = settings.get("free_plan", DEFAULT_FREE_PLAN)
    sub = {
        "id": new_id(),
        "user_id": user_id,
        "package_id": None,
        "package_name": "Free Plan",
        "source": "free",
        "status": "ACTIVE",
        "start_date": now_iso(),
        "end_date": (datetime.now(timezone.utc) + timedelta(days=free_plan.get("validity_days", 3650))).isoformat(),
        "entitlements": free_plan,
        "usage": {"full_mock": 0, "skill_mock": 0, "practice": 0, "ai": 0},
        "created_at": now_iso(),
    }
    await db.subscriptions.insert_one(sub)
    sub.pop("_id", None)
    return sub


async def active_subscription(user_id: str) -> dict:
    """Return the effective (best) active subscription; paid preferred over free."""
    now = now_iso()
    subs = await db.subscriptions.find(
        {"user_id": user_id, "status": "ACTIVE"}, {"_id": 0}
    ).to_list(50)
    valid = [s for s in subs if (s.get("end_date") or "9999") >= now]
    if not valid:
        return await ensure_free_subscription(user_id)
    paid = [s for s in valid if s.get("source") != "free"]
    pool = paid or valid
    pool.sort(key=lambda s: s.get("start_date", ""), reverse=True)
    return pool[0]


async def check_entitlement(user_id: str, usage_type: str) -> dict:
    sub = await active_subscription(user_id)
    ent = sub.get("entitlements", {})
    ent_key = USAGE_KEYS[usage_type]
    limit = ent.get(ent_key, 0)
    used = sub.get("usage", {}).get(usage_type, 0)
    unlimited = ent.get("unlimited", False) or limit == -1
    remaining = 999999 if unlimited else max(0, limit - used)
    allowed = unlimited or used < limit
    return {
        "allowed": allowed,
        "unlimited": unlimited,
        "limit": limit,
        "used": used,
        "remaining": remaining,
        "subscription_id": sub["id"],
        "package_name": sub.get("package_name"),
        "reason": None if allowed else "Upgrade your plan to continue.",
    }


async def consume_entitlement(user_id: str, usage_type: str):
    sub = await active_subscription(user_id)
    await db.subscriptions.update_one(
        {"id": sub["id"]}, {"$inc": {f"usage.{usage_type}": 1}}
    )


async def entitlement_summary(user_id: str) -> dict:
    sub = await active_subscription(user_id)
    ent = sub.get("entitlements", {})
    usage = sub.get("usage", {})
    out = {"package_name": sub.get("package_name"), "source": sub.get("source"),
           "end_date": sub.get("end_date"), "items": {}}
    for utype, ekey in USAGE_KEYS.items():
        limit = ent.get(ekey, 0)
        used = usage.get(utype, 0)
        unlimited = ent.get("unlimited", False) or limit == -1
        out["items"][utype] = {
            "limit": limit, "used": used, "unlimited": unlimited,
            "remaining": 999999 if unlimited else max(0, limit - used),
        }
    out["notes_access"] = ent.get("notes_access", False)
    out["analytics_access"] = ent.get("analytics_access", False)
    return out
