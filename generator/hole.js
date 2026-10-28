#!/usr/bin/env node
'use strict';
/**
 * Holt die Rohdaten für jede konfigurierte PLZ und legt sie unter roh/<plz>.json ab.
 * Läuft nur, wenn die Datei fehlt oder älter als --max-alter Tage ist (Vorgabe 25),
 * damit wiederholte Builds die öffentlichen Server nicht unnötig belasten.
 *
 *   node generator/hole.js            nur was veraltet ist
 *   node generator/hole.js --alle     alles neu
 *   node generator/hole.js 76337      nur diese PLZ
 */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const ORTE = JSON.parse(fs.readFileSync(path.join(WURZEL, 'orte.json'), 'utf8'));
const KENNUNG = 'essen-in-der-naehe/1.0 (+https://github.com/)';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

const args = process.argv.slice(2);
const alle = args.includes('--alle');
const nurPlz = args.filter(a => /^\d{5}$/.test(a));
const maxAlterTage = Number((args.find(a => a.startsWith('--max-alter=')) || '').split('=')[1] || 25);

const schlaf = ms => new Promise(r => setTimeout(r, ms));

async function hole(url, optionen = {}, versuche = 3) {
  for (let i = 1; i <= versuche; i++) {
    try {
      const antwort = await fetch(url, {
        ...optionen,
        headers: { 'User-Agent': KENNUNG, ...(optionen.headers || {}) },
      });
      if (antwort.status === 429 || antwort.status === 504) throw new Error('Server ausgelastet (' + antwort.status + ')');
      if (!antwort.ok) throw new Error('HTTP ' + antwort.status);
      return antwort;
    } catch (e) {
      if (i === versuche) throw e;
      const warten = 5000 * i;
      console.warn(`   Versuch ${i} fehlgeschlagen (${e.message}), neuer Versuch in ${warten / 1000}s`);
      await schlaf(warten);
    }
  }
}

/** PLZ zu Koordinaten, falls in orte.json keine Mitte hinterlegt ist. */
async function mitteSuchen(plz) {
  const url = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
    postalcode: plz, country: 'de', format: 'jsonv2', limit: '1',
  });
  const d = await (await hole(url)).json();
  if (!d.length) throw new Error(`Keine Koordinaten für PLZ ${plz} gefunden`);
  await schlaf(1100); // Nominatim erlaubt höchstens eine Anfrage pro Sekunde
  return [Number(d[0].lat), Number(d[0].lon)];
}

function abfrage(mitte, radius) {
  const um = `(around:${radius},${mitte[0]},${mitte[1]})`;
  return `[out:json][timeout:180];
(
  nwr[amenity~"^(restaurant|cafe|fast_food|pub|bar|ice_cream|biergarten)$"][name]${um};
  nwr[shop~"^(bakery|ice_cream|deli|confectionery)$"][name]${um};
);
out center tags;`;
}

function istVeraltet(datei) {
  if (!fs.existsSync(datei)) return true;
  const tage = (Date.now() - fs.statSync(datei).mtimeMs) / 864e5;
  return tage > maxAlterTage;
}

(async () => {
  const plzListe = (nurPlz.length ? nurPlz : Object.keys(ORTE));
  let geholt = 0;
  for (const plz of plzListe) {
    const ort = ORTE[plz];
    if (!ort) { console.error(`! ${plz} steht nicht in orte.json`); process.exitCode = 1; continue; }
    const ziel = path.join(WURZEL, 'roh', `${plz}.json`);
    if (!alle && !nurPlz.length && !istVeraltet(ziel)) {
      console.log(`${plz} ${ort.label}: Rohdaten aktuell, übersprungen`);
      continue;
    }
    const mitte = ort.mitte || await mitteSuchen(plz);
    console.log(`${plz} ${ort.label}: frage Overpass (${mitte.join(', ')}, ${ort.radius} m) …`);
    const antwort = await hole(OVERPASS, {
      method: 'POST',
      body: new URLSearchParams({ data: abfrage(mitte, ort.radius) }),
    });
    const daten = await antwort.json();
    if (!Array.isArray(daten.elements)) throw new Error('Unerwartete Antwort von Overpass');
    fs.writeFileSync(ziel, JSON.stringify(daten));
    console.log(`   ${daten.elements.length} Objekte -> roh/${plz}.json`);
    geholt++;
    if (plzListe.length > 1) await schlaf(4000); // Overpass nicht überrennen
  }
  console.log(geholt ? `\n${geholt} Ort(e) aktualisiert.` : '\nNichts zu tun.');
})().catch(e => { console.error('\nAbbruch:', e.message); process.exit(1); });
