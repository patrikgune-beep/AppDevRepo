const EXERCISES = {
  vikter: [
    { name: "Bänkpress", details: "3 set × 8–10 reps", muscle: "Bröst, triceps" },
    { name: "Knäböj", details: "4 set × 6–8 reps", muscle: "Lår, rumpa" },
    { name: "Marklyft", details: "3 set × 5 reps", muscle: "Rygg, lår, rumpa" },
    { name: "Axelpress (stående)", details: "3 set × 10 reps", muscle: "Axlar, triceps" },
    { name: "Skivstångsrodd", details: "3 set × 10 reps", muscle: "Rygg, biceps" },
    { name: "Incline bänkpress", details: "3 set × 10 reps", muscle: "Övre bröst" },
    { name: "Benpress", details: "4 set × 12 reps", muscle: "Lår, rumpa" },
    { name: "Hantelbicep curl", details: "3 set × 12 reps", muscle: "Biceps" },
    { name: "Triceps pushdown", details: "3 set × 12–15 reps", muscle: "Triceps" },
    { name: "Lateral raise", details: "3 set × 15 reps", muscle: "Axlar" },
    { name: "Facepull", details: "3 set × 15 reps", muscle: "Bakre axel, rotatorkuff" },
    { name: "Rumänsk marklyft", details: "3 set × 10 reps", muscle: "Baksida lår, rumpa" },
    { name: "Goblet squat", details: "3 set × 12 reps", muscle: "Lår, rumpa, core" },
    { name: "Overhead triceps extension", details: "3 set × 12 reps", muscle: "Triceps" },
    { name: "Hammer curl", details: "3 set × 12 reps", muscle: "Biceps, underarm" },
    { name: "Leg curl", details: "3 set × 12 reps", muscle: "Baksida lår" },
    { name: "Leg extension", details: "3 set × 15 reps", muscle: "Framsida lår" },
    { name: "Kabeldrag (lat pulldown)", details: "3 set × 10 reps", muscle: "Rygg, biceps" },
    { name: "Seated row", details: "3 set × 10 reps", muscle: "Rygg, biceps" },
    { name: "Shrugs", details: "3 set × 15 reps", muscle: "Trapezius" },
  ],
  kropp: [
    { name: "Armhävningar", details: "3 set × 15–20 reps", muscle: "Bröst, triceps" },
    { name: "Chin-ups", details: "3 set × 6–10 reps", muscle: "Rygg, biceps" },
    { name: "Dips", details: "3 set × 10–15 reps", muscle: "Bröst, triceps" },
    { name: "Pistol squat", details: "3 set × 5–8 reps/sida", muscle: "Lår, rumpa" },
    { name: "Bulgariansk split squat", details: "3 set × 10 reps/sida", muscle: "Lår, rumpa" },
    { name: "Pike push-up", details: "3 set × 10 reps", muscle: "Axlar, triceps" },
    { name: "Archer push-up", details: "3 set × 8 reps/sida", muscle: "Bröst, triceps" },
    { name: "Inverted row", details: "3 set × 10 reps", muscle: "Rygg, biceps" },
    { name: "Diamond push-up", details: "3 set × 12 reps", muscle: "Triceps, bröst" },
    { name: "Wide grip pull-up", details: "3 set × 6–8 reps", muscle: "Rygg, axlar" },
    { name: "Hollow body hold", details: "3 set × 30 sek", muscle: "Core, hela kroppen" },
    { name: "L-sit", details: "3 set × 15 sek", muscle: "Core, triceps, axlar" },
    { name: "Jump squat", details: "3 set × 15 reps", muscle: "Lår, rumpa, vader" },
    { name: "Explosive push-up", details: "3 set × 8 reps", muscle: "Bröst, triceps" },
    { name: "Single-leg deadlift", details: "3 set × 10 reps/sida", muscle: "Baksida lår, rumpa" },
  ],
  kondition: [
    { name: "Löpning", details: "20–30 min, måttlig intensitet", muscle: "Hela kroppen" },
    { name: "Intervallträning (HIIT)", details: "20 min – 8 × 20 sek sprint / 10 sek vila", muscle: "Hela kroppen" },
    { name: "Cykling", details: "30 min, jämn takt", muscle: "Ben, hjärta" },
    { name: "Rodd (maskin)", details: "15 min, konstant tempo", muscle: "Rygg, ben, armar" },
    { name: "Hopprep", details: "3 set × 3 min", muscle: "Vader, koordination" },
    { name: "Boxhopp", details: "4 set × 10 reps", muscle: "Lår, rumpa, vader" },
    { name: "Burpees", details: "3 set × 15 reps", muscle: "Hela kroppen" },
    { name: "Backlöpning", details: "6 × uppförsbacke ca 60 m", muscle: "Ben, rumpa, kondition" },
    { name: "Skipping (höga knän)", details: "3 set × 1 min", muscle: "Ben, core" },
    { name: "Elliptical", details: "25 min, varierande motstånd", muscle: "Ben, armar, hjärta" },
    { name: "Simning", details: "500–1000 m frisim", muscle: "Hela kroppen" },
    { name: "Mountain climbers", details: "3 set × 30 sek", muscle: "Core, axlar, ben" },
    { name: "Aerobics / dans", details: "30 min, hög puls", muscle: "Hela kroppen, koordination" },
    { name: "Trappklättring", details: "10 min intervaller", muscle: "Ben, kondition" },
  ],
  rorlighet: [
    { name: "Nedre rygg (lying twist)", details: "3 × 30 sek/sida", muscle: "Ländrygg, höfter" },
    { name: "Hip flexor stretch", details: "3 × 45 sek/sida", muscle: "Höftböjare, lår" },
    { name: "Bröstsöppning (doorway stretch)", details: "3 × 30 sek", muscle: "Bröst, axlar" },
    { name: "Hamstring stretch", details: "3 × 40 sek/sida", muscle: "Baksida lår" },
    { name: "Pigeon pose", details: "3 × 1 min/sida", muscle: "Höfter, rumpa" },
    { name: "Cat-cow (yoga)", details: "2 × 10 rep", muscle: "Ryggrad, mage" },
    { name: "Shoulder cross stretch", details: "3 × 30 sek/sida", muscle: "Axlar, övre rygg" },
    { name: "Vadstretching (väggstöd)", details: "3 × 40 sek/sida", muscle: "Vader" },
    { name: "Nackstretching", details: "3 × 20 sek/sida", muscle: "Nacke, axlar" },
    { name: "Seated forward fold", details: "3 × 1 min", muscle: "Baksida ben, ländrygg" },
    { name: "Worlds greatest stretch", details: "2 × 5 rep/sida", muscle: "Hela kroppen" },
    { name: "Thoracic rotation", details: "3 × 10 rep/sida", muscle: "Övre rygg, kärnmuskulatur" },
    { name: "Figure-four stretch", details: "3 × 45 sek/sida", muscle: "Piriformis, rumpa" },
  ],
  core: [
    { name: "Planka", details: "3 set × 45–60 sek", muscle: "Core, axlar" },
    { name: "Sidoplanka", details: "3 set × 30 sek/sida", muscle: "Sidor, obliques" },
    { name: "Dead bug", details: "3 set × 10 rep/sida", muscle: "Core, ländrygg" },
    { name: "Russian twist", details: "3 set × 20 reps", muscle: "Obliques, core" },
    { name: "Hanging knee raise", details: "3 set × 12 reps", muscle: "Mage, höftböjare" },
    { name: "Ab wheel rollout", details: "3 set × 8–10 reps", muscle: "Hela core" },
    { name: "Bird dog", details: "3 set × 10 rep/sida", muscle: "Core, ländrygg" },
    { name: "Pallof press", details: "3 set × 10 reps/sida", muscle: "Anti-rotation, core" },
    { name: "Toe touch crunch", details: "3 set × 15 reps", muscle: "Raka magen" },
    { name: "Flutter kicks", details: "3 set × 30 sek", muscle: "Nedre mage, höftböjare" },
    { name: "Dragon flag (negativ)", details: "3 set × 5 reps", muscle: "Hela core" },
    { name: "Landmine rotation", details: "3 set × 10 rep/sida", muscle: "Obliques, axlar" },
    { name: "Copenhagen plank", details: "3 set × 20 sek/sida", muscle: "Adduktorer, core" },
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

const ESTIMATED_MINUTES = {
  vikter: 5,
  kropp: 4,
  kondition: 8,
  rorlighet: 3,
  core: 4,
  blandat: 5,
};

let selectedType = "vikter";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

function estimateTime(exercises) {
  return exercises.reduce((sum, e) => sum + (ESTIMATED_MINUTES[e.type] || 5), 0);
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
        <div class="exercise-details">${ex.details} &mdash; <em>${ex.muscle}</em></div>
      </div>
    `;
    list.appendChild(card);
  });
}

function renderSummary(exercises) {
  const summary = document.getElementById("summary");
  const minutes = estimateTime(exercises);
  const types = [...new Set(exercises.map(e => TYPE_LABELS[e.type]))].join(", ");
  summary.innerHTML = `
    <div class="summary-item">
      <span class="summary-label">Antal övningar</span>
      <span class="summary-value">${exercises.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Beräknad tid</span>
      <span class="summary-value">~${minutes} min</span>
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

  const count = parseInt(countInput.value, 10);
  if (!count || count < 1 || count > 20) {
    const msg = document.createElement("p");
    msg.className = "error-msg";
    msg.textContent = "Ange ett antal mellan 1 och 20.";
    countInput.after(msg);
    return;
  }

  const maxAvailable = selectedType === "blandat"
    ? Object.values(EXERCISES).flat().length
    : EXERCISES[selectedType].length;

  const actualCount = Math.min(count, maxAvailable);
  const exercises = pickExercises(selectedType, actualCount);

  const results = document.getElementById("results");
  const title = document.getElementById("results-title");
  title.textContent = `${TYPE_LABELS[selectedType]} – ${actualCount} övningar`;

  renderExercises(exercises);
  renderSummary(exercises);

  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.querySelectorAll(".type-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".type-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedType = btn.dataset.type;
  });
});

document.getElementById("generate-btn").addEventListener("click", generate);
document.getElementById("regenerate-btn").addEventListener("click", generate);
