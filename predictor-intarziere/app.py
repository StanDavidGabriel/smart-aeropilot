"""Run with: python -m streamlit run app.py"""
import json
import os
from datetime import datetime, timezone
import pandas as pd
import streamlit as st
from risk.airports import AIRPORTS, BASE_ICAO, BASE_REGION, airport_code, airport_reason
from risk.providers import get_live_flights, get_live_metars, parse_time
from risk.replay import SCENARIOS, get_replay
from risk.scoring import DEFAULT_WEIGHTS, compute_risk, crossed_cancel_threshold, decode_metar

st.set_page_config(page_title="Craiova & Airport Flight Risk", page_icon="✈️", layout="wide")

@st.cache_data(ttl=600, show_spinner=False)
def weather(icaos):
    return get_live_metars(icaos)


def configured_key():
    key = os.environ.get("AERODATABOX_API_KEY", "")
    if key: return key
    try: return st.secrets.get("AERODATABOX_API_KEY", "")
    except (FileNotFoundError, st.errors.StreamlitSecretNotFoundError): return ""


def reset_weights():
    for name, value in DEFAULT_WEIGHTS.items():
        st.session_state[f"weight_{name}"] = value


with st.sidebar:
    st.caption(f"CRA BASE · {BASE_REGION.upper()}")
    labels = {a["icao"]: f"{a['iata']} · {a['name']} · {a['city']} ({a['icao']})" for a in AIRPORTS}
    icao = st.selectbox("Search airports", list(labels), index=list(labels).index(BASE_ICAO), format_func=labels.get, key="airport")
    scenario = st.selectbox("Scenario", ["live", *SCENARIOS], format_func=lambda v: "Live" if v == "live" else SCENARIOS[v]["label"])
    st.button("Reset weights", on_click=reset_weights, width="stretch")
    weights = {name: st.slider(label, 0.0, 1.0, DEFAULT_WEIGHTS[name], .01, key=f"weight_{name}")
               for name, label in [("weather", "Weather"), ("inbound", "Inbound delay"), ("congestion", "Congestion")]}
    st.divider()
    with st.expander("Flight provider settings", expanded=not bool(configured_key())):
        entered_key = st.text_input("AeroDataBox RapidAPI key", type="password", key="provider_key")
        st.caption("Session only. Not saved to the download or a file.")
    key = entered_key or configured_key()

airport = next(a for a in AIRPORTS if a["icao"] == icao)
st.title(f"{airport['iata']} · {airport['city']} Airport")
st.caption("DELAY & CANCELLATION RISK")

@st.fragment(run_every="10m")
def dashboard():
    if st.button("Refresh departures", key="refresh"):
        # Provider boards remain cached for 10 minutes to protect your quota.
        weather.clear()
    if scenario == "live":
        with st.spinner(f"Loading {airport['iata']} departures…"):
            result = get_live_flights(icao, key)
        flights = result["flights"]
        if result["error"]: st.error(result["error"])
        ids = sorted({icao, *(a for f in flights for a in [f["origin"], f["dest"]] if a)})
        with st.spinner("Loading airport weather…"):
            metars = weather(tuple(ids))
        st.caption("Flights: live AeroDataBox" if not result["error"] else "Flights: unavailable")
        st.caption("Weather: live NOAA METAR" if metars else "Weather: unavailable")
        st.caption("Past hour + next 11 hours · UTC · Provider boards cached for 10 minutes")
    else:
        flights, metars = get_replay(icao, scenario)
        st.caption("Flights & weather: recorded replay · sample times are 31 October 2026 UTC")
    missing = sorted({a for f in flights for a in [f["origin"], f["dest"]] if a and a not in metars})
    if missing:
        st.warning("Weather unavailable for " + ", ".join(airport_code(a) for a in missing) + ". Their weather contribution is unassessed (zero).")
    scored = [(f, compute_risk(decode_metar(metars.get(f["origin"], f["origin"])),
                             decode_metar(metars.get(f["dest"], f["dest"])), f["inboundDelayMin"], f["congestion"], weights)) for f in flights]
    scored.sort(key=lambda row: -row[1]["score"])
    previous = st.session_state.setdefault("previous_scores", {})
    events = st.session_state.setdefault("cancellation_events", [])
    for f, risk in scored:
        if crossed_cancel_threshold(previous.get(f["id"]), risk["score"]):
            event = dict(type="CancelEvent", flightId=f["id"], flightNo=f["flightNo"], score=risk["score"],
                         affectedPassengers=f["passengers"], reasons=risk["reasons"], at=datetime.now(timezone.utc).isoformat())
            events.append(event)
            st.toast(f"Likely cancellation: {f['flightNo']} · {f['passengers']} estimated passengers", icon="⚠️")
        previous[f["id"]] = risk["score"]
    del events[:-100]
    cols = st.columns(3)
    cols[0].metric("Flights", len(flights))
    cols[1].metric("High / critical risk", sum(r["score"] >= .6 for _, r in scored))
    cols[2].metric("Critical risk", sum(r["score"] >= .85 for _, r in scored))
    st.subheader(f"{airport['iata']} departures" if scenario == "live" else f"{airport['iata']} sample operations")
    table = []
    for f, risk in scored:
        date = parse_time(f["std"])
        table.append({"Flight": f["flightNo"], "Route": f"{airport_code(f['origin'])} → {airport_code(f['dest'])}",
            "STD (UTC)": date.strftime("%d %b %H:%M") if date else "—", "Risk": risk["score"], "Level": risk["level"].upper(),
            "Top reasons": " · ".join(airport_reason(r) for r in risk["reasons"][:2]) or "No assessed risk factors"})
    if table:
        frame = pd.DataFrame(table)
        st.dataframe(frame, hide_index=True, width="stretch", height=500,
                     column_config={"Risk": st.column_config.ProgressColumn("Risk", min_value=0, max_value=1, format="%.2f")})
        st.download_button("Download departures CSV", frame.to_csv(index=False).encode(), file_name=f"{airport['iata']}-departures.csv", mime="text/csv")
        selected_id = st.selectbox("Flight details", [f["id"] for f, _ in scored],
            format_func=lambda value: next(f"{f['flightNo']} · {airport_code(f['origin'])} → {airport_code(f['dest'])}" for f, _ in scored if f["id"] == value))
        selected = next(f for f, _ in scored if f["id"] == selected_id)
        panel_ids = [a for a in dict.fromkeys([selected["origin"], selected["dest"]]) if a]
    else:
        st.info(f"No {'departures reported in this time window' if scenario == 'live' else 'sample flights'} for {airport['iata']}.")
        panel_ids = [icao]
    for column, ident in zip(st.columns(len(panel_ids)), panel_ids):
        with column:
            st.subheader(airport_code(ident))
            raw = metars.get(ident)
            st.code(raw or "No METAR available", language=None, wrap_lines=True)
            if raw:
                d = decode_metar(raw)
                details = {"Visibility": f"{d['visibilityM']} m" if d["visibilityM"] is not None else "Unknown",
                           "Ceiling": f"{d['ceilingFt']} ft" if d["ceilingFt"] is not None else "Not reported",
                           "Wind / gust": f"{d['windKt'] if d['windKt'] is not None else '—'} / {d['gustKt'] if d['gustKt'] is not None else '—'} kt",
                           "Thunderstorm": "Yes" if d["thunderstorm"] else "No", "Fog": "Yes" if d["fog"] else "No"}
                st.table(pd.DataFrame(details.items(), columns=["Condition", "Value"]).set_index("Condition"))
    with st.expander("Cancellation alerts"):
        if events:
            st.dataframe([{**e, "reasons": " · ".join(airport_reason(r) for r in e["reasons"])} for e in reversed(events)], hide_index=True)
            st.download_button("Download alert events", json.dumps(events, indent=2), "cancellation-events.json", "application/json")
        else: st.caption("No threshold crossings recorded this session.")
    st.caption("Heuristic score, not a cancellation probability. Live passenger counts (120) and congestion (0.3) are estimates; revised departure delay is used as an inbound-delay proxy. No flights are cancelled by this app.")

dashboard()
