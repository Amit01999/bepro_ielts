"""Unit + guarded-live coverage for the Gemini migration in ai_service.py.

Unit tests (no network, always run): the JSON-parsing helpers tolerate the same
markdown-fenced / noisy-output shapes a real LLM response can contain.

The live test makes exactly one real call to confirm the new client/model/auth
wiring genuinely works end-to-end. If GEMINI_API_KEY is missing, or the account's
quota is exhausted (confirmed to be the real state of this project's key at the
time this suite was written), it is reported as explicitly BLOCKED via
pytest.skip with the real error — never silently passed, never a hard failure
for something outside this code's control.
"""
import sys
import pathlib
import asyncio
import pytest
from dotenv import dotenv_values, load_dotenv

_BACKEND_DIR = pathlib.Path(__file__).parent.parent
load_dotenv(_BACKEND_DIR / ".env")  # ai_service reads GEMINI_API_KEY/GEMINI_MODEL at import time

sys.path.insert(0, str(_BACKEND_DIR))
import ai_service  # noqa: E402

_ENV = dotenv_values(_BACKEND_DIR / ".env")
HAS_AI_KEY = bool((_ENV.get("GEMINI_API_KEY") or "").strip()) and not (_ENV.get("GEMINI_API_KEY") or "").startswith("your-gemini")


class TestJsonParsing:
    def test_parse_json_strips_markdown_fence(self):
        text = '```json\n{"overall_band": 7.0, "notes": "ok"}\n```'
        assert ai_service._parse_json(text) == {"overall_band": 7.0, "notes": "ok"}

    def test_parse_json_relaxed_ignores_trailing_commentary(self):
        text = '{"a": 1, "b": [1, 2, 3]}\n\nNote: this is my best attempt at the JSON.'
        assert ai_service._parse_json_relaxed(text) == {"a": 1, "b": [1, 2, 3]}

    def test_parse_json_relaxed_handles_nested_braces(self):
        text = '```json\n{"outer": {"inner": {"deep": true}}, "list": [{"x": 1}]}\n```'
        obj = ai_service._parse_json_relaxed(text)
        assert obj["outer"]["inner"]["deep"] is True
        assert obj["list"][0]["x"] == 1


class TestClientConfiguration:
    def test_missing_key_raises_clear_error(self, monkeypatch):
        monkeypatch.setattr(ai_service, "GEMINI_API_KEY", None)
        monkeypatch.setattr(ai_service, "_client", None)
        with pytest.raises(RuntimeError, match="GEMINI_API_KEY is not configured"):
            ai_service._client_or_raise()


@pytest.mark.skipif(not HAS_AI_KEY, reason="GEMINI_API_KEY not configured in this environment — BLOCKED, not a defect.")
class TestLiveGeminiCall:
    def test_one_real_call_succeeds_or_reports_quota_blocked(self):
        """Deliberately a single minimal call — this account's quota is known to be
        tight, so this suite does not run a broad sweep."""
        async def _call():
            return await ai_service.evaluate_writing(
                prompt="Describe your hometown in a few sentences.",
                essay="My hometown is a small coastal town known for its fishing industry and quiet beaches.",
                task_type="Task 2",
            )

        try:
            result = asyncio.run(_call())
        except RuntimeError as e:
            msg = str(e)
            # Quota exhaustion and transient provider-side overload (Google's own "high
            # demand... try again later" 503s) are both outside this code's control.
            markers = ("RESOURCE_EXHAUSTED", "429", "quota", "503", "UNAVAILABLE", "high demand")
            if any(m.lower() in msg.lower() for m in markers):
                pytest.skip(f"Gemini API unavailable for this account right now — BLOCKED, not a defect: {msg}")
            raise
        assert result["provider"] == "gemini"
        band = result["raw"].get("overall_band")
        assert band is not None and 0 <= band <= 9
