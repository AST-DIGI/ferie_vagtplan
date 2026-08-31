import { useMemo, useState } from 'react';
import {
  DAYS, DAY_SHORT, SHIFTS, TEAMS, seatKey, getStatus, evaluate, generate,
  isoWeekOf, mondayOf, weeksInYear, weekKey, dayLabel,
} from './scheduler.js';

const LABEL = { kontor: 'Kontor', hjem: 'Hjemme', fravaer: 'Fravær', fri: 'Fri' };
const CYCLE = [undefined, 'hjem', 'fravaer', 'kontor']; // klik: automatisk → hjemme → fravær → kontor

export default function Plan({ data, setData, yw, setYw, goEmployees }) {
  const { year, week } = yw;
  const key = weekKey(year, week);
  const emps = data.employees;
  const wd = data.weeks[key] || { status: {}, seats: {} };
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');

  const setWd = (fn) => setData((d) => ({ ...d, weeks: { ...d.weeks, [key]: fn(d.weeks[key] || { status: {}, seats: {} }) } }));

  // Vagter de seneste 4 uger – bruges til at fordele retfærdigt over tid
  const history = useMemo(() => {
    const h = {};
    for (let k = 1; k <= 4; k++) {
      const dt = mondayOf(year, week);
      dt.setUTCDate(dt.getUTCDate() - 7 * k);
      const p = isoWeekOf(dt);
      Object.values(data.weeks[weekKey(p.year, p.week)]?.seats || {}).forEach((s) => { if (s.id) h[s.id] = (h[s.id] || 0) + 1; });
    }
    return h;
  }, [data.weeks, year, week]);

  const run = (mode) => setWd((w) => ({ ...w, seats: generate({ employees: emps, week, weekData: w, history, mode, seed: Date.now() }) }));
  const clear = () => confirm('Fjern alle vagter i ugen (også låste)?') && setWd((w) => ({ ...w, seats: {} }));
  const go = (delta) => {
    const dt = mondayOf(year, week);
    dt.setUTCDate(dt.getUTCDate() + 7 * delta);
    setYw(isoWeekOf(dt));
  };

  const setSeat = (k, id) => setWd((w) => {
    const seats = { ...w.seats };
    if (id) seats[k] = { id, locked: true }; else delete seats[k];
    return { ...w, seats };
  });
  const toggleLock = (k) => setWd((w) => ({ ...w, seats: { ...w.seats, [k]: { ...w.seats[k], locked: !w.seats[k].locked } } }));
  const cycleStatus = (d, e) => setWd((w) => {
    const k = `${d}|${e.id}`;
    const cur = w.status[k];
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    const status = { ...w.status };
    if (next) status[k] = next; else delete status[k];
    return { ...w, status };
  });

  const usedByDay = DAYS.map((_, d) => new Set(Object.entries(wd.seats).filter(([k]) => k.startsWith(`${d}|`)).map(([, s]) => s.id)));
  const total = SHIFTS.reduce((n, s) => n + s.seats, 0) * DAYS.length;
  const filled = Object.values(wd.seats).filter((s) => s.id).length;
  const weekCounts = {};
  Object.values(wd.seats).forEach((s) => { if (s.id) weekCounts[s.id] = (weekCounts[s.id] || 0) + 1; });
  const st = (e, d) => getStatus(e, d, week, wd);

  const shown = emps.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) && (!team || e.team === team))
    .sort((a, b) => a.name.localeCompare(b.name, 'da'));

  if (!emps.length) {
    return (
      <main className="empty-state">
        <h2>Ingen medarbejdere endnu</h2>
        <p>Tilføj medarbejdere, roller og regler, så kan ugen genereres.</p>
        <button className="primary" onClick={goEmployees}>Tilføj medarbejdere</button>
      </main>
    );
  }

  return (
    <main>
      <section className="bar">
        <div className="weeknav">
          <button onClick={() => go(-1)} aria-label="Forrige uge">‹</button>
          <label>Uge <input type="number" min="1" max={weeksInYear(year)} value={week}
            onChange={(e) => { const w = Math.min(weeksInYear(year), Math.max(1, +e.target.value || 1)); setYw({ year, week: w }); }} /></label>
          <label>År <input type="number" value={year} onChange={(e) => { const y = +e.target.value || year; setYw({ year: y, week: Math.min(week, weeksInYear(y)) }); }} /></label>
          <button onClick={() => go(1)} aria-label="Næste uge">›</button>
          <span className="range">{dayLabel(year, week, 0)} – {dayLabel(year, week, 4)}</span>
        </div>
        <div className="spacer" />
        <button className="primary" onClick={() => run('all')}>Generér ugen</button>
        <button onClick={() => run('fill')}>Udfyld tomme pladser</button>
        <button className="ghost" onClick={clear}>Ryd</button>
      </section>

      <div className={'summary ' + (filled === total ? 'ok' : 'bad')}>
        {filled === total ? `Alle ${total} pladser er bemandet.` : `${total - filled} af ${total} pladser mangler bemanding.`}
        <span> Vælg en person manuelt i en tom plads, eller sæt fravær nedenfor og tryk «Udfyld tomme pladser».</span>
      </div>

      <div className="scroll">
        <table className="grid">
          <thead>
            <tr>
              <th />
              {DAYS.map((n, d) => (
                <th key={d}>
                  <div className="dayname">{n}</div>
                  <div className="date">{dayLabel(year, week, d)}</div>
                  <div className="meta">Hjemme: {emps.filter((e) => st(e, d) === 'hjem').length} · Fravær: {emps.filter((e) => st(e, d) === 'fravaer').length}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map((s) => (
              <FragmentRows key={s.id} shift={s}>
                {Array.from({ length: s.seats }, (_, i) => (
                  <tr key={i}>
                    <th className="rowlabel">{i === 0 ? s.name : ''}</th>
                    {DAYS.map((_, d) => {
                      const k = seatKey(d, s.id, i);
                      const cur = wd.seats[k];
                      const e = cur && emps.find((x) => x.id === cur.id);
                      const ev = e && evaluate(e, s.id, d, week, st(e, d));
                      const opts = emps.map((x) => ({ x, ev: evaluate(x, s.id, d, week, st(x, d)) }))
                        .filter(({ x }) => x.id === cur?.id || !usedByDay[d].has(x.id))
                        .filter(({ ev: v }) => v.hard !== 'skill')
                        .sort((a, b) => a.x.name.localeCompare(b.x.name, 'da'));
                      const good = opts.filter((o) => o.ev.ok && !o.ev.penalty);
                      const warn = opts.filter((o) => o.ev.ok && o.ev.penalty);
                      const bad = opts.filter((o) => !o.ev.ok);
                      return (
                        <td key={d} className={!e ? 'missing' : ''}>
                          <div className="seat">
                            <select value={e?.id || ''} onChange={(ev2) => setSeat(k, ev2.target.value)} aria-label={`${s.name} ${DAYS[d]} plads ${i + 1}`}>
                              <option value="">Mangler</option>
                              <optgroup label="Kan tage vagten">{good.map(({ x }) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
                              <optgroup label="Med forbehold">{warn.map(({ x, ev: v }) => <option key={x.id} value={x.id}>{x.name} ({v.reasons.join(', ')})</option>)}</optgroup>
                              <optgroup label="Fri / fravær">{bad.map(({ x, ev: v }) => <option key={x.id} value={x.id}>{x.name} ({v.reasons.join(', ')})</option>)}</optgroup>
                            </select>
                            {e && <button className="lock" onClick={() => toggleLock(k)} title={cur.locked ? 'Låst – ændres ikke af «Generér»' : 'Låst op'}>{cur.locked ? 'Låst' : 'Åben'}</button>}
                          </div>
                          {ev && ev.reasons.length > 0 && <div className="warn">{ev.reasons.join(', ')}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </FragmentRows>
            ))}
          </tbody>
        </table>
      </div>

      <section className="panel">
        <h2>Dagsstatus</h2>
        <p className="hint">Udfyldes automatisk fra de faste regler. Klik på en dag for at ændre den: hjemme → fravær → kontor → automatisk.</p>
        <div className="filters">
          <input placeholder="Søg medarbejder" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="">Alle teams</option>
            {TEAMS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="scroll">
          <table className="status">
            <thead><tr><th>Medarbejder</th>{DAY_SHORT.map((n) => <th key={n}>{n}</th>)}<th>Vagter</th></tr></thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <th>{e.name || '(uden navn)'} <small>{e.team}</small></th>
                  {DAYS.map((_, d) => {
                    const s = st(e, d);
                    return (
                      <td key={d}>
                        <button className={`pill ${s}${wd.status[`${d}|${e.id}`] ? ' manual' : ''}`} onClick={() => cycleStatus(d, e)}>{LABEL[s]}</button>
                      </td>
                    );
                  })}
                  <td className="num">{weekCounts[e.id] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function FragmentRows({ shift, children }) {
  return (
    <>
      <tr className="shifthead"><th colSpan={6}>{shift.name} – {shift.seats} pladser pr. dag</th></tr>
      {children}
    </>
  );
}
