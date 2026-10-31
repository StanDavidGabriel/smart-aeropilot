"""Demo fares and non-redeemable goodwill vouchers."""
from __future__ import annotations

import math
from datetime import datetime, timedelta

from .core import epoch_ms, hub_code, parse_instant, round_half_up

POINTS = {
    "LHR": (51.47, -0.4543), "LGW": (51.1537, -0.1821), "CDG": (49.0097, 2.5479), "ORY": (48.7262, 2.3652),
    "FRA": (50.0379, 8.5622), "MUC": (48.3538, 11.7861), "BER": (52.3667, 13.5033), "AMS": (52.3105, 4.7683),
    "MAD": (40.4983, -3.5676), "BCN": (41.2974, 2.0833), "FCO": (41.8003, 12.2389), "MXP": (45.6306, 8.7281),
    "IST": (41.2753, 28.7519), "DUB": (53.4213, -6.2701), "ZRH": (47.4581, 8.5555), "GVA": (46.2381, 6.1089),
    "VIE": (48.1103, 16.5697), "BRU": (50.9014, 4.4844), "CPH": (55.6181, 12.6561), "OSL": (60.1939, 11.1004),
    "ARN": (59.6519, 17.9186), "HEL": (60.3172, 24.9633), "LIS": (38.7742, -9.1342), "ATH": (37.9364, 23.9445),
    "WAW": (52.1657, 20.9671), "PRG": (50.1008, 14.26), "BUD": (47.4298, 19.2611), "OTP": (44.5711, 26.085),
}


def estimate(legs: list[dict]) -> dict:
    """Each leg: USD 40 + USD 0.10 per great-circle km; range 80–140%."""
    if not legs:
        return {}
    base = 0.0
    for leg in legs:
        a, b = POINTS.get(hub_code(leg.get("origin"))), POINTS.get(hub_code(leg.get("destination")))
        if a is None or b is None:
            return {}
        h = math.sin(math.radians(b[0] - a[0]) / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
        km = 6371 * 2 * math.atan2(math.sqrt(h), math.sqrt(max(0.0, 1 - h)))
        base += 40 + km * 0.10
    return {"low": round_half_up(base * 0.8), "high": round_half_up(base * 1.4), "currency": "USD"}


def voucher(flight: dict, alternative_count: int, now: datetime) -> dict:
    """No voucher before 8h from scheduled departure; USD 25 from 8h, USD 50 from 12h; only when no route exists."""
    departure = parse_instant(flight.get("scheduledDeparture"))
    if departure is None:
        return {"status": "unknown", "amount": 0}
    if alternative_count > 0:
        return {"status": "route-found", "amount": 0}
    elapsed = now - departure
    if elapsed < timedelta(hours=8):
        return {"status": "waiting", "amount": 0, "eligibleAt": epoch_ms(departure) + 8 * 3600000}
    return {"status": "eligible", "amount": 50 if elapsed >= timedelta(hours=12) else 25}
