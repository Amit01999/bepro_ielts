import re
from typing import List

# ---------------- Band conversion tables (raw /40 -> band) ----------------
# Ranges are inclusive. Ordered high->low; first match wins.
LISTENING_TABLE = [
    (39, 40, 9.0), (37, 38, 8.5), (35, 36, 8.0), (32, 34, 7.5), (30, 31, 7.0),
    (26, 29, 6.5), (23, 25, 6.0), (18, 22, 5.5), (16, 17, 5.0), (13, 15, 4.5),
    (10, 12, 4.0), (8, 9, 3.5), (6, 7, 3.0), (4, 5, 2.5), (2, 3, 2.0), (0, 1, 1.0),
]
ACADEMIC_READING_TABLE = [
    (39, 40, 9.0), (37, 38, 8.5), (35, 36, 8.0), (33, 34, 7.5), (30, 32, 7.0),
    (27, 29, 6.5), (23, 26, 6.0), (19, 22, 5.5), (15, 18, 5.0), (13, 14, 4.5),
    (10, 12, 4.0), (8, 9, 3.5), (6, 7, 3.0), (4, 5, 2.5), (0, 3, 2.0),
]
GENERAL_READING_TABLE = [
    (40, 40, 9.0), (39, 39, 8.5), (37, 38, 8.0), (36, 36, 7.5), (34, 35, 7.0),
    (32, 33, 6.5), (30, 31, 6.0), (27, 29, 5.5), (23, 26, 5.0), (19, 22, 4.5),
    (15, 18, 4.0), (12, 14, 3.5), (9, 11, 3.0), (6, 8, 2.5), (0, 5, 2.0),
]


def table_for(skill: str, ielts_type: str):
    if skill == "listening":
        return LISTENING_TABLE
    if skill == "reading":
        return GENERAL_READING_TABLE if ielts_type == "general" else ACADEMIC_READING_TABLE
    return ACADEMIC_READING_TABLE


def raw_to_band(raw: int, skill: str, ielts_type: str = "academic", table=None) -> float:
    tbl = table or table_for(skill, ielts_type)
    for lo, hi, band in tbl:
        if lo <= raw <= hi:
            return band
    return 0.0


def round_half_band(value: float) -> float:
    """IELTS overall rounding: .25 -> up to .5, .75 -> up to next whole."""
    whole = int(value)
    frac = value - whole
    if frac < 0.25:
        return float(whole)
    if frac < 0.75:
        return whole + 0.5
    return float(whole + 1)


def overall_band(bands: List[float]) -> float:
    bands = [b for b in bands if b is not None]
    if not bands:
        return 0.0
    return round_half_band(sum(bands) / len(bands))


# ---------------- Answer normalization / checking ----------------
def _normalize(text: str) -> str:
    text = str(text).strip().lower()
    text = re.sub(r"[.,;:!?'\"]+$", "", text)
    text = re.sub(r"\s+", " ", text)
    # common number/word variants
    text = text.replace("&", "and")
    return text


def check_answer(user_answer, accepted: List[str]) -> bool:
    if user_answer is None or user_answer == "":
        return False
    if isinstance(user_answer, list):
        ua = sorted(_normalize(x) for x in user_answer)
        acc = sorted(_normalize(x) for x in accepted)
        return ua == acc
    ua = _normalize(user_answer)
    for a in accepted:
        variants = [v.strip() for v in str(a).split("/")]  # allow slash-separated variants
        for v in variants:
            if ua == _normalize(v):
                return True
    return False


def score_objective_section(questions: List[dict], answers: dict):
    """Returns (raw_correct, total, per_question[])."""
    correct = 0
    details = []
    for q in questions:
        num = str(q["number"])
        ua = answers.get(num)
        is_correct = check_answer(ua, q.get("accepted_answers", []))
        if is_correct:
            correct += 1
        details.append({
            "number": q["number"],
            "type": q.get("type"),
            "topic": q.get("topic"),
            "user_answer": ua,
            "correct_answer": q.get("accepted_answers", []),
            "is_correct": is_correct,
            "answered": ua is not None and ua != "",
        })
    return correct, len(questions), details
