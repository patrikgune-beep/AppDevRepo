# Dalarö KM – iOS-app (Capacitor-wrapper)

Den här mappen paketerar KM-webbappen (`../index.html`) som en riktig iOS-app med
[Capacitor](https://capacitorjs.com/). Appen körs helt lokalt (offline) i en native WKWebView –
samma funktioner som webbversionen: klasser, stegar, schema, auto-planering, utskrift m.m.

> Själva bygget, signeringen och uppladdningen görs på en **Mac med Xcode**. Filerna här är
> förberedda så att du bara behöver köra några kommandon.

## Förutsättningar (på din Mac)
- **Xcode 15+** (Mac App Store) och **Xcode Command Line Tools**
- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- **CocoaPods**: `sudo gem install cocoapods`
- För App Store: **Apple Developer Program** (99 USD/år)

## Kom igång – steg för steg

Öppna Terminal och gå till den här mappen:

```bash
cd capacitor-app
npm install            # hämtar Capacitor
npm run add:ios        # kopierar index.html + skapar ios/-projektet (kör en gång)
npm run open:ios       # öppnar projektet i Xcode
```

I Xcode:
1. Välj projektet **App** → fliken **Signing & Capabilities** → välj ditt **Team** (Apple-konto).
2. Välj en simulator eller din inkopplade iPhone högst upp och tryck **▶ Run** för att testa.
3. För App Store: **Product → Archive → Distribute App → App Store Connect**.

## När du ändrat appen (ny `index.html`)
Lägg den uppdaterade `index.html` i projektets rot (som vanligt), och kör sedan:

```bash
cd capacitor-app
npm run sync           # kopierar in nya index.html och uppdaterar ios-projektet
```

Öppna sedan i Xcode och kör/arkivera igen.

## Appinformation
- **App-namn:** Dalarö KM · **App-ID (Bundle ID):** `se.dalarotk.km`
  (ändra i `capacitor.config.json` om du vill ett annat ID – måste vara unikt i App Store)
- **Webbinnehåll:** `www/` (genereras från `../index.html` av `copyweb.js`)

## Appikon och startskärm
Xcode använder en standardikon tills du lägger in en egen. Enklast:

```bash
npm install --save-dev @capacitor/assets
# lägg en kvadratisk PNG (minst 1024×1024) som resources/icon.png och kör:
npx @capacitor/assets generate --ios
```

## Känd begränsning (bra att veta)
Funktionerna **Exportera säkerhetskopia** och **Spara bild av stege** använder webbläsarens
nedladdning/fil­väljare. I en native WKWebView fungerar det inte alltid som på webben. Om du vill
att spara/dela ska fungera smidigt i appen kan man koppla in Capacitors **Share**- och
**Filesystem**-plugins (native dela-ark). Säg till så lägger jag till det.
