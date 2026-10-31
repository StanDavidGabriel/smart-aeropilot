"""Shared helpers: time parsing, hub codes, live-flight eligibility."""
from __future__ import annotations

import math
import re
from datetime import datetime, timedelta, timezone

HUBS = {
    "EGLL": "LHR", "EGKK": "LGW", "LFPG": "CDG", "LFPO": "ORY", "EDDF": "FRA", "EDDM": "MUC",
    "EDDB": "BER", "EHAM": "AMS", "LEMD": "MAD", "LEBL": "BCN", "LIRF": "FCO", "LIMC": "MXP",
    "LTFM": "IST", "EIDW": "DUB", "LSZH": "ZRH", "LSGG": "GVA", "LOWW": "VIE", "EBBR": "BRU",
    "EKCH": "CPH", "ENGM": "OSL", "ESSA": "ARN", "EFHK": "HEL", "LPPT": "LIS", "LGAV": "ATH",
    "EPWA": "WAW", "LKPR": "PRG", "LHBP": "BUD", "LROP": "OTP",
}
_HUB_VALUES = set(HUBS.values())
_OPEN_STATUSES = {"expected", "scheduled", "checkin", "boarding", "gateclosed", "delayed"}


def hub_code(code) -> str:
    code = str(code)
    return HUBS.get(code, code)


def parse_instant(value) -> datetime | None:
    """Strict ISO-8601 UTC instant; None when invalid."""
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z", value):
        return None
    base, _, frac = value[:-1].partition(".")
    try:
        dt = datetime.strptime(base, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return dt + timedelta(microseconds=int((frac + "000000")[:6])) if frac else dt


def fmt_instant(dt: datetime) -> str:
    """yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"""
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def iso_now(dt: datetime) -> str:
    return fmt_instant(dt)


def epoch_ms(dt: datetime) -> int:
    return int(dt.timestamp() * 1000)


def round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


def eligible(a: dict, now: datetime) -> bool:
    origin, destination = str(a.get("origin")), str(a.get("destination"))
    known = lambda c: c in HUBS or c in _HUB_VALUES
    if not known(origin) or not known(destination):
        return False
    status = re.sub(r"[\s_-]", "", str(a.get("officialStatus", "Unknown")).lower())
    if status not in _OPEN_STATUSES or a.get("actualDeparture") is not None:
        return False
    departure = parse_instant(a.get("scheduledDeparture"))
    return departure is not None and now < departure <= now + timedelta(days=1)
