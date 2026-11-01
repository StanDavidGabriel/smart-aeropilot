# Estimator cozi la securitate — Python

> Modul din [Smart AeroPilot](../README.md) — echipa **VEPA CPPU APV**

## Descărcare (doar acest folder)

**Varianta 1 — fără Git:** deschide
https://download-directory.github.io/?url=https://github.com/StanDavidGabriel/smart-aeropilot/tree/main/estimator-cozi
și se descarcă un ZIP doar cu folderul `estimator-cozi`. Dezarhivează-l.

**Varianta 2 — cu Git (sparse checkout):**

```sh
git clone --filter=blob:none --sparse https://github.com/StanDavidGabriel/smart-aeropilot.git
cd smart-aeropilot
git sparse-checkout set estimator-cozi
cd estimator-cozi
```

**Varianta 3 — tot repo-ul:** pe GitHub, **Code → Download ZIP**, apoi deschide folderul `estimator-cozi`.


Aplicație locală, scrisă în Python. Interfața Streamlit se deschide în browser;
nu trebuie să scrii sau să instalezi cod TypeScript. Necesită Python 3.11 sau 3.12.

## Pornire

Dezarhivează arhiva și deschide un terminal în folderul `estimator_cozi`.

```sh
python -m venv .venv
```

Activează mediul:
- Windows: `.venv\Scripts\activate`
- macOS / Linux: `source .venv/bin/activate`

```sh
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

Pe macOS/Linux, folosește `python3` în loc de `python` dacă este necesar.
Deschide adresa afișată în terminal (de regulă http://localhost:8501).
Apasă **Pornește**, apoi alege afișajul **Pasageri** sau **Detecție**.
Selectorul **Limbă / Language** schimbă interfața între **Română** și **English**,
fără oprirea detecției sau schimbarea sursei video.
Camera web este camera calculatorului pe care rulează Python, nu o cameră la distanță.
**Oprește** eliberează camera. Închide procesul cu Ctrl+C după utilizare.
Nu expune această aplicație în internet; este configurată numai pentru localhost.

## Fișiere

- `app.py`: afișaj pasageri și vizualizare tehnică, comenzi pornire/oprire și surse video.
- `i18n.py`: textele interfeței în română și engleză.
- `detector.py`: YOLOv8n ONNX pe CPU, captură OpenCV, hartă IR simulată.
- `queue_logic.py`: asocierea bagajelor, formula și netezirea timpilor.
- `test_queue_logic.py`: teste pentru formula de calcul și timpii suplimentari.
- `assets/`: model YOLOv8n ONNX și clip demonstrativ WebM inclus.

## Reguli și limite

Trei benzi sunt zone verticale egale ale imaginii, nu benzi calibrate fizic.
Persoane = 0,7 × YOLO + 0,3 × IR simulat; baza este 30 s/persoană/bandă.
Se adaugă în cel mai rău caz: rucsac +120 s, valiză +90 s, laptop +60 s,
geantă +30 s, nimic +0 s. Timpul se netezește cu alpha 0,15.
IR este o simulare bazată pe detecții și zgomot, nu măsurare termică reală.
Clipul inclus este generat pentru demonstrație. Nu se păstrează istoric și nu se
înregistrează camera. Detectarea obiectelor nu dezvăluie conținutul bagajelor;
„nimic detectat” nu garantează lipsa obiectelor. Estimările nu sunt validate
pentru operare reală într-un aeroport. Frecvența țintă este 5 cadre/s, limitată de CPU.

## Teste

```sh
python -m unittest -v
```

Modelul YOLOv8n aparține ecosistemului Ultralytics (AGPL-3.0 sau licență comercială).
Consultă https://www.ultralytics.com/license înainte de utilizare comercială;
această arhivă nu acordă o licență comercială pentru model.
