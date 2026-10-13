import os
from motor.motor_asyncio import AsyncIOMotorClient

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

NO_ID = {"_id": 0}


def clean(doc):
    """Remove Mongo internal _id from a document (we use our own uuid `id`)."""
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("student_id")
    await db.users.create_index("role")
    await db.batches.create_index("batch_code", unique=True)
    await db.exams.create_index("status")
    await db.exam_assignments.create_index("exam_code", unique=True)
    await db.attempts.create_index([("user_id", 1), ("exam_id", 1)])
    await db.subscriptions.create_index("user_id")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.login_attempts.create_index("identifier")
    await db.source_documents.create_index("exam_id")
