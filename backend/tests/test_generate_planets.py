"""Hash-based freshness check for planets.json generation."""

import hashlib
from pathlib import Path

import pytest

_BODIES_PATH = Path(__file__).resolve().parent.parent / "app" / "engine" / "bodies.py"
_HASH_PATH = Path(__file__).resolve().parent / ".generate_planets_hash"


def _current_hash() -> str:
    text = _BODIES_PATH.read_text(encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_generate_planets_hash_current():
    """Fails if bodies.py changed since planets.json was last generated.

    Fix by running: cd backend && python -m app.engine.generate_planets
    """
    if not _HASH_PATH.exists():
        pytest.fail(
            "planets.json has never been generated. "
            "Run: cd backend && python -m app.engine.generate_planets"
        )
    saved = _HASH_PATH.read_text().strip()
    if saved != _current_hash():
        pytest.fail(
            "bodies.py changed since planets.json was last generated. "
            "Run: cd backend && python -m app.engine.generate_planets"
        )
