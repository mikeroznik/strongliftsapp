'use strict';

const STORAGE_KEY = 'stronglifts5x5.v1';
const TARGET_REPS = 5;
const UNIT = 'lb';

// warmups: reps-only sets that don't affect progression.
const EXERCISES = {
  squat:    { name: 'Squat',          increment: 5,  warmups: 0, workSets: 5 },
  bench:    { name: 'Bench Press',    increment: 5,  warmups: 0, workSets: 5 },
  row:      { name: 'Barbell Row',    increment: 5,  warmups: 0, workSets: 5 },
  ohp:      { name: 'Overhead Press', increment: 5,  warmups: 0, workSets: 5 },
  deadlift: { name: 'Deadlift',       increment: 10, warmups: 4, workSets: 1 },
};

const PLANS = {
  A: ['squat', 'bench', 'row'],
  B: ['squat', 'ohp', 'deadlift'],
};

const app = document.getElementById('app');
let flash = null;

// ---------- Storage ----------

function loadData() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.workouts)) return data;
  } catch (e) {
    console.error('Could not read saved workouts', e);
  }
  return { version: 1, workouts: [] };
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    alert('Could not save workout: ' + e.message);
    return false;
  }
}

// Most recent first: by workout date, then by when it was logged.
function workoutsNewestFirst() {
  return loadData().workouts.slice().sort((a, b) =>
    b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt));
}

// ---------- Program rules ----------

function nextWorkoutType(workouts) {
  if (!workouts.length) return 'A';
  return workouts[0].type === 'A' ? 'B' : 'A';
}

function lastEntry(workouts, key) {
  for (const workout of workouts) {
    const exercise = workout.exercises.find(ex => ex.key === key);
    if (exercise) return exercise;
  }
  return null;
}

function suggestedWeight(key, last) {
  if (!last) return null;
  return last.missed ? last.weight : last.weight + EXERCISES[key].increment;
}

function setTemplate(key) {
  const def = EXERCISES[key];
  return [
    ...Array.from({ length: def.warmups }, () => ({ warmup: true })),
    ...Array.from({ length: def.workSets }, () => ({ warmup: false })),
  ];
}

function setLabels(sets) {
  let warmup = 0;
  let work = 0;
  return sets.map(s => (s.warmup ? `Warm-up ${++warmup}` : `Set ${++work}`));
}

// ---------- Formatting ----------

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function fmtWeight(n) {
  return String(Math.round(n * 100) / 100);
}

function todayISO() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(iso, options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, options);
}

function topBar(title) {
  return `
    <header class="topbar">
      <a href="#/" class="back">&lsaquo; Home</a>
      <h1>${escapeHtml(title)}</h1>
    </header>`;
}

// ---------- Home ----------

function renderHome() {
  const workouts = workoutsNewestFirst();
  const next = nextWorkoutType(workouts);
  const last = workouts[0];
  const message = flash;
  flash = null;

  app.innerHTML = `
    <h1 class="home-title">StrongLifts 5×5</h1>
    ${message ? `<p class="toast" role="status">${escapeHtml(message)}</p>` : ''}
    <section class="card next">
      <p class="eyebrow">Next up</p>
      <p class="next-type">Workout ${next}</p>
      <p class="muted">${PLANS[next].map(k => EXERCISES[k].name).join(' · ')}</p>
      ${last ? `<p class="muted small">Last logged: Workout ${last.type} on ${fmtDate(last.date)}</p>` : ''}
    </section>
    <a href="#/record" class="btn btn-primary btn-big">Record</a>
    <a href="#/view" class="btn btn-secondary btn-big">View</a>`;
}

// ---------- Record ----------

function exerciseForm(key, workouts) {
  const def = EXERCISES[key];
  const last = lastEntry(workouts, key);
  const weight = suggestedWeight(key, last);
  const sets = setTemplate(key);
  const labels = setLabels(sets);

  let hint;
  if (!last) hint = 'First time: enter a starting weight.';
  else if (last.missed) hint = `Last: ${fmtWeight(last.weight)} ${UNIT}, missed reps, so same weight.`;
  else hint = `Last: ${fmtWeight(last.weight)} ${UNIT}, all reps done, so +${def.increment}.`;

  const rows = sets.map((s, i) => `
    <span class="set-label${s.warmup ? ' is-warmup' : ''}">${labels[i]}</span>
    <input type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1"
      name="${key}-reps-${i}" value="${TARGET_REPS}"${s.warmup ? ' data-warmup' : ''}
      aria-label="${def.name} ${labels[i]} reps">`).join('');

  return `
    <section class="card">
      <div class="ex-head">
        <h2>${def.name}</h2>
        <label class="weight-field">
          <input type="number" inputmode="decimal" min="0" step="any"
            name="${key}-weight" value="${weight ?? ''}" placeholder="0"
            aria-label="${def.name} weight in ${UNIT}">
          ${UNIT}
        </label>
      </div>
      <p class="hint">${hint}</p>
      <div class="sets">
        <span class="sets-head">Set</span>
        <span class="sets-head">Reps</span>
        ${rows}
      </div>
    </section>`;
}

function renderRecord() {
  const workouts = workoutsNewestFirst();
  const type = nextWorkoutType(workouts);
  const today = todayISO();

  app.innerHTML = `
    ${topBar(`Workout ${type}`)}
    <form id="record-form" novalidate>
      <section class="card">
        <label class="date-field">Date
          <input type="date" name="date" value="${today}" max="${today}">
        </label>
      </section>
      ${PLANS[type].map(key => exerciseForm(key, workouts)).join('')}
      <div class="form-error" id="form-error" role="alert" hidden></div>
      <button type="submit" class="btn btn-primary btn-block log-btn">Log</button>
    </form>`;

  const form = document.getElementById('record-form');
  form.addEventListener('focusin', e => {
    if (e.target.type === 'number') e.target.select();
  });
  form.addEventListener('input', e => {
    if (e.target.name.includes('-reps-')) markShort(e.target);
    e.target.removeAttribute('aria-invalid');
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    logWorkout(form, type);
  });
}

function markShort(input) {
  if (input.hasAttribute('data-warmup')) return;
  const value = input.value.trim();
  input.classList.toggle('short', value !== '' && Number(value) < TARGET_REPS);
}

function logWorkout(form, type) {
  const errors = [];
  const invalid = [];
  const field = name => form.elements[name];

  const date = field('date').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('Pick a date.');
    invalid.push(field('date'));
  } else if (date > todayISO()) {
    errors.push('The date can’t be in the future.');
    invalid.push(field('date'));
  }

  const exercises = PLANS[type].map(key => {
    const def = EXERCISES[key];
    const weightInput = field(`${key}-weight`);
    const weight = Number(weightInput.value);
    if (weightInput.value.trim() === '' || !(weight > 0)) {
      errors.push(`Enter a weight for ${def.name}.`);
      invalid.push(weightInput);
    }

    let badReps = false;
    const sets = setTemplate(key).map((s, i) => {
      const input = field(`${key}-reps-${i}`);
      const reps = Number(input.value);
      if (input.value.trim() === '' || !Number.isInteger(reps) || reps < 0) {
        badReps = true;
        invalid.push(input);
      }
      return { warmup: s.warmup, reps, target: TARGET_REPS };
    });
    if (badReps) errors.push(`Enter whole-number reps for every ${def.name} set.`);

    const working = sets.filter(s => !s.warmup);
    const missedReps = working.reduce((n, s) => n + Math.max(0, s.target - s.reps), 0);
    const missedSets = working.filter(s => s.reps === 0).length;
    return { key, name: def.name, weight, unit: UNIT, sets, missed: missedReps > 0, missedReps, missedSets };
  });

  const errorBox = document.getElementById('form-error');
  if (errors.length) {
    invalid.forEach(input => input.setAttribute('aria-invalid', 'true'));
    errorBox.innerHTML = `<ul>${errors.map(m => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
    errorBox.hidden = false;
    invalid[0].focus();
    return;
  }

  const data = loadData();
  data.workouts.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    type,
    date,
    loggedAt: new Date().toISOString(),
    exercises,
  });
  if (!saveData(data)) return;

  flash = `Workout ${type} logged for ${fmtDate(date)}.`;
  location.hash = '#/';
}

// ---------- View ----------

// Epley formula, using the last working set of the session.
function estimateOneRepMax(exercise) {
  const working = exercise.sets.filter(s => !s.warmup);
  const reps = working[working.length - 1].reps;
  return { reps, value: exercise.weight * (1 + reps / 30) };
}

function oneRepMaxCard(workouts) {
  const tiles = Object.entries(EXERCISES).map(([key, def]) => {
    const workout = workouts.find(w => w.exercises.some(ex => ex.key === key));
    if (!workout) {
      return `
        <div class="orm-tile">
          <p class="orm-name">${def.name}</p>
          <p class="orm-value muted">—</p>
          <p class="orm-basis">Not logged yet</p>
        </div>`;
    }
    const exercise = workout.exercises.find(ex => ex.key === key);
    const { reps, value } = estimateOneRepMax(exercise);
    return `
      <div class="orm-tile">
        <p class="orm-name">${def.name}</p>
        <p class="orm-value">${Math.round(value)} <span class="orm-unit">${UNIT}</span></p>
        <p class="orm-basis">${fmtWeight(exercise.weight)} × ${reps} · ${fmtDate(workout.date, { month: 'short', day: 'numeric' })}</p>
      </div>`;
  }).join('');

  return `
    <section class="card">
      <p class="eyebrow">Estimated one-rep max</p>
      <div class="orm-grid">${tiles}</div>
      <p class="table-note">weight × (1 + reps ÷ 30), from the last working set of each lift’s most recent session.</p>
    </section>`;
}

function workoutCard(w) {
  const anyMissed = w.exercises.some(ex => ex.missed);
  const setCount = Math.max(...w.exercises.map(ex => ex.sets.length));
  const hasWarmups = w.exercises.some(ex => ex.sets.some(s => s.warmup));

  const headCells = Array.from({ length: setCount }, (_, i) => `<th scope="col">${i + 1}</th>`).join('');
  const rows = w.exercises.map(ex => {
    const labels = setLabels(ex.sets);
    const cells = Array.from({ length: setCount }, (_, i) => {
      const s = ex.sets[i];
      if (!s) return '<td></td>';
      const cls = s.warmup ? 'wu' : s.reps < s.target ? 'short' : 'done';
      return `<td class="${cls}" title="${labels[i]}: ${s.reps}/${s.target}">${s.reps}</td>`;
    }).join('');
    return `
      <tr>
        <th scope="row">${escapeHtml(ex.name)}</th>
        <td class="weight">${fmtWeight(ex.weight)}</td>
        ${cells}
      </tr>`;
  }).join('');

  return `
    <article class="card">
      <div class="wo-head">
        <div>
          <p class="wo-title">${fmtDate(w.date)}</p>
          <p class="wo-sub">
            <span class="badge badge-type">Workout ${w.type}</span>
            ${anyMissed ? '<span class="badge badge-missed">Missed reps</span>' : ''}
          </p>
        </div>
        <button type="button" class="btn btn-danger" data-delete="${escapeHtml(w.id)}">Delete</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th scope="col">Exercise</th><th scope="col">${UNIT}</th>${headCells}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${hasWarmups ? '<p class="table-note">Numbers are reps per set. Italic = deadlift warm-up sets (1–4).</p>' : '<p class="table-note">Numbers are reps per set.</p>'}
    </article>`;
}

function renderView() {
  const workouts = workoutsNewestFirst();
  app.innerHTML = `
    ${topBar('History')}
    ${workouts.length
      ? oneRepMaxCard(workouts) + workouts.map(workoutCard).join('')
      : '<p class="empty">No workouts logged yet.</p>'}`;

  app.onclick = e => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    const data = loadData();
    const workout = data.workouts.find(w => w.id === btn.dataset.delete);
    if (!workout) return;
    if (!confirm(`Delete Workout ${workout.type} from ${fmtDate(workout.date)}? This can’t be undone.`)) return;
    data.workouts = data.workouts.filter(w => w.id !== workout.id);
    if (saveData(data)) renderView();
  };
}

// ---------- Router ----------

function route() {
  app.onclick = null;
  switch (location.hash) {
    case '#/record': renderRecord(); break;
    case '#/view': renderView(); break;
    default: renderHome();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
