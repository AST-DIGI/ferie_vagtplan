// ---------- Konstanter ----------
export const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];
export const DAY_SHORT = ['Man', 'Tir', 'Ons', 'Tor', 'Fre'];
// Antal pladser pr. vagt – ret her hvis behovet ændrer sig
export const SHIFTS = [
  { id: 'infocenter', name: 'Infocenter', seats: 3 },
  { id: 'reception', name: 'Reception', seats: 2 },
  { id: 'receptionBorn', name: 'Reception Børn', seats: 2 },
];
export const ROLES = ['Medarbejder', 'Elev', 'Studerende', 'Vikar'];
export const TEAMS = ['Arbejdsskade', 'Børn/Ret/Klage', 'Nævn', 'KSB', 'AKT', 'Info'];

const INF = 1e6; // "umulig" – højere end alle bløde omkostninger tilsammen
const SOFT = 1000; // straf for regler der kun brydes for at undgå en tom vagt

// ---------- Uger og datoer (ISO) ----------
export const weekKey = (y, w) => `${y}-W${String(w).padStart(2, '0')}`;
export const parity = (w) => (w % 2 === 0 ? 'even' : 'odd');

export function isoWeekOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return { year, week };
}
export const todayYw = () => {
  const n = new Date();
  return isoWeekOf(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
};
export const weeksInYear = (y) => isoWeekOf(new Date(Date.UTC(y, 11, 28))).week;
export function mondayOf(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const m = new Date(jan4);
  m.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return m;
}
export function dayLabel(year, week, i) {
  const d = mondayOf(year, week);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

// ---------- Medarbejdere ----------
export const uid = () => Math.random().toString(36).slice(2, 9);
export const emptyPD = () => ({ all: [], odd: [], even: [] }); // ugedage: hver uge / ulige / lige
export const newEmployee = () => ({
  id: uid(),
  name: '',
  role: 'Medarbejder',
  team: TEAMS[0],
  skills: [], // hvilke vagter personen må tage
  off: emptyPD(), // fridage
  offWeeks: 'none', // 'none' | 'odd' | 'even' – hele uger fri
  onlyDays: [], // kan KUN disse dage (tom = ingen begrænsning)
  preferred: [], // foretrukne dage
  home: emptyPD(), // hjemmearbejde
  early: { time: '', days: [] }, // går tidligt (tom days = alle dage)
  everyN: { n: '', start: '' }, // kan kun tage vagt hver n. uge, med startuge
});

const inPD = (pd, d, w) => pd.all.includes(d) || pd[parity(w)].includes(d);

// Status ud fra personens faste regler: 'kontor' | 'hjem' | 'fri'
export function defaultStatus(e, d, w) {
  if (e.offWeeks === parity(w) || inPD(e.off, d, w) || (e.onlyDays.length && !e.onlyDays.includes(d))) return 'fri';
  if (inPD(e.home, d, w)) return 'hjem';
  return 'kontor';
}
// Dagens manuelle ændring (syg, opgave, hjemme…) vinder over de faste regler
export const getStatus = (e, d, w, wd) => wd.status?.[`${d}|${e.id}`] || defaultStatus(e, d, w);

// Kan personen tage vagten? ok=false er hårde regler, penalty er bløde regler
export function evaluate(e, shiftId, d, w, st) {
  if (!e.skills.includes(shiftId)) return { ok: false, hard: 'skill', reasons: ['Har ikke rollen'], penalty: INF };
  if (st === 'fri') return { ok: false, hard: 'fri', reasons: ['Fri'], penalty: INF };
  if (st === 'fravaer') return { ok: false, hard: 'fravaer', reasons: ['Fravær'], penalty: INF };
  let penalty = 0;
  const reasons = [];
  if (st === 'hjem') { penalty += SOFT; reasons.push('Hjemmearbejde'); }
  if (e.early.time && (!e.early.days.length || e.early.days.includes(d))) {
    penalty += SOFT; reasons.push(`Går kl. ${e.early.time}`);
  }
  const n = +e.everyN.n;
  if (n > 1 && (((w - (+e.everyN.start || 0)) % n) + n) % n !== 0) {
    penalty += SOFT; reasons.push(`Vagt kun hver ${n}. uge`);
  }
  return { ok: true, reasons, penalty };
}

// ---------- Generator ----------
export const seatKey = (d, s, i) => `${d}|${s}|${i}`;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Optimal tildeling (ungarsk metode): rækker = pladser, kolonner = personer, n <= m
function hungarian(a) {
  const n = a.length, m = a[0].length;
  const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(m + 1).fill(Infinity), used = Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const ans = Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
  return ans;
}

/**
 * mode 'all':  behold kun låste pladser, generér resten
 * mode 'fill': behold alle gyldige pladser, udfyld kun tomme (fx efter sygemelding)
 * history: {medarbejderId: antal vagter de seneste uger} bruges til fordelingen
 * Hver dag løses optimalt, så flest mulige pladser bliver fyldt – derefter retfærdighed.
 */
export function generate({ employees, week, weekData, history, mode, seed }) {
  const rnd = mulberry32(seed);
  const byId = Object.fromEntries(employees.map((e) => [e.id, e]));
  const counts = {};
  employees.forEach((e) => (counts[e.id] = (history[e.id] || 0) * 0.5));
  const seats = {};
  const used = DAYS.map(() => new Set());

  DAYS.forEach((_, d) => SHIFTS.forEach((s) => {
    for (let i = 0; i < s.seats; i++) {
      const k = seatKey(d, s.id, i);
      const cur = weekData.seats?.[k];
      const e = cur?.id && byId[cur.id];
      if (!e || used[d].has(e.id)) continue;
      if (!(cur.locked || mode === 'fill')) continue;
      if (!evaluate(e, s.id, d, week, getStatus(e, d, week, weekData)).ok) continue;
      seats[k] = cur;
      used[d].add(e.id);
      counts[e.id]++;
    }
  }));

  // Fyld de mest begrænsede dage først
  const scarcity = DAYS.map((_, d) => employees.filter((e) =>
    SHIFTS.some((s) => evaluate(e, s.id, d, week, getStatus(e, d, week, weekData)).ok)).length);
  const order = DAYS.map((_, d) => d).sort((a, b) => scarcity[a] - scarcity[b]);

  for (const d of order) {
    const open = [];
    SHIFTS.forEach((s) => { for (let i = 0; i < s.seats; i++) if (!seats[seatKey(d, s.id, i)]) open.push({ s, i }); });
    if (!open.length) continue;
    const cands = employees.filter((e) => !used[d].has(e.id));
    const cols = Math.max(cands.length, open.length);
    const matrix = open.map(({ s }) => Array.from({ length: cols }, (_, c) => {
      const e = cands[c];
      if (!e) return INF;
      const ev = evaluate(e, s.id, d, week, getStatus(e, d, week, weekData));
      if (!ev.ok) return INF;
      return ev.penalty + counts[e.id] * 30 - (e.preferred.includes(d) ? 25 : 0) + rnd() * 6;
    }));
    const pick = hungarian(matrix);
    pick.forEach((c, r) => {
      if (c < 0 || c >= cands.length || matrix[r][c] >= INF) return;
      const e = cands[c];
      seats[seatKey(d, open[r].s.id, open[r].i)] = { id: e.id, locked: false };
      used[d].add(e.id);
      counts[e.id]++;
    });
  }
  return seats;
}
