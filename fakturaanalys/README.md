# Fakturaanalys Bygg

Webbapp för att läsa in fakturaunderlag med bilagor från leverantörer i byggprojekt, lagra dem per
projekt över tid och analysera dem: per månad, leverantör och kostnadstyp, mellan projekt, och med
fritextfrågor.

## Kom igång

```bash
cd fakturaanalys
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # krävs för tolkning av PDF:er och fritextfrågor
npm run demo                          # valfritt: läser in exemplet Karlavägen 71 utan AI-anrop
npm start                             # http://localhost:3100
npm test
```

Kräver Node 22.13 eller senare (använder inbyggda `node:sqlite`). Data sparas i `data/`
(`DATA_DIR` styr var). Utan API-nyckel fungerar analys och jämförelse på redan inläst data.

## Så fungerar det

1. **Uppladdning.** Ett underlag är en eller flera filer (PDF, även skannad, bild, txt/csv). Filer som
   laddas upp samtidigt tolkas i samma anrop, så att bilagor kopplas till rätt rad på huvudfakturan.
2. **Tolkning (Claude, `claude-opus-5-5`).** Varje sida läses, även skannade bilagor. Resultatet blir
   strukturerad JSON enligt ett fast schema: fakturor, rader (antal, enhet, à-pris, belopp),
   kostnadstyp, yrke, materialtyp och kopplingen huvudfaktura → bilaga. Bilagor utan belopp
   (arbetsbeskrivningar, tidrapporter) sparas som sammanfattningar.
3. **Avstämning (deterministisk kod, `src/store.js`).**
   - Huvudfakturans klumprad (t.ex. "HARD WORKERS … 33869 – 22 960 kr") ersätts av bilagans
     detaljrader, så att inget räknas två gånger.
   - Påslaget räknas fram: vidarefakturerat belopp / bilagans belopp. 22 960 / 20 500 = 12 %.
   - Om kvoten är orimlig (under 1,0 eller över 1,5) flaggas den. Beloppen fördelas då så att
     summan stämmer, och à-priserna räknas med projektets typiska påslag, markerat som antaget.
   - Samma leverantör plus fakturanummer i projektet blir en dubblett, och den räknas inte.
4. **Analys.** Vyn `cost_lines` har en rad per kostnadsrad med leverantörens pris och priset för
   beställaren (inklusive påslag). Månad kan avse när arbetet utfördes eller fakturadatum.
5. **Fråga.** Claude besvarar frågor genom att köra skrivskyddade SQL-frågor mot databasen.
   Varje fråga som körts visas under svaret, så att siffrorna går att kontrollera.
6. **Rättning.** Kostnadstyp, yrke, material och enhet kan ändras per rad. Avstämningen körs då om.

## Vad exemplet visar (Karlavägen 71)

| Kontroll | Resultat |
|---|---|
| Hard Workers 33869: 20 500 → 22 960 kr | påslag 12,0 % |
| Hard Workers 33864 (ÄTA): 49 990 → 55 988,80 kr | påslag 12,0 % |
| Big Bag/Sortera: 4 063,88 → 4 551,71 kr | påslag 12,0 % |
| Beijer 260980851828: bilaga 18 253,40 kr, vidarefakturerat 5 947,20 kr | **avvikelse**, 32,6 % (5 310 kr + 12 %) och ingen kombination av rader ger 5 310 kr |
| Rivning (Hard Workers) | 430 kr/h från UE, 481,60 kr/h för beställaren, 105 h |
| Arbetsledning (Thessén & Ek) | 680 kr/h, 15 h |

## Struktur

```
server.js            Express-API och statiska filer
src/db.js            SQLite-schema och vyn cost_lines
src/taxonomy.js      Kostnadstyper, yrken och enheter (gemensamma för alla projekt)
src/extract.js       Claude-tolkning med structured outputs
src/store.js         Sparar tolkning, avstämning, påslag och dubbletter
src/analytics.js     Översikt och jämförelse mellan projekt (ren SQL)
src/ask.js           Fritextfrågor: Claude och ett skrivskyddat SQL-verktyg
public/              Gränssnitt (vanilla JS)
fixtures/            Färdigtolkat exempel för demo och tester
```

## Kända begränsningar

- Max cirka 20 MB eller 600 sidor per uppladdning, eftersom underlaget skickas i ett enda anrop.
  Större underlag behöver delas upp.
- Jämförelser mellan projekt blir bara så bra som klassificeringen (yrke, materialtyp, enhet).
  Kontrollera och rätta raderna i början. Betong i "m3" och betong i "st" (säck) jämförs inte med
  varandra.
- Ingen inloggning. Appen är byggd för att köras lokalt eller bakom en egen åtkomstkontroll.
