const EXERCISES = {
  vikter: [
    {
      name: "Bänkpress",
      sets: "3 set × 8–10 reps",
      muscle: "Bröst, triceps",
      how: "Ligg på bänken med fötterna i golvet. Sänk stången kontrollerat till bröstet, håll armbågarna ca 45° från kroppen. Pressa upp till raka armar."
    },
    {
      name: "Knäböj",
      sets: "4 set × 6–8 reps",
      muscle: "Lår, rumpa",
      how: "Stå axelbrett med stången på övre ryggen. Böj knäna och höfterna tills låren är parallella med golvet. Håll ryggen rak och pressa upp genom hälen."
    },
    {
      name: "Marklyft",
      sets: "3 set × 5 reps",
      muscle: "Rygg, lår, rumpa",
      how: "Stå med fötterna höftbrett, stången ovanför mitten av foten. Håll ryggen rak, spann magen och lyft med benen. Dra stången nära kroppen hela vägen upp."
    },
    {
      name: "Axelpress (stående)",
      sets: "3 set × 10 reps",
      muscle: "Axlar, triceps",
      how: "Håll stången i axelhöjd med brett grepp. Spänn magen och pressa stången rakt upp ovanför huvudet tills armarna är helt sträckta."
    },
    {
      name: "Skivstångsrodd",
      sets: "3 set × 10 reps",
      muscle: "Rygg, biceps",
      how: "Böj överkroppen ca 45° framåt med rak rygg. Dra stången mot naveln med armbågarna längs sidan. Pressa ihop skulderbladen högst upp."
    },
    {
      name: "Incline bänkpress",
      sets: "3 set × 10 reps",
      muscle: "Övre bröst",
      how: "Ställ bänken på 30–45°. Utför bänkpress på lutad bänk – sänk stången mot övre bröstet och pressa upp."
    },
    {
      name: "Benpress",
      sets: "4 set × 12 reps",
      muscle: "Lår, rumpa",
      how: "Sitt i maskinen med fötterna axelbrett på plattan. Sänk plattan tills knäna är 90°, pressa sedan ifrån med hälen."
    },
    {
      name: "Hantelbicep curl",
      sets: "3 set × 12 reps",
      muscle: "Biceps",
      how: "Stå upp med hantlarna vid sidorna. Håll armbågarna stilla mot kroppen och curl hantlarna upp mot axlarna. Sänk kontrollerat."
    },
    {
      name: "Triceps pushdown",
      sets: "3 set × 12–15 reps",
      muscle: "Triceps",
      how: "Stå vid kabelmaskin. Håll armbågarna still mot sidan och tryck handtaget neråt tills armarna är raka. Sänk kontrollerat."
    },
    {
      name: "Lateral raise",
      sets: "3 set × 15 reps",
      muscle: "Axlar",
      how: "Stå med hantlarna vid sidorna och lätt böjda armar. Lyft ut hantlarna till axelhöjd utan att gunga. Sänk sakta."
    },
    {
      name: "Facepull",
      sets: "3 set × 15 reps",
      muscle: "Bakre axel, rotatorkuff",
      how: "Ställ kabeln i ansiktshöjd. Dra handtaget mot ansiktet med höga armbågar och externa rotera axlarna. Håll ca 1 sek."
    },
    {
      name: "Rumänsk marklyft",
      sets: "3 set × 10 reps",
      muscle: "Baksida lår, rumpa",
      how: "Stå upp med stången. Böj höfterna bakåt med nästan raka knän och sänk stången längs framsidan av benen. Känn sträcket i baksida lår."
    },
    {
      name: "Goblet squat",
      sets: "3 set × 12 reps",
      muscle: "Lår, rumpa, core",
      how: "Håll en hantel vertikalt mot bröstet. Stå med bred fotposition, knäböj djupt och håll överkroppen upprätt."
    },
    {
      name: "Overhead triceps extension",
      sets: "3 set × 12 reps",
      muscle: "Triceps",
      how: "Håll en hantel med båda händerna bakom huvudet. Sträck armarna rakt upp, håll armbågarna stilla. Böj sedan tillbaka."
    },
    {
      name: "Hammer curl",
      sets: "3 set × 12 reps",
      muscle: "Biceps, underarm",
      how: "Curl hantlarna med tummen upp (neutralgrepp). Armbågarna still mot kroppen. Bra för underarmarna och bicepshuvudet."
    },
    {
      name: "Leg curl",
      sets: "3 set × 12 reps",
      muscle: "Baksida lår",
      how: "Ligg i maskinen med hälen mot kudden. Böj knäna och dra hälen mot rumpan. Sänk kontrollerat."
    },
    {
      name: "Leg extension",
      sets: "3 set × 15 reps",
      muscle: "Framsida lår",
      how: "Sitt i maskinen med kudden mot vristerna. Sträck benen rakt ut och håll en sekund. Sänk kontrollerat."
    },
    {
      name: "Kabeldrag (lat pulldown)",
      sets: "3 set × 10 reps",
      muscle: "Rygg, biceps",
      how: "Sitt med låren under stödet. Greppa stången brett, luta lätt bakåt och dra ner mot övre bröstet med armbågarna neråt."
    },
    {
      name: "Seated row",
      sets: "3 set × 10 reps",
      muscle: "Rygg, biceps",
      how: "Sitt upprätt vid kabelmaskin. Dra handtaget mot magen och pressa ihop skulderbladen. Sträck ut armarna kontrollerat."
    },
    {
      name: "Shrugs",
      sets: "3 set × 15 reps",
      muscle: "Trapezius",
      how: "Håll hantlarna eller stången vid sidorna. Lyft axlarna rakt upp mot öronen, håll 1 sek och sänk."
    },
  ],
  kropp: [
    {
      name: "Armhävningar",
      sets: "3 set × 15–20 reps",
      muscle: "Bröst, triceps",
      how: "Plankposition med händerna axelbrett. Böj armbågarna och sänk bröstet mot golvet, håll kroppen rak. Pressa sedan upp."
    },
    {
      name: "Chin-ups",
      sets: "3 set × 6–10 reps",
      muscle: "Rygg, biceps",
      how: "Häng i stången med handflator mot dig, händer axelbrett. Dra upp tills hakan passerar stången, sänk kontrollerat."
    },
    {
      name: "Dips",
      sets: "3 set × 10–15 reps",
      muscle: "Bröst, triceps",
      how: "Stöd på parallella stänger med raka armar. Sänk kroppen tills armbågarna är ca 90°. Pressa upp till raka armar."
    },
    {
      name: "Pistol squat",
      sets: "3 set × 5–8 reps/sida",
      muscle: "Lår, rumpa",
      how: "Stå på ett ben med det andra rakt fram. Sänk höften mot golvet med kontroll. Håll ryggen rak och pressa upp."
    },
    {
      name: "Bulgariansk split squat",
      sets: "3 set × 10 reps/sida",
      muscle: "Lår, rumpa",
      how: "Bakre foten vilar på en bänk. Sänk bakre knät rakt mot golvet. Håll överkroppen upprätt och pressa upp genom framfoten."
    },
    {
      name: "Pike push-up",
      sets: "3 set × 10 reps",
      muscle: "Axlar, triceps",
      how: "Start i inverterat V med höfterna högt. Böj armbågarna och sänk huvudet mot golvet mellan händerna. Pressa upp."
    },
    {
      name: "Archer push-up",
      sets: "3 set × 8 reps/sida",
      muscle: "Bröst, triceps",
      how: "Bred handposition. Böj ena armen och sänk mot den sidan medan den andra hålls rak ut åt sidan. Alternera sidor."
    },
    {
      name: "Inverted row",
      sets: "3 set × 10 reps",
      muscle: "Rygg, biceps",
      how: "Ligg under en horisontell stång. Greppa den med händerna ovanför bröstet och dra bröstet upp mot stången. Håll kroppen rak."
    },
    {
      name: "Diamond push-up",
      sets: "3 set × 12 reps",
      muscle: "Triceps, bröst",
      how: "Placera händerna nära varandra i en diamantform under bröstet. Utför armhävning – belastar triceps mer."
    },
    {
      name: "Wide grip pull-up",
      sets: "3 set × 6–8 reps",
      muscle: "Rygg, axlar",
      how: "Greppa stången med brett grepp och handflator från dig. Dra upp tills bröstet nuddar stången. Fokus på ryggen."
    },
    {
      name: "Hollow body hold",
      sets: "3 set × 30 sek",
      muscle: "Core, hela kroppen",
      how: "Ligg på rygg. Lyft axlar och raka ben en liten bit. Pressa ländryggen mot golvet och håll formen."
    },
    {
      name: "L-sit",
      sets: "3 set × 15 sek",
      muscle: "Core, triceps, axlar",
      how: "Stöd på händerna (paralleltstänger/golv), lyft kroppen och sträck benen vågrätt framåt. Håll skuldrorna nere."
    },
    {
      name: "Jump squat",
      sets: "3 set × 15 reps",
      muscle: "Lår, rumpa, vader",
      how: "Knäböj tills låren är parallella, hoppa sedan explosivt upp så högt du kan. Landa mjukt med böjda knän."
    },
    {
      name: "Explosive push-up",
      sets: "3 set × 8 reps",
      muscle: "Bröst, triceps",
      how: "Utför en armhävning med explosiv press i uppfasen så att händerna lyfter från golvet. Landa mjukt och upprepa."
    },
    {
      name: "Single-leg deadlift",
      sets: "3 set × 10 reps/sida",
      muscle: "Baksida lår, rumpa",
      how: "Stå på ett ben med lätt böjt knä. Böj framåt med rak rygg och lyft bakre benet bakåt tills kroppen är horisontell. Återgå."
    },
  ],
  kondition: [
    {
      name: "Löpning",
      sets: "20–30 min, måttlig intensitet",
      muscle: "Hela kroppen",
      how: "Jogga i ett tempo där du kan prata i korta meningar. Håll upprätt hållning, avslappnade axlar och jämnt andningsmönster."
    },
    {
      name: "Intervallträning (HIIT)",
      sets: "8 × 20 sek sprint / 10 sek vila",
      muscle: "Hela kroppen",
      how: "Spring maximalt i 20 sek, vila aktivt 10 sek. Upprepa 8 gånger. Värm upp 5 min innan och kyl ner efteråt."
    },
    {
      name: "Cykling",
      sets: "30 min, jämn takt",
      muscle: "Ben, hjärta",
      how: "Cykla i ett jämnt tempo med kadens runt 80–90 rpm. Justera motståndet så pulsen håller sig på måttlig nivå."
    },
    {
      name: "Rodd (maskin)",
      sets: "15 min, konstant tempo",
      muscle: "Rygg, ben, armar",
      how: "Tryck ifrån med benen, luta bakåt och dra handtaget mot magen. Återgå i omvänd ordning. Håll ryggen rak hela tiden."
    },
    {
      name: "Hopprep",
      sets: "3 set × 3 min",
      muscle: "Vader, koordination",
      how: "Håll handtagen avslappnat, vrid med handlederna. Hoppa precis så högt att repet passerar under fötterna. Landa på framfoten."
    },
    {
      name: "Boxhopp",
      sets: "4 set × 10 reps",
      muscle: "Lår, rumpa, vader",
      how: "Stå framför en box, gör en kort svingrörelse med armarna och hoppa upp med båda fötterna. Landa mjukt med böjda knän. Kliv ner."
    },
    {
      name: "Burpees",
      sets: "3 set × 15 reps",
      muscle: "Hela kroppen",
      how: "Stå, hoppa ner i plankposition, gör en armhävning, hoppa fötterna mot händerna och hoppa upp med armarna ovanför huvudet."
    },
    {
      name: "Backlöpning",
      sets: "6 × ca 60 m uppförsbacke",
      muscle: "Ben, rumpa, kondition",
      how: "Luta överkroppen lätt framåt, kör med höga knän och kraftiga armrörelser. Jogga ner för vila. Maximalt i uppförsbacken."
    },
    {
      name: "Skipping (höga knän)",
      sets: "3 set × 1 min",
      muscle: "Ben, core",
      how: "Spring på stället med knäna högt mot bröstet i snabbt tempo. Koordinera med armarna. Håll magen spänd."
    },
    {
      name: "Elliptical",
      sets: "25 min, varierande motstånd",
      muscle: "Ben, armar, hjärta",
      how: "Stå upprätt på maskinen. Skjut med benen i elliptisk rörelse och dra/skjut med armarna. Variera motstånd var 5:e minut."
    },
    {
      name: "Simning",
      sets: "500–1000 m frisim",
      muscle: "Hela kroppen",
      how: "Ta långa tag med armarna, rotera kroppen och sparka jämnt med benen. Andas var 3:e tag för jämn syresättning."
    },
    {
      name: "Mountain climbers",
      sets: "3 set × 30 sek",
      muscle: "Core, axlar, ben",
      how: "Plankposition med raka armar. Dra ett knä i taget snabbt mot bröstet i ett löpliknande mönster. Håll höfterna nere."
    },
    {
      name: "Trappklättring",
      sets: "10 min intervaller",
      muscle: "Ben, kondition",
      how: "Kliv upp för trappstegen med hela foten. Håll god hållning och driv med armarna. Springa varannan trappa för högre intensitet."
    },
  ],
  rorlighet: [
    {
      name: "Nedre rygg – liggande vridning",
      sets: "3 × 30 sek/sida",
      muscle: "Ländrygg, höfter",
      how: "Ligg på rygg med armarna ut åt sidan. Dra ett knä upp och vrid det över kroppen åt sidan. Håll axeln i golvet."
    },
    {
      name: "Hip flexor stretch",
      sets: "3 × 45 sek/sida",
      muscle: "Höftböjare, lår",
      how: "Knästå med ett ben framåt i utfallsposition. Skjut höften rakt framåt och nedåt. Håll ryggen rak och känn sträcket i framsida höft."
    },
    {
      name: "Bröstsöppning (dörrkarmsstretch)",
      sets: "3 × 30 sek",
      muscle: "Bröst, axlar",
      how: "Stå i en dörröppning med underarmarna mot karmen. Luta kroppen sakta framåt tills du känner sträcket i bröstet."
    },
    {
      name: "Hamstring stretch",
      sets: "3 × 40 sek/sida",
      muscle: "Baksida lår",
      how: "Ligg på rygg, lyft ett ben och håll bakom låret eller med ett band. Sträck benet rakt och dra mot dig tills du känner sträcket."
    },
    {
      name: "Pigeon pose",
      sets: "3 × 1 min/sida",
      muscle: "Höfter, rumpa",
      how: "Från plankposition, för ett knä framåt bakom handleden och sträck det andra benet rakt bakåt. Sänk höfterna mot golvet."
    },
    {
      name: "Cat-cow",
      sets: "2 × 10 repetitioner",
      muscle: "Ryggrad, mage",
      how: "På händer och knän. Andas in och svanka ryggen (ko), andas ut och rundra ryggen mot taket (katt). Rör mjukt och kontrollerat."
    },
    {
      name: "Axelstretch tvärs bröstet",
      sets: "3 × 30 sek/sida",
      muscle: "Axlar, övre rygg",
      how: "Dra en rak arm tvärs framför bröstet. Håll den på plats med andra armen strax ovan armbågen. Känn sträcket i bakre axeln."
    },
    {
      name: "Vadstretching (väggstöd)",
      sets: "3 × 40 sek/sida",
      muscle: "Vader",
      how: "Stå med händerna mot väggen. Sträck ett ben bakåt med hälen i golvet och böj det främre knät. Känn sträcket i vaden."
    },
    {
      name: "Nackstretching",
      sets: "3 × 20 sek/sida",
      muscle: "Nacke, axlar",
      how: "Luta huvudet åt sidan mot axeln. Förstärk lätt med handen ovanpå huvudet. Håll axeln nere på motstående sida."
    },
    {
      name: "Seated forward fold",
      sets: "3 × 1 min",
      muscle: "Baksida ben, ländrygg",
      how: "Sitt med raka ben. Böj från höften (inte ryggen) och nå mot fötterna. Håll ryggen så rak du kan och andas djupt."
    },
    {
      name: "World's greatest stretch",
      sets: "2 × 5 rep/sida",
      muscle: "Hela kroppen",
      how: "Utfall framåt, placera samma sidas hand vid foten. Rotera sedan överkroppen uppåt och sträck armen mot taket. Gå igenom hela rörelsen."
    },
    {
      name: "Thoracic rotation",
      sets: "3 × 10 rep/sida",
      muscle: "Övre rygg",
      how: "Knästå med en hand bakom huvudet och den andra i golvet. Rotera överkroppen uppåt så armbågen pekar mot taket. Gå tillbaka."
    },
    {
      name: "Figure-four stretch",
      sets: "3 × 45 sek/sida",
      muscle: "Rumpa, piriformis",
      how: "Ligg på rygg med böjda knän. Kors ett ben och lägg vristbenet mot det andra låret. Dra det undre knät mot bröstet tills du känner sträcket."
    },
  ],
  core: [
    {
      name: "Planka",
      sets: "3 set × 45–60 sek",
      muscle: "Core, axlar",
      how: "Vila på underarmar och tår. Håll kroppen rak som en bräda – spänn magen, rumpa och lår. Undvik att höfterna sjunker eller höjs."
    },
    {
      name: "Sidoplanka",
      sets: "3 set × 30 sek/sida",
      muscle: "Sidor, obliques",
      how: "Stöd på en underarm med sidan av foten. Lyft höften och håll kroppen rak. Kärnan ska hålla dig uppe, inte axeln."
    },
    {
      name: "Dead bug",
      sets: "3 set × 10 rep/sida",
      muscle: "Core, ländrygg",
      how: "Ligg på rygg med armar upp och höfter/knän i 90°. Sänk motsatt arm och ben mot golvet och pressa ländryggen mot golvet hela tiden."
    },
    {
      name: "Russian twist",
      sets: "3 set × 20 reps",
      muscle: "Obliques, core",
      how: "Sitt med böjda ben och luta överkroppen 45° bakåt. Håll händerna ihop och rotera överkroppen från sida till sida."
    },
    {
      name: "Hanging knee raise",
      sets: "3 set × 12 reps",
      muscle: "Mage, höftböjare",
      how: "Häng i en stång. Spänn magen och dra knäna kontrollerat upp mot bröstet. Sänk sakta utan att svinga."
    },
    {
      name: "Ab wheel rollout",
      sets: "3 set × 8–10 reps",
      muscle: "Hela core",
      how: "Knästående med hjulet framför. Rulla sakta ut med raka armar tills du nästan når golvet. Dra tillbaka med magen – inte ryggen."
    },
    {
      name: "Bird dog",
      sets: "3 set × 10 rep/sida",
      muscle: "Core, ländrygg",
      how: "På händer och knän. Sträck ett ben och motsatt arm rakt ut. Håll ryggen plan och höfterna i nivå. Sänk och byt sida."
    },
    {
      name: "Pallof press",
      sets: "3 set × 10 reps/sida",
      muscle: "Anti-rotation, core",
      how: "Stå med sidan mot kabelmaskin, håll handtaget vid bröstet. Pressa rakt ut, håll 2 sek och dra tillbaka. Motstå rotationskraften."
    },
    {
      name: "Toe touch crunch",
      sets: "3 set × 15 reps",
      muscle: "Raka magen",
      how: "Ligg på rygg med benen rakt upp. Nå med händerna mot tårna och lyft överkroppen med magen – inte med nacken."
    },
    {
      name: "Flutter kicks",
      sets: "3 set × 30 sek",
      muscle: "Nedre mage, höftböjare",
      how: "Ligg på rygg med händerna under rumpan och benen raka. Flytta benen alternativt upp och ner i liten rörelse. Håll ländryggen nere."
    },
    {
      name: "Dragon flag (negativ)",
      sets: "3 set × 5 reps",
      muscle: "Hela core",
      how: "Ligg på en bänk och håll fast bakom huvudet. Lyft hela kroppen rakt upp och sänk sedan kontrollerat med rak kropp. Fokus på nedfasen."
    },
    {
      name: "Landmine rotation",
      sets: "3 set × 10 rep/sida",
      muscle: "Obliques, axlar",
      how: "Håll stångändan med båda händerna framför bröstet. Rotera överkroppen och sväng stången ned mot ena sidan, sedan tillbaka. Håll armarna nästan raka."
    },
    {
      name: "Copenhagen plank",
      sets: "3 set × 20 sek/sida",
      muscle: "Adduktorer, core",
      how: "Sidoplanka med insidan av foten på en bänk. Lyft höften och håll kroppen rak. Det inre låret håller dig uppe."
    },
  ],
};

const TYPE_LABELS = {
  vikter: "Vikter",
  kropp: "Kropp",
  kondition: "Kondition",
  rorlighet: "Rörlighet",
  core: "Core",
  blandat: "Blandat",
};

// Minutes per exercise including rest
const MIN_PER_EXERCISE = {
  vikter: 6,
  kropp: 5,
  kondition: 14,
  rorlighet: 3,
  core: 4,
  blandat: 6,
};

const DURATIONS = [30, 45, 60, 90];

let selectedType = "vikter";
let selectedDuration = null;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcCountFromDuration(type, minutes) {
  const mpe = MIN_PER_EXERCISE[type === "blandat" ? "blandat" : type] || 6;
  return Math.max(1, Math.floor(minutes / mpe));
}

function pickExercises(type, count) {
  if (type === "blandat") {
    const allTypes = Object.keys(EXERCISES);
    let pool = [];
    for (const t of allTypes) {
      pool = pool.concat(EXERCISES[t].map(e => ({ ...e, type: t })));
    }
    return shuffle(pool).slice(0, count);
  }
  const pool = EXERCISES[type].map(e => ({ ...e, type }));
  return shuffle(pool).slice(0, count);
}

function renderExercises(exercises) {
  const list = document.getElementById("exercise-list");
  list.innerHTML = "";
  exercises.forEach((ex, i) => {
    const card = document.createElement("div");
    card.className = "exercise-card";
    card.style.animationDelay = `${i * 60}ms`;
    card.innerHTML = `
      <div class="exercise-number">${i + 1}</div>
      <div class="exercise-info">
        <div class="exercise-name">
          ${ex.name}
          <span class="exercise-tag tag-${ex.type}">${TYPE_LABELS[ex.type]}</span>
        </div>
        <div class="exercise-how">${ex.how}</div>
        <div class="exercise-meta">
          <span class="meta-sets">${ex.sets}</span>
          <span class="meta-sep">·</span>
          <span class="meta-muscle">${ex.muscle}</span>
        </div>
      </div>
    `;
    list.appendChild(card);
  });
}

function renderSummary(exercises, duration) {
  const summary = document.getElementById("summary");
  const totalMin = duration
    ? duration
    : exercises.reduce((s, e) => s + (MIN_PER_EXERCISE[e.type] || 6), 0);
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
      <span class="summary-label">Kategori</span>
      <span class="summary-value">${types}</span>
    </div>
  `;
}

function generate() {
  const countInput = document.getElementById("exercise-count");
  const errorEl = document.querySelector(".error-msg");
  if (errorEl) errorEl.remove();

  let count;
  if (selectedDuration) {
    count = calcCountFromDuration(selectedType, selectedDuration);
    countInput.value = count;
  } else {
    count = parseInt(countInput.value, 10);
    if (!count || count < 1 || count > 20) {
      const msg = document.createElement("p");
      msg.className = "error-msg";
      msg.textContent = "Ange ett antal mellan 1 och 20, eller välj en passlängd.";
      countInput.after(msg);
      return;
    }
  }

  const maxAvailable = selectedType === "blandat"
    ? Object.values(EXERCISES).flat().length
    : EXERCISES[selectedType].length;

  const actualCount = Math.min(count, maxAvailable);
  const exercises = pickExercises(selectedType, actualCount);

  const durationLabel = selectedDuration ? ` · ${selectedDuration} min` : "";
  document.getElementById("results-title").textContent =
    `${TYPE_LABELS[selectedType]}${durationLabel} – ${actualCount} övningar`;

  renderExercises(exercises);
  renderSummary(exercises, selectedDuration);

  const results = document.getElementById("results");
  results.style.display = "block";
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Type buttons
document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
    if (selectedDuration) {
      document.getElementById("exercise-count").value =
        calcCountFromDuration(selectedType, selectedDuration);
    }
  });
});

// Duration buttons
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
      document.getElementById("exercise-count").value =
        calcCountFromDuration(selectedType, selectedDuration);
    }
  });
});

document.getElementById("generate-btn").addEventListener("click", generate);
document.getElementById("regenerate-btn").addEventListener("click", generate);
