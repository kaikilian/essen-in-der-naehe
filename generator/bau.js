#!/usr/bin/env node
'use strict';
/**
 * Baut aus roh/<plz>.json plus korrekturen/<plz>.json die fertige Seite nach web/.
 * Braucht kein Netz - läuft also auch offline und reproduzierbar.
 */
const fs = require('fs');
const path = require('path');
const { transform } = require('./lib/transform');
const { merge } = require('./lib/merge');

const WURZEL = path.join(__dirname, '..');
const p = (...t) => path.join(WURZEL, ...t);
const ORTE = JSON.parse(fs.readFileSync(p('orte.json'), 'utf8'));
const kuerzel = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const STAND = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

const orte = {};
let fehler = 0;

// Zahlenschlüssel sortiert JavaScript von sich aus aufsteigend - die gewünschte
// Reihenfolge steht deshalb als eigenes Feld in orte.json.
const reihenfolge = Object.entries(ORTE)
  .sort((a, b) => (a[1].reihenfolge ?? 99) - (b[1].reihenfolge ?? 99));

for (const [plz, cfg] of reihenfolge) {
  if (cfg.veroeffentlicht === false) { console.log(`${plz} ${cfg.label}: nicht veröffentlicht, übersprungen`); continue; }
  const rohDatei = p('roh', `${plz}.json`);
  if (!fs.existsSync(rohDatei)) {
    console.error(`! ${plz} ${cfg.label}: roh/${plz}.json fehlt — erst "npm run hole" laufen lassen`);
    fehler++; continue;
  }
  const roh = JSON.parse(fs.readFileSync(rohDatei, 'utf8')).elements;
  const { saetze, verworfen } = transform(roh, { mitte: cfg.mitte, bundesland: cfg.bundesland });

  const korrDatei = p('korrekturen', `${plz}.json`);
  const korr = fs.existsSync(korrDatei) ? JSON.parse(fs.readFileSync(korrDatei, 'utf8')) : {};
  const { saetze: fertig, bericht } = merge(saetze, korr);

  fs.writeFileSync(p('daten', `${plz}.json`), JSON.stringify(fertig, null, 1));
  // Schlüssel ist der Ortsname, nicht die PLZ: reine Zahlenschlüssel würde
  // JavaScript beim Serialisieren aufsteigend umsortieren, und als Anker in
  // der Adresse liest sich "#waldbronn" besser als "#76337".
  orte[kuerzel(cfg.label)] = {
    label: cfg.label, plz, origin: `${plz} ${cfg.label}`, mitte: cfg.mitte,
    intro: cfg.intro, kmnote: cfg.kmnote, rows: fertig,
  };

  const g = fertig.filter(s => s.geprueft).length;
  console.log(`${plz} ${cfg.label}: ${roh.length} roh -> ${fertig.length} Einträge, ${g} geprüft ` +
    `(${verworfen.ladenOhneSitz} Läden ohne Sitzplatz aussortiert)`);
  if (bericht.geaendert || bericht.ergaenzt || bericht.dubletten)
    console.log(`   Korrekturen: ${bericht.geaendert} geändert, ${bericht.ergaenzt} ergänzt, ${bericht.dubletten} Dubletten entfernt`);
  if (bericht.verwaist.length) {
    console.warn(`   ! ${bericht.verwaist.length} Korrektur(en) zeigen ins Leere — OSM-ID gibt es nicht mehr:`);
    bericht.verwaist.forEach(id => console.warn(`     ${id}`));
  }
}

if (!Object.keys(orte).length) { console.error('\nKein einziger Ort gebaut.'); process.exit(1); }

const vorlage = fs.readFileSync(p('generator', 'vorlage.html'), 'utf8');
const KOPF = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="Lokale rund um ${Object.values(orte).map(o => o.label).join(' und ')} - sortierbar nach Kueche, Note und Entfernung.">
<meta name="robots" content="noindex, nofollow">
<style>
:root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; font: 14px system-ui, -apple-system, "Segoe UI", sans-serif; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>
`;

let html = KOPF + vorlage
  .replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
  .replace('__PLACES__', JSON.stringify(orte))
  .replace('__STAND__', STAND);
html = html.replace('</style>\n\n<div class="wrap">', '</style>\n</head>\n<body>\n\n<div class="wrap">')
           .trimEnd() + '\n\n</body>\n</html>\n';

fs.mkdirSync(p('web'), { recursive: true });
fs.writeFileSync(p('web', 'index.html'), html);
console.log(`\nweb/index.html: ${Math.round(html.length / 1024)} KB, ${Object.keys(orte).length} Ort(e), Stand ${STAND}`);
if (fehler) process.exit(1);
