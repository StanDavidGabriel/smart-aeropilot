"""Passenger SMS for sample-network reroutes: AI-written when LOVABLE_API_KEY is set, otherwise a fixed template."""
from __future__ import annotations

import json
import os
import sys
import urllib.request

SYSTEM = ("You are an airline assistant. Write a warm, clear SMS in English only (at most 3 sentences), regardless of the passenger's "
          "name or country. No markdown or excessive emoji. Only state the itinerary and voucher provided; never invent details.")


def _fmt(v):
    return str(int(v)) if isinstance(v, float) and v.is_integer() else str(v)


def fallback(cancelled: dict, result: dict) -> str:
    first = str(result["passenger"].get("name")).split(" ")[0]
    voucher = result.get("voucher")
    total = voucher.get("total") if voucher else 0
    chosen = result.get("chosen")
    if not chosen:
        return (f"Hi {first}, flight {cancelled.get('id')} to {cancelled.get('to')} was cancelled and no alternative itinerary has been found yet. "
                f"Your demo voucher is {_fmt(total)} EUR. Your booking is awaiting assistance.")
    route = ", ".join(f"{l.get('id')} ({l.get('from')} {l.get('depart')} → {l.get('to')} {l.get('arrive')})" for l in chosen["legs"])
    extra = f" Your demo voucher is {_fmt(total)} EUR." if isinstance(total, (int, float)) and total > 0 else ""
    return f"Hi {first}, flight {cancelled.get('id')} was cancelled and your demo booking has been moved to: {route}. You arrive at {chosen.get('arrive')}.{extra}"


def generate(cancelled: dict, result: dict) -> dict:
    key = os.environ.get("LOVABLE_API_KEY", "").strip()
    if not key:
        return {"message": fallback(cancelled, result), "source": "template"}
    try:
        p, chosen, voucher = result["passenger"], result.get("chosen"), result.get("voucher")
        route = ", ".join(f"{l.get('id')} {l.get('from')}→{l.get('to')}" for l in chosen["legs"]) if chosen else "no itinerary found"
        delay = result.get("delay_minutes")
        prompt = (f"Passenger: {p.get('name')} (party of {p.get('family_size')}). Flight {cancelled.get('id')} was cancelled.\n"
                  f"New itinerary: {route}. Arrival: {chosen.get('arrive') if chosen else '-'}. Delay: {'-' if delay is None else delay} minutes.\n"
                  f"Compensation voucher: {_fmt(voucher.get('total') if voucher else 0)} EUR.")
        body = json.dumps({"model": "google/gemini-3-flash-preview", "messages": [
            {"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}]}).encode()
        req = urllib.request.Request("https://ai.gateway.lovable.dev/v1/chat/completions", data=body, method="POST",
                                     headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            text = str(json.loads(r.read())["choices"][0]["message"]["content"]).strip()
        if not text:
            raise RuntimeError("Empty AI response")
        return {"message": text, "source": "ai"}
    except Exception as e:
        print(f"AI message failed, using template: {e}", file=sys.stderr)
        return {"message": fallback(cancelled, result), "source": "template"}
