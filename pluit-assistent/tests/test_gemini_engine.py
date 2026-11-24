"""Сопоставление ошибок официального SDK google-genai с поведением бота (без сети)."""

from __future__ import annotations

import asyncio

import pytest
from google.genai import errors

from app.schemas.analysis import AlternativeReply
from app.services.ai_analyzer import FatalError, GeminiEngine, QuotaError, TransientError


def _engine(monkeypatch, exc=None, text='{"suggested_reply": "ок"}'):
    engine = GeminiEngine("test-key", 10)

    class Resp:
        pass

    async def fake(*, model, contents, config):
        assert config.response_mime_type == "application/json"
        assert config.response_schema is AlternativeReply
        assert config.system_instruction == "sys"
        if exc:
            raise exc
        r = Resp()
        r.text = text
        return r

    monkeypatch.setattr(engine._client.aio.models, "generate_content", fake)
    return engine


def _call(engine):
    return asyncio.run(engine.call("free-model", "sys", "user", AlternativeReply))


def test_success(monkeypatch):
    assert _call(_engine(monkeypatch)) == '{"suggested_reply": "ок"}'


def test_daily_quota(monkeypatch):
    body = {
        "error": {
            "code": 429,
            "message": "Quota exceeded",
            "status": "RESOURCE_EXHAUSTED",
            "details": [{"violations": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}],
        }
    }
    with pytest.raises(QuotaError) as err:
        _call(_engine(monkeypatch, errors.ClientError(429, body)))
    assert err.value.per_day


def test_minute_quota(monkeypatch):
    body = {
        "error": {
            "code": 429,
            "message": "Quota exceeded",
            "status": "RESOURCE_EXHAUSTED",
            "details": [{"violations": [{"quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"}]}],
        }
    }
    with pytest.raises(QuotaError) as err:
        _call(_engine(monkeypatch, errors.ClientError(429, body)))
    assert not err.value.per_day


def test_server_error_transient(monkeypatch):
    with pytest.raises(TransientError):
        _call(_engine(monkeypatch, errors.ServerError(503, {"error": {"code": 503, "message": "overloaded"}})))


def test_bad_request_fatal(monkeypatch):
    with pytest.raises(FatalError):
        _call(_engine(monkeypatch, errors.ClientError(404, {"error": {"code": 404, "message": "model not found"}})))


def test_empty_response_transient(monkeypatch):
    with pytest.raises(TransientError):
        _call(_engine(monkeypatch, text=""))
