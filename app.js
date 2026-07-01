const EXERCISES = {
  vikter: [
    { name: "Bänkpress", sets: "4 set × 6–8 reps", muscle: "Bröst, triceps", how: "Ligg på bänken med fötterna i golvet. Sänk stången kontrollerat till bröstet och håll armbågarna ca 45° ut. Pressa upp till raka armar." },
    { name: "Knäböj", sets: "4 set × 6–8 reps", muscle: "Lår, rumpa", how: "Stå axelbrett med stången på övre ryggen. Böj knäna och höfterna tills låren är parallella med golvet. Håll ryggen rak och pressa upp genom hälen." },
    { name: "Marklyft", sets: "3 set × 5 reps", muscle: "Rygg, lår, rumpa", how: "Stå med fötterna höftbrett. Håll ryggen rak, spänn magen och lyft stången nära kroppen hela vägen upp med hjälp av benen och höfterna." },
    { name: "Axelpress (stående)", sets: "3 set × 8–10 reps", muscle: "Axlar, triceps", how: "Håll stången i axelhöjd. Spänn magen och pressa rakt upp tills armarna är helt sträckta. Sänk kontrollerat tillbaka." },
    { name: "Skivstångsrodd", sets: "3 set × 10 reps", muscle: "Rygg, biceps", how: "Böj överkroppen ca 45° framåt med rak rygg. Dra stången mot naveln med armbågarna längs sidan. Pressa ihop skulderbladen i topp." },
    { name: "Incline bänkpress", sets: "3 set × 10 reps", muscle: "Övre bröst", how: "Bänken på 30–45°. Sänk stången mot övre bröstet och pressa upp. Fokuserar mer på övre bröstmuskeln." },
    { name: "Benpress", sets: "4 set × 12 reps", muscle: "Lår, rumpa", how: "Sitt i maskinen med fötterna axelbrett på plattan. Sänk tills knäna är 90° och pressa ifrån med hälen." },
    { name: "Hantelbicep curl", sets: "3 set × 12 reps", muscle: "Biceps", how: "Stå upp med hantlarna vid sidorna. Håll armbågarna stilla mot kroppen och curl upp mot axlarna. Sänk kontrollerat." },
    { name: "Triceps pushdown", sets: "3 set × 12–15 reps", muscle: "Triceps", how: "Stå vid kabelmaskin. Håll armbågarna still mot sidan och tryck handtaget neråt tills armarna är raka. Sänk kontrollerat." },
    { name: "Lateral raise", sets: "3 set × 15 reps", muscle: "Axlar", how: "Stå med hantlarna vid sidorna och lätt böjda armar. Lyft ut till axelhöjd utan att gunga. Sänk sakta." },
    { name: "Facepull", sets: "3 set × 15 reps", muscle: "Bakre axel, rotatorkuff", how: "Kabeln i ansiktshöjd. Dra handtaget mot ansiktet med höga armbågar och externrotera axlarna. Håll 1 sek i slutet." },
    { name: "Rumänsk marklyft", sets: "3 set × 10 reps", muscle: "Baksida lår, rumpa", how: "Stå upp med stången. Böj höfterna bakåt med nästan raka knän och sänk stången längs framsidan av benen." },
    { name: "Goblet squat", sets: "3 set × 12 reps", muscle: "Lår, rumpa, core", how: "Håll en hantel vertikalt mot bröstet. Brett fotställning. Knäböj djupt med upprätt överkropp." },
    { name: "Overhead triceps extension", sets: "3 set × 12 reps", muscle: "Triceps", how: "Håll en hantel med båda händerna bakom huvudet. Sträck armarna rakt upp och håll armbågarna stilla." },
    { name: "Hammer curl", sets: "3 set × 12 reps", muscle: "Biceps, underarm", how: "Curl hantlarna med tummen upp (neutralgrepp). Armbågarna still mot kroppen. Belastar bicepsens långa huvud och underarmarna." },
    { name: "Leg curl", sets: "3 set × 12 reps", muscle: "Baksida lår", how: "Ligg i maskinen med hälen mot kudden. Böj knäna och dra hälen mot rumpan. Sänk kontrollerat." },
    { name: "Leg extension", sets: "3 set × 15 reps", muscle: "Framsida lår", how: "Sitt med kudden mot vristerna. Sträck benen rakt ut och håll en sekund. Sänk kontrollerat." },
    { name: "Kabeldrag (lat pulldown)", sets: "3 set × 10 reps", muscle: "Rygg, biceps", how: "Luta lätt bakåt och dra stången ned mot övre bröstet med armbågarna neråt. Känn ryggen arbeta." },
    { name: "Seated row", sets: "3 set × 10 reps", muscle: "Rygg, biceps", how: "Dra handtaget mot magen och pressa ihop skulderbladen. Sträck ut armarna kontrollerat." },
    { name: "Shrugs", sets: "3 set × 15 reps", muscle: "Trapezius", how: "Håll hantlarna vid sidorna. Lyft axlarna rakt upp mot öronen, håll 1 sek och sänk." },
    { name: "Sumo marklyft", sets: "3 set × 6 reps", muscle: "Höfter, lår, rygg", how: "Bred fotposition med tårna utåt. Greppa stången innanför knäna. Tryck knäna utåt och lyft med rak rygg." },
    { name: "Bänkpress med hantlar", sets: "3 set × 10 reps", muscle: "Bröst, triceps", how: "Ligg på bänk med hantlarna i brösthöjd. Sänk med kontroll och pressa upp. Ger större rörelseomfång än stång." },
    { name: "Hantelflyes", sets: "3 set × 12 reps", muscle: "Bröst", how: "Ligg på bänk med hantlarna ovanför bröstet. Öppna armarna i en vid båge ner till axelhöjd och för ihop." },
    { name: "Arnold press", sets: "3 set × 10 reps", muscle: "Axlar, triceps", how: "Start med hantlarna framför ansiktet, handflator mot dig. Rotera utåt och pressa upp – en flytande rörelse." },
    { name: "EZ-bar curl", sets: "3 set × 12 reps", muscle: "Biceps", how: "Curl med böjd stång för neutralare handledsposition. Armbågarna still mot kroppen, full rörelseomfång." },
    { name: "Cable crossover", sets: "3 set × 12 reps", muscle: "Bröst", how: "Stå mitt emellan kabelmaskinerna med kablarna högt. Dra handtagen nedåt och framåt till de möts. Böj lite framåt." },
    { name: "Hip thrust", sets: "4 set × 10 reps", muscle: "Rumpa, baksida lår", how: "Övre ryggen mot en bänk, stången på höfterna. Pressa höfterna mot taket tills kroppen är rak. Håll 1 sek och sänk." },
    { name: "Front squat", sets: "3 set × 8 reps", muscle: "Framsida lår, core", how: "Stången framför på axlarna (korsgrepp eller ren-position). Knäböj med upprätt överkropp och knäna i linje med tårna." },
    { name: "Reverse fly", sets: "3 set × 15 reps", muscle: "Bakre axel, övre rygg", how: "Böj överkroppen framåt ca 45°. Lyft hantlarna ut åt sidorna med lätt böjda armar tills de når axelhöjd." },
    { name: "Upright row", sets: "3 set × 12 reps", muscle: "Axlar, trapezius", how: "Håll stången med smalt grepp. Dra rakt upp längs kroppen med höga armbågar tills stången når hakan." },
    { name: "Close grip bänkpress", sets: "3 set × 10 reps", muscle: "Triceps, bröst", how: "Bänkpress med smalt grepp (axelbrett). Håll armbågarna nära kroppen för mer tricepsfokus." },
    { name: "T-bar row", sets: "3 set × 10 reps", muscle: "Rygg, biceps", how: "Stå gränsle över stångändan. Böj framåt och dra mot nedre bröstet. Känn att ryggen drar, inte armarna." },
    { name: "Hack squat (maskin)", sets: "4 set × 12 reps", muscle: "Framsida lår, rumpa", how: "Rygg mot maskinen, fötterna framåt. Sänk tills knäna är 90° och pressa upp. Håll ryggen mot stödet." },
    { name: "Stående vadpress", sets: "4 set × 15–20 reps", muscle: "Vader", how: "Stå på tårna (med eller utan extra vikt). Lyft hälen så högt som möjligt, håll 1 sek och sänk hela vägen ner." },
    { name: "Preacher curl", sets: "3 set × 12 reps", muscle: "Biceps", how: "Stöd armbågarna mot curlbänkens lutade yta. Curl stången/hanteln upp utan att häva med armbågarna." },
    { name: "Incline hantelcurl", sets: "3 set × 12 reps", muscle: "Biceps", how: "Sitt på lutad bänk (45–60°) med armarna hängande. Curl utan att häva – ger maximalt sträck i biceps." },
    { name: "Rack pull", sets: "3 set × 5 reps", muscle: "Övre rygg, trapezius", how: "Marklyft från knähöjd (sätt stången på stift). Håll ryggen rak och drag kraftfullt upp. Fokuserar övre del av draget." },
    { name: "Single arm hantelrodd", sets: "3 set × 10 reps/sida", muscle: "Rygg, biceps", how: "Stöd en hand och knä på en bänk. Dra hanteln mot höften med armbågen längs sidan. Rotera lätt i topp." },
    { name: "Good morning", sets: "3 set × 12 reps", muscle: "Baksida lår, ländrygg", how: "Stången på övre ryggen. Böj framåt med nästan raka ben tills överkroppen är nära horisontell. Pressa höfterna och gå tillbaka." },
    { name: "Sumo squat med hantel", sets: "3 set × 12 reps", muscle: "Höfter, lår, rumpa", how: "Bred fotposition, tår utåt, en tung hantel hängande emellan benen. Knäböj djupt med upprätt bröst." },
  ],
  kropp: [
    { name: "Armhävningar", sets: "3 set × 15–20 reps", muscle: "Bröst, triceps", how: "Plankposition, händerna axelbrett. Sänk bröstet mot golvet med rak kropp. Pressa upp. Armbågar ca 45° från kroppen." },
    { name: "Chin-ups", sets: "3 set × 6–10 reps", muscle: "Rygg, biceps", how: "Häng med handflator mot dig. Dra upp tills hakan passerar stången. Sänk kontrollerat till raka armar." },
    { name: "Dips", sets: "3 set × 10–15 reps", muscle: "Bröst, triceps", how: "Stöd på parallellstänger med raka armar. Sänk tills armbågarna är ca 90°. Pressa upp. Luta lätt framåt för mer bröst." },
    { name: "Pistol squat", sets: "3 set × 5–8 reps/sida", muscle: "Lår, rumpa", how: "Stå på ett ben med andra rakt fram. Sänk höften mot golvet med kontroll. Håll ryggen rak och pressa upp." },
    { name: "Bulgariansk split squat", sets: "3 set × 10 reps/sida", muscle: "Lår, rumpa", how: "Bakre foten på bänk. Sänk bakre knät rakt mot golvet. Håll överkroppen upprätt och pressa upp genom framfoten." },
    { name: "Pike push-up", sets: "3 set × 10 reps", muscle: "Axlar, triceps", how: "Inverterat V med höfterna högt. Böj armbågarna och sänk huvudet mot golvet. Pressa upp. Liknar axelpress." },
    { name: "Archer push-up", sets: "3 set × 8 reps/sida", muscle: "Bröst, triceps", how: "Brett handgrepp. Böj ena armen och sänk mot den sidan medan den andra hålls rak. Progressiv enarms-armhävning." },
    { name: "Inverted row", sets: "3 set × 10 reps", muscle: "Rygg, biceps", how: "Ligg under en stång. Greppa den och dra bröstet upp med kroppen rak som en planka. Armbågarna längs sidan." },
    { name: "Diamond push-up", sets: "3 set × 12 reps", muscle: "Triceps, bröst", how: "Händerna i diamantform under bröstet. Armhävning med armbågarna längs kroppen. Belastar triceps primärt." },
    { name: "Wide grip pull-up", sets: "3 set × 6–8 reps", muscle: "Rygg, axlar", how: "Brett grepp med handflator från dig. Dra upp tills bröstet nuddar stången. Fokus på latissimus dorsi." },
    { name: "Hollow body hold", sets: "3 set × 30 sek", muscle: "Core, hela kroppen", how: "Ligg på rygg. Lyft axlar och raka ben en bit. Pressa ländryggen mot golvet. Håll positionen." },
    { name: "L-sit", sets: "3 set × 15 sek", muscle: "Core, triceps, axlar", how: "Stöd på händerna och lyft kroppen. Sträck benen vågrätt framåt i L-form. Håll skuldrorna nere." },
    { name: "Jump squat", sets: "3 set × 15 reps", muscle: "Lår, rumpa, vader", how: "Knäböj och hoppa explosivt upp. Landa mjukt med böjda knän. Gå direkt in i nästa rep." },
    { name: "Explosive push-up", sets: "3 set × 8 reps", muscle: "Bröst, triceps", how: "Explosiv press uppåt så händerna lyfter från golvet. Landa mjukt och upprepa. Bygger kraft och snabbhet." },
    { name: "Single-leg deadlift", sets: "3 set × 10 reps/sida", muscle: "Baksida lår, rumpa", how: "Stå på ett ben med lätt böjt knä. Böj framåt med rak rygg och lyft bakre benet bakåt till horisontell. Återgå." },
    { name: "Muscle-up", sets: "3 set × 3–5 reps", muscle: "Rygg, bröst, triceps", how: "Häng i stången. Kraftig pull-up och när hakan passerar stången, tryck ned med handlederna och pressa upp till dip-position." },
    { name: "Handstand push-up", sets: "3 set × 5–8 reps", muscle: "Axlar, triceps", how: "Stå på händerna mot en vägg. Böj armbågarna och sänk huvudet mot golvet. Pressa upp. Börja med stöd av väggen." },
    { name: "Nordic hamstring curl", sets: "3 set × 5–8 reps", muscle: "Baksida lår", how: "Knästå med fötterna fixerade av en partner/maskin. Sänk överkroppen framåt så sakta som möjligt med kontroll. Stöd med händerna." },
    { name: "Step-up", sets: "3 set × 12 reps/sida", muscle: "Lår, rumpa", how: "Kliv upp på en box med ett ben. Räta ut benet helt. Kliv ned och upprepa. Håll överkroppen upprätt." },
    { name: "Glute bridge", sets: "3 set × 15 reps", muscle: "Rumpa, baksida lår", how: "Ligg på rygg med böjda knän och fötterna i golvet. Pressa höfterna mot taket. Kläm ihop rumpan i topp." },
    { name: "Superman", sets: "3 set × 12 reps", muscle: "Ländrygg, rumpa", how: "Ligg magen ner med armarna framåt. Lyft armar, bröst och ben simultant. Håll 2 sek och sänk." },
    { name: "Bear crawl", sets: "3 set × 20 m", muscle: "Core, axlar, höfter", how: "På händer och fötter med höfterna uppe. Gå framåt med motstående hand och fot. Håll ryggen plan." },
    { name: "Ring push-up", sets: "3 set × 10 reps", muscle: "Bröst, triceps, core", how: "Armhävning i gymnastikriingar. Kräver mer stabilisering. Ringarnas instabilitet aktiverar fler muskler." },
    { name: "Plyometric lunge", sets: "3 set × 10 reps/sida", muscle: "Lår, rumpa, vader", how: "Utfall ner och hoppa upp och växla ben i luften. Landa mjukt i utfall på andra benet. Explosivt och konditionskrävande." },
    { name: "Wall walk", sets: "3 set × 3–5 reps", muscle: "Axlar, core, rygg", how: "Start i armhävningsposition med fötterna mot väggen. Gå upp längs väggen bakåt tills du är nära handstående. Gå tillbaka." },
    { name: "Tuck jump", sets: "3 set × 10 reps", muscle: "Ben, kondition", how: "Hoppa maximalt och dra knäna mot bröstet i luften. Landa mjukt med böjda knän. Gå direkt in i nästa hopp." },
    { name: "Box dip", sets: "3 set × 15 reps", muscle: "Triceps, bröst", how: "Händerna på en bänk/box bakom dig med benen raka framåt. Sänk kroppen med böjda armar och pressa upp." },
    { name: "Skater squat", sets: "3 set × 8 reps/sida", muscle: "Lår, rumpa, balans", how: "Stå på ett ben. Böj knäet och sträck bakåtbenet nedåt. Det bakre knät grasar golvet. Pressa upp." },
    { name: "Arch body hold", sets: "3 set × 20–30 sek", muscle: "Ländrygg, rumpa, axlar", how: "Ligg magen ner. Lyft armar och ben i en brosform. Håll positionen. Grundläggande för gymnastikstyrkans posterior chain." },
    { name: "Wall sit", sets: "3 set × 45–60 sek", muscle: "Framsida lår", how: "Luta ryggen mot väggen med knäna i 90°. Håll isometrisk position. Bra för framsida lår och mentalt fokus." },
    { name: "Australian pull-up", sets: "3 set × 12 reps", muscle: "Rygg, biceps", how: "Ligg under en stång på ca höfthöjd. Dra bröstet upp till stången med kroppen rak. Enklare variant av pull-up." },
    { name: "Pseudo planche push-up", sets: "3 set × 8 reps", muscle: "Bröst, axlar, core", how: "Armhävningsposition men med händerna vid höfterna och framåtlutad. Kräver stor axelstyrka. Progression mot planche." },
    { name: "Hip extension", sets: "3 set × 15 reps/sida", muscle: "Rumpa, baksida lår", how: "Ligg magen ner. Lyft ett ben bakåt och uppåt med sträckt knä. Kläm rumpan i topp. Sänk kontrollerat." },
    { name: "Armhävning med rotation", sets: "3 set × 10 reps", muscle: "Bröst, core, axlar", how: "Gör en armhävning. I topp, rotera kroppen och lyft en arm mot taket. Alternera sidor varje rep." },
    { name: "Negativ pull-up", sets: "3 set × 5 reps", muscle: "Rygg, biceps", how: "Hoppa upp till stångens topp. Sänk kroppen så sakta som möjligt (5–10 sek). Perfekt för nybörjare till pull-ups." },
    { name: "Sissy squat", sets: "3 set × 10 reps", muscle: "Framsida lår", how: "Stå på tårna, håll i ett stöd. Luta överkroppen och knäna bakåt simultant. Knäna rör sig framåt men det är meningen." },
    { name: "Crab walk", sets: "3 set × 20 m", muscle: "Triceps, core, axlar", how: "Sitt på golvet med händerna och fötterna i golvet och höfterna lyft. Gå bakåt/framåt i krabbaposition." },
    { name: "Typewriter pull-up", sets: "3 set × 5 reps/sida", muscle: "Rygg, biceps", how: "Dra upp i pull-up. I toppen, förflytta kroppen horisontellt till ena sidan och sänk. Klättra tillbaka och byta sida." },
    { name: "Glute kickback", sets: "3 set × 15 reps/sida", muscle: "Rumpa", how: "På händer och knän. Sparka ett ben bakåt och upp med böjt knä. Kläm rumpan i topp. Sänk utan att vila." },
    { name: "Clock push-up", sets: "3 set × 8 reps/riktning", muscle: "Bröst, triceps, axlar", how: "I armhävningsposition, flytta en hand i en klockposition (12, 3, 6, 9) och gör en armhävning i varje. Tränar alla vinklar." },
  ],
  kondition: [
    { name: "Löpning", sets: "20–30 min, måttlig intensitet", muscle: "Hela kroppen", how: "Jogga i ett tempo där du kan prata i korta meningar. Upprätt hållning, avslappnade axlar och jämnt andningsmönster." },
    { name: "Intervallträning (HIIT)", sets: "8 × 20 sek sprint / 10 sek vila", muscle: "Hela kroppen", how: "Spring maximalt i 20 sek, vila aktivt 10 sek. Upprepa 8 gånger. Värm upp 5 min och kyl ner efteråt." },
    { name: "Cykling", sets: "30 min, jämn takt", muscle: "Ben, hjärta", how: "Cykla i ett jämnt tempo med kadens ca 80–90 rpm. Justera motståndet så pulsen håller sig på måttlig nivå." },
    { name: "Rodd (maskin)", sets: "15 min, konstant tempo", muscle: "Rygg, ben, armar", how: "Tryck ifrån med benen, luta bakåt och dra handtaget mot magen. Återgå i omvänd ordning. Håll ryggen rak." },
    { name: "Hopprep", sets: "3 set × 3 min", muscle: "Vader, koordination", how: "Håll handtagen avslappnat och vrid med handlederna. Hoppa precis så högt att repet passerar. Landa på framfoten." },
    { name: "Boxhopp", sets: "4 set × 10 reps", muscle: "Lår, rumpa, vader", how: "Stå framför box, gör kort svingrörelse och hoppa upp med båda fötterna. Landa mjukt med böjda knän. Kliv ner." },
    { name: "Burpees", sets: "3 set × 15 reps", muscle: "Hela kroppen", how: "Stå, hoppa ner i plankaposition, gör armhävning, hoppa fötterna mot händerna och hoppa upp med armarna högt." },
    { name: "Backlöpning", sets: "6 × ca 60 m", muscle: "Ben, rumpa, kondition", how: "Luta överkroppen lätt framåt, kör med höga knän och kraftfulla armrörelser. Jogga ner för vila. Maximalt uppförsbacken." },
    { name: "Skipping (höga knän)", sets: "3 set × 1 min", muscle: "Ben, core", how: "Spring på stället med knäna högt mot bröstet i snabbt tempo. Koordinera med armarna. Håll magen spänd." },
    { name: "Elliptical", sets: "25 min, varierande motstånd", muscle: "Ben, armar, hjärta", how: "Stå upprätt på maskinen. Skjut med benen i elliptisk rörelse och dra/skjut med armarna. Variera motstånd var 5:e min." },
    { name: "Simning", sets: "500–1000 m frisim", muscle: "Hela kroppen", how: "Ta långa tag med armarna, rotera kroppen och sparka jämnt med benen. Andas var 3:e tag för jämn syresättning." },
    { name: "Mountain climbers", sets: "3 set × 30 sek", muscle: "Core, axlar, ben", how: "Plankposition med raka armar. Dra ett knä i taget snabbt mot bröstet i ett löpliknande mönster. Håll höfterna nere." },
    { name: "Trappklättring", sets: "10 min intervaller", muscle: "Ben, kondition", how: "Kliv upp för trappstegen med hela foten. God hållning och drivande armar. Springa varannan trappa för högre intensitet." },
    { name: "Kettlebell swing", sets: "4 set × 20 reps", muscle: "Rumpa, baksida lår, core", how: "Stå axelbrett. Böj höfterna och svinga kettlebell bakåt, pressa sedan höfterna framåt explosivt och svinga upp till axelhöjd." },
    { name: "Battle ropes", sets: "3 set × 30 sek", muscle: "Axlar, armar, core", how: "Håll ett rep i varje hand. Skapa alternativa eller simultana vågmönster intensivt. Håll lätt böjda knän och spänd core." },
    { name: "Assault bike intervaller", sets: "8 × 20 sek max / 40 sek vila", muscle: "Hela kroppen", how: "Cykla maximalt med båda armar och ben i 20 sek. Vänta 40 sek. Assault bike är en av de tuffaste konditionsövningarna." },
    { name: "Farmers carry", sets: "4 set × 30 m", muscle: "Core, axlar, grepp, ben", how: "Håll tunga hantlar/kettlebells i varje hand. Gå med upprätt hållning och spänd core. Låt inte vikten dra ned axlarna." },
    { name: "Shadowboxning", sets: "4 set × 2 min", muscle: "Axlar, hela kroppen", how: "Boxas i luften med snabba kombinationer av jab, kross, krok och uppercut. Rör på fötterna hela tiden." },
    { name: "Power walk med vikter", sets: "20–30 min", muscle: "Ben, hjärta, axlar", how: "Promenera snabbt med hantlar i händerna eller viktväst. Håll armarna aktiva i rörelsen för att höja intensiteten." },
    { name: "Kettlebell snatch", sets: "3 set × 8 reps/sida", muscle: "Hela kroppen", how: "Lyft kettlebell i ett explosivt svep från mellan benen till rakt arm ovan huvud. Böj höfterna och pressa höfterna fram." },
    { name: "Jump rope double unders", sets: "3 set × 30 reps", muscle: "Vader, kondition", how: "Hopprep där repet passerar under fötterna två gånger per hopp. Kräver snabba handledsvridningar och lite högre hopp." },
    { name: "Sled push", sets: "4 set × 20 m", muscle: "Hela kroppen", how: "Luta kroppen framåt mot sleden. Driv med benen och håll armarna raka. Fokus på explosiv kraft från benen." },
    { name: "Depth jump", sets: "4 set × 8 reps", muscle: "Ben, explosivitet", how: "Kliv av en låg box och hoppa omedelbart uppåt maximalt när du landar. Minimera kontakttiden med golvet." },
    { name: "Cykling HIIT", sets: "8 × 30 sek max / 90 sek lugnt", muscle: "Ben, hjärta", how: "Cykla med maximalt motstånd i 30 sek. Sänk motståndet och cykla lugnt i 90 sek. Upprepa 8 gånger." },
    { name: "Bakåtlöpning", sets: "5 × 30 m", muscle: "Ben, koordination", how: "Spring bakåt med kontrollerade steg. Fokus på proprioception och koordination. Bra variation och aktiverar baksida lår mer." },
    { name: "Snabba step-ups", sets: "3 set × 1 min", muscle: "Ben, kondition", how: "Steg upp och ner på en box/trappsteg så snabbt som möjligt. Alternera ledande benet varannan set." },
    { name: "Jumping jacks", sets: "3 set × 50 reps", muscle: "Hela kroppen, kondition", how: "Hoppa och särat fötterna simultant med att höja armarna ovanför huvudet. Hoppa tillbaka till start. Bra uppvärmning." },
    { name: "Speed skaters", sets: "3 set × 20 reps", muscle: "Lår, rumpa, kondition", how: "Hoppa från ett ben till det andra i en skejt-rörelse, sving motsatt arm framåt. Explosivt och rytmiskt." },
    { name: "Box jump burpees", sets: "3 set × 10 reps", muscle: "Hela kroppen", how: "Gör ett burpee och avsluta med ett boxhopp istället för vanligt hopp. Kombinerar styrka och kondition." },
    { name: "Ski erg", sets: "3 set × 500 m", muscle: "Överkropp, core, kondition", how: "Greppa handtagen. Stå med böjda knän och dra kraftigt nedåt med armarna. Böj överkroppen och sträck. Simulerar skidåkning." },
    { name: "Rope climb", sets: "3 × upp och ner", muscle: "Rygg, biceps, grepp", how: "Greppa repet högt, dra upp med armarna och klättra med fötterna (S-teknik). Bra för överkroppsstyrka och kondition." },
    { name: "Sandbag carry", sets: "4 set × 20 m", muscle: "Hela kroppen, kondition", how: "Bär en sandbag på axeln, mot bröstet eller i björnagrepp. Variera positionen och känn hur hela kroppen stabiliserar." },
    { name: "Kettlebell clean", sets: "3 set × 10 reps/sida", muscle: "Höfter, axlar, core", how: "Lyft kettlebell explosivt från golv/mellan benen upp till rack-position (knytnäven mot axeln). Explosiv höftextension." },
    { name: "Rodd intervaller", sets: "4 × 500 m med 2 min vila", muscle: "Rygg, ben, kondition", how: "Ro varje 500 m intervall maximalt. Fokus på effektiv rowningteknik: ben, höft, armar – i den ordningen." },
    { name: "Stair sprints", sets: "6–10 × en trappa", muscle: "Ben, kondition, explosivitet", how: "Sprint upp för trappan med maximalt driv från benen. Gå ner som aktiv vila. Fokusera på explosivitet." },
    { name: "Plyo push-up med boxhopp", sets: "3 set × 8 kombinationer", muscle: "Hela kroppen", how: "Gör ett explosivt push-up, hoppa upp, gör ett boxhopp, kliv ner och upprepa. Maximal intensitet och kondition." },
    { name: "High intensity elliptical", sets: "5 × 1 min max / 1 min lugn", muscle: "Ben, armar, kondition", how: "Intervallträning på elliptical. Öka motstånd kraftigt under intensiva faser och sänk under vilofaserna." },
    { name: "Simning intervaller", sets: "4 × 100 m med 30 sek vila", muscle: "Hela kroppen", how: "Simma 100 m frisim med maximal intensitet. Vila 30 sek. Fokusera på teknik och kraftfulla tag." },
    { name: "Tire flip", sets: "3 set × 10 reps", muscle: "Hela kroppen, explosivitet", how: "Dra ett tungt däck upp längs låren med handgreppet underifrån. När det når knähöjd, pressa det framåt och välta." },
    { name: "Konditiion cirkelträning", sets: "3 varv × 5 stationer", muscle: "Hela kroppen", how: "Kombinera 5 övningar (t.ex. burpees, hopprep, mountain climbers, boxhopp, battle ropes) med 40 sek på/20 sek vila." },
  ],
  rorlighet: [
    { name: "Liggande vridning (rygg)", sets: "3 × 30 sek/sida", muscle: "Ländrygg, höfter", how: "Ligg på rygg. Dra ett knä upp och vrid det åt sidan över kroppen. Håll axeln i golvet. Andas djupt." },
    { name: "Hip flexor stretch", sets: "3 × 45 sek/sida", muscle: "Höftböjare, framsida lår", how: "Knästå med ett ben framåt. Skjut höften rakt framåt och nedåt. Håll ryggen rak. Känn sträcket framtill i höften." },
    { name: "Bröstsöppning (dörr)", sets: "3 × 30 sek", muscle: "Bröst, axlar", how: "Stå i dörröppning med underarmarna mot karmen. Luta kroppen sakta framåt. Känn sträcket i bröstet och framsidan av axlarna." },
    { name: "Hamstring stretch (liggande)", sets: "3 × 40 sek/sida", muscle: "Baksida lår", how: "Ligg på rygg. Lyft ett ben och håll bakom låret. Sträck benet tills du känner ett lätt drag. Andas ut och sträck mer." },
    { name: "Pigeon pose", sets: "3 × 1 min/sida", muscle: "Höfter, rumpa", how: "Från planka, för ett knä framåt bakom handleden och sträck andra benet bakåt. Sänk höfterna mot golvet och håll." },
    { name: "Cat-cow", sets: "2 × 10 rep", muscle: "Ryggrad, mage", how: "På händer och knän. Andas in och svanka (ko), andas ut och rundra mot taket (katt). Mjuk, kontrollerad rörelse." },
    { name: "Axelstretch tvärs bröstet", sets: "3 × 30 sek/sida", muscle: "Bakre axel, övre rygg", how: "Dra en rak arm tvärs framför bröstet. Håll på plats med andra armen ovanför armbågen. Känn bakre axeln sträcka." },
    { name: "Vadstretching (vägg)", sets: "3 × 40 sek/sida", muscle: "Vader", how: "Stå med händerna mot väggen. Sträck ett ben bakåt med hälen i golvet och böj det främre knät. Känn vaden sträcka." },
    { name: "Nackstretching", sets: "3 × 20 sek/sida", muscle: "Nacke, axlar", how: "Luta huvudet åt sidan. Förstärk lätt med handen ovanpå. Håll motsatt axel nere. Känn sträck längs sidan av nacken." },
    { name: "Seated forward fold", sets: "3 × 1 min", muscle: "Baksida ben, ländrygg", how: "Sitt med raka ben. Böj från höften (inte ryggen) och nå mot fötterna. Håll ryggen så rak du kan. Andas ut och sträck mer." },
    { name: "World's greatest stretch", sets: "2 × 5 rep/sida", muscle: "Hela kroppen", how: "Utfall framåt, placera samma sidas hand vid foten. Rotera överkroppen upp och sträck armen mot taket. Gå igenom hela rörelsen." },
    { name: "Thoracic rotation", sets: "3 × 10 rep/sida", muscle: "Övre rygg", how: "Knästå med en hand bakom huvudet. Rotera överkroppen uppåt så armbågen pekar mot taket. Ger mobilitet i bröstrygg." },
    { name: "Figure-four stretch", sets: "3 × 45 sek/sida", muscle: "Rumpa, piriformis", how: "Ligg på rygg. Kors ett ben och lägg vristbenet mot det andra låret. Dra det undre knät mot bröstet. Känn rumpa/höft." },
    { name: "Downward dog", sets: "3 × 30 sek", muscle: "Baksida lår, vader, rygg, axlar", how: "Händer och fötter i golvet i omvänt V. Pressa hälar mot golvet och lyft höfterna. Sträck ut ryggen och benen." },
    { name: "Child's pose", sets: "3 × 1 min", muscle: "Ländrygg, höfter, axlar", how: "Knästå, sänk rumpan mot hälarna. Sträck armarna framåt och sänk bröstet mot golvet. Andas djupt och koppla av." },
    { name: "Cobra stretch", sets: "3 × 30 sek", muscle: "Mage, ländrygg, bröst", how: "Ligg magen ner. Placera händerna vid axlarna och pressa upp överkroppen med raka eller lätt böjda armar. Håll höfterna nere." },
    { name: "Butterfly stretch", sets: "3 × 45 sek", muscle: "Höfter, ljumskarna", how: "Sitt med fotsulorna mot varandra. Håll i fötterna och tryck knäna mot golvet med armbågarna. Luta eventuellt framåt." },
    { name: "Stående framåtböj", sets: "3 × 30 sek", muscle: "Baksida ben, ländrygg", how: "Stå med raka ben, böj framåt och låt överkroppen hänga tungt. Nå mot golvet. Skaka lite på kroppen och andas djupt." },
    { name: "Lizard pose", sets: "3 × 45 sek/sida", muscle: "Höfter, framsida lår, ljumskarna", how: "Djupt utfall med framfoten utanför handen. Sänk höften mot golvet och håll. Ev. gå ner på bakre underarmen." },
    { name: "Seated spinal twist", sets: "3 × 30 sek/sida", muscle: "Ryggrad, höfter", how: "Sitt med ett ben sträckt. Dra det andra knät mot bröstet. Rotera överkroppen mot det böjda benet med stöd av armen." },
    { name: "Thread the needle", sets: "3 × 30 sek/sida", muscle: "Övre rygg, axlar", how: "På händer och knän. För en arm under kroppen längs golvet och rotera överkroppen. Känn sträcket i övre ryggen." },
    { name: "Stående quad stretch", sets: "3 × 30 sek/sida", muscle: "Framsida lår", how: "Stå på ett ben (håll i stöd). Böj det andra benet och håll foten mot rumpan. Håll knäna tillsammans. Stå upprätt." },
    { name: "IT-band stretch", sets: "3 × 30 sek/sida", muscle: "Utsida lår/höft", how: "Stå och kors ett ben framför det andra. Böj åt sidan mot det korsade benet och lyft motsatt arm. Känn utsidan av höften." },
    { name: "Soleus stretch", sets: "3 × 30 sek/sida", muscle: "Djupa vaden (soleus)", how: "Vadstretching mot väggen men böj knäet på bakre benet. Fokuserar på djupare del av vaden till skillnad från rakt ben." },
    { name: "Happy baby", sets: "2 × 1 min", muscle: "Höfter, ländrygg, ljumskarna", how: "Ligg på rygg. Böj knäna mot bröstet och håll i fotsulorna utifrån. Dra fötterna mot golvet och gunga lätt." },
    { name: "Frog stretch", sets: "3 × 1 min", muscle: "Höfter, ljumskarna", how: "På händer och knän, flytta ut knäna brett med underbenen parallella med kroppen. Sänk höfterna mot golvet. Andas djupt." },
    { name: "Scorpion stretch", sets: "3 × 10 rep/sida", muscle: "Ländrygg, axlar, bröst", how: "Ligg magen ner med armarna ut åt sidorna. Lyft ett ben och sväng det tvärs över kroppen mot motstående hand." },
    { name: "Hip circles", sets: "2 × 10 rep/riktning", muscle: "Höfter, ländrygg", how: "Stå med händerna på höfterna. Rita stora cirklar med höfterna. Mjuk, rund rörelse. Stämmer av rörlighet i höftleden." },
    { name: "Wall chest opener", sets: "3 × 30 sek/sida", muscle: "Bröst, axlar", how: "Stå vid en vägg. Placera en rak arm mot väggen i 90°. Rotera kroppen bort från väggen tills du känner bröst/axel sträcka." },
    { name: "Toe stretch", sets: "2 × 30 sek", muscle: "Fotsulor, tår", how: "Knästå med tårna böjda under fötterna (tåhällning). Sänk rumpan mot hälarna och känn sträcket i fotsulorna." },
    { name: "Extended puppy pose", sets: "3 × 45 sek", muscle: "Axlar, övre rygg, ländrygg", how: "På händer och knän. Gå ut med händerna framåt och sänk bröstet mot golvet. Rumpan stannar ovanför knäna." },
    { name: "Neck rolls", sets: "2 × 5 rep/riktning", muscle: "Nacke, övre trapezius", how: "Rulla sakta med huvudet i en halvcirkel framåt från axel till axel. Aldrig bakåt om det gör ont. Mjukt och lugnt." },
    { name: "Wrist circles", sets: "2 × 10 rep/riktning", muscle: "Handleder, underarmar", how: "Håll armarna framåt. Rotera handlederna i cirklar i båda riktningarna. Bra uppvärmning och förebygger skador." },
    { name: "Side-lying quad stretch", sets: "3 × 30 sek/sida", muscle: "Framsida lår, höftböjare", how: "Ligg på sidan. Böj det övre benet och håll i foten. Tryck höften framåt (inte bakåt). Känn framsidan av låret." },
    { name: "Thoracic extension (skumrulle)", sets: "3 × 1 min", muscle: "Bröstrygg, bröstkorg", how: "Ligg med en skumrulle tvärs under övre ryggen. Böj bakåt över rullen. Flytta den stegvis uppåt längs bröstryggen." },
    { name: "Low lunge med rotation", sets: "3 × 5 rep/sida", muscle: "Höfter, rygg, bröst", how: "Djupt utfall, bakre knä i golvet. Lyft samma hand som bakre benet och rotera överkroppen upp. Öppnar höft och bröst." },
    { name: "Ryggknä mot bröstet", sets: "3 × 30 sek/sida", muscle: "Ländrygg, rumpa", how: "Ligg på rygg. Krama ett knä mot bröstet med båda händerna. Dra lätt och håll. Känn ländryggssträcket." },
    { name: "Sitting hip opener", sets: "3 × 45 sek/sida", muscle: "Höfter, ljumskarna", how: "Sitt på golvet med ena benet böjt framåt (fotsulan inåt) och det andra åt sidan. Luta framåt mot det böjda benet." },
    { name: "Axelcirkel (stående)", sets: "2 × 10 rep/riktning", muscle: "Axelleden, övre trapezius", how: "Stå med armarna avslappnade. Rotera axlarna i stora cirklar bakåt och framåt. Perfekt uppvärmning för axlar." },
    { name: "Standing side stretch", sets: "3 × 30 sek/sida", muscle: "Sidor, obliques, latissimus", how: "Stå upp. Lyft en arm rakt upp och böj överkroppen åt sidan. Känn hela sidan sträcka. Håll höfterna stilla." },
  ],
  core: [
    { name: "Planka", sets: "3 set × 45–60 sek", muscle: "Core, axlar", how: "Vila på underarmar och tår. Håll kroppen rak som en bräda – spänn magen, rumpa och lår. Undvik att höfterna sjunker." },
    { name: "Sidoplanka", sets: "3 set × 30 sek/sida", muscle: "Sidor, obliques", how: "Stöd på en underarm med sidan av foten. Lyft höften och håll kroppen rak. Core håller dig uppe, inte axeln." },
    { name: "Dead bug", sets: "3 set × 10 rep/sida", muscle: "Core, ländrygg", how: "Ligg på rygg med armar upp och höfter/knän i 90°. Sänk motsatt arm och ben mot golvet. Pressa ländryggen mot golvet." },
    { name: "Russian twist", sets: "3 set × 20 reps", muscle: "Obliques, core", how: "Sitt med böjda ben och luta överkroppen 45° bakåt. Håll händerna ihop och rotera överkroppen från sida till sida." },
    { name: "Hanging knee raise", sets: "3 set × 12 reps", muscle: "Mage, höftböjare", how: "Häng i stång. Spänn magen och dra knäna kontrollerat upp mot bröstet. Sänk sakta utan att svinga." },
    { name: "Ab wheel rollout", sets: "3 set × 8–10 reps", muscle: "Hela core", how: "Knästående med hjulet framför. Rulla sakta ut med raka armar. Dra tillbaka med magen – inte ryggen. Undvik att ländryggen sjunker." },
    { name: "Bird dog", sets: "3 set × 10 rep/sida", muscle: "Core, ländrygg", how: "På händer och knän. Sträck ett ben och motsatt arm rakt ut. Håll ryggen plan och höfterna i nivå. Byt sida." },
    { name: "Pallof press", sets: "3 set × 10 reps/sida", muscle: "Anti-rotation, core", how: "Stå med sidan mot kabeln. Håll handtaget vid bröstet. Pressa rakt ut, håll 2 sek och dra tillbaka. Motstå rotationskraften." },
    { name: "Toe touch crunch", sets: "3 set × 15 reps", muscle: "Raka magen", how: "Ligg på rygg med benen rakt upp. Nå med händerna mot tårna och lyft överkroppen med magen – inte med nacken." },
    { name: "Flutter kicks", sets: "3 set × 30 sek", muscle: "Nedre mage, höftböjare", how: "Ligg på rygg med händerna under rumpan och benen raka. Flytta benen alternativt upp och ner. Håll ländryggen nere." },
    { name: "Dragon flag (negativ)", sets: "3 set × 5 reps", muscle: "Hela core", how: "Ligg på bänk och håll fast bakom huvudet. Lyft kroppen rakt upp. Sänk sedan kontrollerat med rak kropp. Fokus på nedfasen." },
    { name: "Landmine rotation", sets: "3 set × 10 rep/sida", muscle: "Obliques, axlar", how: "Håll stångändan med båda händerna framför bröstet. Rotera och sväng ned till ena sidan, sedan tillbaka. Armarna nästan raka." },
    { name: "Copenhagen plank", sets: "3 set × 20 sek/sida", muscle: "Adduktorer, core", how: "Sidoplanka med insidan av foten på en bänk. Lyft höften och håll kroppen rak. Det inre låret håller dig uppe." },
    { name: "V-sit", sets: "3 set × 20–30 sek", muscle: "Core, höftböjare", how: "Balansera på sittbensbenen. Lyft benen och överkroppen i V-form. Håll ryggen rak och armar framåt. Svårt men effektivt." },
    { name: "Windshield wipers", sets: "3 set × 10 rep/sida", muscle: "Obliques, core", how: "Häng i stång med benen raka och höfterna i 90°. Sväng benen långsamt från sida till sida. Kontrollerad rörelse." },
    { name: "Hollow rock", sets: "3 set × 20 sek", muscle: "Core, hela kroppen", how: "Håll hollow body-positionen (se hollow body hold) och gunga fram och tillbaka. En korrekt position är viktigt." },
    { name: "Weighted plank", sets: "3 set × 30–45 sek", muscle: "Core, axlar", how: "Vanlig planka men med en viktplatta (10–20 kg) på övre ryggen. Ökar belastningen markant utan att ändra rörelsen." },
    { name: "Toes to bar", sets: "3 set × 8 reps", muscle: "Mage, höftböjare, latissimus", how: "Häng i stång. Håll armbågarna lätt böjda. Lyft raka ben tills tårna nuddar stången. Sänk kontrollerat." },
    { name: "Reverse crunch", sets: "3 set × 15 reps", muscle: "Nedre mage", how: "Ligg på rygg med händerna vid sidan. Lyft höfterna och rulla dem mot bröstet. Fokus på nedre magen – inte höftböjarna." },
    { name: "Bicycle crunch", sets: "3 set × 20 reps", muscle: "Obliques, raka magen", how: "Ligg på rygg, händerna bakom huvudet. Rotera en armbåge mot motstående knä. Förläng det andra benet. Alternera." },
    { name: "Plank hip dip", sets: "3 set × 15 reps/sida", muscle: "Obliques", how: "Från sidoplankposition. Sänk höften mot golvet och lyft tillbaka. Kontrollerat och mjukt. Obliques arbetar hela tiden." },
    { name: "Inchworm", sets: "3 set × 8 reps", muscle: "Core, axlar, baksida ben", how: "Böj ner och gå ut med händerna till plankposition. Gå sedan med fötterna mot händerna och stå upp. Upprepa." },
    { name: "Cable crunch (knästående)", sets: "3 set × 12 reps", muscle: "Raka magen", how: "Knästå vid kabel. Håll handtaget vid pannan. Dra ner överkroppen mot golvet med magen – håll höfterna stilla." },
    { name: "Decline crunch", sets: "3 set × 15 reps", muscle: "Raka magen", how: "Sit-up på lutad bänk med fötterna uppåt. Lägg händerna på bröstet. Lyft överkroppen mot knäna. Sänk kontrollerat." },
    { name: "Stability ball pass", sets: "3 set × 10 reps", muscle: "Hela core", how: "Ligg på rygg. Håll en gymball med händerna. Lyft armar och ben och passa bollen till fötterna. Sänk och passa tillbaka." },
    { name: "Hanging L-sit", sets: "3 set × 10–15 sek", muscle: "Core, latissimus, axlar", how: "Häng i stång. Lyft raka ben till vågrätt i L-form. Håll positionen. Extremt krävande för core och höftböjare." },
    { name: "Jackknife crunch", sets: "3 set × 12 reps", muscle: "Hela core", how: "Ligg på rygg med armar och ben raka. Lyft armar och ben och möt händer och fötter i mitten. Sänk kontrollerat." },
    { name: "Stir the pot", sets: "3 set × 10 reps/riktning", muscle: "Core, stabilisering", how: "Underarmar på en gymball. Rulla bollen i cirklar medan du håller plankaposition. Stor utmaning för coresstabilitet." },
    { name: "Suitcase carry", sets: "4 set × 20 m/sida", muscle: "Core, anti-lateral flexion, grepp", how: "Bär en tung hantel i en hand och håll kroppen helt rak. Motstå frestelsen att luta mot vikten. Anti-lateral flexion." },
    { name: "Half kneeling chop", sets: "3 set × 10 rep/sida", muscle: "Core, axlar, rotation", how: "Knästå med ena benet framåt. Dra ett kabelhandtag från hög till låg diagonalt. Rotera överkroppen kontrollerat." },
    { name: "Lateral crunch", sets: "3 set × 15 reps/sida", muscle: "Obliques", how: "Ligg på sidan med händerna bakom huvudet. Lyft överkroppen sidledes mot höften. Håll 1 sek och sänk." },
    { name: "Cross body mountain climber", sets: "3 set × 20 reps", muscle: "Obliques, core, axlar", how: "Mountain climbers men dra knäet mot motstående armbåge. Roterar mer och engagerar obliques starkare." },
    { name: "Plank jacks", sets: "3 set × 30 sek", muscle: "Core, kondition", how: "Plankposition med raka armar. Hoppa med fötterna ut åt sidorna och tillbaka (som jumping jacks). Håll höfterna stilla." },
    { name: "Long lever plank", sets: "3 set × 20–30 sek", muscle: "Core", how: "Som vanlig underarmsplanka men flytta armbågarna framåt (förlänger hävarmen). Markant svårare för core." },
    { name: "Bear crunch", sets: "3 set × 12 rep/sida", muscle: "Core, obliques", how: "Bear crawl-position (höfterna uppe). Dra ett knä mot motstående armbåge. Håll höfterna stabila. Alternera sidor." },
    { name: "Weighted sit-up", sets: "3 set × 12 reps", muscle: "Raka magen", how: "Ligg på rygg med en viktplatta mot bröstet. Utför sit-up. Håll fötterna fixerade eller fria. Pressa ut hakan i toppen." },
    { name: "Dragon walk", sets: "3 set × 10 m", muscle: "Core, axlar, höfter", how: "Gå framåt i armhävningsposition men ta steg med hand och fot på samma sida simultant. Håll höfterna nere." },
    { name: "TRX pike", sets: "3 set × 10 reps", muscle: "Core, axlar", how: "Fötterna i TRX, händerna i golvet i planka. Dra höfterna upp mot taket till inverterat V. Kontrollerat och sakta." },
    { name: "Superman plank", sets: "3 set × 30–40 sek", muscle: "Ländrygg, rumpa, core", how: "Ligg magen ner med armarna framåt. Lyft armar och ben som i Superman men håll positionen istället för att gunga." },
    { name: "Ab wheel pike", sets: "3 set × 8 reps", muscle: "Core, axlar", how: "Knästå med ab wheel. Rulla ut, sedan istället för att dra tillbaka rakt – lyft höfterna upp och dra hjulet mot knäna." },
  ],
  tennis: [
    { name: "Extern rotation (rotatorkuff)", sets: "3 set × 15 reps/sida", muscle: "Rotatorkuff, bakre axel", how: "Armbågen böjd i 90° mot sidan med ett band/kabel. Rotera underarmen utåt från kroppen. Grundövning för att förebygga de axelskador som är vanligast i tennis." },
    { name: "Intern rotation (rotatorkuff)", sets: "3 set × 15 reps/sida", muscle: "Rotatorkuff, axlar", how: "Som extern rotation men inåt. Armbågen i 90°, rotera underarmen mot magen mot bandets motstånd. Balanserar axelmusklerna och motverkar överbelastning." },
    { name: "Shoulder Y-raise", sets: "3 set × 12 reps", muscle: "Övre trapezius, serratus, axlar", how: "Ligg magen ner eller böjd framåt. Lyft armarna diagonalt i Y-form (ca 45° ut). Tummen upp. Stärker övre trapezius som är avgörande för serv och smash." },
    { name: "Shoulder T-raise", sets: "3 set × 12 reps", muscle: "Bakre axel, rhomboids", how: "Ligg magen ner. Lyft armarna rakt ut åt sidan i T-form. Tummen upp. Stärker bakre axel för balanserad axelstyrka och förebygger impingement." },
    { name: "Shoulder W-raise", sets: "3 set × 12 reps", muscle: "Bakre axel, rotatorkuff", how: "Ligg magen ner med armarna i W-form. Kläm skulderbladen och externrotera. YTW-serien är standardrekommendation för tennisspelarens axelhälsa." },
    { name: "Face pull", sets: "3 set × 15 reps", muscle: "Bakre axel, rotatorkuff", how: "Kabeln i ansiktshöjd, dra mot ansiktet med höga armbågar. Externrotera i slutposition. Motverkar den inåtrotation av axlar som tennisträning ger upphov till." },
    { name: "Medicinbollskast mot vägg (rotation)", sets: "4 set × 10 reps/sida", muscle: "Obliques, core, axlar", how: "Stå vid en vägg med sidan mot den. Rotera explosivt och kasta medicinbollen i väggen. Fånga och upprepa. Tränar den explosiva rotationsstyrka som driver alla tennisslag." },
    { name: "Kabelchop (hög till låg)", sets: "3 set × 12 reps/sida", muscle: "Obliques, core, axlar", how: "Kabeln högt. Stå med sidan mot maskinen. Dra diagonalt ner och tvärs kroppen med sträckta armar. Simulerar forhands- och backhandsrörelsen. Kärnövning för tenniskraft." },
    { name: "Kabelchop (låg till hög)", sets: "3 set × 12 reps/sida", muscle: "Obliques, core, axlar", how: "Kabeln lågt. Dra diagonalt upp och tvärs kroppen. Simulerar lobben och servrörelsens uppåtgående fas. Tränar rotationsstyrka från höft till axel." },
    { name: "Pallof press", sets: "3 set × 10 reps/sida", muscle: "Core, obliques", how: "Stå med sidan mot kabel. Pressa handtaget rakt ut, håll 2 sek. Motstå rotationen. Anti-rotationsstyrka ger dig en stabil bas att slå från oavsett balansläge på banan." },
    { name: "Landmine rotation", sets: "3 set × 10 reps/sida", muscle: "Obliques, core, axlar", how: "Håll stångändan med sträckta armar. Sväng explosivt från sida till sida med höften som motor. Liknar tennisservens slagrörelse – kraft från marken upp." },
    { name: "Russian twist med medicinboll", sets: "3 set × 20 reps", muscle: "Obliques, core", how: "Sitt med böjda ben, luta bakåt. Rotera överkroppen med medicinboll och rör golvet på varje sida. Stärker obliques som driver alla slag, särskilt vid öppen ståndsfot." },
    { name: "Lateral shuffle (10 m)", sets: "5 × 10 m/riktning", muscle: "Lår, rumpa, vader, kondition", how: "Spring sidledes 10 m med låg tyngdpunkt och korsade armar. Byt riktning snabbt. Tränar det specifika laterala rörelsemönstret du använder varje poäng på tennisbanan." },
    { name: "Carioca (kors-steg)", sets: "3 × 20 m/riktning", muscle: "Höfter, lår, koordination", how: "Spring sidledes med korsande steg – en fot framför och en bakom alternativt. Tränar höftrörlighet och koordination för snabba riktningsbyten på banan." },
    { name: "Split step", sets: "3 set × 20 reps", muscle: "Vader, lår, reaktion", how: "Hoppa isär med båda fötterna simultant och landa lätt i redo-position (böjda knän, lätt framåtlutad). Klassisk startrörelse i tennis – tränar reaktion och explosivitet." },
    { name: "Lateral lunge", sets: "3 set × 10 reps/sida", muscle: "Lår, höfter, rumpa", how: "Tag ett stort steg åt sidan. Böj det stegande benet djupt medan det andra är rakt. Pressa tillbaka. Speglar rörelsemönstret vid wide balls – bra balans och höftstyrka." },
    { name: "Lateral band walk", sets: "3 set × 15 steg/riktning", muscle: "Höftabduktorer, rumpa", how: "Gummiband runt knäna eller anklar. Gå sidledes med konstant spänning i banden. Stärker höftabduktorerna som stabiliserar knäet vid snabba laterala byten." },
    { name: "Box jump lateral", sets: "4 set × 8 reps/sida", muscle: "Lår, rumpa, vader", how: "Stå vid sidan av en box. Hoppa lateralt upp på boxen och kliv ner på andra sidan. Tränar explosiv lateral kraft – samma kraft du behöver för att täcka banan." },
    { name: "Nordic hamstring curl", sets: "3 set × 5–8 reps", muscle: "Baksida lår", how: "Knästå med fötterna fixerade av partner. Sänk överkroppen framåt så sakta som möjligt. Stöd med händerna. Förebygger hamstringsskador som drabbar tennisspelare ofta vid snabba stopp." },
    { name: "Squat jump med rotation", sets: "3 set × 10 reps", muscle: "Lår, rumpa, core", how: "Knäböj och hoppa upp med en 90° rotation i luften. Landa mjukt med böjda knän. Kombinerar benstyrka med luftrotation – specifikt för tennisserven och smash-landningen." },
    { name: "Snabba calf raises", sets: "4 set × 20 reps", muscle: "Vader", how: "Snabba, rytmiska tåhävningar på ett eller två ben. Imiterar de reaktiva fotarbetsrörelserna. Tränar elastisk kraft i vader för snabba split steps och riktningsbyten." },
    { name: "Agility stege – kors-steg", sets: "4 × 15 m", muscle: "Koordination, fötter, lår", how: "Stega snabbt med kors-steg in och ut ur varje ruta i en agilitetsstege. Fokus på snabba fottag och god hållning. Tränar tennisspecifikt fotarbete och koordination." },
    { name: "Wrist curl (handled, flexion)", sets: "3 set × 20 reps", muscle: "Underarm (flexorer)", how: "Sitt med underarmen stödd mot låret, handflatorna uppåt. Curl handleden upp och ner med lätt hantel. Stärker greppet och underarmsflexorerna för slagkontroll." },
    { name: "Wrist extension (handled)", sets: "3 set × 20 reps", muscle: "Underarm (extensorer)", how: "Som wrist curl men handflatorna nedåt. Sträck handleden uppåt mot motståndet. Förebygger tennisarmbåge (lateral epikondylit) – det vanligaste tennisrelaterade skadeproblemet." },
    { name: "Supination/pronation (underarm)", sets: "3 set × 15 reps/sida", muscle: "Underarm, handled", how: "Håll en hammarpinne eller liten hantel. Rotera underarmen från pronerat (nedåt) till supinerat (uppåt) läge. Stärker de underarmsrotatorer som styr racketpositionen vid slag." },
    { name: "Forhands-simulering (gummiband)", sets: "3 set × 15 reps", muscle: "Bröst, obliques, axlar", how: "Fäst gummiband bakom dig. Utför forhands-rörelsen explosivt – rotation och arm korsas kroppen framåt. Specifik muskelprogrammering för tennisforhanden med rätt rörelsekedja." },
    { name: "Backhands-simulering (gummiband)", sets: "3 set × 15 reps", muscle: "Axlar, obliques, rygg", how: "Fäst gummiband framför dig. Rotera bort och dra armen i backhandsriktning. Tränar de specifika muskelkedjorna för backhanden. Bra komplement till banträning." },
    { name: "Single arm axelpress (stående)", sets: "3 set × 10 reps/sida", muscle: "Axlar, core", how: "Stå och pressa en hantel med ett arm rakt upp. Motstå lateralt läckage med core. Tränar axelstabilitet och core-integration – kritiskt för den asymmetriska servrörelsen." },
    { name: "TRX-rodd med rotation", sets: "3 set × 10 reps/sida", muscle: "Rygg, axlar, core", how: "Dra i TRX (inverted row) och rotera överkroppen med fri hand mot taket i toppositionen. Kombinerar ryggstyrka med rotationsrörlighet för bättre backhandsrörelse." },
    { name: "Sittande kabeldrag med rotation", sets: "3 set × 12 reps/sida", muscle: "Rygg, obliques, biceps", how: "Dra kabeln och rotera överkroppen i slutpositionen. Kombinerar dragstyrka med rotation – relevant för de backhandsslag och returer som kräver rotationskraft." },
    { name: "Single leg balance + kast", sets: "3 set × 10 kast/sida", muscle: "Balans, vader, core", how: "Stå på ett ben. En partner kastar en boll i olika riktningar och du fångar och kastar tillbaka. Tränar dynamisk balans och proprioception för stabila slag i instabila lägen." },
    { name: "Single leg RDL (hantel)", sets: "3 set × 10 reps/sida", muscle: "Baksida lår, rumpa, balans", how: "Stå på ett ben, böj framåt med rak rygg och lyft bakre benet. Håll hantel i motsatt hand. Stärker stabilisatorerna kring fotled och knä för snabb, stabil rörelse på banan." },
    { name: "Lunge med rotation", sets: "3 set × 10 reps/sida", muscle: "Lår, rumpa, obliques", how: "Gå i utfall framåt och rotera överkroppen mot framfoten i botten. Kombinerar benstyrka med rotationsförmåga. Speglar rörelsemönstret vid wide balls och öppna forhänder." },
    { name: "Hip 90/90 stretch", sets: "3 × 45 sek/sida", muscle: "Höfter, piriformis", how: "Sitt med båda benen i 90° men i olika riktningar (ett framåt, ett åt sidan). Luta mot frambenet. Öppnar höftlederna för bättre rörlighet och förebygger höftskador i tennis." },
    { name: "Bröstöppning på skumrulle", sets: "3 × 1 min", muscle: "Bröstrygg, bröst, axlar", how: "Ligg med en skumrulle längs ryggraden och armarna ut åt sidan. Koppla av och låt bröstet sjunka. Motverkar den framåtlutna hållning som drabbar många tennisspelare." },
    { name: "Thorax rotation (knästående)", sets: "3 × 10 reps/sida", muscle: "Bröstrygg, axlar", how: "Knästå med en hand bakom huvudet. Rotera överkroppen uppåt. Ökar rörligheten i bröstryggen som är kritisk för servens rörelseomfång och slagteknik." },
    { name: "Höft intern rotation (golv)", sets: "3 × 30 sek/sida", muscle: "Höfter, höftabduktorer", how: "Sitt på golvet, böj ett knä och för det inåt mot golvet. Bättre höftintern rotation ger smidigare split steps och lungerörelser utan kompensatorisk belastning på knä och ländrygg." },
    { name: "Ankelmobilitet (knästående mot vägg)", sets: "3 × 15 reps/sida", muscle: "Fotled, vader", how: "Knästå nära en vägg. Skjut knäet framåt och ut mot väggen utan att hälen lyfter. Bättre ankelmobilitet förbättrar alla positions- och rörelsemönster på banan." },
    { name: "Sprint 10–15–20 m", sets: "3 omgångar", muscle: "Lår, rumpa, vader, kondition", how: "Sprinta 10 m, gå tillbaka. Sprint 15 m, gå tillbaka. Sprint 20 m, gå tillbaka. Tennisspecifik acceleration – de flesta poäng avgörs på distanser under 5 m." },
    { name: "Medicinbolls slam med rotation", sets: "4 set × 8 reps/sida", muscle: "Core, obliques, axlar", how: "Lyft en medicinboll ovanför ena axeln och kasta ner den explosivt i golvet med full rotationsrörelse. Plocka upp och upprepa. Maximal explosiv rotationskraft för tennisslagets acceleration." },
  ],
};

const TYPE_LABELS = {
  vikter: "Vikter",
  kropp: "Kropp",
  kondition: "Kondition",
  rorlighet: "Rörlighet",
  core: "Core",
  tennis: "Tennis",
};

const MIN_PER_EXERCISE = {
  vikter: 6,
  kropp: 5,
  kondition: 14,
  rorlighet: 3,
  core: 4,
  tennis: 5,
};

let selectedTypes = new Set(["vikter"]);
let selectedDuration = null;
let selectedFocus = new Set();
let currentExercises = [];

// ── User & History ────────────────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function getUserName() {
  return localStorage.getItem('tg_username_v1') || null;
}
function setUserName(name) {
  if (name) localStorage.setItem('tg_username_v1', name);
  else localStorage.removeItem('tg_username_v1');
}
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('tg_history_v1')) || []; } catch { return []; }
}
function saveHistory(history) {
  localStorage.setItem('tg_history_v1', JSON.stringify(history));
}
function loadBlacklist() {
  try { return new Set(JSON.parse(localStorage.getItem('tg_blacklist_v1')) || []); } catch { return new Set(); }
}
function saveBlacklist(set) {
  localStorage.setItem('tg_blacklist_v1', JSON.stringify([...set]));
}

function migrateOldData() {
  if (getUserName()) return;
  try {
    const profiles = JSON.parse(localStorage.getItem('tg_profiles_v2')) || [];
    const activeId = localStorage.getItem('tg_active_v2');
    const active = profiles.find(p => p.id === activeId) || profiles[0];
    if (active && (active.alias || active.name)) setUserName(active.alias || active.name);
  } catch {}
  try {
    const old = JSON.parse(localStorage.getItem('tg_profile_v1'));
    if (old && old.name && !getUserName()) setUserName(old.name);
  } catch {}
}

function getLastResult(exerciseName) {
  for (const workout of loadHistory()) {
    const found = (workout.exercises || []).find(e =>
      e.name === exerciseName && e.logged && Object.keys(e.logged).length > 0
    );
    if (found) return { ...found.logged, date: workout.date };
  }
  return null;
}

function formatLastResult(logged) {
  const d = new Date(logged.date);
  const months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  const dateStr = `${d.getDate()} ${months[d.getMonth()]}`;
  const parts = [];
  if (logged.reps)    parts.push(`${logged.reps} reps`);
  if (logged.weight)  parts.push(`${logged.weight} kg`);
  if (logged.minutes) parts.push(`${logged.minutes} min`);
  if (logged.seconds) parts.push(`${logged.seconds} sek`);
  if (logged.done)    parts.push('utförd');
  return parts.join(' × ') + ' · ' + dateStr;
}

function getLogType(exercise) {
  if (exercise.type === 'vikter') return 'strength';
  if (exercise.type === 'kondition') return 'time';
  if (exercise.type === 'rorlighet') return 'check';
  if (/\bsek\b/i.test(exercise.sets)) return 'seconds';
  if (/\bmin\b/i.test(exercise.sets)) return 'time';
  return 'reps';
}

function renderLogRow(logType) {
  if (logType === 'strength') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<input class="log-input" type="number" inputmode="numeric" placeholder="Reps" data-log="reps" min="0">'
      + '<span class="log-sep">\xd7</span>'
      + '<input class="log-input" type="number" inputmode="decimal" placeholder="kg" data-log="weight" min="0" step="0.5">'
      + '</div>';
  }
  if (logType === 'time') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<input class="log-input" type="number" inputmode="numeric" placeholder="0" data-log="minutes" min="0">'
      + '<span class="log-unit">min</span>'
      + '</div>';
  }
  if (logType === 'seconds') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<input class="log-input" type="number" inputmode="numeric" placeholder="0" data-log="seconds" min="0">'
      + '<span class="log-unit">sek</span>'
      + '</div>';
  }
  if (logType === 'check') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<label class="log-check-label"><input type="checkbox" data-log="done"> Utf\xf6rd</label>'
      + '</div>';
  }
  return '<div class="log-row">'
    + '<span class="log-label">Logg</span>'
    + '<input class="log-input" type="number" inputmode="numeric" placeholder="Reps" data-log="reps" min="0">'
    + '</div>';
}

// ── User UI ───────────────────────────────────────────────────────────────────

function updateProfileBar() {
  const name = getUserName();
  const bar = document.getElementById('profile-bar');
  const hasBg = !!localStorage.getItem('tg_bg_image_v1');
  bar.innerHTML = '';
  if (name) {
    const greeting = document.createElement('span');
    greeting.className = 'profile-greeting';
    greeting.textContent = 'Hej, ';
    const strong = document.createElement('strong');
    strong.textContent = name;
    greeting.appendChild(strong);

    const statsBtn = document.createElement('button');
    statsBtn.className = 'profile-link-btn';
    statsBtn.textContent = '📊 Statistik';
    statsBtn.addEventListener('click', openStatsModal);

    const changeBtn = document.createElement('button');
    changeBtn.className = 'profile-link-btn';
    changeBtn.textContent = 'Ändra namn';
    changeBtn.addEventListener('click', openNameModal);

    bar.appendChild(greeting);
    bar.appendChild(statsBtn);
    bar.appendChild(changeBtn);
  } else {
    const createBtn = document.createElement('button');
    createBtn.className = 'profile-link-btn';
    createBtn.textContent = '+ Ange ditt namn';
    createBtn.addEventListener('click', openNameModal);
    bar.appendChild(createBtn);
  }

  const bgBtn = document.createElement('button');
  bgBtn.className = 'profile-link-btn';
  bgBtn.title = hasBg ? 'Ta bort bakgrundsbild' : 'Lägg till bakgrundsbild';
  bgBtn.textContent = hasBg ? '🖼 ✕' : '🖼';
  if (hasBg) {
    bgBtn.addEventListener('click', function() {
      if (confirm('Ta bort bakgrundsbilden?')) {
        localStorage.removeItem('tg_bg_image_v1');
        applyBgImage();
        updateProfileBar();
      }
    });
  } else {
    bgBtn.addEventListener('click', function() {
      document.getElementById('bg-file-input').click();
    });
  }
  bar.appendChild(bgBtn);
}

function openNameModal() {
  var input = document.getElementById('profile-alias-input');
  input.value = getUserName() || '';
  var errEl = document.getElementById('profile-create-error');
  errEl.textContent = '';
  errEl.className = 'profile-create-error';
  document.getElementById('profile-submit-btn').disabled = false;
  document.getElementById('profile-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(function() { input.focus(); }, 50);
}

function closeNameModal() {
  document.getElementById('profile-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function submitNewProfile() {
  var aliasInput = document.getElementById('profile-alias-input');
  var errorEl = document.getElementById('profile-create-error');
  var name = aliasInput.value.trim();
  errorEl.textContent = '';
  errorEl.className = 'profile-create-error';
  if (!name) { errorEl.textContent = 'Ange ett namn.'; aliasInput.focus(); return; }
  setUserName(name);
  closeNameModal();
  updateProfileBar();
}

// ── Stats ────────────────────────────────────────────────────────────────────

function getExerciseInfo(name) {
  for (const [type, list] of Object.entries(EXERCISES)) {
    const found = list.find(e => e.name === name);
    if (found) return { ...found, type };
  }
  return null;
}

const TYPE_COLORS = {
  vikter: '#a78bfa', kropp: '#60a5fa', kondition: '#34d399',
  rorlighet: '#fbbf24', core: '#f87171', tennis: '#22d3ee',
};
const MUSCLE_LABELS = {
  bröst: 'Bröst', rygg: 'Rygg', axlar: 'Axlar', armar: 'Armar',
  lår: 'Lår', rumpa: 'Rumpa', vader: 'Vader', mage: 'Mage', core: 'Core', höfter: 'Höfter',
};

function computeStats() {
  const name = getUserName();
  const history = loadHistory();
  const allLogged = history.reduce(function(acc, w) {
    return acc.concat((w.exercises || []).filter(function(e) {
      return Object.keys(e.logged || {}).length > 0;
    }));
  }, []);

  const byType = {};
  allLogged.forEach(e => { byType[e.type] = (byType[e.type] || 0) + 1; });

  const byMuscle = {};
  const mainAreas = ['bröst','rygg','axlar','armar','lår','rumpa','vader','mage','core','höfter'];
  allLogged.forEach(e => {
    const info = getExerciseInfo(e.name);
    if (!info) return;
    const parts = getBodyParts(info.muscle);
    mainAreas.forEach(area => {
      if (parts.has(area)) byMuscle[area] = (byMuscle[area] || 0) + 1;
    });
  });

  const byName = {};
  allLogged.forEach(e => { byName[e.name] = (byName[e.name] || 0) + 1; });
  const topExercises = Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return {
    name,
    workoutCount: history.length,
    loggedCount: allLogged.length,
    byType: Object.entries(byType).sort((a, b) => b[1] - a[1]),
    byMuscle: Object.entries(byMuscle).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topExercises,
    recent: history.slice(0, 30),
  };
}

function statBarHtml(label, value, max, color) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return `<div class="stat-bar-row">
    <span class="stat-bar-label">${label}</span>
    <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="stat-bar-count">${value}</span>
  </div>`;
}

function renderStats() {
  const stats = computeStats();
  const content = document.getElementById('stats-content');
  if (!stats.name) {
    content.innerHTML = '<p class="stats-empty">Ange ditt namn för att se statistik.</p>';
    return;
  }
  document.getElementById('stats-title').textContent = `Statistik – ${stats.name}`;
  if (stats.workoutCount === 0) {
    content.innerHTML = '<p class="stats-empty">Inga sparade pass ännu. Generera ett pass, fyll i dina resultat och tryck "Spara pass".</p>';
    return;
  }

  let html = `<div class="stats-overview">
    <div class="stats-kpi"><span class="stats-kpi-value">${stats.workoutCount}</span><span class="stats-kpi-label">Pass totalt</span></div>
    <div class="stats-kpi"><span class="stats-kpi-value">${stats.loggedCount}</span><span class="stats-kpi-label">Loggade övn.</span></div>
  </div>`;

  if (stats.byType.length > 0) {
    const typeMax = stats.byType[0][1];
    html += `<div class="stats-section"><h3>Träningstyper</h3>`;
    stats.byType.forEach(([t, v]) => {
      html += statBarHtml(TYPE_LABELS[t] || t, v, typeMax, TYPE_COLORS[t] || '#a78bfa');
    });
    html += `</div>`;
  }

  if (stats.byMuscle.length > 0) {
    const muscleMax = stats.byMuscle[0][1];
    html += `<div class="stats-section"><h3>Muskelgrupper</h3>`;
    stats.byMuscle.forEach(([m, v]) => {
      html += statBarHtml(MUSCLE_LABELS[m] || m, v, muscleMax, '#60a5fa');
    });
    html += `</div>`;
  }

  if (stats.topExercises.length > 0) {
    html += `<div class="stats-section"><h3>Vanligaste övningar</h3><ol class="stats-top-list">`;
    stats.topExercises.forEach(([name, count]) => {
      html += `<li><span class="stats-ex-name">${name}</span><span class="stats-ex-count">${count}×</span></li>`;
    });
    html += `</ol></div>`;
  }

  if (stats.recent.length > 0) {
    const months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
    html += `<div class="stats-section"><h3>Historik</h3><ul class="stats-recent-list">`;
    stats.recent.forEach(w => {
      const d = new Date(w.date);
      const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      const count = (w.exercises || []).length;
      const types = [...new Set((w.exercises || []).map(e => TYPE_LABELS[e.type] || e.type))].join(', ');
      html += `<li>
        <span class="stats-recent-date">${dateStr}</span>
        <span class="stats-recent-info">${count} övn · ${types}</span>
        ${w.id ? `<span class="history-actions">
          <button class="history-action-btn history-edit-btn" data-id="${w.id}" title="Redigera pass">✎</button>
          <button class="history-action-btn history-delete-btn" data-id="${w.id}" title="Radera pass">✕</button>
        </span>` : ''}
      </li>`;
    });
    html += `</ul></div>`;
  }

  content.innerHTML = html;

  content.querySelectorAll('.history-edit-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { openEditWorkoutModal(this.dataset.id); });
  });
  content.querySelectorAll('.history-delete-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { confirmDeleteWorkout(this.dataset.id); });
  });
}

function openStatsModal() {
  document.getElementById('stats-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  renderStats();
}
function closeStatsModal() {
  document.getElementById('stats-modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ── Edit / Delete workout ─────────────────────────────────────────────────────

var editingWorkoutId = null;

function confirmDeleteWorkout(id) {
  if (!confirm('Radera detta gympass?\nDetta går inte att ångra.')) return;
  deleteWorkout(id);
}

function deleteWorkout(id) {
  saveHistory(loadHistory().filter(function(w) { return w.id !== id; }));
  renderStats();
}

function openEditWorkoutModal(id) {
  var history = loadHistory();
  var workout = history.find(function(w) { return w.id === id; });
  if (!workout) return;
  editingWorkoutId = id;
  renderEditWorkoutContent(workout);
  document.getElementById('edit-workout-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeEditWorkoutModal() {
  document.getElementById('edit-workout-modal').style.display = 'none';
  document.body.style.overflow = '';
  editingWorkoutId = null;
}

function renderEditWorkoutContent(workout) {
  var months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  var d = new Date(workout.date);
  var dateStr = d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  document.getElementById('edit-workout-title').textContent = 'Redigera – ' + dateStr;
  var exercises = workout.exercises || [];
  var html = '';
  exercises.forEach(function(ex, i) {
    var typeLabel = TYPE_LABELS[ex.type] || ex.type || '';
    html += '<div class="edit-exercise-row" data-index="' + i + '">'
      + '<div class="edit-exercise-name">' + ex.name
      + (typeLabel ? ' <span class="exercise-tag tag-' + (ex.type || '') + '">' + typeLabel + '</span>' : '')
      + '</div>'
      + renderEditLogInputs(ex, i)
      + '</div>';
  });
  if (!html) html = '<p class="stats-empty">Inga \xf6vningar loggade i detta pass.</p>';
  document.getElementById('edit-workout-content').innerHTML = html;
}

function renderEditLogInputs(ex, i) {
  var logged = ex.logged || {};
  var logType;
  if ('weight' in logged) logType = 'strength';
  else if ('minutes' in logged) logType = 'time';
  else if ('seconds' in logged) logType = 'seconds';
  else if ('done' in logged) logType = 'check';
  else logType = getLogType(ex);

  if (logType === 'strength') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<input class="log-input" type="number" inputmode="numeric" placeholder="Reps" data-log="reps" value="' + (logged.reps !== undefined ? logged.reps : '') + '" min="0">'
      + '<span class="log-sep">\xd7</span>'
      + '<input class="log-input" type="number" inputmode="decimal" placeholder="kg" data-log="weight" value="' + (logged.weight !== undefined ? logged.weight : '') + '" min="0" step="0.5">'
      + '</div>';
  }
  if (logType === 'time') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<input class="log-input" type="number" inputmode="numeric" placeholder="0" data-log="minutes" value="' + (logged.minutes !== undefined ? logged.minutes : '') + '" min="0">'
      + '<span class="log-unit">min</span>'
      + '</div>';
  }
  if (logType === 'seconds') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<input class="log-input" type="number" inputmode="numeric" placeholder="0" data-log="seconds" value="' + (logged.seconds !== undefined ? logged.seconds : '') + '" min="0">'
      + '<span class="log-unit">sek</span>'
      + '</div>';
  }
  if (logType === 'check') {
    return '<div class="log-row">'
      + '<span class="log-label">Logg</span>'
      + '<label class="log-check-label"><input type="checkbox" data-log="done"' + (logged.done ? ' checked' : '') + '> Utf\xf6rd</label>'
      + '</div>';
  }
  return '<div class="log-row">'
    + '<span class="log-label">Logg</span>'
    + '<input class="log-input" type="number" inputmode="numeric" placeholder="Reps" data-log="reps" value="' + (logged.reps !== undefined ? logged.reps : '') + '" min="0">'
    + '</div>';
}

function saveEditedWorkout() {
  if (!editingWorkoutId) return;
  var history = loadHistory();
  var idx = history.findIndex(function(w) { return w.id === editingWorkoutId; });
  if (idx < 0) return;
  var workout = history[idx];
  var exercises = workout.exercises || [];
  var rows = document.querySelectorAll('#edit-workout-content .edit-exercise-row');
  rows.forEach(function(row, i) {
    if (!exercises[i]) return;
    var logged = {};
    var repsEl    = row.querySelector('[data-log="reps"]');
    var weightEl  = row.querySelector('[data-log="weight"]');
    var minutesEl = row.querySelector('[data-log="minutes"]');
    var secondsEl = row.querySelector('[data-log="seconds"]');
    var doneEl    = row.querySelector('[data-log="done"]');
    if (repsEl    && repsEl.value)    logged.reps    = parseFloat(repsEl.value);
    if (weightEl  && weightEl.value)  logged.weight  = parseFloat(weightEl.value);
    if (minutesEl && minutesEl.value) logged.minutes = parseFloat(minutesEl.value);
    if (secondsEl && secondsEl.value) logged.seconds = parseFloat(secondsEl.value);
    if (doneEl    && doneEl.checked)  logged.done    = true;
    exercises[i].logged = logged;
  });
  workout.exercises = exercises;
  history[idx] = workout;
  saveHistory(history);
  closeEditWorkoutModal();
  renderStats();
}

// ── Save workout ──────────────────────────────────────────────────────────────

function saveWorkout() {
  const name = getUserName();
  if (!name) { openNameModal(); return; }

  const cards = document.querySelectorAll('.exercise-card');
  const logged = [];
  cards.forEach((card, i) => {
    const ex = currentExercises[i];
    if (!ex) return;
    const entry = { name: ex.name, type: ex.type, logged: {} };
    const repsEl    = card.querySelector('[data-log="reps"]');
    const weightEl  = card.querySelector('[data-log="weight"]');
    const minutesEl = card.querySelector('[data-log="minutes"]');
    const secondsEl = card.querySelector('[data-log="seconds"]');
    const doneEl    = card.querySelector('[data-log="done"]');
    if (repsEl    && repsEl.value)    entry.logged.reps    = parseFloat(repsEl.value);
    if (weightEl  && weightEl.value)  entry.logged.weight  = parseFloat(weightEl.value);
    if (minutesEl && minutesEl.value) entry.logged.minutes = parseFloat(minutesEl.value);
    if (secondsEl && secondsEl.value) entry.logged.seconds = parseFloat(secondsEl.value);
    if (doneEl    && doneEl.checked)  entry.logged.done    = true;
    if (Object.keys(entry.logged).length > 0) logged.push(entry);
  });

  if (logged.length === 0) {
    alert('Inga resultat att spara – fyll i minst en övning.');
    return;
  }

  const workout = { id: generateId(), date: new Date().toISOString(), profileName: name, exercises: logged };
  const history = loadHistory();
  history.unshift(workout);
  if (history.length > 200) history.splice(200);
  saveHistory(history);

  const btn = document.getElementById('save-btn');
  btn.textContent = '✓ Sparat!';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = 'Spara pass'; btn.disabled = false; }, 2000);
}

const FOCUS_TAG_MAP = {
  "helkropp":  ["helkropp"],
  "överkropp": ["överkropp"],
  "underkropp":["underkropp"],
  "mage-rygg": ["mage/rygg"],
  "bröst":     ["bröst"],
  "rygg":      ["rygg"],
  "axlar":     ["axlar"],
  "armar":     ["biceps", "triceps", "armar"],
  "lår":       ["lår"],
  "rumpa":     ["rumpa", "höfter"],
  "vader":     ["vader"],
  "mage":      ["mage", "core"],
};

function getBodyParts(muscle) {
  const m = muscle.toLowerCase();
  const p = new Set();
  if (m.includes("bröst"))                                             p.add("bröst");
  if ((m.includes("rygg") && !m.includes("ländrygg")) ||
       m.includes("latissimus") || m.includes("trapezius") ||
       m.includes("rotatorkuff") || m.includes("övre rygg"))          p.add("rygg");
  if (m.includes("axlar") || m.includes("axel") ||
      m.includes("bakre axel"))                                        p.add("axlar");
  if (m.includes("biceps"))                                            p.add("biceps");
  if (m.includes("triceps"))                                           p.add("triceps");
  if (m.includes("underarm") || m.includes("grepp"))                  p.add("armar");
  if (m.includes("lår"))                                               p.add("lår");
  if (m.includes("rumpa"))                                             p.add("rumpa");
  if (m.includes("vader"))                                             p.add("vader");
  if (m.includes("höfter") || m.includes("höft") ||
      m.includes("adduktorer") || m.includes("höftböjare") ||
      m.includes("piriformis"))                                        p.add("höfter");
  if (m.includes("mage") || m.includes("obliques"))                   p.add("mage");
  if (m.includes("core") || m.includes("anti-rotation"))              p.add("core");
  if (m.includes("ländrygg"))                                          p.add("ländrygg");

  const upper = ["bröst","rygg","axlar","biceps","triceps","armar"];
  const lower = ["lår","rumpa","vader","höfter"];
  const mid   = ["mage","core","ländrygg"];
  if (upper.some(t => p.has(t))) p.add("överkropp");
  if (lower.some(t => p.has(t))) p.add("underkropp");
  if (mid.some(t => p.has(t)))   p.add("mage/rygg");
  if (m.includes("hela kroppen") ||
      (p.has("överkropp") && p.has("underkropp")))  p.add("helkropp");
  return p;
}

function exerciseMatchesFocus(exercise) {
  if (selectedFocus.size === 0) return true;
  const exParts = getBodyParts(exercise.muscle);
  return [...selectedFocus].some(key =>
    (FOCUS_TAG_MAP[key] || [key]).some(tag => exParts.has(tag))
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAdjustedSets(exercise, minutesPerExercise) {
  if (!minutesPerExercise) return exercise.sets;

  const base = MIN_PER_EXERCISE[exercise.type] || 5;
  const scale = minutesPerExercise / base;

  if (exercise.type === 'kondition') {
    return `${exercise.sets} · ca ${Math.round(minutesPerExercise)} min`;
  }

  const m = exercise.sets.match(/^(\d+)/);
  if (!m) return exercise.sets;
  const baseNum = parseInt(m[1]);
  let adjusted;
  if (scale < 0.55)      adjusted = Math.max(1, baseNum - 1);
  else if (scale < 1.45) adjusted = baseNum;
  else if (scale < 2.2)  adjusted = baseNum + 1;
  else                   adjusted = baseNum + 2;
  return adjusted === baseNum
    ? exercise.sets
    : exercise.sets.replace(/^\d+/, String(adjusted));
}

function pickExercises(types, count) {
  const blacklist = loadBlacklist();
  const typeArr = [...types];
  const base = Math.floor(count / typeArr.length);
  const remainder = count % typeArr.length;

  const result = [];
  typeArr.forEach((t, i) => {
    let pool = EXERCISES[t].map(e => ({ ...e, type: t }));
    pool = pool.filter(e => !blacklist.has(e.name));
    if (selectedFocus.size > 0) pool = pool.filter(exerciseMatchesFocus);
    const n = base + (i < remainder ? 1 : 0);
    result.push(...shuffle(pool).slice(0, n));
  });
  return result;
}

function buildCardHtml(ex, index, minutesPerExercise) {
  const setsLabel = getAdjustedSets(ex, minutesPerExercise);
  const logType = getLogType(ex);
  const lastResult = getLastResult(ex.name);
  const lastHtml = lastResult
    ? `<div class="last-result">↩ Senast: ${formatLastResult(lastResult)}</div>`
    : '';
  return `
    <div class="exercise-number">${index + 1}</div>
    <div class="exercise-info">
      <div class="exercise-name-row">
        <div class="exercise-name">
          ${ex.name}
          <span class="exercise-tag tag-${ex.type}">${TYPE_LABELS[ex.type]}</span>
        </div>
        <div class="card-actions">
          <button class="card-action-btn card-replace" title="Ersätt med annan övning">Ny</button>
          <button class="card-action-btn card-replace-del" title="Ersätt och dölj permanent">Ny + Del</button>
        </div>
      </div>
      <div class="exercise-how">${ex.how}</div>
      <div class="exercise-meta">
        <span class="meta-sets">${setsLabel}</span>
        <span class="meta-sep">·</span>
        <span class="meta-muscle">${ex.muscle}</span>
      </div>
      ${lastHtml}
      ${renderLogRow(logType)}
    </div>
  `;
}

function attachCardButtons(card, index) {
  card.querySelector('.card-replace').addEventListener('click', () => replaceExercise(index, false));
  card.querySelector('.card-replace-del').addEventListener('click', () => replaceExercise(index, true));
}

function renderExercises(exercises, minutesPerExercise) {
  currentExercises = exercises;
  const list = document.getElementById("exercise-list");
  list.innerHTML = "";
  const distinctTypes = new Set(exercises.map(e => e.type));
  const showHeaders = distinctTypes.size > 1;
  let lastType = null;
  exercises.forEach((ex, i) => {
    if (showHeaders && ex.type !== lastType) {
      const header = document.createElement("div");
      header.className = "exercise-type-header";
      header.textContent = TYPE_LABELS[ex.type] || ex.type;
      list.appendChild(header);
      lastType = ex.type;
    }
    const card = document.createElement("div");
    card.className = "exercise-card";
    card.style.animationDelay = `${i * 50}ms`;
    card.innerHTML = buildCardHtml(ex, i, minutesPerExercise);
    attachCardButtons(card, i);
    list.appendChild(card);
  });
}

function replaceExercise(index, deleteFromLibrary) {
  const oldEx = currentExercises[index];
  if (!oldEx) return;

  const blacklist = loadBlacklist();
  if (deleteFromLibrary) blacklist.add(oldEx.name);

  const currentNames = new Set(currentExercises.filter((_, i) => i !== index).map(e => e.name));

  let pool = (EXERCISES[oldEx.type] || []).map(e => ({ ...e, type: oldEx.type }));
  pool = pool.filter(e => !currentNames.has(e.name) && !blacklist.has(e.name));

  const focused = selectedFocus.size > 0 ? pool.filter(exerciseMatchesFocus) : pool;
  const available = focused.length > 0 ? focused : pool;

  if (deleteFromLibrary) saveBlacklist(blacklist);

  if (available.length === 0) {
    alert(deleteFromLibrary
      ? `"${oldEx.name}" är borttagen från biblioteket. Inga fler övningar tillgängliga för ${TYPE_LABELS[oldEx.type] || oldEx.type}.`
      : `Inga fler övningar att byta till för ${TYPE_LABELS[oldEx.type] || oldEx.type}.`);
    return;
  }

  const newEx = shuffle(available)[0];
  currentExercises[index] = newEx;

  const cards = document.querySelectorAll('.exercise-card');
  const card = cards[index];
  if (!card) return;

  const mpe = selectedDuration ? selectedDuration / currentExercises.length : null;
  card.innerHTML = buildCardHtml(newEx, index, mpe);
  attachCardButtons(card, index);
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'slideIn 0.3s ease both';
}

function renderSummary(exercises, duration) {
  const summary = document.getElementById("summary");
  const totalMin = duration
    ? duration
    : exercises.reduce((s, e) => s + (MIN_PER_EXERCISE[e.type] || 5), 0);
  const types = [...new Set(exercises.map(e => TYPE_LABELS[e.type]))].join(", ");
  summary.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Antal övningar</span>
      <span class="summary-value">${exercises.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Passlängd</span>
      <span class="summary-value">~${totalMin} min</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Kategorier</span>
      <span class="summary-value">${types}</span>
    </div>
  `;
}

function generate() {
  const countInput = document.getElementById("exercise-count");
  const errorEl = document.querySelector(".error-msg");
  if (errorEl) errorEl.remove();

  const count = parseInt(countInput.value, 10);
  if (!count || count < 1 || count > 30) {
    const msg = document.createElement("p");
    msg.className = "error-msg";
    msg.textContent = "Ange ett antal mellan 1 och 30.";
    countInput.after(msg);
    return;
  }

  // Build filtered pool to check availability
  const blacklist = loadBlacklist();
  let checkPool = [];
  for (const t of selectedTypes) {
    checkPool = checkPool.concat(EXERCISES[t].map(e => ({ ...e, type: t })));
  }
  checkPool = checkPool.filter(e => !blacklist.has(e.name));
  if (selectedFocus.size > 0) checkPool = checkPool.filter(exerciseMatchesFocus);

  if (checkPool.length === 0) {
    const msg = document.createElement("p");
    msg.className = "error-msg";
    msg.textContent = "Inga övningar matchar kombinationen av träningstyp och fokusområde. Prova ett annat urval.";
    countInput.after(msg);
    return;
  }

  const actualCount = Math.min(count, checkPool.length);
  const minutesPerExercise = selectedDuration ? selectedDuration / actualCount : null;

  const typeNames = [...selectedTypes].map(t => TYPE_LABELS[t]).join(" + ");
  const durationLabel = selectedDuration ? ` · ${selectedDuration} min` : "";
  document.getElementById("results-title").textContent =
    `${typeNames}${durationLabel} – ${actualCount} övningar`;

  const exercises = pickExercises(selectedTypes, actualCount);
  renderExercises(exercises, minutesPerExercise);
  renderSummary(exercises, selectedDuration);

  const results = document.getElementById("results");
  results.style.display = "block";
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function suggestCount() {
  const hintEl = document.getElementById('count-hint');
  if (!selectedDuration) {
    if (hintEl) hintEl.textContent = '';
    return;
  }
  const types = [...selectedTypes];
  const avgMin = types.reduce((s, t) => s + (MIN_PER_EXERCISE[t] || 5), 0) / types.length;
  const suggested = Math.max(1, Math.min(20, Math.round(selectedDuration / avgMin)));
  document.getElementById('exercise-count').value = suggested;
  if (hintEl) hintEl.textContent = `Förslag baserat på ${selectedDuration} min – ändra gärna`;
}

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    if (selectedTypes.has(type)) {
      if (selectedTypes.size > 1) {
        selectedTypes.delete(type);
        btn.classList.remove("active");
      }
    } else {
      selectedTypes.add(type);
      btn.classList.add("active");
    }
    suggestCount();
  });
});

document.querySelectorAll(".duration-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const val = parseInt(btn.dataset.duration, 10);
    if (selectedDuration === val) {
      selectedDuration = null;
      btn.classList.remove("active");
    } else {
      document.querySelectorAll(".duration-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedDuration = val;
    }
    suggestCount();
  });
});

document.querySelectorAll(".focus-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.focus;
    if (selectedFocus.has(key)) {
      selectedFocus.delete(key);
      btn.classList.remove("active");
    } else {
      selectedFocus.add(key);
      btn.classList.add("active");
    }
  });
});

document.getElementById("generate-btn").addEventListener("click", generate);
document.getElementById("regenerate-btn").addEventListener("click", generate);
document.getElementById("save-btn").addEventListener("click", saveWorkout);

document.getElementById("profile-submit-btn").addEventListener("click", submitNewProfile);
document.getElementById("profile-alias-input").addEventListener("keydown", e => {
  if (e.key === "Enter") submitNewProfile();
});
document.getElementById("profile-close-btn").addEventListener("click", closeNameModal);
document.getElementById("profile-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeNameModal();
});
document.getElementById("stats-close-btn").addEventListener("click", closeStatsModal);
document.getElementById("stats-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) closeStatsModal();
});

document.getElementById("edit-workout-close-btn").addEventListener("click", closeEditWorkoutModal);
document.getElementById("edit-workout-cancel-btn").addEventListener("click", closeEditWorkoutModal);
document.getElementById("edit-workout-save-btn").addEventListener("click", saveEditedWorkout);
document.getElementById("edit-workout-modal").addEventListener("click", function(e) {
  if (e.target === e.currentTarget) closeEditWorkoutModal();
});

// ── Background image ─────────────────────────────────────────────────────────

function applyBgImage() {
  var img = localStorage.getItem('tg_bg_image_v1') || '';
  if (img) {
    document.body.style.backgroundImage = 'url(' + img + ')';
    document.body.classList.add('has-bg-image');
  } else {
    document.body.style.backgroundImage = '';
    document.body.classList.remove('has-bg-image');
  }
}

document.getElementById("bg-file-input").addEventListener("change", function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(ev) {
    localStorage.setItem('tg_bg_image_v1', ev.target.result);
    applyBgImage();
    updateProfileBar();
    e.target.value = '';
  };
  reader.readAsDataURL(file);
});


// Init
migrateOldData();
applyBgImage();
updateProfileBar();
if (!getUserName()) openNameModal();
