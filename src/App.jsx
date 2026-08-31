import { useEffect, useRef, useState } from 'react';
import Plan from './Plan.jsx';
import Employees from './Employees.jsx';
import { todayYw } from './scheduler.js';

// localStorage frem for cookies: cookies er begrænset til ~4 KB, og 100 medarbejdere med regler fylder mere.
const KEY = 'vagtplan-v1';
const EMPTY = { employees: [], weeks: {} };

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || EMPTY; } catch { return EMPTY; }
}

export default function App() {
  const [data, setData] = useState(load);
  const [tab, setTab] = useState('plan');
  const [yw, setYw] = useState(todayYw);
  const fileRef = useRef();

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* fuld lagring eller privat tilstand */ }
  }, [data]);

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    a.download = `vagtplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importData = async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (Array.isArray(j.employees) && j.weeks) setData(j);
      else alert('Filen er ikke en vagtplan-backup.');
    } catch { alert('Filen kunne ikke læses.'); }
    ev.target.value = '';
  };

  return (
    <div className="app">
      <header className="top">
        <h1>Vagtplan</h1>
        <nav>
          <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>Vagtplan</button>
          <button className={tab === 'emp' ? 'on' : ''} onClick={() => setTab('emp')}>Medarbejdere ({data.employees.length})</button>
        </nav>
        <div className="spacer" />
        <button className="ghost" onClick={exportData}>Gem backup</button>
        <button className="ghost" onClick={() => fileRef.current.click()}>Hent backup</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
      </header>
      {tab === 'plan'
        ? <Plan data={data} setData={setData} yw={yw} setYw={setYw} goEmployees={() => setTab('emp')} />
        : <Employees data={data} setData={setData} />}
    </div>
  );
}
