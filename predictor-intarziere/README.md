# Craiova Airport Flight Risk â€” Python edition

> Modul din [Smart AeroPilot](../README.md) â€” echipa **VEPA CPPU APV**

## DescÄƒrcare (doar acest folder)

**Varianta 1 â€” fÄƒrÄƒ Git:** deschide
https://download-directory.github.io/?url=https://github.com/StanDavidGabriel/smart-aeropilot/tree/main/predictor-intarziere
È™i se descarcÄƒ un ZIP doar cu folderul `predictor-intarziere`. DezarhiveazÄƒ-l.

**Varianta 2 â€” cu Git (sparse checkout):**

```sh
git clone --filter=blob:none --sparse https://github.com/StanDavidGabriel/smart-aeropilot.git
cd smart-aeropilot
git sparse-checkout set predictor-intarziere
cd predictor-intarziere
```

**Varianta 3 â€” tot repo-ul:** pe GitHub, **Code â†’ Download ZIP**, apoi deschide folderul `predictor-intarziere`.


A complete standalone Python/Streamlit dashboard. This is a separate runnable app,
not a replacement for the Lovable-hosted React app. All custom application logic and
UI definitions are Python; Streamlit supplies the browser interface. No Java, custom
JavaScript, or TypeScript source is required.

## Start on your computer

1. Install Python 3.11 or newer from https://www.python.org/downloads/.
2. Extract this ZIP and open a terminal in its folder.
3. Install the dependencies:

   ```sh
   python -m pip install -r requirements.txt
   ```

4. Start the dashboard:

   ```sh
   python -m streamlit run app.py
   ```

5. Open the local address printed in the terminal (usually http://localhost:8501).
   On Windows, `py` may be used instead of `python`.
6. Open **Flight provider settings** in the sidebar and paste your AeroDataBox
   **X-RapidAPI-Key** into the password field. An active AeroDataBox subscription
   on RapidAPI is required. The input stays in the running session only.

NOAA weather needs no key. Replay scenarios run without any credentials.
Your existing Lovable secrets are NOT included in this download. No passwords,
API keys, account information or private uploads are bundled.

## Optional persistent configuration

Copy `.streamlit/secrets.toml.example` to `.streamlit/secrets.toml`, put your own
key between the quotes, and keep that file private. Alternatively set the
`AERODATABOX_API_KEY` environment variable on the computer or hosting service.
Never commit or share a real secrets file. Use HTTPS if hosting this app online;
protect the host with access control if you do not want others using your quota.

## Included features

- Craiova (CRA), Dolj as the default base.
- Searchable airport selector covering the existing Romanian/European directory
  by IATA code, ICAO code, city or name; provider requests use ICAO internally.
- Every departure returned by AeroDataBox in a rolling 12-hour window (past hour
  and next 11 hours), without the old 15-flight cap. Includes available cancelled,
  cargo and private departures; codeshares are excluded to avoid duplicate flights.
- Separate 10-minute provider caches per airport; automatic 10-minute refresh while
  the browser is connected. Refresh does not bypass a fresh provider cache.
- Live NOAA METAR weather, parsed visibility, ceiling, wind/gust, fog and thunderstorms.
- Clear, fog, thunderstorm and inbound-delay replay scenarios with original fixtures.
  Replay operations are filtered to the selected airport; some airports have no samples.
- Original weighted risk model, sliders/reset, descending risk table, flight/weather
  detail selector, threshold-crossing toast alerts and session event history.
- CSV flight export and JSON cancellation-alert export.
- Honest loading, request-limit, unavailable and empty states. Live provider failures
  never silently turn into Craiova sample flights.

## Model limitations
š\ÚÈ\ÈH]\š\İXÈØÛÜ™K
Š››İHØ[Xœ˜]Y›Ø˜Xš[]HÜˆÜ\˜][Û˜[ÛX\˜[˜ÙJŠ‹‚”\ÜÙ[™Ù\ˆÛİ[È
LŒ
H[™ÛÛ™Ù\İ[Ûˆ
ŒÊH›Üˆ]™H›YÚÈ\™H\İ[X]\Ëˆ™]š\ÙYœØÚY[YY\\\™H[^HÙ\™\È\È[ˆ[˜›İ[™Y[^H›ŞK›İÛÛ™š\›YY[˜›İ[™˜XÚÚ[™ËˆZ\ÜÚ[™ÈÙX]\ˆ\È™\›ÈÛÛšX][Ûˆ[™\È^XÚ]HØ\›™YX›İ]Âš]\È›İ™\šYšYYÛX\ˆÙX]\‹ˆHÜšYÚ[˜[\œÙ\ˆ\™Ù]ÈPĞSË\İ[HQUTœË››İHÛÛ\]HÛÜ›ÚYHXÛÙ\ˆ
K™ËˆTÈİ]]K[Z[Hš\ÚXš[]H\È›İ\œÙY
K‚[\È]ØÛÜ™HHHÈ›İØ[˜Ù[›YÚËˆ]™H]˜Z[Xš[]KÛİ™\˜YÙKTHÛÜİÂ˜[™][İ\È\[™ÛˆH›İšY\‹ÜİXœØÜš\[Û‹ˆ\È\È\\\™\Ë›İ[ˆ\œš]˜[Â˜›Ø\™ÜˆH[Y^H\İÜšXØ[\˜Ú]™Kˆ›YÚ[Y\È\™HUË‚‚ˆÈÈ\İÂ‚˜Úœ]Ûˆ[H[š]\İ\ØÛİ™\ˆ\È\İÈ]‚˜‚ˆÈÈÛİ\˜ÙH^[İ]‚‹H\œXˆ[\Ú›Ø\™RH[ˆ]Û‚‹Hš\ÚËØZ\œÜËœXˆZ\œÜX™[ËÙX\˜Ú˜[Y][Û‚‹Hš\ÚËÜ›İšY\œËœXˆ]™HØ[Ë\‹XZ\œÜØXÚK\\\™HX\[™Â‹Hš\ÚËÜØÛÜš[™ËœXˆQUTˆXÛÙ[™ËÙ]™\š]Kš\ÚÈ]™[Ë™\ÚÛÜ›ÜÜÚ[™Â‹Hš\ÚËÜ™\^KœXˆ[™YØ[\HØÙ[˜\š[ÜÂ‹H]KØˆZ\œÜ\™XİÜH[™ÜšYÚ[˜[™\^KÙ›YÚ”ÓÓˆš^\™\Â‹H\İËØˆ[H[™›İšY\ˆ™YÜ™\ÜÚ[Ûˆ\İÂ‹Hœİ™X[[]Øˆ[YH[™[\HÙXÜ™][\]B‚•ÈÜİÛ›[™K\ŞH\ÙHš[\ÈÈH]Û‹XØ\X›HÜİİ\Ü[™Èİ™X[[]˜[™İ\HHTHÙ^H\Ú[™È]Üİ	ÜÈš]˜]HÙXÜ™]Ù][™ÜËˆİ˜X›IÜÈ™]šY]Â˜Ø[››İ^Xİ]H\È]Ûˆ\ÈH^\İ[™È™]šY]È™[XZ[œÈ[˜Ú[™ÙY‚