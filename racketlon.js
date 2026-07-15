// ── Racketlon – tävlingsupplägg ────────────────────────────────────────────────
// Genererar ett round-robin-schema ("alla möter alla") för valfritt antal spelare.
// Varje möte spelas i de valda racketsporterna. Vinnaren avgörs på total poäng
// summerad över alla sporter (klassisk racketlon). Sporterna kan styras antingen
// på antal poäng eller på antal minuter per sport.

// Kanonisk ordning (kortast till längst racket) – används för visning och matcher.
const SPORTS = [
  { key: 'pingis',    label: 'Pingis',    icon: '🏓' },
  { key: 'badminton', label: 'Badminton', icon: '🏸' },
  { key: 'squash',    label: 'Squash',    icon: '🎱' },
  { key: 'padel',     label: 'Padel',     icon: '🥎' },
  { key: 'tennis',    label: 'Tennis',    icon: '🎾' },
];
const SPORT_BY_KEY = SPORTS.reduce((m, s) => { m[s.key] = s; return m; }, {});

const STORAGE_KEY = 'rl_tournament_v1';
const MAX_PLAYERS = 24;
const MIN_PLAYERS = 2;

// ── Setup-state ────────────────────────────────────────────────────────────────
let selectedSports = new Set(['pingis', 'badminton', 'squash', 'tennis']);
let mode = 'points';          // 'points' | 'minutes'
let days = 1;                 // 1 | 2
let names = [];               // spelarnamn i inmatningsfälten (kan vara tomma)

let tournament = null;        // det genererade upplägget (persistas)

// ── Hjälpfunktioner ─────────────────────────────────────────────────────────────
function el(id) { return document.getElementById(id); }

function clampPlayerCount(v) {
  const n = parseInt(v, 10);
  if (!n || n < MIN_PLAYERS) return MIN_PLAYERS;
  if (n > MAX_PLAYERS) return MAX_PLAYERS;
  return n;
}

function orderedSports() {
  return SPORTS.filter(s => selectedSports.has(s.key)).map(s => s.key);
}

function playerName(i) {
  const n = (names[i] || '').trim();
  return n || ('Spelare ' + (i + 1));
}

// Round-robin via cirkelmetoden. Returnerar en lista av ronder, där varje rond är
// en lista av par [aIndex, bIndex]. Udda antal spelare ger en spökspelare (bye).
function roundRobinRounds(count) {
  const arr = [];
  for (let i = 0; i < count; i++) arr.push(i);
  if (arr.length % 2 === 1) arr.push(null); // bye-plats
  const n = arr.length;
  const half = n / 2;
  const fixed = arr[0];
  let rest = arr.slice(1);
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const lineup = [fixed].concat(rest);
    const pairs = [];
    for (let i = 0; i < half; i++) {
      const a = lineup[i];
      const b = lineup[n - 1 - i];
      if (a !== null && b !== null) pairs.push([a, b]);
    }
    rounds.push(pairs);
    rest = [rest[rest.length - 1]].concat(rest.slice(0, rest.length - 1));
  }
  return rounds;
}

// ── Setup-UI ─────────────────────────────────────────────────────────────────
function renderSportGrid() {
  const grid = el('sport-grid');
  grid.innerHTML = '';
  SPORTS.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'type-btn' + (selectedSports.has(s.key) ? ' active' : '');
    btn.dataset.sport = s.key;
    btn.innerHTML = '<span class="type-icon">' + s.icon + '</span><span>' + s.label + '</span>';
    btn.addEventListener('click', () => {
      if (selectedSports.has(s.key)) {
        if (selectedSports.size > 1) { selectedSports.delete(s.key); btn.classList.remove('active'); }
      } else {
        selectedSports.add(s.key); btn.classList.add('active');
      }
    });
    grid.appendChild(btn);
  });
}

function renderNameGrid() {
  const count = clampPlayerCount(el('player-count').value);
  const grid = el('name-grid');
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.placeholder = 'Spelare ' + (i + 1);
    input.maxLength = 30;
    input.autocomplete = 'off';
    input.value = names[i] || '';
    input.addEventListener('input', () => { names[i] = input.value; });
    grid.appendChild(input);
  }
  // trimma bort namn utöver aktuellt antal
  names.length = count;
}

function updatePlayersHint() {
  const count = clampPlayerCount(el('player-count').value);
  const encounters = count * (count - 1) / 2;
  const perRound = Math.floor(count / 2);
  const rounds = count % 2 === 0 ? count - 1 : count;
  const byeNote = count % 2 === 1 ? ' · en spelare vilar per rond' : '';
  el('players-hint').textContent =
    count + ' spelare → ' + encounters + ' möten, ' + rounds + ' ronder (' +
    perRound + ' matcher/rond)' + byeNote;
}

function updateModeUi() {
  el('mode-toggle').querySelectorAll('.mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  if (mode === 'points') {
    el('mode-value-label').textContent = 'Spela till';
    el('mode-value-unit').textContent = 'poäng per sport';
    if (!el('mode-value').value) el('mode-value').value = 21;
  } else {
    el('mode-value-label').textContent = 'Spela i';
    el('mode-value-unit').textContent = 'minuter per sport';
    if (!el('mode-value').value) el('mode-value').value = 10;
  }
}

// ── Generering ─────────────────────────────────────────────────────────────────
function generate() {
  const errEl = el('setup-error');
  errEl.style.display = 'none';

  const count = clampPlayerCount(el('player-count').value);
  el('player-count').value = count;

  const sports = orderedSports();
  if (sports.length === 0) {
    errEl.textContent = 'Välj minst en sport.';
    errEl.style.display = 'block';
    return;
  }

  const modeValue = Math.max(1, parseInt(el('mode-value').value, 10) || (mode === 'points' ? 21 : 10));
  el('mode-value').value = modeValue;

  const rounds = roundRobinRounds(count);
  const totalRounds = rounds.length;
  // Fördela ronder över dagarna.
  const day1Rounds = days === 2 ? Math.ceil(totalRounds / 2) : totalRounds;

  const players = [];
  for (let i = 0; i < count; i++) players.push({ index: i, name: playerName(i) });

  const matches = [];
  rounds.forEach((pairs, r) => {
    const day = (days === 2 && r >= day1Rounds) ? 2 : 1;
    pairs.forEach((pair, i) => {
      matches.push({
        id: 'm' + r + '-' + i,
        round: r,
        day: day,
        a: pair[0],
        b: pair[1],
        scores: {}, // { sportKey: { a: number|null, b: number|null } }
      });
    });
  });

  tournament = {
    createdAt: new Date().toISOString(),
    players: players,
    sports: sports,
    mode: mode,
    modeValue: modeValue,
    days: days,
    totalRounds: totalRounds,
    day1Rounds: day1Rounds,
    matches: matches,
  };

  saveTournament();
  renderResults();
  el('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Persistens ─────────────────────────────────────────────────────────────────
function saveTournament() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tournament)); } catch (e) {}
}
function loadTournament() {
  try {
    const t = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (t && Array.isArray(t.players) && Array.isArray(t.matches)) return t;
  } catch (e) {}
  return null;
}
function resetTournament() {
  if (!confirm('Ta bort det här upplägget och alla ifyllda resultat?')) return;
  tournament = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  el('results-section').style.display = 'none';
  el('setup-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Resultatberäkning ───────────────────────────────────────────────────────────
// Summerar en match. Returnerar { totalA, totalB, played } där played är sant om
// minst en sport har fått en poäng ifylld.
function matchTotals(match) {
  let totalA = 0, totalB = 0, played = false;
  tournament.sports.forEach(key => {
    const s = match.scores[key];
    if (!s) return;
    const a = Number.isFinite(s.a) ? s.a : 0;
    const b = Number.isFinite(s.b) ? s.b : 0;
    if (s.a != null || s.b != null) played = true;
    totalA += a; totalB += b;
  });
  return { totalA, totalB, played };
}

function computeStandings() {
  const rows = tournament.players.map(p => ({
    index: p.index, name: p.name,
    played: 0, wins: 0, draws: 0, losses: 0, pf: 0, pa: 0,
  }));
  tournament.matches.forEach(match => {
    const t = matchTotals(match);
    if (!t.played) return;
    const A = rows[match.a], B = rows[match.b];
    A.played++; B.played++;
    A.pf += t.totalA; A.pa += t.totalB;
    B.pf += t.totalB; B.pa += t.totalA;
    if (t.totalA > t.totalB) { A.wins++; B.losses++; }
    else if (t.totalB > t.totalA) { B.wins++; A.losses++; }
    else { A.draws++; B.draws++; }
  });
  rows.forEach(r => { r.diff = r.pf - r.pa; });
  rows.sort((x, y) =>
    (y.wins - x.wins) || (y.diff - x.diff) || (y.pf - x.pf) || (x.index - y.index)
  );
  return rows;
}

// ── Rendering av resultat ───────────────────────────────────────────────────────
function renderResults() {
  el('results-section').style.display = 'block';
  renderSummary();
  renderStandings();
  renderSchedule();
}

function renderSummary() {
  const t = tournament;
  const sportLabels = t.sports.map(k => SPORT_BY_KEY[k].icon + ' ' + SPORT_BY_KEY[k].label).join(', ');
  const encounters = t.matches.length;
  const formatStr = t.mode === 'points'
    ? ('Till ' + t.modeValue + ' poäng/sport')
    : (t.modeValue + ' min/sport');

  el('results-title').textContent = 'Racketlon – ' + t.players.length + ' spelare';
  el('tournament-summary').innerHTML =
    summaryItem('Spelare', t.players.length) +
    summaryItem('Sporter', t.sports.length) +
    summaryItem('Möten', encounters) +
    summaryItem('Ronder', t.totalRounds) +
    summaryItem('Dagar', t.days) +
    summaryItem('Matchstyrning', formatStr);

  el('format-note').innerHTML =
    '<strong>Format:</strong> alla möter alla (round-robin). Varje möte spelas i ' +
    sportLabels + '. ' +
    (t.mode === 'points'
      ? ('Varje sport spelas till ' + t.modeValue + ' poäng.')
      : ('Varje sport spelas i ' + t.modeValue + ' minuter.')) +
    ' Vinnaren av mötet är den med flest poäng sammanlagt över alla sporter.';
}

function summaryItem(label, value) {
  return '<div class="summary-item"><span class="summary-label">' + label +
    '</span><span class="summary-value">' + value + '</span></div>';
}

function renderStandings() {
  const rows = computeStandings();
  const anyPlayed = rows.some(r => r.played > 0);
  let html = '<div class="standings-block"><h3 class="section-title">Tabell</h3>';
  html += '<div class="table-scroll"><table class="standings-table">';
  html += '<thead><tr>' +
    '<th class="col-pos">#</th>' +
    '<th class="col-name">Spelare</th>' +
    '<th title="Spelade möten">S</th>' +
    '<th title="Vinster">V</th>' +
    '<th title="Oavgjorda">O</th>' +
    '<th title="Förluster">F</th>' +
    '<th title="Poäng för">PF</th>' +
    '<th title="Poäng emot">PE</th>' +
    '<th title="Poängdifferens">+/–</th>' +
    '</tr></thead><tbody>';
  rows.forEach((r, i) => {
    const diffStr = (r.diff > 0 ? '+' : '') + r.diff;
    html += '<tr>' +
      '<td class="col-pos">' + (i + 1) + '</td>' +
      '<td class="col-name">' + escapeHtml(r.name) + '</td>' +
      '<td>' + r.played + '</td>' +
      '<td class="cell-win">' + r.wins + '</td>' +
      '<td>' + r.draws + '</td>' +
      '<td>' + r.losses + '</td>' +
      '<td>' + r.pf + '</td>' +
      '<td>' + r.pa + '</td>' +
      '<td class="cell-diff">' + diffStr + '</td>' +
      '</tr>';
  });
  html += '</tbody></table></div>';
  if (!anyPlayed) {
    html += '<p class="standings-hint">Fyll i poäng i matcherna nedan så uppdateras tabellen automatiskt.</p>';
  }
  html += '</div>';
  el('standings-wrap').innerHTML = html;
}

function renderSchedule() {
  const t = tournament;
  const wrap = el('schedule-wrap');
  wrap.innerHTML = '';

  const daysToRender = t.days === 2 ? [1, 2] : [1];
  daysToRender.forEach(day => {
    const dayMatches = t.matches.filter(m => m.day === day);
    if (dayMatches.length === 0) return;

    const daySection = document.createElement('div');
    daySection.className = 'day-section';
    if (t.days === 2) {
      const dayHeader = document.createElement('h3');
      dayHeader.className = 'day-header';
      dayHeader.textContent = 'Dag ' + day;
      daySection.appendChild(dayHeader);
    } else {
      const title = document.createElement('h3');
      title.className = 'section-title';
      title.textContent = 'Spelschema';
      daySection.appendChild(title);
    }

    const roundsInDay = [...new Set(dayMatches.map(m => m.round))].sort((a, b) => a - b);
    roundsInDay.forEach((round, idx) => {
      const roundHeader = document.createElement('div');
      roundHeader.className = 'round-header';
      roundHeader.textContent = 'Rond ' + (round + 1);
      // notera vem som vilar (bye) denna rond
      const playing = new Set();
      dayMatches.filter(m => m.round === round).forEach(m => { playing.add(m.a); playing.add(m.b); });
      const resting = t.players.filter(p => !playing.has(p.index));
      if (resting.length > 0) {
        const bye = document.createElement('span');
        bye.className = 'round-bye';
        bye.textContent = 'Vilar: ' + resting.map(p => p.name).join(', ');
        roundHeader.appendChild(bye);
      }
      daySection.appendChild(roundHeader);

      dayMatches.filter(m => m.round === round).forEach(match => {
        daySection.appendChild(buildMatchCard(match));
      });
    });

    wrap.appendChild(daySection);
  });
}

function buildMatchCard(match) {
  const t = tournament;
  const nameA = t.players[match.a].name;
  const nameB = t.players[match.b].name;

  const card = document.createElement('div');
  card.className = 'match-card';
  card.dataset.match = match.id;

  const targetLabel = t.mode === 'points'
    ? ('till ' + t.modeValue + ' p')
    : (t.modeValue + ' min');

  let html = '<div class="match-head">' +
    '<span class="match-players"><strong>' + escapeHtml(nameA) +
    '</strong> <span class="vs">vs</span> <strong>' + escapeHtml(nameB) + '</strong></span>' +
    '<span class="match-total" data-total="' + match.id + '"></span>' +
    '</div>';

  html += '<table class="score-table"><thead><tr>' +
    '<th class="sport-col">Sport</th>' +
    '<th class="pname-col">' + escapeHtml(shortName(nameA)) + '</th>' +
    '<th class="pname-col">' + escapeHtml(shortName(nameB)) + '</th>' +
    '</tr></thead><tbody>';
  t.sports.forEach(key => {
    const sp = SPORT_BY_KEY[key];
    const s = match.scores[key] || {};
    const va = (s.a != null ? s.a : '');
    const vb = (s.b != null ? s.b : '');
    html += '<tr>' +
      '<td class="sport-cell"><span class="sport-name">' + sp.icon + ' ' + sp.label +
        '</span><span class="sport-target">' + targetLabel + '</span></td>' +
      '<td><input class="score-input" type="number" inputmode="numeric" min="0" ' +
        'data-match="' + match.id + '" data-sport="' + key + '" data-side="a" value="' + va + '"></td>' +
      '<td><input class="score-input" type="number" inputmode="numeric" min="0" ' +
        'data-match="' + match.id + '" data-sport="' + key + '" data-side="b" value="' + vb + '"></td>' +
      '</tr>';
  });
  html += '</tbody></table>';

  card.innerHTML = html;

  card.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', onScoreInput);
  });
  updateMatchTotalLabel(match, card);
  return card;
}

function onScoreInput(e) {
  const input = e.target;
  const matchId = input.dataset.match;
  const sport = input.dataset.sport;
  const side = input.dataset.side;
  const match = tournament.matches.find(m => m.id === matchId);
  if (!match) return;

  if (!match.scores[sport]) match.scores[sport] = { a: null, b: null };
  const raw = input.value.trim();
  match.scores[sport][side] = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);

  saveTournament();
  updateMatchTotalLabel(match);
  renderStandings();
}

function updateMatchTotalLabel(match, root) {
  const labelEl = (root || document).querySelector('[data-total="' + match.id + '"]');
  if (!labelEl) return;
  const t = matchTotals(match);
  if (!t.played) { labelEl.textContent = ''; labelEl.className = 'match-total'; return; }
  let leader = 'Oavgjort';
  let cls = 'match-total draw';
  if (t.totalA > t.totalB) { leader = tournament.players[match.a].name + ' leder'; cls = 'match-total lead'; }
  else if (t.totalB > t.totalA) { leader = tournament.players[match.b].name + ' leder'; cls = 'match-total lead'; }
  labelEl.textContent = t.totalA + '–' + t.totalB + ' · ' + leader;
  labelEl.className = cls;
}

// ── Diverse ─────────────────────────────────────────────────────────────────────
function shortName(name) {
  return name.length > 12 ? name.slice(0, 11) + '…' : name;
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Init & event-wiring ─────────────────────────────────────────────────────────
renderSportGrid();
renderNameGrid();
updatePlayersHint();
updateModeUi();

el('player-count').addEventListener('input', () => {
  renderNameGrid();
  updatePlayersHint();
});
el('player-count').addEventListener('blur', () => {
  el('player-count').value = clampPlayerCount(el('player-count').value);
  renderNameGrid();
  updatePlayersHint();
});

el('mode-toggle').querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    // byt standardvärde om fältet innehåller det andra lägets standard
    const cur = parseInt(el('mode-value').value, 10);
    if (mode === 'points' && cur === 10) el('mode-value').value = 21;
    else if (mode === 'minutes' && cur === 21) el('mode-value').value = 10;
    updateModeUi();
  });
});

el('days-grid').querySelectorAll('.duration-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    days = parseInt(btn.dataset.days, 10);
    el('days-grid').querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

el('generate-btn').addEventListener('click', generate);
el('reset-btn').addEventListener('click', resetTournament);
el('print-btn').addEventListener('click', () => window.print());

// Återställ ev. sparat upplägg
tournament = loadTournament();
if (tournament) {
  // synka setup-fälten mot det sparade upplägget
  el('player-count').value = tournament.players.length;
  names = tournament.players.map(p => p.name);
  renderNameGrid();
  updatePlayersHint();
  selectedSports = new Set(tournament.sports);
  renderSportGrid();
  mode = tournament.mode;
  el('mode-value').value = tournament.modeValue;
  updateModeUi();
  days = tournament.days;
  el('days-grid').querySelectorAll('.duration-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.days, 10) === days);
  });
  renderResults();
}
