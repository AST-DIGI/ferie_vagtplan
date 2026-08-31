import { newEmployee, TEAMS } from './scheduler.js';

const NAMES = ['Anna','Bo','Camilla','Dan','Eva','Frederik','Gitte','Henrik','Ida','Jens','Karen','Lars','Mette','Niels','Ole','Pia','Rasmus','Sofie','Thomas','Ulla','Vibeke','Willy','Yrsa','Zeki','Astrid','Bent','Cecilie','David','Emma','Finn'];
const SKILLS = [['infocenter'],['reception'],['receptionBorn'],['infocenter','reception'],['reception','receptionBorn'],['infocenter','reception','receptionBorn']];

export function demoEmployees() {
  return NAMES.map((name, i) => {
    const e = newEmployee();
    e.name = name;
    e.team = TEAMS[i % TEAMS.length];
    e.role = i % 10 === 7 ? 'Elev' : i % 10 === 9 ? 'Studerende' : 'Medarbejder';
    e.skills = SKILLS[i % 6];
    if (i % 5 === 0) e.off.all = [4];
    if (i % 7 === 0) e.off.odd = [3];
    if (i % 11 === 0) e.offWeeks = 'odd';
    if (i % 6 === 2) e.home.all = [0];
    if (i % 9 === 4) e.early = { time: '13:00', days: [] };
    if (i % 8 === 3) e.preferred = [2];
    return e;
  });
}
