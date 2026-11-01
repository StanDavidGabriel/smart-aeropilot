# AeroPilot Reroute

> Modul din [Smart AeroPilot](../README.md) — echipa **VEPA CPPU APV**

Re-rutare automată a pasagerilor când un zbor este anulat. Motorul Java 17 (fără dependențe) calculează rute alternative cu Dijkstra dependent de timp, aplică prioritățile pasagerilor și decide vouchere. Site-ul (TanStack Start + React) oferă o consolă operațională și o vizualizare de pe telefonul pasagerului.

## Descărcare (doar acest folder)

**Varianta 1 — fără Git:** deschide
https://download-directory.github.io/?url=https://github.com/StanDavidGabriel/smart-aeropilot/tree/main/reroute
și se descarcă un ZIP doar cu folderul `reroute`. Dezarhivează-l.

**Varianta 2 — cu Git (sparse checkout):**

```sh
git clone --filter=blob:none --sparse https://github.com/StanDavidGabriel/smart-aeropilot.git
cd smart-aeropilot
git sparse-checkout set reroute
cd reroute
```

**Varianta 3 — tot repo-ul:** pe GitHub, **Code → Download ZIP**, apoi deschide folderul `reroute`.

## Cerințe

- **Node.js 20+** și npm
- **JDK 17** (de ex. Adoptium Temurin 17) — pentru motorul Java
- Opțional: **Maven** pentru teste și jar

## Pornire site

```sh
cd reroute
npm install
npm run dev
```

Deschide http://localhost:8080. Pagini: `/` (acasă), `/ops` (consola operațională), `/passenger` (vizualizarea pasagerului).

## Pornire motor Java

```sh
cd reroute/java/reroute-engine

# Fără Maven (macOS/Linux):
javac -d out $(find src -name '*.java')
# Fără Maven (Windows):
javac -d out src\main\java\ro\aeropilot\reroute\*.java

java -cp out ro.aeropilot.reroute.RerouteServer ../../src/data/network.json 8081

# Cu Maven:
mvn package && java -jar target/reroute-engine.jar ../../src/data/network.json 8081
```

Motorul ascultă pe http://localhost:8081. Site-ul îl găsește prin `VITE_REROUTE_API_URL` (implicit `http://localhost:8081`). Dacă motorul e oprit, site-ul folosește `src/modules/reroute/router.ts`, o copie 1:1 în TypeScript.

## API

- `GET  /api/reroute/health` — verificare
- `GET  /api/reroute/network` — rețeaua demo
- `GET  /api/reroute/live-flights` — plecări AeroDataBox din OTP (necesită cheie)
- `POST /api/reroute/recommendations` — până la 3 itinerarii alternative
- `POST /api/reroute/support` — itinerarii + estimare tarif + decizie voucher
- `POST /api/reroute/cancel` — `{"flightId":"AP103"}` → re-rutare demo

## Zboruri live (opțional)

Setează `RAPIDAPI_KEY` în mediul procesului înainte de a porni motorul Java. Datele se actualizează la 10 minute (~288 cereri/zi) — verifică limita abonamentului AeroDataBox. Nu pune niciodată cheia în cod sau în configurația browserului.

## Teste

```sh
cd reroute && npm test
cd reroute/java/reroute-engine && mvn test
```

## Limitări

Pasagerii notificați sunt sintetici; nu se modifică rezervări reale și nu se garantează locuri. Anulările simulate sunt locale în browser și separate de statusul oficial al companiei aeriene.

Documentație detaliată: [`java/reroute-engine/README.md`](java/reroute-engine/README.md) și [`LOCAL_SETUP.md`](LOCAL_SETUP.md).
