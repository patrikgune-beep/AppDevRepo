# Bemanningsanalys

Lokal webbapp för att ställa frågor till bemanningsunderlag (Excel/PowerPoint). Allt körs i webbläsaren, ingen data lämnar datorn.

## Starta
- Dubbelklicka på `index.html`, eller kör `python3 -m http.server -d bemanningsanalys 8080` från repots rot och öppna http://localhost:8080.

## Använda
- Skriv en fråga, t.ex. *"Hur många ÅA minskar vi med per befattningskategori, fördelat per avdelning?"*
- Appen visar sin **tolkning** (källa, mått, gruppering, filter). Är den fel: **Justera frågan** och ändra själv.
- **+ Läs in Excel** (eller dra in filer): välj blad, justera rubrikrad, och år/månadskolumner kan göras om till rader. Inlästa källor sparas i webbläsaren (IndexedDB).

## Förladdade källor
Skapas av `build_data.py` från de fem underlagsfilerna: åtgärder per avdelning, åtgärdsplanens summering, resursbehov per prognostillfälle, rekryteringsbehov 2027, befattning→kategori, resurs per år (T2), befattning per månad, program (vakant/tilldelat), egna resurser, samt PowerPoint-texten.

Bygg om: `python3 -I build_data.py <katalog med filerna>` → `data/preloaded.js`.

## Att veta
- Frågetolkningen är regelbaserad (ingen AI-modell): den matchar ord i frågan mot kolumnnamn och värden.
- "Minskar" filtrerar till rader < 0 och visar vad som uteslöts. Utan det ordet summeras netto.
- Flera prognostillfällen/år i samma källa blandas om du inte filtrerar – appen varnar.
- Jättestora blad (t.ex. 967 000 rader i T2:s "Resursbehov per resurs") läses bara in till 60 000 rader.
