import os
from datetime import datetime, timezone, timedelta
from database import db
from security import hash_password, verify_password
from models import now_iso, new_id
from entitlements import DEFAULT_FREE_PLAN

DEFAULT_SETTINGS = {
    "id": "system",
    "branding": {"name": "BePro IELTS", "tagline": "Your Path to Your Target Band"},
    "free_plan": DEFAULT_FREE_PLAN,
    "exam_rules": {"listening_minutes": 30, "reading_minutes": 60, "writing_minutes": 60,
                   "speaking_minutes": 14, "autosave_interval": 15},
    "anti_cheat": {"enabled": True, "warnings": 1},
    "result_visibility": "immediate",
}


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": email, "password_hash": hash_password(password),
            "name": "Platform Owner", "role": "super_admin", "permissions": [],
            "status": "active", "created_at": now_iso()})
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password),
                                                              "role": "super_admin"}})


async def seed_settings():
    if not await db.settings.find_one({"id": "system"}):
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))


async def seed_content():
    if await db.exams.count_documents({}) > 0:
        return
    # ---- Packages ----
    packages = [
        {"id": new_id(), "name": "Starter", "slug": "starter", "description": "Kickstart your IELTS journey with essential practice.",
         "regular_price": 990, "sale_price": 690, "currency": "BDT", "active": True, "featured": False, "is_free": False,
         "benefits": ["5 full mock tests", "20 practice sets", "10 AI evaluations", "Study notes"], "display_order": 1,
         "entitlements": {"full_mock_attempts": 5, "skill_mock_attempts": 15, "practice_sets": 20, "ai_evaluations": 10,
                          "notes_access": True, "analytics_access": True, "unlimited": False, "validity_days": 30}, "created_at": now_iso()},
        {"id": new_id(), "name": "IELTS Pro", "slug": "ielts-pro", "description": "The complete package for serious candidates.",
         "regular_price": 2490, "sale_price": 1990, "currency": "BDT", "active": True, "featured": True, "is_free": False,
         "benefits": ["20 full mock tests", "Unlimited practice", "50 AI evaluations", "Teacher reviews", "Premium analytics"], "display_order": 2,
         "entitlements": {"full_mock_attempts": 20, "skill_mock_attempts": 60, "practice_sets": -1, "ai_evaluations": 50,
                          "notes_access": True, "analytics_access": True, "unlimited": False, "validity_days": 60}, "created_at": now_iso()},
        {"id": new_id(), "name": "IELTS Intensive", "slug": "ielts-intensive", "description": "Unlimited everything for 90 days.",
         "regular_price": 4990, "sale_price": 3990, "currency": "BDT", "active": True, "featured": False, "is_free": False,
         "benefits": ["Unlimited mocks", "Unlimited practice", "Unlimited AI", "Priority teacher reviews", "Batch access"], "display_order": 3,
         "entitlements": {"full_mock_attempts": -1, "skill_mock_attempts": -1, "practice_sets": -1, "ai_evaluations": -1,
                          "notes_access": True, "analytics_access": True, "unlimited": True, "validity_days": 90}, "created_at": now_iso()},
    ]
    await db.packages.insert_many([dict(p) for p in packages])

    # ---- Reading Exam (Academic) ----
    reading_passage = {
        "id": new_id(), "title": "The Rise of Urban Vertical Farming", "order": 0,
        "body": ("Vertical farming, the practice of growing crops in stacked layers within controlled indoor "
                 "environments, has emerged as a compelling response to the pressures of a rapidly urbanising world. "
                 "Unlike traditional agriculture, which depends heavily on arable land, favourable weather and "
                 "seasonal cycles, vertical farms use hydroponic or aeroponic systems in which plant roots are "
                 "suspended in nutrient-rich solutions or mist rather than soil. Advocates argue that because these "
                 "farms can be located inside cities, they dramatically reduce the distance food travels from farm to "
                 "plate, cutting transport emissions and delivering fresher produce.\n\n"
                 "The technology is not without its critics. The most frequently cited drawback is energy consumption. "
                 "Because vertical farms replace sunlight with LED lighting and rely on climate-control systems, their "
                 "electricity demands are considerable. Where that electricity is generated from fossil fuels, the "
                 "environmental benefits of reduced transport can be offset. However, proponents note that lighting "
                 "technology has improved sharply, with modern LEDs consuming a fraction of the power of earlier models, "
                 "and that many operations are now pairing their facilities with renewable energy sources.\n\n"
                 "Beyond emissions, supporters point to water efficiency. Vertical farms typically recirculate water "
                 "through closed systems, using as little as five per cent of the water required by conventional field "
                 "farming for the same yield. In regions facing chronic water scarcity, this efficiency is potentially "
                 "transformative. Whether vertical farming becomes a mainstream pillar of the food system or remains a "
                 "niche supplement will depend largely on how quickly energy costs continue to fall.")
    }
    reading_questions = [
        {"id": new_id(), "number": 1, "skill": "reading", "ielts_type": "academic", "type": "tfng",
         "prompt": "Vertical farming relies on soil to grow crops.", "options": ["True", "False", "Not Given"],
         "accepted_answers": ["False"], "explanation": "The passage states roots are suspended in solutions or mist 'rather than soil'.", "status": "published"},
        {"id": new_id(), "number": 2, "skill": "reading", "ielts_type": "academic", "type": "tfng",
         "prompt": "Vertical farms can be built within cities.", "options": ["True", "False", "Not Given"],
         "accepted_answers": ["True"], "explanation": "'these farms can be located inside cities'.", "status": "published"},
        {"id": new_id(), "number": 3, "skill": "reading", "ielts_type": "academic", "type": "tfng",
         "prompt": "The author states that vertical farming is more profitable than traditional farming.", "options": ["True", "False", "Not Given"],
         "accepted_answers": ["Not Given"], "explanation": "Profitability is never discussed.", "status": "published"},
        {"id": new_id(), "number": 4, "skill": "reading", "ielts_type": "academic", "type": "mcq_single",
         "prompt": "According to the passage, the main drawback of vertical farming is:", "options": ["Water usage", "Energy consumption", "Poor taste of produce", "Lack of arable land"],
         "accepted_answers": ["Energy consumption"], "explanation": "'The most frequently cited drawback is energy consumption'.", "status": "published"},
        {"id": new_id(), "number": 5, "skill": "reading", "ielts_type": "academic", "type": "completion",
         "prompt": "Vertical farms can use as little as ______ per cent of the water of conventional farming.", "options": [],
         "accepted_answers": ["five", "5"], "max_words": 1, "explanation": "'as little as five per cent of the water'.", "status": "published"},
        {"id": new_id(), "number": 6, "skill": "reading", "ielts_type": "academic", "type": "completion",
         "prompt": "Vertical farms grow crops in stacked ______ within controlled environments.", "options": [],
         "accepted_answers": ["layers"], "max_words": 1, "explanation": "'growing crops in stacked layers'.", "status": "published"},
    ]
    reading_exam = {
        "id": new_id(), "title": "Academic Reading Practice Test 1", "ielts_type": "academic", "kind": "reading",
        "description": "A single-passage academic reading mini-test to experience the split-screen engine.",
        "duration_minutes": 20, "is_free": True, "packages_allowed": [], "ai_evaluation": False,
        "instructions": "Read the passage and answer all questions. You have 20 minutes.",
        "sections": [{"id": new_id(), "skill": "reading", "order": 0,
                      "instructions": "Read Passage 1 and answer Questions 1-6.",
                      "audio_url": None, "passages": [reading_passage], "questions": reading_questions,
                      "duration_minutes": 20}],
        "status": "published", "version": 1, "created_at": now_iso(),
    }
    await db.exams.insert_one(reading_exam)

    # ---- Listening Exam ----
    listening_questions = [
        {"id": new_id(), "number": 1, "skill": "listening", "ielts_type": "academic", "type": "completion",
         "prompt": "The customer's first name is ______.", "options": [], "accepted_answers": ["Michael"], "max_words": 1,
         "explanation": "Sample answer.", "status": "published"},
        {"id": new_id(), "number": 2, "skill": "listening", "ielts_type": "academic", "type": "completion",
         "prompt": "The appointment is scheduled for ______ (day).", "options": [], "accepted_answers": ["Tuesday"], "max_words": 1,
         "explanation": "Sample answer.", "status": "published"},
        {"id": new_id(), "number": 3, "skill": "listening", "ielts_type": "academic", "type": "mcq_single",
         "prompt": "Which service does the caller request?", "options": ["Repair", "Installation", "Consultation", "Refund"],
         "accepted_answers": ["Consultation"], "explanation": "Sample answer.", "status": "published"},
        {"id": new_id(), "number": 4, "skill": "listening", "ielts_type": "academic", "type": "completion",
         "prompt": "The total cost quoted is $______.", "options": [], "accepted_answers": ["150", "one hundred fifty"], "max_words": 2,
         "explanation": "Sample answer.", "status": "published"},
    ]
    listening_exam = {
        "id": new_id(), "title": "Listening Practice Test 1", "ielts_type": "academic", "kind": "listening",
        "description": "A short listening mini-test with audio player and question navigator.",
        "duration_minutes": 15, "is_free": True, "packages_allowed": [], "ai_evaluation": False,
        "instructions": "Listen to the recording and answer all questions. The audio plays once.",
        "sections": [{"id": new_id(), "skill": "listening", "order": 0,
                      "instructions": "Listen to Section 1 and answer Questions 1-4.",
                      "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                      "passages": [], "questions": listening_questions, "duration_minutes": 15}],
        "status": "published", "version": 1, "created_at": now_iso(),
    }
    await db.exams.insert_one(listening_exam)

    # ---- Writing Exam ----
    writing_exam = {
        "id": new_id(), "title": "Academic Writing Practice Test 1", "ielts_type": "academic", "kind": "writing",
        "description": "Two writing tasks evaluated by AI against IELTS criteria.",
        "duration_minutes": 60, "is_free": True, "packages_allowed": [], "ai_evaluation": True,
        "instructions": "Complete both tasks. Task 1: min 150 words. Task 2: min 250 words.",
        "sections": [{"id": new_id(), "skill": "writing", "order": 0, "instructions": "Complete both writing tasks.",
                      "audio_url": None, "passages": [], "duration_minutes": 60,
                      "questions": [
                          {"id": new_id(), "number": 1, "skill": "writing", "ielts_type": "academic", "type": "essay",
                           "prompt": "The chart below shows the percentage of households with internet access in three countries between 2000 and 2020. Summarise the information by selecting and reporting the main features. Write at least 150 words.",
                           "options": [], "accepted_answers": [], "max_words": None, "status": "published"},
                          {"id": new_id(), "number": 2, "skill": "writing", "ielts_type": "academic", "type": "essay",
                           "prompt": "Some people believe that unpaid community service should be a compulsory part of high school programmes. To what extent do you agree or disagree? Write at least 250 words.",
                           "options": [], "accepted_answers": [], "max_words": None, "status": "published"}]}],
        "status": "published", "version": 1, "created_at": now_iso(),
    }
    await db.exams.insert_one(writing_exam)

    # ---- Practice sets ----
    practice_sets = [
        {"id": new_id(), "title": "True/False/Not Given Basics", "skill": "reading", "ielts_type": "academic",
         "topic": "TFNG", "level": "beginner", "estimated_minutes": 15, "instructions": "Decide True, False or Not Given.",
         "is_free": True, "reveal_answers": True, "passage": reading_passage["body"],
         "questions": reading_questions[:3], "created_at": now_iso()},
        {"id": new_id(), "title": "Form Completion Listening", "skill": "listening", "ielts_type": "academic",
         "topic": "Form Completion", "level": "intermediate", "estimated_minutes": 10, "instructions": "Complete the form.",
         "is_free": True, "reveal_answers": True, "audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
         "questions": listening_questions[:2], "created_at": now_iso()},
    ]
    await db.practice_sets.insert_many([dict(p) for p in practice_sets])

    # ---- Sample teacher, batch, student ----
    teacher_id = new_id()
    await db.users.insert_one({"id": teacher_id, "email": "teacher@bepro.com",
                               "password_hash": hash_password("Teacher@123"), "name": "Sarah Ahmed",
                               "role": "teacher", "permissions": [], "status": "active", "created_at": now_iso()})
    batch = {"id": new_id(), "name": "IELTS Academic Batch A-07", "batch_code": "IELTS-A-07",
             "description": "60-day intensive academic batch.", "teacher_id": teacher_id,
             "start_date": now_iso()[:10], "end_date": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat()[:10],
             "capacity": 30, "package_id": packages[1]["id"], "schedule": "Sun/Tue/Thu 7-9 PM",
             "status": "active", "created_at": now_iso()}
    await db.batches.insert_one(batch)

    student_id = new_id()
    await db.users.insert_one({"id": student_id, "email": "student@bepro.com",
                               "password_hash": hash_password("Student@123"), "name": "Rafiq Islam",
                               "role": "student", "permissions": [], "student_id": "STU-2026-000001",
                               "target_ielts_type": "academic", "target_band": 7.5, "current_band": None,
                               "status": "active", "must_change_password": False, "batch_ids": [batch["id"]],
                               "created_at": now_iso()})
    # give sample student the batch package
    ent = packages[1]["entitlements"]
    await db.subscriptions.insert_one({"id": new_id(), "user_id": student_id, "package_id": packages[1]["id"],
                                       "package_name": packages[1]["name"], "source": "batch", "status": "ACTIVE",
                                       "start_date": now_iso(),
                                       "end_date": (datetime.now(timezone.utc) + timedelta(days=60)).isoformat(),
                                       "entitlements": ent, "usage": {"full_mock": 0, "skill_mock": 0, "practice": 0, "ai": 0},
                                       "created_at": now_iso()})

    await db.announcements.insert_one({"id": new_id(), "title": "Welcome to BePro IELTS",
                                       "body": "New Academic and General Training mock tests are now available.",
                                       "target": "everyone", "priority": "normal", "pinned": True, "created_at": now_iso()})


async def run_seed():
    await seed_admin()
    await seed_settings()
    await seed_content()
    await seed_extra()


async def seed_extra():
    """Idempotently add a Speaking exam and a Full 4-skill Mock if missing."""
    # ---- Speaking exam ----
    if not await db.exams.find_one({"kind": "speaking"}):
        speaking_section = {"id": new_id(), "skill": "speaking", "order": 0,
            "instructions": "You will complete three parts. Speak clearly after each prompt.",
            "audio_url": None, "passages": [], "duration_minutes": 14,
            "questions": [
                {"id": new_id(), "number": 1, "skill": "speaking", "ielts_type": "academic", "type": "speaking",
                 "part": "1", "prep_seconds": 0, "speak_seconds": 45,
                 "prompt": "Let's talk about your hometown. Where are you from and what is it like?", "options": [], "accepted_answers": [], "status": "published"},
                {"id": new_id(), "number": 2, "skill": "speaking", "ielts_type": "academic", "type": "speaking",
                 "part": "1", "prep_seconds": 0, "speak_seconds": 45,
                 "prompt": "Do you prefer studying in the morning or the evening? Why?", "options": [], "accepted_answers": [], "status": "published"},
                {"id": new_id(), "number": 3, "skill": "speaking", "ielts_type": "academic", "type": "speaking",
                 "part": "2", "prep_seconds": 60, "speak_seconds": 120,
                 "prompt": "Describe a skill you would like to learn. You should say: what the skill is, why you want to learn it, how you would learn it, and explain how it would help you.", "options": [], "accepted_answers": [], "status": "published"},
                {"id": new_id(), "number": 4, "skill": "speaking", "ielts_type": "academic", "type": "speaking",
                 "part": "3", "prep_seconds": 0, "speak_seconds": 60,
                 "prompt": "Do you think schools should teach more practical life skills? Why or why not?", "options": [], "accepted_answers": [], "status": "published"},
            ]}
        await db.exams.insert_one({"id": new_id(), "title": "Speaking Practice Test 1", "ielts_type": "academic",
            "kind": "speaking", "description": "A 3-part speaking test recorded in your browser and evaluated by AI.",
            "duration_minutes": 15, "is_free": True, "packages_allowed": [], "ai_evaluation": True,
            "instructions": "Complete a microphone check, then answer all three parts. Your recordings are transcribed and evaluated.",
            "sections": [speaking_section], "status": "published", "version": 1, "created_at": now_iso()})

    # ---- Full 4-skill mock ----
    if not await db.exams.find_one({"kind": "full"}):
        reading = await db.exams.find_one({"kind": "reading"}, {"_id": 0})
        listening = await db.exams.find_one({"kind": "listening"}, {"_id": 0})
        writing = await db.exams.find_one({"kind": "writing"}, {"_id": 0})
        speaking = await db.exams.find_one({"kind": "speaking"}, {"_id": 0})
        sections = []
        for order, ex in enumerate([listening, reading, writing, speaking]):
            if ex and ex.get("sections"):
                s = dict(ex["sections"][0]); s["id"] = new_id(); s["order"] = order
                sections.append(s)
        if sections:
            await db.exams.insert_one({"id": new_id(), "title": "Full IELTS Mock Test 1", "ielts_type": "academic",
                "kind": "full", "description": "A complete four-skill IELTS mock: Listening, Reading, Writing and Speaking in one sitting.",
                "duration_minutes": 170, "is_free": True, "packages_allowed": [], "ai_evaluation": True,
                "instructions": "Complete all four skills in order. Your progress is saved automatically.",
                "sections": sections, "status": "published", "version": 1, "created_at": now_iso()})
