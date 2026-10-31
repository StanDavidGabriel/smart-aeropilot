import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
AIRPORTS = json.loads((DATA / "airports.json").read_text(encoding="utf-8"))
BASE_ICAO = "LRCV"
BASE_REGION = "Dolj, Romania"
_LABELS = {a["icao"]: a["iata"] for a in AIRPORTS}

def airport_code(icao):
    return _LABELS.get(icao, icao) or "—"

def airport_reason(reason):
    return re.sub(r"\b[A-Z]{4}\b", lambda m: airport_code(m[0]), reason)

def validate_airport(icao):
    if not re.fullmatch(r"[A-Z0-9]{4}", icao):
        raise ValueError("Use a four-character ICAO airport identifier.")
    return icao

def search_airports(query):
    q = query.strip().casefold()
    if not q:
        return []
    ranked = []
    for a in AIRPORTS:
        rank = (0 if a["iata"].casefold().startswith(q) or a["icao"].casefold().startswith(q)
                else 1 if a["city"].casefold().startswith(q)
                else 2 if q in a["name"].casefold() or q in a["city"].casefold() else -1)
        if rank >= 0:
            ranked.append((rank, a))
    return [a for _, a in sorted(ranked, key=lambda x: x[0])]
