"""Generate frontend/data/planets.json from bodies.py.

Usage:
  cd engine && python -m app.engine.generate_planets
"""

import hashlib
import json
from pathlib import Path

import astropy.units as u

from app.engine.bodies import PLANETS

_OUTPUT = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "data" / "planets.json"
_BODIES_PATH = Path(__file__).resolve().parent / "bodies.py"
_HASH_PATH = Path(__file__).resolve().parent.parent.parent / "tests" / ".generate_planets_hash"


def generate_planets() -> list[dict]:
    return [
        {
            "name": p.name,
            "semi_major_axis_au": round(p.semi_major_axis.to(u.AU).value, 4),
            "orbital_period_days": round(p.orbital_period.to(u.day).value, 4),
        }
        for p in PLANETS
    ]


def write_planets() -> None:
    data = generate_planets()
    _OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    _OUTPUT.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Wrote {_OUTPUT} ({len(data)} planets)")

    # Update hash so the freshness test passes
    text = _BODIES_PATH.read_text(encoding="utf-8")
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()
    _HASH_PATH.write_text(h)
    print(f"Wrote hash to {_HASH_PATH}")


if __name__ == "__main__":
    write_planets()
