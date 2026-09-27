# Ettor – köpkalkyl & utvärdering

Webbapp byggd från `Utvärdering av bostadsrätter – Ettor.xlsx`. Öppna `index.html` direkt i
webbläsaren (eller via `npm start` → http://localhost:3000/bostadsratt/). Data sparas lokalt i
webbläsaren; använd **Exportera/Importera** för säkerhetskopia eller för att flytta mellan enheter.

| Excel-flik | I appen |
|---|---|
| Simulering (Rådmansgatan såld: reavinst, uppskov, skatt) | Sålda lägenheter |
| Simulering (Karlavägen köpt + antaganden) | Kapital & antaganden |
| Simulering (kandidat-ettor, köpa vs hyra) | Lägenheter |
| Utvärdering + vikter | Utvärdering (kriterier kan döpas om och släckas/tändas) |
| Fakturor Karlavägen 71 | Fakturor Karlavägen |
| Betygsskala & metod | Metod |

## Filer
- `calc.js` – all beräkningslogik (ren JS, ingen DOM).
- `app.js`, `index.html` – gränssnittet.
- `test/calc.test.js` – jämför `calc.js` mot värden som LibreOffice räknat ur originalets formler
  (`test/fixture.json`, skapad med `test/make_fixture.py`). Kör: `node bostadsratt/test/calc.test.js`.

## Medvetna skillnader mot Excel
- Kontantinsatsen hämtas från kapitalberäkningen (Excel hade ett separat hårdkodat belopp,
  6 835 600 kr, på fliken Utvärdering som inte stämde med Simuleringens 3 499 200 kr). Manuellt
  belopp går att välja.
- Alternativkostnaden räknas bara på kapital som faktiskt binds i lägenheten (Excel räknade på
  hela kontantinsatsen även när den översteg priset).
- Bolånetak och skärpt amorteringskrav är inställningar i stället för hårdkodade.
- Obegränsat antal lägenheter (Excel: 5 aktiva + 10 arkiv).
