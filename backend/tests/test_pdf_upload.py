"""PDF upload -> Cloudinary -> extraction -> draft exam workflow.

Covers:
 - Authorized upload succeeds with real Cloudinary asset metadata
 - Non-admin upload -> 403
 - Non-PDF content -> 400
 - Oversized file -> 400
 - Delete removes both the Mongo record and the live Cloudinary asset (verified by a
   real follow-up fetch, not a mock)
 - Extraction reaches a terminal status; when GEMINI_API_KEY is configured and has quota
   available it produces a real draft exam linked back to the source document
 - Full success criterion (upload -> extract -> review/correct -> publish -> student
   completes it -> result) when GEMINI_API_KEY is configured; explicitly skipped
   with a clear reason otherwise, matching the existing TestWritingAI tolerance pattern
"""
import os
import io
import time
import pathlib
import pytest
import requests
from dotenv import dotenv_values

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://writing-excellence-2.preview.emergentagent.com").rstrip("/")
API = BASE_URL + "/api"

ADMIN_EMAIL = "nirmul554@gmail.com"
ADMIN_PASS = "Admin@12345"
STUDENT_EMAIL = "student@bepro.com"
STUDENT_PASS = "Student@123"

# Read the backend's own .env directly rather than this test process's environment — the
# server that actually performs extraction runs as a separate process.
_ENV = dotenv_values(pathlib.Path(__file__).parent.parent / ".env")
HAS_AI_KEY = bool((_ENV.get("GEMINI_API_KEY") or "").strip()) and not (_ENV.get("GEMINI_API_KEY") or "").startswith("your-gemini")

# Conditions genuinely outside this code's control: quota/rate-limit exhaustion and
# transient provider-side overload (Google's own "high demand... try again later" 503s —
# more likely when this suite's own parallel workers burst several real Gemini calls
# in a tight window). Both are BLOCKED, not a defect in this implementation.
TRANSIENT_PROVIDER_MARKERS = ("RESOURCE_EXHAUSTED", "429", "quota", "503", "UNAVAILABLE", "high demand")


def _is_quota_warning(warnings: list) -> bool:
    text = " ".join(warnings or [])
    return any(m in text for m in TRANSIENT_PROVIDER_MARKERS)


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_EMAIL, ADMIN_PASS)["access_token"]


@pytest.fixture(scope="module")
def student_token():
    return _login(STUDENT_EMAIL, STUDENT_PASS)["access_token"]


def _sample_pdf_bytes() -> bytes:
    """A minimal hand-built, genuinely valid single-page PDF containing real IELTS-style
    TFNG question text and an inline answer key, so extraction has something real to read."""
    content_stream = (
        b"BT\n/F1 14 Tf\n50 760 Td\n(IELTS Academic Reading Practice Test - Sample) Tj\n"
        b"0 -30 Td\n(Passage 1: The History of Tea) Tj\n"
        b"0 -20 Td\n(Tea has been consumed for thousands of years. It originated in China) Tj\n"
        b"0 -16 Td\n(and spread across Asia before reaching Europe in the 17th century.) Tj\n"
        b"0 -30 Td\n(Question 1. Tea originated in China.) Tj\n"
        b"0 -16 Td\n(Write TRUE, FALSE or NOT GIVEN.) Tj\n"
        b"0 -20 Td\n(Answer: TRUE) Tj\n"
        b"0 -30 Td\n(Question 2. Tea reached Europe before the 15th century.) Tj\n"
        b"0 -20 Td\n(Answer: FALSE) Tj\n"
        b"0 -30 Td\n(Question 3. Tea is the most popular drink in the world.) Tj\n"
        b"0 -20 Td\n(Answer: NOT GIVEN) Tj\nET"
    )
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>",
        b"<< /Length " + str(len(content_stream)).encode() + b" >>\nstream\n" + content_stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref_offset = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF").encode()
    return bytes(out)


def _upload(tok, filename="sample-ielts.pdf", content_type="application/pdf", data=None):
    data = data if data is not None else _sample_pdf_bytes()
    files = {"file": (filename, io.BytesIO(data), content_type)}
    return requests.post(f"{API}/admin/source-documents", headers=H(tok), files=files, timeout=30)


class TestUploadValidation:
    def test_authorized_upload_creates_real_cloudinary_asset(self, admin_token):
        r = _upload(admin_token)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "uploaded"
        assert d["cloudinary_public_id"]
        assert d["cloudinary_resource_type"] == "raw"
        assert d["size_bytes"] > 0

        # Real round-trip: fetch the signed preview URL and confirm the asset is genuinely
        # retrievable from Cloudinary, not just recorded in Mongo.
        pr = requests.get(f"{API}/admin/source-documents/{d['id']}/preview-url", headers=H(admin_token), timeout=15)
        assert pr.status_code == 200, pr.text
        fetched = requests.get(pr.json()["url"], timeout=15)
        assert fetched.status_code == 200
        assert fetched.content[:5] == b"%PDF-"

        # cleanup
        dr = requests.delete(f"{API}/admin/source-documents/{d['id']}", headers=H(admin_token), timeout=15)
        assert dr.status_code == 200

    def test_student_cannot_upload(self, student_token):
        r = _upload(student_token)
        assert r.status_code == 403

    def test_non_pdf_content_rejected(self, admin_token):
        r = _upload(admin_token, filename="not-a-pdf.txt", content_type="text/plain", data=b"hello world, not a pdf")
        assert r.status_code == 400

    def test_oversized_file_rejected(self, admin_token):
        oversized = b"%PDF-1.4\n" + (b"0" * (20 * 1024 * 1024 + 1))
        r = _upload(admin_token, data=oversized)
        assert r.status_code == 400


class TestDeleteCleansUpCloudinary:
    def test_delete_removes_mongo_and_cloudinary(self, admin_token):
        r = _upload(admin_token)
        assert r.status_code == 200, r.text
        doc_id = r.json()["id"]

        pr = requests.get(f"{API}/admin/source-documents/{doc_id}/preview-url", headers=H(admin_token), timeout=15)
        preview_url = pr.json()["url"]

        dr = requests.delete(f"{API}/admin/source-documents/{doc_id}", headers=H(admin_token), timeout=15)
        assert dr.status_code == 200

        lr = requests.get(f"{API}/admin/source-documents", headers=H(admin_token), timeout=15)
        assert all(x["id"] != doc_id for x in lr.json()["items"])

        # Real check against the live Cloudinary account, not a mock.
        still_there = requests.get(preview_url, timeout=15)
        assert still_there.status_code == 404


class TestExtraction:
    def test_extraction_reaches_terminal_status(self, admin_token):
        r = _upload(admin_token)
        doc_id = r.json()["id"]
        try:
            er = requests.post(f"{API}/admin/source-documents/{doc_id}/extract", headers=H(admin_token), timeout=15)
            assert er.status_code == 200, er.text

            status = None
            for _ in range(30):
                time.sleep(2)
                lr = requests.get(f"{API}/admin/source-documents", headers=H(admin_token), timeout=15)
                doc = next(x for x in lr.json()["items"] if x["id"] == doc_id)
                status = doc["status"]
                if status in ("extracted", "extraction_failed"):
                    break
            assert status in ("extracted", "extraction_failed"), f"extraction never settled: {status}"

            if not HAS_AI_KEY:
                assert status == "extraction_failed"
                assert doc["extraction_warnings"], "a failed extraction should explain why"
                pytest.skip("GEMINI_API_KEY not configured in this environment — extraction correctly failed closed; BLOCKED, not a defect.")

            if status == "extraction_failed" and _is_quota_warning(doc["extraction_warnings"]):
                pytest.skip(f"Gemini API quota exhausted for this account — BLOCKED, not a defect: {doc['extraction_warnings']}")

            assert status == "extracted"
            assert doc["exam_id"]
            exr = requests.get(f"{API}/exams/{doc['exam_id']}", headers=H(admin_token), timeout=15)
            assert exr.status_code == 200
            exam = exr.json()
            assert exam["status"] == "draft"
            assert exam["source_document_id"] == doc_id
            assert exam["sections"], "extraction produced an exam with no sections at all"
        finally:
            requests.delete(f"{API}/admin/source-documents/{doc_id}", headers=H(admin_token), timeout=15)


@pytest.mark.skipif(not HAS_AI_KEY, reason="GEMINI_API_KEY not configured in this environment — full extraction->publish->student-completion chain is BLOCKED, not a defect.")
class TestFullSuccessCriterion:
    def test_pdf_to_published_exam_to_student_result(self, admin_token, student_token):
        r = _upload(admin_token)
        doc_id = r.json()["id"]
        requests.post(f"{API}/admin/source-documents/{doc_id}/extract", headers=H(admin_token), timeout=15)

        exam_id = None
        for _ in range(30):
            time.sleep(2)
            lr = requests.get(f"{API}/admin/source-documents", headers=H(admin_token), timeout=15)
            doc = next(x for x in lr.json()["items"] if x["id"] == doc_id)
            if doc["status"] == "extracted":
                exam_id = doc["exam_id"]
                break
            if doc["status"] == "extraction_failed":
                if _is_quota_warning(doc["extraction_warnings"]):
                    pytest.skip(f"Gemini API quota exhausted for this account — BLOCKED, not a defect: {doc['extraction_warnings']}")
                pytest.fail(f"extraction failed unexpectedly: {doc['extraction_warnings']}")
        assert exam_id, "extraction did not settle in time"

        # Simulate the mandatory human review/correction step: ensure every objective
        # question has at least one accepted answer before publishing (the extracted PDF's
        # inline answer key should already have populated these for a well-formed source).
        exr = requests.get(f"{API}/exams/{exam_id}", headers=H(admin_token), timeout=15)
        exam = exr.json()
        changed = False
        for sec in exam["sections"]:
            for q in sec.get("questions", []):
                if q.get("type") not in ("essay", "letter") and not q.get("accepted_answers"):
                    q["accepted_answers"] = ["true"]
                    changed = True
        if changed:
            pur = requests.put(f"{API}/exams/{exam_id}", headers=H(admin_token), json=exam, timeout=15)
            assert pur.status_code == 200, pur.text

        pub = requests.post(f"{API}/exams/{exam_id}/publish", headers=H(admin_token), timeout=15)
        assert pub.status_code == 200, pub.text

        listed = requests.get(f"{API}/student/exams", headers=H(student_token), timeout=15)
        assert any(x["id"] == exam_id for x in listed.json()["items"]), "published exam not visible to an eligible student"

        start = requests.post(f"{API}/exams/{exam_id}/start", headers=H(student_token), json={"agreed": True}, timeout=15)
        assert start.status_code == 200, start.text
        aid = start.json()["attempt_id"]

        att = requests.get(f"{API}/attempts/{aid}", headers=H(student_token), timeout=15).json()
        answers = {}
        for sec in att["exam"]["sections"]:
            for q in sec.get("questions", []):
                if q.get("type") not in ("essay", "letter"):
                    answers[str(q["number"])] = "true"
        requests.post(f"{API}/attempts/{aid}/answers", headers=H(student_token), json={"answers": answers}, timeout=15)

        sub = requests.post(f"{API}/attempts/{aid}/submit", headers=H(student_token), timeout=30)
        assert sub.status_code == 200, sub.text
        rid = sub.json()["result_id"]

        res = requests.get(f"{API}/student/results/{rid}", headers=H(student_token), timeout=15).json()
        assert res["id"] == rid
        assert res["skills"], "no result produced from the PDF-derived exam"

        requests.delete(f"{API}/admin/source-documents/{doc_id}", headers=H(admin_token), timeout=15)
