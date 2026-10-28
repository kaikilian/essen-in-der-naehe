'use strict';
/**
 * Legt die Korrekturdatei über die OSM-Rohdaten.
 *
 * Aufbau der Korrekturdatei:
 * {
 *   "eintraege": {
 *     "node/123": { "name": "Dönerbar", "hinweis": "früher Orient Kebap", "note": 4.5 },
 *     "node/456": { "loeschen": true, "warum": "gibt es nicht mehr" },
 *     "node/789": { "dublette_von": "node/123" }
 *   },
 *   "zusaetzlich": [
 *     { "name": "Napoli 2", "kueche": "Pizza", "gruppe": "Italienisch & Pizza", ... }
 *   ]
 * }
 */
const FELDER = ['name', 'kueche', 'gruppe', 'note', 'tel', 'url', 'ruhetag',
                'hinweis', 'ort', 'km', 'liefert', 'geprueft'];

function merge(saetze, korrektur = {}) {
  const eintraege = korrektur.eintraege || {};
  const bericht = { geaendert: 0, geloescht: 0, dubletten: 0, ergaenzt: 0, verwaist: [] };

  const bekannt = new Set(saetze.map(s => s.id));
  for (const id of Object.keys(eintraege)) {
    if (!bekannt.has(id)) bericht.verwaist.push(id);
  }

  const raus = [];
  for (const satz of saetze) {
    const k = eintraege[satz.id];
    if (!k) { raus.push(satz); continue; }
    if (k.loeschen) { bericht.geloescht++; continue; }
    if (k.dublette_von) { bericht.dubletten++; continue; }
    const neu = { ...satz, korrigiert: [] };
    for (const f of FELDER) {
      if (k[f] !== undefined && k[f] !== satz[f]) { neu[f] = k[f]; neu.korrigiert.push(f); }
    }
    if (neu.korrigiert.length) bericht.geaendert++;
    raus.push(neu);
  }

  for (const extra of (korrektur.zusaetzlich || [])) {
    raus.push({ id: extra.id || ('hand/' + (extra.name || '').toLowerCase().replace(/\W+/g, '-')),
                note: null, tel: '', url: '', ruhetag: '', hinweis: '', ort: '', km: null,
                liefert: false, geprueft: true, unsicher: false, vonHand: true, ...extra });
    bericht.ergaenzt++;
  }

  raus.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || a.name.localeCompare(b.name, 'de'));
  return { saetze: raus, bericht };
}
module.exports = { merge };
