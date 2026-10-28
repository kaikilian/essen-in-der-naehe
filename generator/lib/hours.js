'use strict';
const OpeningHours = require('opening_hours');

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function nominatimStub(bundesland) {
  return { address: { country_code: 'de', state: bundesland || 'Baden-Württemberg' } };
}

/** Läufe zusammenfassen: [Mo,Di,Mi,So] -> "Mo–Mi, So" */
function fasseZusammen(indizes) {
  if (!indizes.length) return '';
  if (indizes.length === 7) return 'dauerhaft zu';
  const teile = [];
  let start = indizes[0], prev = indizes[0];
  for (const i of indizes.slice(1)) {
    if (i === prev + 1) { prev = i; continue; }
    teile.push([start, prev]); start = prev = i;
  }
  teile.push([start, prev]);
  return teile.map(([a, b]) =>
    b - a >= 2 ? `${TAGE[a]}–${TAGE[b]}` : b === a ? TAGE[a] : `${TAGE[a]}, ${TAGE[b]}`
  ).join(', ');
}

/**
 * Wertet einen opening_hours-Ausdruck aus.
 * Prüft je Wochentag die nächsten vier Vorkommen und entscheidet per Mehrheit,
 * damit einzelne Feiertage oder Ausnahmen das Ergebnis nicht verfälschen.
 */
function ruhetage(ausdruck, { bundesland, jetzt } = {}) {
  if (!ausdruck || !ausdruck.trim()) return { ruhetag: '', ok: true, grund: 'kein Eintrag' };
  let oh;
  try {
    oh = new OpeningHours(ausdruck, nominatimStub(bundesland), { tag_key: 'opening_hours' });
  } catch (e) {
    return { ruhetag: null, ok: false, grund: String(e.message || e).slice(0, 90) };
  }

  const basis = jetzt ? new Date(jetzt) : new Date();
  basis.setHours(0, 0, 0, 0);

  const zu = [];
  for (let wt = 0; wt < 7; wt++) {
    let offen = 0, geprueft = 0;
    for (let w = 0; w < 4; w++) {
      const tag = new Date(basis);
      // (getDay(): 0 = Sonntag) auf Mo=0 umrechnen
      const delta = (wt - ((basis.getDay() + 6) % 7) + 7) % 7;
      tag.setDate(basis.getDate() + delta + w * 7);
      const ende = new Date(tag); ende.setDate(tag.getDate() + 1);
      let iv;
      try { iv = oh.getOpenIntervals(tag, ende); }
      catch (e) { return { ruhetag: null, ok: false, grund: String(e.message || e).slice(0, 90) }; }
      geprueft++;
      if (iv && iv.length) offen++;
    }
    if (geprueft && offen * 2 <= geprueft) zu.push(wt);
  }
  // Unvollständige Ausdrücke wie "Tu off" sagen nur, wann zu ist, nie wann offen.
  // opening_hours wertet den Rest als geschlossen -> die ganze Woche wäre zu.
  if (zu.length === 7 && !/^\s*(off|closed)\s*$/i.test(ausdruck)) {
    const explizit = [];
    const re = /([A-Za-z]{2}(?:\s*[-–]\s*[A-Za-z]{2})?(?:\s*,\s*[A-Za-z]{2})*)\s+(?:off|closed)/gi;
    let m;
    while ((m = re.exec(ausdruck)) !== null) {
      for (const stueck of m[1].split(',')) {
        const grenzen = stueck.trim().split(/\s*[-–]\s*/).map(x => TAGE.indexOf(
          x.trim().replace(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/i, t => (
            { mo: 'Mo', tu: 'Di', we: 'Mi', th: 'Do', fr: 'Fr', sa: 'Sa', su: 'So' }[t.toLowerCase()]
          ))));
        if (grenzen.some(i => i < 0)) continue;
        if (grenzen.length === 2) {
          for (let i = grenzen[0]; i <= grenzen[1]; i++) explizit.push(i);
        } else {
          explizit.push(grenzen[0]);
        }
      }
    }
    const eindeutig = [...new Set(explizit)].sort((a, b) => a - b);
    return {
      ruhetag: fasseZusammen(eindeutig),
      ok: false,
      unvollstaendig: true,
      grund: 'Ausdruck nennt nur Ruhetage, keine Öffnungszeiten'
    };
  }

  return { ruhetag: fasseZusammen(zu), ok: true, grund: '' };
}

module.exports = { ruhetage, TAGE };
