# Fakturaanalys Bygg

App för iPhone och iPad som läser in fakturaunderlag med bilagor från leverantörer i byggprojekt.
Fakturorna sparas per projekt, och appen gör analyser och jämförelser mellan projekt: per månad,
leverantör och kostnadstyp, samt med fritextfrågor.

**Allt körs och lagras på enheten.** Det finns ingen server. Databasen (SQLite) och kopior av
fakturorna ligger i appen. Bara tolkningen av fakturor och dina frågor skickas till Claude, och
det kräver internet och en egen API-nyckel.

## Två sätt att köra appen

| | iOS-app (rekommenderas) | Webbapp i Safari |
|---|---|---|
| Fakturamapp i Filer | Välj mappen **en gång** och tryck sedan **⟳ Uppdatera** | Markera alla filer i mappen varje gång |
| Installation | Byggs i Xcode på en Mac | Öppna adressen och välj **Lägg till på hemskärmen** |
| Data | I appen på enheten | I Safari på enheten |

Safari kan inte ge en webbsida bestående åtkomst till en mapp. Därför har iOS-appen ett litet
inbyggt tillägg (`native/capacitor-folder-access`) som kommer ihåg mappen med iOS egen mekanism
(security-scoped bookmark).

## Bygga iOS-appen (Mac med Xcode)

```bash
cd fakturaanalys
npm install
npm run ios:add      # första gången: skapar Xcode-projektet i ios/
npm run ios:open     # öppnar Xcode
```

Välj ditt team under *Signing & Capabilities*, koppla in iPad/iPhone och tryck ▶︎. Tillägget för
fakturamappen registreras automatiskt via Swift Package Manager, så inga manuella steg behövs.
Efter kodändringar: `npm run ios:sync` och kör igen från Xcode.

Med ett gratis Apple-ID slutar appen fungera efter 7 dagar och måste installeras om från Xcode.
Med Apple Developer Program (99 USD/år) gäller den ett år, och den kan även läggas ut via
TestFlight.

## Komma igång i appen

1. **⚙︎ Inställningar:** klistra in din API-nyckel från console.anthropic.com. Den sparas bara
   på enheten.
2. **Projekt:** skapa ett projekt och tryck **Välj mapp…**. Välj mappen med projektets fakturor i
   Filer (iCloud Drive, På min iPad …).
3. Lägg nya fakturor i mappen och tryck **⟳ Uppdatera** eller **Uppdatera alla projekt**.

Hur filerna i mappen grupperas:

| Plats i mappen | Tolkas som |
|---|---|
| `faktura.pdf` direkt i mappen | ett eget underlag |
| `Faktura 132387/huvud.pdf` + `bilaga.jpg` | ett underlag (faktura och bilagor tillsammans) |

- **Filer känns igen på innehållet** (SHA-256), inte på filnamnet. En omdöpt kopia läses inte in två
  gånger.
- **Snabb Uppdatera:** filer vars storlek och ändringstid inte har ändrats läses inte om. En
  Uppdatera med hundratals gamla fakturor tar därför bara ett ögonblick.
- **Borttaget stannar borta:** ett underlag som du tar bort i appen läses inte in igen.
- **Originalen orörda:** appen ändrar eller raderar aldrig något i din mapp.
- **Begränsad tolkning:** högst två underlag tolkas samtidigt.

**Säkerhetskopia** (⚙︎ Inställningar): om appen raderas försvinner datan. Spara därför en
säkerhetskopia av databasen i Filer ibland. Originalfilerna ingår inte, men de finns kvar i din
mapp och kan läsas in igen.

## Utveckling

```bash
npm run dev     # bygger och serverar på http://localhost:3100 (webbläget)
npm run build   # bygger www/ (används av iOS-appen)
npm test
```

Testerna kör samma SQLite-motor (sql.js) som appen. Mappen i Filer, lagringen och Claude
ersätts med fejkade versioner.

## Så fungerar det

1. **Tolkning (Claude, `claude-opus-5-5`).** Underlaget skickas från appen direkt till Claudes API
   med din nyckel. Varje sida läses, även skannade bilagor. Resultatet blir strukturerad JSON
   enligt ett fast schema:
   - fakturor och rader (antal, enhet, à-pris, belopp)
   - kostnadstyp, yrke och materialtyp
   - kopplingen huvudfaktura → bilaga

   Bilagor utan belopp, som arbetsbeskrivningar och tidrapporter, sparas som sammanfattningar.
2. **Avstämning** (`src/store.js`, vanlig kod):
   - Huvudfakturans klumprad ersätts av bilagans detaljrader, så att inget räknas två gånger.
   - Påslaget räknas fram (t.ex. 22 960 / 20 500 = 12 %). Avvikelser flaggas.
   - Samma leverantör plus fakturanummer i ett projekt blir en dubblett, och den räknas inte.
3. **Analys och jämförelse:** ren SQL mot vyn `cost_lines`, utan AI.
4. **Fråga:** Claude besvarar frågor genom att köra skrivskyddade SQL-frågor mot databasen på
   enheten (`PRAGMA query_only`). Varje fråga som körts visas under svaret.

## Struktur

```
web/                       Gränssnitt (HTML/CSS/JS), startpunkt web/main.js
src/local-api.js           Appens motor: projekt, import, mappsynk, kö, tolkning, frågor
src/schema.js              SQLite-schema och migrering
src/sqljs-adapter.js       SQLite som WebAssembly (sql.js) på enheten
src/device-store.js        Lagring på enheten (IndexedDB): databas, originalfiler, inställningar
src/folders.js             Fakturamappen: iOS-tillägg, Chrome/Edge eller val av filer
src/importer.js            Import och dubblettskydd (SHA-256)
src/extract.js, ask.js     Claude: tolkning (structured outputs) och frågor (SQL-verktyg)
src/store.js, analytics.js Avstämning, påslag, analyser
native/capacitor-folder-access/  Swift-tillägg för bestående mappåtkomst i Filer
scripts/build.js           Bygger www/
```

## Kända begränsningar

- **Internet krävs för tolkning och frågor.** Analys och jämförelse fungerar utan nät.
- **API-nyckeln ligger i appen på enheten.** Det är rimligt för eget bruk, men dela inte appen
  med nyckeln inlagd.
- **Max cirka 20 MB eller 600 sidor per underlag.** Större PDF:er behöver delas upp.
- **Jämförelser kräver rätt klassificering.** De blir bara så bra som yrke, materialtyp och enhet
  på raderna. Rätta raderna i början.
- **Ingen synk mellan enheter.** Data på iPhone och iPad är separat. Använd säkerhetskopian för att
  flytta data.
