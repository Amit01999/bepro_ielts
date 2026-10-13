import uuid
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# --------------------------- Auth -------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None
    target_ielts_type: Optional[str] = "academic"
    target_band: Optional[float] = 7.0


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordInput(BaseModel):
    email: EmailStr


class ResetPasswordInput(BaseModel):
    token: str
    password: str = Field(min_length=6)


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


# ------------------------- Users --------------------------------
class StudentCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: Optional[str] = None
    target_ielts_type: str = "academic"
    target_band: float = 7.0
    country: Optional[str] = None
    package_id: Optional[str] = None
    batch_id: Optional[str] = None


class StaffCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str  # teacher, examiner, content_manager, sub_admin, admin
    permissions: List[str] = []


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    target_ielts_type: Optional[str] = None
    target_band: Optional[float] = None
    target_exam_date: Optional[str] = None
    status: Optional[str] = None
    permissions: Optional[List[str]] = None


# ------------------------ Packages ------------------------------
class Entitlements(BaseModel):
    full_mock_attempts: int = 0
    skill_mock_attempts: int = 0
    practice_sets: int = 0
    ai_evaluations: int = 0
    notes_access: bool = False
    analytics_access: bool = False
    unlimited: bool = False
    validity_days: int = 30


class PackageInput(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = ""
    regular_price: float = 0
    sale_price: Optional[float] = None
    currency: str = "BDT"
    active: bool = True
    featured: bool = False
    is_free: bool = False
    image: Optional[str] = None
    benefits: List[str] = []
    display_order: int = 0
    entitlements: Entitlements = Entitlements()


# ------------------------- Batches ------------------------------
class BatchInput(BaseModel):
    name: str
    batch_code: str
    description: Optional[str] = ""
    teacher_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    capacity: int = 30
    package_id: Optional[str] = None
    schedule: Optional[str] = None
    status: str = "active"


# ------------------------ Questions -----------------------------
class Question(BaseModel):
    id: str = Field(default_factory=new_id)
    number: int
    skill: str
    ielts_type: str = "academic"
    type: str  # mcq_single, mcq_multi, tfng, ynng, matching, completion, short_answer, map_labeling, essay, letter
    prompt: str
    options: List[str] = []
    accepted_answers: List[str] = []
    explanation: Optional[str] = ""
    max_words: Optional[int] = None
    difficulty: str = "medium"
    topic: Optional[str] = None
    status: str = "published"


class Passage(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str
    body: str
    order: int = 0


class ExamSection(BaseModel):
    id: str = Field(default_factory=new_id)
    skill: str  # listening, reading, writing, speaking
    order: int = 0
    instructions: str = ""
    audio_url: Optional[str] = None
    passages: List[Passage] = []
    questions: List[Question] = []
    duration_minutes: Optional[int] = None


class ExamInput(BaseModel):
    title: str
    ielts_type: str = "academic"
    kind: str = "full"  # full, listening, reading, writing, speaking
    description: Optional[str] = ""
    duration_minutes: int = 60
    is_free: bool = False
    packages_allowed: List[str] = []
    ai_evaluation: bool = True
    instructions: str = ""
    sections: List[ExamSection] = []
    status: str = "draft"
    source_document_id: Optional[str] = None


# ------------------------ Practice ------------------------------
class PracticeInput(BaseModel):
    title: str
    skill: str
    ielts_type: str = "academic"
    topic: Optional[str] = None
    level: str = "intermediate"
    estimated_minutes: int = 20
    instructions: str = ""
    is_free: bool = True
    audio_url: Optional[str] = None
    passage: Optional[str] = None
    questions: List[Question] = []
    reveal_answers: bool = True


# ----------------------- Attempts -------------------------------
class StartExamInput(BaseModel):
    exam_id: Optional[str] = None
    exam_code: Optional[str] = None
    access_pin: Optional[str] = None
    agreed: bool = True


class SaveAnswersInput(BaseModel):
    answers: Dict[str, Any]
    section_index: Optional[int] = None


class ViolationInput(BaseModel):
    type: str
    question_number: Optional[int] = None


# ------------------------ Exam ID -------------------------------
class ExamAssignmentInput(BaseModel):
    exam_id: str
    exam_code: str
    batch_id: Optional[str] = None
    access_pin: Optional[str] = None
    start_time: Optional[str] = None
    close_time: Optional[str] = None
    attempt_limit: int = 1
    result_release: str = "immediate"  # immediate, manual, scheduled


# ---------------------- Subscriptions ---------------------------
class SubscribeInput(BaseModel):
    package_id: str
    coupon_code: Optional[str] = None


class AssignPackageInput(BaseModel):
    user_id: str
    package_id: str


# ------------------------- AI / Reviews -------------------------
class TeacherReviewInput(BaseModel):
    criteria_scores: Dict[str, float] = {}
    overall_band: Optional[float] = None
    comments: Optional[str] = ""
    approved: bool = False


class SettingsInput(BaseModel):
    data: Dict[str, Any]


class MaterialInput(BaseModel):
    title: str
    description: Optional[str] = ""
    type: str = "note"  # note, pdf, vocabulary, guide, link, video
    url: Optional[str] = None
    content: Optional[str] = ""
    target_type: str = "everyone"  # everyone, package, batch, student, academic, general
    target_id: Optional[str] = None
