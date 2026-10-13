"""BePro backend tests - comprehensive coverage of priority flows.

Covers:
 - Auth: register, login (student/admin), /me, change-password, RBAC 403 on admin routes
 - Entitlements: free plan defaults, decrement, exhaustion returns 403 upgrade message
 - Reading exam engine end-to-end + server timer authority + idempotent submit
 - Listening exam
 - Practice flow (no accepted_answers leak, submit returns band + feedback)
 - Subscription simulated activation
 - Admin: dashboard, create student (temp_password + STU-... id), create package, create batch,
          add student to batch assigns package
 - Exam builder + publish validation (missing accepted answers rejected)
 - Exam ID assignment + student /exams/enter (404 wrong code, 403 unauthorized batch)
 - Writing AI evaluation (polls result; may be slow so tolerate EVALUATING)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://writing-excellence-2.preview.emergentagent.com").rstrip("/")
API = BASE_URL + "/api"

ADMIN_EMAIL = "nirmul554@gmail.com"
ADMIN_PASS = "Admin@12345"
STUDENT_EMAIL = "student@bepro.com"
STUDENT_PASS = "Student@123"


# ------------------------- Helpers/fixtures -----------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)["access_token"]


@pytest.fixture(scope="session")
def student_token():
    return _login(STUDENT_EMAIL, STUDENT_PASS)["access_token"]


@pytest.fixture(scope="session")
def new_student():
    """Fresh student on free plan (used for quota-exhaustion tests)."""
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "Quota Tester", "email": email, "password": "Test@1234"}
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": "Test@1234", "token": data["access_token"],
            "user_id": data["user"]["id"], "student_id": data["user"].get("student_id")}


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


# --------------------------- Auth tests --------------------------
class TestAuth:
    def test_admin_login(self):
        d = _login(ADMIN_EMAIL, ADMIN_PASS)
        assert d["user"]["role"] == "super_admin"
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 10

    def test_student_login(self):
        d = _login(STUDENT_EMAIL, STUDENT_PASS)
        assert d["user"]["role"] == "student"

    def test_me_endpoint(self, student_token):
        r = requests.get(f"{API}/auth/me", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == STUDENT_EMAIL

    def test_register_returns_student_id(self, new_student):
        assert new_student["student_id"] and new_student["student_id"].startswith("STU-")

    def test_bad_login_401(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": STUDENT_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_change_password_wrong_current(self, student_token):
        r = requests.post(f"{API}/auth/change-password", headers=H(student_token),
                          json={"current_password": "WRONG", "new_password": "Xyz@1234"}, timeout=15)
        assert r.status_code == 400

    def test_rbac_student_cannot_hit_admin(self, student_token):
        r = requests.get(f"{API}/admin/dashboard", headers=H(student_token), timeout=15)
        assert r.status_code == 403


# ---------------------- Entitlements tests -----------------------
class TestEntitlements:
    def test_free_plan_defaults_for_new_user(self, new_student):
        r = requests.get(f"{API}/student/entitlements", headers=H(new_student["token"]), timeout=15)
        assert r.status_code == 200
        d = r.json()
        items = d["items"]
        assert items["full_mock"]["limit"] == 1
        assert items["skill_mock"]["limit"] == 3
        assert items["practice"]["limit"] == 10
        assert items["ai"]["limit"] == 3
        assert items["full_mock"]["used"] == 0


# ----------------------- Reading exam flow -----------------------
def _get_first_reading_exam(tok):
    r = requests.get(f"{API}/student/exams?kind=reading", headers=H(tok), timeout=15)
    assert r.status_code == 200
    items = r.json()["items"]
    assert items, "No reading exams seeded"
    return items[0]


class TestReadingFlow:
    def test_reading_exam_e2e(self, student_token):
        exam = _get_first_reading_exam(student_token)
        eid = exam["id"]

        # Start
        r = requests.post(f"{API}/exams/{eid}/start", headers=H(student_token),
                          json={"agreed": True}, timeout=15)
        assert r.status_code == 200, r.text
        aid = r.json()["attempt_id"]

        # GET attempt
        r = requests.get(f"{API}/attempts/{aid}", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["remaining_seconds"] > 0
        # Ensure no leaked answers/explanation
        for sec in d["exam"]["sections"]:
            for q in sec.get("questions", []):
                assert "accepted_answers" not in q
                assert "explanation" not in q

        # Timer authority: 2nd GET should not increase remaining
        time.sleep(1)
        r2 = requests.get(f"{API}/attempts/{aid}", headers=H(student_token), timeout=15)
        assert r2.json()["remaining_seconds"] <= d["remaining_seconds"]

        # Save some answers using first question
        first_sec = d["exam"]["sections"][0]
        answers = {}
        for q in first_sec["questions"][:3]:
            answers[str(q["number"])] = "test"
        r = requests.post(f"{API}/attempts/{aid}/answers", headers=H(student_token),
                          json={"answers": answers}, timeout=15)
        assert r.status_code == 200

        # Submit
        r = requests.post(f"{API}/attempts/{aid}/submit", headers=H(student_token), timeout=30)
        assert r.status_code == 200, r.text
        rid = r.json()["result_id"]
        assert r.json()["already"] is False

        # Duplicate submit -> already
        r2 = requests.post(f"{API}/attempts/{aid}/submit", headers=H(student_token), timeout=15)
        assert r2.status_code == 200
        assert r2.json()["result_id"] == rid
        assert r2.json()["already"] is True

        # Save after submit -> 409
        r = requests.post(f"{API}/attempts/{aid}/answers", headers=H(student_token),
                          json={"answers": {"1": "x"}}, timeout=15)
        assert r.status_code == 409

        # Result contains band 0-9
        r = requests.get(f"{API}/student/results/{rid}", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        res = r.json()
        rd = res.get("skills", {}).get("reading", {})
        assert "band" in rd
        assert rd["total"] > 0
        assert 0 <= (rd["band"] or 0) <= 9


# ------------------ Cross-student result/attempt privacy --------
class TestResultPrivacy:
    def test_other_student_cannot_read_result_or_attempt(self, student_token):
        exam = _get_first_reading_exam(student_token)
        r = requests.post(f"{API}/exams/{exam['id']}/start", headers=H(student_token),
                          json={"agreed": True}, timeout=15)
        assert r.status_code == 200, r.text
        aid = r.json()["attempt_id"]
        r = requests.post(f"{API}/attempts/{aid}/submit", headers=H(student_token), timeout=30)
        assert r.status_code == 200, r.text
        rid = r.json()["result_id"]

        other_email = f"otherres_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"name": "Other", "email": other_email, "password": "Test@1234"}, timeout=15)
        assert r.status_code == 200, r.text
        other_token = r.json()["access_token"]

        r = requests.get(f"{API}/student/results/{rid}", headers=H(other_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

        r = requests.get(f"{API}/attempts/{aid}", headers=H(other_token), timeout=15)
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"


# ----------------------- Listening flow -------------------------
class TestListening:
    def test_listening_flow(self, student_token):
        r = requests.get(f"{API}/student/exams?kind=listening", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        if not items:
            pytest.skip("No listening exam seeded")
        eid = items[0]["id"]
        r = requests.post(f"{API}/exams/{eid}/start", headers=H(student_token),
                          json={"agreed": True}, timeout=15)
        assert r.status_code == 200
        aid = r.json()["attempt_id"]
        r = requests.get(f"{API}/attempts/{aid}", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        found_audio = any(sec.get("audio_url") for sec in d["exam"]["sections"])
        assert found_audio, "Listening exam missing audio_url"
        r = requests.post(f"{API}/attempts/{aid}/submit", headers=H(student_token), timeout=30)
        assert r.status_code == 200
        rid = r.json()["result_id"]
        r = requests.get(f"{API}/student/results/{rid}", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        assert "listening" in r.json().get("skills", {})


# ----------------------- Practice flow --------------------------
class TestPractice:
    def test_practice_list_and_submit(self, student_token):
        r = requests.get(f"{API}/student/practice", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        if not items:
            pytest.skip("no practice sets seeded")
        # find free
        free = next((p for p in items if p.get("is_free")), items[0])
        pid = free["id"]
        r = requests.get(f"{API}/student/practice/{pid}", headers=H(student_token), timeout=15)
        assert r.status_code == 200
        p = r.json()
        for q in p.get("questions", []):
            assert "accepted_answers" not in q
        answers = {str(q["number"]): "test" for q in p.get("questions", [])[:3]}
        r = requests.post(f"{API}/student/practice/{pid}/submit", headers=H(student_token),
                          json={"answers": answers}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "band" in d and "total" in d and "details" in d


# ------------------ Subscription simulated ----------------------
class TestSubscription:
    def test_activate_subscription(self, admin_token, new_student):
        # ensure a package exists (create one via admin if needed)
        r = requests.get(f"{API}/packages", timeout=15)
        pkgs = r.json().get("items", [])
        if not pkgs:
            pkg_payload = {
                "name": "Test Basic",
                "regular_price": 100,
                "active": True,
                "entitlements": {"full_mock_attempts": 5, "skill_mock_attempts": 5,
                                 "practice_sets": 50, "ai_evaluations": 5,
                                 "notes_access": True, "analytics_access": True,
                                 "unlimited": False, "validity_days": 30},
            }
            r = requests.post(f"{API}/admin/packages", headers=H(admin_token),
                              json=pkg_payload, timeout=15)
            assert r.status_code == 200, r.text
            pkg_id = r.json()["id"]
        else:
            pkg_id = pkgs[0]["id"]
        r = requests.post(f"{API}/student/subscribe", headers=H(new_student["token"]),
                          json={"package_id": pkg_id}, timeout=15)
        assert r.status_code == 200, r.text
        sub = r.json()["subscription"]
        assert sub["status"] == "ACTIVE"


# ------------------ Free Quota exhaustion -----------------------
class TestQuotaExhaustion:
    def test_practice_exhaustion_returns_403(self):
        """Register a fresh student, exhaust practice quota (10), then submit should 403."""
        email = f"quota_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register",
                          json={"name": "Q", "email": email, "password": "Test@1234"}, timeout=15)
        assert r.status_code == 200
        tok = r.json()["access_token"]
        # get a free practice
        r = requests.get(f"{API}/student/practice", headers=H(tok), timeout=15)
        items = r.json()["items"]
        if not items:
            pytest.skip("no practice sets")
        # prefer non-free to trigger consumption; else use any
        non_free = next((p for p in items if not p.get("is_free")), None)
        if not non_free:
            pytest.skip("no non-free practice to consume quota")
        pid = non_free["id"]
        # exhaust quota
        for i in range(11):
            r = requests.post(f"{API}/student/practice/{pid}/submit", headers=H(tok),
                              json={"answers": {}}, timeout=20)
            if r.status_code == 403:
                assert "Upgrade" in r.text or "upgrade" in r.text.lower()
                return
        pytest.fail("Quota was never exhausted after 11 submits")


# ------------------------- Admin tests --------------------------
class TestAdmin:
    def test_dashboard(self, admin_token):
        r = requests.get(f"{API}/admin/dashboard", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        assert "cards" in r.json()

    def test_create_student_returns_temp_password_and_id(self, admin_token):
        email = f"admincreate_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/admin/students", headers=H(admin_token),
                          json={"name": "Admin Made", "email": email}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["temp_password"] == "Student@123"
        assert d["user"]["student_id"].startswith("STU-")

    def test_create_package_and_batch_assigns_pkg(self, admin_token):
        # package
        pkg = {"name": f"PKG-{uuid.uuid4().hex[:6]}", "regular_price": 500, "active": True,
               "entitlements": {"full_mock_attempts": 2, "skill_mock_attempts": 2,
                                "practice_sets": 5, "ai_evaluations": 2,
                                "notes_access": True, "analytics_access": True,
                                "unlimited": False, "validity_days": 30}}
        r = requests.post(f"{API}/admin/packages", headers=H(admin_token), json=pkg, timeout=15)
        assert r.status_code == 200, r.text
        pkg_id = r.json()["id"]

        # batch with package
        batch = {"name": f"Batch-{uuid.uuid4().hex[:6]}",
                 "batch_code": f"BC-{uuid.uuid4().hex[:6].upper()}",
                 "package_id": pkg_id, "capacity": 30, "status": "active"}
        r = requests.post(f"{API}/admin/batches", headers=H(admin_token), json=batch, timeout=15)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        # create fresh student
        email = f"batchstu_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/admin/students", headers=H(admin_token),
                          json={"name": "Batch Stu", "email": email}, timeout=15)
        stu = r.json()["user"]

        # add to batch -> assigns package
        r = requests.post(f"{API}/admin/batches/{bid}/add-student", headers=H(admin_token),
                          json={"user_id": stu["id"]}, timeout=15)
        assert r.status_code == 200

        # verify subscription reflects package
        r = requests.get(f"{API}/admin/students/{stu['id']}", headers=H(admin_token), timeout=15)
        subs = r.json().get("subscriptions", [])
        assert any(s.get("package_id") == pkg_id for s in subs)


# ------------------- Exam publish validation --------------------
class TestExamBuilder:
    def test_publish_missing_accepted_answers_fails(self, admin_token):
        # Create draft with reading section but no accepted_answers on question
        payload = {
            "title": f"Draft-{uuid.uuid4().hex[:6]}",
            "kind": "reading", "duration_minutes": 60, "status": "draft",
            "sections": [{
                "skill": "reading", "order": 0,
                "passages": [{"title": "P", "body": "Some passage text.", "order": 0}],
                "questions": [{
                    "number": 1, "skill": "reading", "type": "short_answer",
                    "prompt": "What?", "accepted_answers": []
                }],
            }],
        }
        r = requests.post(f"{API}/exams", headers=H(admin_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        r = requests.post(f"{API}/exams/{eid}/publish", headers=H(admin_token), timeout=15)
        assert r.status_code == 400
        assert "missing accepted answers" in r.text.lower()


# ------------------- Exam ID entry ------------------------------
class TestExamCodeEntry:
    def test_wrong_code_404_and_ok(self, admin_token, student_token):
        # Get a published exam
        r = requests.get(f"{API}/student/exams", headers=H(student_token), timeout=15)
        items = r.json()["items"]
        if not items:
            pytest.skip("no exams")
        eid = items[0]["id"]
        code = f"EX-{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(f"{API}/exam-assignments", headers=H(admin_token),
                          json={"exam_id": eid, "exam_code": code, "attempt_limit": 5}, timeout=15)
        assert r.status_code == 200, r.text
        # wrong
        r = requests.post(f"{API}/exams/enter", headers=H(student_token),
                          json={"exam_code": "NOSUCH-XYZ"}, timeout=15)
        assert r.status_code == 404
        # correct
        r = requests.post(f"{API}/exams/enter", headers=H(student_token),
                          json={"exam_code": code}, timeout=15)
        assert r.status_code == 200
        assert r.json()["exam_id"] == eid


# ------------------- Writing AI eval ----------------------------
class TestWritingAI:
    def test_writing_evaluates(self, student_token):
        r = requests.get(f"{API}/student/exams?kind=writing", headers=H(student_token), timeout=15)
        items = r.json().get("items", [])
        if not items:
            pytest.skip("no writing exam seeded")
        eid = items[0]["id"]
        r = requests.post(f"{API}/exams/{eid}/start", headers=H(student_token),
                          json={"agreed": True}, timeout=15)
        assert r.status_code == 200, r.text
        aid = r.json()["attempt_id"]
        r = requests.get(f"{API}/attempts/{aid}", headers=H(student_token), timeout=15)
        exam = r.json()["exam"]
        # submit reasonable essay for both tasks
        essay = ("Modern technology has significantly transformed the way people communicate. "
                 "While it enables faster interaction, it also has drawbacks. In this essay, I "
                 "will discuss both sides and give my opinion. On the positive side, instant "
                 "messaging bridges distances. However, over-reliance may weaken face-to-face "
                 "skills. In conclusion, technology's benefits outweigh its downsides when used "
                 "mindfully.") * 3
        answers = {}
        for sec in exam["sections"]:
            for q in sec.get("questions", []):
                answers[str(q["number"])] = essay
        r = requests.post(f"{API}/attempts/{aid}/answers", headers=H(student_token),
                          json={"answers": answers}, timeout=15)
        assert r.status_code == 200
        r = requests.post(f"{API}/attempts/{aid}/submit", headers=H(student_token), timeout=30)
        assert r.status_code == 200
        rid = r.json()["result_id"]
        # Poll up to 60s
        band = None
        status = None
        for _ in range(20):
            time.sleep(3)
            r = requests.get(f"{API}/student/results/{rid}", headers=H(student_token), timeout=15)
            j = r.json()
            status = j.get("status")
            w = j.get("skills", {}).get("writing", {})
            band = w.get("band")
            if status == "COMPLETED" and band is not None:
                break
        # tolerate EVALUATING if the LLM is slow; PARTIAL means it settled as FAILED
        # (expected when GEMINI_API_KEY isn't configured or its quota is exhausted)
        # rather than silently COMPLETED
        assert status in ("COMPLETED", "EVALUATING", "PARTIAL")
        if status == "COMPLETED":
            assert band is not None
            assert 0 <= band <= 9
