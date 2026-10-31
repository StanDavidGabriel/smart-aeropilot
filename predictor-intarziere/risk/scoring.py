"""Faithful port of the flight-risk scoring model (heuristic, not a probability)."""
import math
import re

DEFAULT_WEIGHTS = {"weather": 0.4, "inbound": 0.35, "congestion": 0.25}
CANCEL_THRESHOLD = 0.85

def clamp(value):
    return min(1, max(0, value))

def decode_metar(raw):
    tokens = raw.strip().split()
    m = dict(icao=tokens[0] if tokens else "", visibilityM=None, ceilingFt=None,
             windKt=None, gustKt=None, thunderstorm=False, fog=False)
    for token in tokens[1:]:
        wind = re.fullmatch(r"(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT", token)
        if wind:
            m.update(windKt=int(wind[2]), gustKt=int(wind[3]) if wind[3] else None)
            continue
        if token == "CAVOK":
            m["visibilityM"] = 10000
            continue
        if m["visibilityM"] is None and re.fullmatch(r"\d{4}", token):
            m["visibilityM"] = 10000 if token == "9999" else int(token)
            continue
        cloud = re.match(r"(BKN|OVC|VV)(\d{3})", token)
        if cloud:
            height = int(cloud[2]) * 100
            m["ceilingFt"] = min(m["ceilingFt"], height) if m["ceilingFt"] is not None else height
            continue
        if re.match(r"^[+-]?(VC)?\w*TS", token) and not token.startswith("R"):
            m["thunderstorm"] = True
        if re.fullmatch(r"(MI|BC|PR|FZ)?FG", token):
            m["fog"] = True
    return m

def weather_severity(m):
    parts = []
    vis = m["visibilityM"]
    if vis is not None:
        v = 1 if vis < 200 else .8 if vis < 800 else .5 if vis < 1500 else .2 if vis < 5000 else 0
        if v:
            parts.append((v, f"{'Fog' if m['fog'] else 'Low visibility'} at {m['icao']}: visibility {vis} m"))
    if m["fog"] and not parts:
        parts.append((.6, f"Fog at {m['icao']}"))
    c = m["ceilingFt"]
    if c is not None:
        v = 1 if c < 200 else .6 if c < 500 else .3 if c < 1000 else 0
        if v: parts.append((v, f"Low ceiling at {m['icao']}: {c} ft"))
    g = m["gustKt"]
    if g is not None:
        v = .8 if g >= 40 else .5 if g >= 30 else .3 if g >= 25 else 0
        if v: parts.append((v, f"Wind gusts at {m['icao']}: {g} kt"))
    if m["thunderstorm"]: parts.append((.9, f"Thunderstorm at {m['icao']}"))
    parts.sort(key=lambda p: -p[0])
    return (clamp(parts[0][0] + .1 * (len(parts)-1)), [p[1] for p in parts]) if parts else (0, [])

def inbound_delay_factor(minutes):
    return clamp(minutes / 90)

def level_for(score):
    return "critical" if score >= .85 else "high" if score >= .6 else "medium" if score >= .3 else "low"

def compute_risk(origin, dest, inbound_delay_min, congestion, weights=None):
    w = DEFAULT_WEIGHTS if weights is None else weights
    o, oreasons = weather_severity(origin)
    d, dreasons = weather_severity(dest)
    cg = clamp(congestion)
    contributions = [
        (w["weather"] * o, oreasons),
        (w["weather"] * d * .8, dreasons),
        (w["inbound"] * inbound_delay_factor(inbound_delay_min), [f"Inbound aircraft {inbound_delay_min} min late"] if inbound_delay_min > 0 else []),
        (w["congestion"] * cg, [f"Airport congestion {math.floor(cg*100+.5)}%"] if cg >= .5 else []),
    ]
    score = clamp(sum(v for v, _ in contributions))
    reasons = [r for v, rs in sorted(contributions, key=lambda c: -c[0]) if v > 0 for r in rs]
    return dict(score=score, level=level_for(score), reasons=reasons)

def crossed_cancel_threshold(previous, next_score):
    return (0 if previous is None else previous) < CANCEL_THRESHOLD <= next_score
