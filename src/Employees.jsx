import { useState } from 'react';
import { DAY_SHORT, ROLES, SHIFTS, TEAMS, newEmployee } from './scheduler.js';
import { demoEmployees } from './demo.js';

function Chips({ value, onChange }) {
  return (
    <span className="chips">
      {DAY_SHORT.map((n, i) => (
        <button type="button" key={i} className={value.includes(i) ? 'on' : ''}
          onClick={() => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i].sort())}>{n}</button>
      ))}
    </span>
  );
}

function ParityDays({ title, hint, value, onChange }) {
  const rows = [['all', 'Hver uge'], ['odd', 'Ulige uger'], ['even', 'Lige uger']];
  return (
    <fieldset>
      <legend>{title}</legend>
      {hint && <p className="hint">{hint}</p>}
      {rows.map(([k, label]) => (
        <div className="row" key={k}><span>{label}</span><Chips value={value[k]} onChange={(v) => onChange({ ...value, [k]: v })} /></div>
      ))}
    </fieldset>
  );
}

function Editor({ e, onChange, onDelete }) {
  const set = (patch) => onChange({ ...e, ...patch });
  const toggleSkill = (id) => set({ skills: e.skills.includes(id) ? e.skills.filter((s) => s !== id) : [...e.skills, id] });
  return (
    <div className="editor">
      <div className="row2">
        <label>Navn<input value={e.name} onChange={(ev) => set({ name: ev.target.value })} /></label>
        <label>Rolle<select value={e.role} onChange={(ev) => set({ role: ev.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Team<select value={e.team} onChange={(ev) => set({ team: ev.target.value })}>{TEAMS.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      <fieldset>
        <legend>Må tage vagterne</legend>
        {SHIFTS.map((s) => (
          <label className="check" key={s.id}><input type="checkbox" checked={e.skills.includes(s.id)} onChange={() => toggleSkill(s.id)} /> {s.name}</label>
        ))}
      </fieldset>
      <ParityDays title="Fridage" hint="Fx hver fredag, eller hver torsdag i ulige uger." value={e.off} onChange={(off) => set({ off })} />
      <fieldset>
        <legend>Hele uger fri</legend>
        <select value={e.offWeeks} onChange={(ev) => set({ offWeeks: ev.target.value })}>
          <option value="none">Ingen</option>
          <option value="odd">Alle ulige uger</option>
          <option value="even">Alle lige uger</option>
        </select>
      </fieldset>
      <fieldset>
        <legend>Kan kun disse dage</legend>
        <p className="hint">Tom = ingen begrænsning. Fx kun torsdag.</p>
        <Chips value={e.onlyDays} onChange={(onlyDays) => set({ onlyDays })} />
      </fieldset>
      <fieldset>
        <legend>Foretrukne dage</legend>
        <Chips value={e.preferred} onChange={(preferred) => set({ preferred })} />
      </fieldset>
      <ParityDays title="Hjemmearbejde" hint="Personen sættes kun på vagt hjemmefra dage, hvis ellers en vagt ville stå tom." value={e.home} onChange={(home) => set({ home })} />
      <fieldset>
        <legend>Går tidligt</legend>
        <div className="row"><span>Tidspunkt</span><input type="time" value={e.early.time} onChange={(ev) => set({ early: { ...e.early, time: ev.target.value } })} /></div>
        <div className="row"><span>Dage (tom = alle)</span><Chips value={e.early.days} onChange={(days) => set({ early: { ...e.early, days } })} /></div>
        <p className="hint">Vagter varer hele dagen, så tidlig afgang tæller som et forbehold.</p>
      </fieldset>
      <fieldset>
        <legend>Vagt hver n. uge</legend>
        <div className="row">
          <span>Hver</span><input className="short" type="number" min="2" value={e.everyN.n} onChange={(ev) => set({ everyN: { ...e.everyN, n: ev.target.value } })} />
          <span>. uge, med start i uge</span><input className="short" type="number" min="1" max="53" value={e.everyN.start} onChange={(ev) => set({ everyN: { ...e.everyN, start: ev.target.value } })} />
        </div>
      </fieldset>
      <button className="danger" onClick={onDelete}>Slet medarbejder</button>
    </div>
  );
}

export default function Employees({ data, setData }) {
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState('');
  const emps = data.employees;
  const cur = emps.find((e) => e.id === sel);
  const upd = (e) => setData((d) => ({ ...d, employees: d.employees.map((x) => (x.id === e.id ? e : x)) }));
  const add = () => { const e = newEmployee(); setData((d) => ({ ...d, employees: [...d.employees, e] })); setSel(e.id); };
  const del = () => {
    if (!confirm(`Slet ${cur.name || 'medarbejderen'}?`)) return;
    setData((d) => ({ ...d, employees: d.employees.filter((x) => x.id !== cur.id) }));
    setSel(null);
  };
  const demo = () => confirm('Indlæs 30 eksempelmedarbejdere? De tilføjes til listen.') && setData((d) => ({ ...d, employees: [...d.employees, ...demoEmployees()] }));
  const list = emps.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'da'));
  const skillNames = (e) => SHIFTS.filter((s) => e.skills.includes(s.id)).map((s) => s.name).join(', ') || 'Ingen vagter';

  return (
    <main className="emp">
      <section className="list">
        <div className="filters">
          <input placeholder="Søg medarbejder" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="primary" onClick={add}>Tilføj</button>
        </div>
        {!emps.length && <button className="ghost" onClick={demo}>Indlæs eksempeldata</button>}
        <ul>
          {list.map((e) => (
            <li key={e.id}>
              <button className={e.id === sel ? 'on' : ''} onClick={() => setSel(e.id)}>
                <strong>{e.name || '(uden navn)'}</strong>
                <small>{e.role} · {e.team}</small>
                <small>{skillNames(e)}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="detail">
        {cur ? <Editor key={cur.id} e={cur} onChange={upd} onDelete={del} /> : <p className="hint">Vælg en medarbejder for at redigere roller og regler.</p>}
      </section>
    </main>
  );
}
