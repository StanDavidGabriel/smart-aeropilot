# Smart AeroPilot ✈️

> Echipa **VEPA CPPU APV**

Smart AeroPilot este un set de trei instrumente pentru aeroporturi care reduc stresul pasagerilor și ajută echipele operaționale: estimarea cozilor la securitate, predicția riscului de întârziere a zborurilor și re-rutarea automată a pasagerilor când un zbor este anulat.

*English summary: Smart AeroPilot is a hackathon project by team VEPA CPPU APV. It bundles three independent modules — a security-queue estimator (Python), a flight delay-risk predictor (Python) and a passenger re-routing system (Java engine + React website).*

## Cuprins

1. [Module](#module)
2. [Arhitectură](#arhitectură)
3. [Cerințe](#cerințe)
4. [Descărcare](#descărcare)
5. [Pornire rapidă](#pornire-rapidă)
6. [Chei API](#chei-api)
7. [Teste](#teste)
8. [Limitări](#limitări)
9. [Licențe terțe](#licențe-terțe)
10. [Structura repo-ului](#structura-repo-ului)

## Module

| Modul | Limbaj | Ce face | Adresă locală |
|---|---|---|---|
| [`estimator-cozi`](estimator-cozi/) | Python + Streamlit | Detectează persoane și bagaje (YOLOv8n) pe 3 benzi și estimează timpul de așteptare la securitate. Interfață RO/EN. | http://localhost:8501 |
| [`predictor-intarziere`](predictor-intarziere/) | Python + Streamlit | Calculează riscul de întârziere/anulare pentru plecările din Craiova (CRA) și alte aeroporturi, din zboruri live (AeroDataBox) și vremea METAR (NOAA). | http://localhost:8501 |
| [`reroute`](reroute/) | Java 17 + TypeScript/React | Când un zbor e anulat, găsește rute alternative (Dijkstra dependent de timp), aplică priorități și decide vouchere. Consolca operatională + vizualizare pasager. | site: http://localhost:8080 · motor: http://localhost:8081 |

Fiecare modul rulează independent; le poți descărca și porni separat.

## Arhitectură

```text
                 ┌────────────────────┐
 Cameră / clip ─▶│  estimator-cozi    │─▶ timp de așteptare pe bandă
                 └────────────────────┘
                 ┌────────────────────┐
 AeroDataBox  ──▶│ predictor-intarziere│─▶ scor de risc pe zbor + alerte
 NOAA METAR   ──▶└────────────────────┘
                 ┌────────────────────┐   ┌──────────────────┐
 AeroDataBox  ──▶│ reroute-engine Java│◀─▶│ site reroute (React)│─▶ ops / pasager
                 └────────────────────┘   └──────────────────┘
```

## Cerințe

- **Python 3.11 sau 3.12** — pentru `estimator-cozi` și `predictor-intarziere`
- **Node.js 20+** și npm — pentru site-ul `reroute`
- **JDK 17** — pentru motorul Java; **Maven** opțional
- Opțional: abonament **AeroDataBox** pe RapidAPI pentru date live

## Descărcare

- **Tot proiectul:** `git clone https://github.com/StanDavidGabriel/smart-aeropilot.git` sau **Code → Download ZIP** pe GitHub.
- **Doar un modul:** vezi secțiunea „Descărcare” din README-ul fiecărui folder.

## Pornire rapidă

### Estimator cozi
```sh
cd estimator-cozi
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

### Predictor întârziere
```sh
cd predictor-intarziere
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

### Reroute
```sh
cd reroute
npm install
npm run dev                       # site pe http://localhost:8080

cd java/reroute-engine            # într-un alt terminal
javac -d out $(find src -name '*.java')
java -cp out ro.aeropilot.reroute.RerouteServer ../../src/data/network.json 8081
```
Dacă motorul Java nu rulează, site-ul folosește o copie identică a algoritmului în TypeScript.

## Chei API

- **AeroDataBox (RapidAPI)** — necesară doar pentru zboruri live. Fără cheie, ambele module de zboruri funcționează în modul demo/replay.
  - `predictor-intarziere`: lipește cheia în bara laterală sau în `.streamlit/secrets.toml` (vezi `secrets.toml.example`), sau setează `AERODATABOX_API_KEY`.
  - `reroute` (Java): setează `RAPIDAPI_KEY` în mediul procesului.
- **NOAA METAR** — nu necesită cheie.

⚠️ Nu urca niciodată chei reale în repo.

## Teste

```sh
cd estimator-cozi && python -m unittest -v
cd predictor-intarziere && python -m pytest
cd reroute && npm test
cd reroute/java/reroute-engine && mvn test
```

## Limitări

- Benzile din estimatorul de cozi sunt zone egale din imagine, nu calibrate fizic; senzorul IR este **simulat**.
- Scorurile de risc și estimările nu sunt validate pentru operare reală într-un aeroport.
- Pasagerii din re-rutare sunt **sintetici**; nu se modifică rezervări reale și nu se garantează locuri.
- Nu se înregistrează imagini de la cameră și nu se păstrează istoric personal.

## Licențe terțe

- Modelul **YOLOv8n** aparține Ultralytics (AGPL-3.0 sau licență comercială) — vezi https://www.ultralytics.com/license.
- Datele de zbor: AeroDataBox; datele meteo: NOAA Aviation Weather Center.

## Structura repo-ului

```text
smart-aeropilot/
├── estimator-cozi/          # Python – cozi la securitate
├── predictor-intarziere/    # Python – risc de întârziere
│   ├── data/                # aeroporturi, zboruri și METAR demo
│   ├── risk/                # model de risc și furnizori de date
│   └── tests/
└── reroute/                 # Site React + motor Java
    ├── java/reroute-engine/ # Java 17, zero dependențe
    ├── src/                 # site TanStack Start
    └── drizzle/             # schema bazei de date
```

---
Realizat de echipa **VEPA CPPU APV**.
