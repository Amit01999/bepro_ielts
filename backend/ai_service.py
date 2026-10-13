import io
import os
import json
import re
from google import genai
from google.genai import types
from google.genai.errors import APIError

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")

WRITING_RUBRIC_VERSION = "writing-v1"
SPEAKING_RUBRIC_VERSION = "speaking-v1"
EXTRACTION_RUBRIC_VERSION = "extraction-v1"

_client = None


def _client_or_raise() -> genai.Client:
    global _client
    if _client is None:
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured.")
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


async def _generate_json(system: str, parts: list) -> dict:
    client = _client_or_raise()
    try:
        resp = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=parts,
            config=types.GenerateContentConfig(system_instruction=system, response_mime_type="application/json"),
        )
    except APIError as e:
        raise RuntimeError(f"Gemini API error {e.code}: {e.message}")
    if not resp.text:
        reason = None
        try:
            reason = resp.candidates[0].finish_reason
        except Exception:
            pass
        raise RuntimeError(f"Gemini returned no usable content (finish_reason={reason}).")
    return _parse_json_relaxed(resp.text)


async def _generate_text(system: str, parts: list) -> str:
    client = _client_or_raise()
    try:
        resp = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=parts,
            config=types.GenerateContentConfig(system_instruction=system),
        )
    except APIError as e:
        raise RuntimeError(f"Gemini API error {e.code}: {e.message}")
    return resp.text or ""


async def _upload_audio_part(audio_bytes: bytes, mime_type: str) -> types.Part:
    """Audio goes through the File API rather than inline bytes: our 25MB recording cap,
    once base64-inflated for an inline request, exceeds Gemini's ~20MB inline-audio ceiling.
    Accepts BytesIO directly, so this still needs no temporary file on disk."""
    client = _client_or_raise()
    uploaded = await client.aio.files.upload(
        file=io.BytesIO(audio_bytes), config=types.UploadFileConfig(mime_type=mime_type))
    return types.Part.from_uri(file_uri=uploaded.uri, mime_type=uploaded.mime_type)


WRITING_SYSTEM = """You are a senior IELTS Writing examiner. Evaluate essays using the four official IELTS Writing criteria and estimate band scores (0-9, half-bands allowed).
Criteria: Task Achievement/Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy.
Return ONLY valid JSON, no markdown, with this exact shape:
{
  "overall_band": number,
  "criteria": {
    "task_response": {"band": number, "feedback": string},
    "coherence_cohesion": {"band": number, "feedback": string},
    "lexical_resource": {"band": number, "feedback": string},
    "grammatical_range": {"band": number, "feedback": string}
  },
  "strengths": [string],
  "weaknesses": [string],
  "grammar_observations": [string],
  "vocabulary_observations": [string],
  "corrected_examples": [{"original": string, "improved": string}],
  "recommended_exercises": [string],
  "target_gap_note": string,
  "model_answer": string
}
Bands must be one of 0,0.5,1,...,9. Keep feedback specific and actionable."""

SPEAKING_SYSTEM = """You are a senior IELTS Speaking examiner. Evaluate a candidate's spoken responses using the four IELTS Speaking criteria and estimate band scores (0-9, half-bands allowed).
Criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, Pronunciation.
You may be given the actual audio recording(s) in addition to a transcript — when audio is present, base Pronunciation and Fluency and Coherence on what you actually hear (intonation, rhythm, hesitation, stress, clarity), not only on the transcript text. When only a transcript is given, infer from text quality/markers only and note that limitation.
Return ONLY valid JSON, no markdown, with this exact shape:
{
  "overall_band": number,
  "criteria": {
    "fluency_coherence": {"band": number, "feedback": string},
    "lexical_resource": {"band": number, "feedback": string},
    "grammatical_range": {"band": number, "feedback": string},
    "pronunciation": {"band": number, "feedback": string}
  },
  "strengths": [string],
  "weaknesses": [string],
  "filler_word_note": string,
  "fluency_observations": [string],
  "recommended_exercises": [string]
}
Bands must be one of 0,0.5,1,...,9."""

EXTRACTION_SYSTEM = """You are an expert IELTS exam digitization assistant. You will be given a PDF of an IELTS \
question paper — it may be a digitally-produced document or a scanned image; read it visually either way. \
Convert it into structured JSON for a mock-test platform.
Return ONLY valid JSON, no markdown, with this exact shape:
{
  "title": string,
  "ielts_type": "academic" or "general",
  "kind": "listening" or "reading" or "writing" or "speaking" or "full",
  "duration_minutes": number,
  "instructions": string,
  "sections": [
    {
      "skill": "listening" or "reading" or "writing" or "speaking",
      "instructions": string,
      "passages": [{"title": string, "body": string}],
      "questions": [
        {
          "number": number,
          "type": "mcq_single" or "mcq_multi" or "tfng" or "ynng" or "matching" or "completion" or "short_answer" or "essay" or "letter",
          "prompt": string,
          "options": [string],
          "accepted_answers": [string],
          "explanation": string
        }
      ]
    }
  ],
  "warnings": [string]
}
Rules:
- Use "options" only for mcq_single/mcq_multi/tfng/ynng/matching questions; an empty array otherwise.
- Only populate "accepted_answers" when an answer key is clearly visible somewhere in the source document. If no \
answer key is visible anywhere, leave "accepted_answers" as an empty array for every question and add one entry to \
"warnings": "No answer key found in the source document — answers must be entered manually before publishing."
- A PDF never contains real listening audio. For every listening section, always add a warning: "Listening section \
audio must be uploaded separately in the Exam Builder before this exam can be published."
- There is no supported question type yet for labeling a map, diagram or image. If you encounter one, extract its \
text as best you can with type "short_answer" and add a warning naming that question number as needing manual review.
- If any part of the document is unclear, ambiguous, or you are not confident about a question's type or boundary, \
do not guess silently: make your best attempt and add a specific warning naming the page or question number.
- Never invent a question, option, or answer that is not actually present in the source document.
Question "number" must be sequential within each section starting at 1. Keep "warnings" as a flat list of short, \
specific strings an exam administrator can act on — an empty list if there is nothing to flag."""


def _parse_json(text: str) -> dict:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        text = m.group(0)
    return json.loads(text)


def _parse_json_relaxed(text: str) -> dict:
    """Like _parse_json, but decodes only the first JSON object instead of greedily
    matching to the last '}' in the response — a large exam-extraction payload is more
    likely to carry trailing commentary that would otherwise corrupt the match."""
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start = text.index("{")
    obj, _ = json.JSONDecoder().raw_decode(text[start:])
    return obj


async def evaluate_writing(prompt: str, essay: str, task_type: str = "Task 2") -> dict:
    text = f"IELTS Writing {task_type}.\n\nPROMPT:\n{prompt}\n\nCANDIDATE RESPONSE:\n{essay}\n\nReturn the JSON evaluation."
    data = await _generate_json(WRITING_SYSTEM, [text])
    return {"model": GEMINI_MODEL, "provider": "gemini", "rubric_version": WRITING_RUBRIC_VERSION, "raw": data}


async def evaluate_speaking(transcript: str, audio_parts: list | None = None) -> dict:
    """audio_parts: optional list of (audio_bytes, mime_type) tuples. When given, the actual
    recordings are sent to Gemini alongside the transcript so Pronunciation and Fluency are
    judged from the real audio rather than text alone."""
    parts: list = [f"IELTS Speaking transcript:\n\n{transcript}\n\nReturn the JSON evaluation."]
    for audio_bytes, mime_type in (audio_parts or []):
        parts.append(await _upload_audio_part(audio_bytes, mime_type))
    data = await _generate_json(SPEAKING_SYSTEM, parts)
    return {"model": GEMINI_MODEL, "provider": "gemini", "rubric_version": SPEAKING_RUBRIC_VERSION, "raw": data}


async def extract_exam_structure(pdf_bytes: bytes, filename: str) -> dict:
    pdf_part = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
    text = f"Digitize this IELTS question paper ({filename}). Return the JSON structure."
    data = await _generate_json(EXTRACTION_SYSTEM, [pdf_part, text])
    return {"model": GEMINI_MODEL, "provider": "gemini", "rubric_version": EXTRACTION_RUBRIC_VERSION, "raw": data}


async def transcribe_audio(audio_bytes: bytes, suffix: str = ".webm") -> str:
    mime_type = {
        ".webm": "audio/webm", ".wav": "audio/wav", ".mp3": "audio/mp3",
        ".m4a": "audio/mp4", ".ogg": "audio/ogg",
    }.get(suffix.lower(), "audio/webm")
    audio_part = await _upload_audio_part(audio_bytes, mime_type)
    text = await _generate_text(
        "Transcribe the spoken audio verbatim in English. Return only the transcript text, nothing else.",
        [audio_part])
    return text.strip()
