'use strict';
const { klassifiziere } = require('./cuisine');
const { ruhetage } = require('./hours');
const { km } = require('./geo');

/** Welche OSM-Objekte wir überhaupt übernehmen. */
const ESSEN = new Set(['restaurant', 'cafe', 'fast_food', 'pub', 'bar', 'ice_cream', 'biergarten']);
const LADEN = new Set(['bakery', 'ice_cream', 'deli', 'confectionery']);

/* Bäckereien sind in OSM jeder Brotladen - allein um Waldbronn 61 Stück,
   darunter vierzehn Filialen derselben Kette. In eine Liste von Lokalen
   gehören nur die, wo man sich auch hinsetzen kann. Eisdielen immer. */
function ladenZaehlt(tags) {
  if (tags.shop === 'ice_cream') return true;
  return Boolean(
    tags.cuisine || tags.outdoor_seating || tags.seating || tags.indoor_seating ||
    /caf[eé]|kaffee|r\u00f6sterei|konditorei/i.test(tags.name || '')
  );
}

function art(tags) {
  if (tags.amenity && ESSEN.has(tags.amenity)) return tags.amenity;
  if (tags.shop && LADEN.has(tags.shop)) {
    if (!ladenZaehlt(tags)) return null;
    return tags.shop === 'confectionery' ? 'bakery' : tags.shop;
  }
  return null;
}

function telefon(tags) {
  let t = (tags.phone || tags['contact:phone'] || '').split(';')[0].trim();
  if (!t) return '';
  t = t.replace(/[()–-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.startsWith('+49')) t = '0' + t.slice(3).trim();
  else if (t.startsWith('0049')) t = '0' + t.slice(4).trim();
  return t.replace(/\s+/g, ' ').trim();
}

function website(tags) {
  let u = (tags.website || tags['contact:website'] || '').split(';')[0].trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

function ortsname(tags) {
  const stadt = tags['addr:city'] || '';
  const teil = tags['addr:suburb'] || '';
  if (stadt && teil && !stadt.includes(teil)) return `${stadt}-${teil}`;
  return stadt;
}

/**
 * Overpass-Elemente -> Datensätze für die Seite.
 * mitte: [lat, lon] als Bezugspunkt für die Luftlinie.
 */
function transform(elemente, { mitte, bundesland, jetzt } = {}) {
  const raus = [];
  const verworfen = { ohneName: 0, falscheArt: 0, ladenOhneSitz: 0, unvollstaendig: 0 };

  for (const el of elemente) {
    const tags = el.tags || {};
    const kind = art(tags);
    if (!kind) {
      if (tags.shop && LADEN.has(tags.shop)) verworfen.ladenOhneSitz++;
      else verworfen.falscheArt++;
      continue;
    }
    const name = (tags.name || '').trim();
    if (!name) { verworfen.ohneName++; continue; }

    const { kueche, gruppe } = klassifiziere(tags.cuisine, kind);
    const r = ruhetage(tags.opening_hours, { bundesland, jetzt });
    const tel = telefon(tags);
    const url = website(tags);

    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lon = el.lon != null ? el.lon : (el.center && el.center.lon);

    const satz = {
      id: `${el.type || 'node'}/${el.id}`,
      name,
      kueche,
      gruppe,
      note: null,
      tel,
      url,
      ruhetag: r.ruhetag || '',
      hinweis: '',
      ort: ortsname(tags),
      lat: lat != null ? Math.round(lat * 1e5) / 1e5 : null,
      lon: lon != null ? Math.round(lon * 1e5) / 1e5 : null,
      km: (mitte && lat != null && lon != null) ? Math.round(km(mitte, [lat, lon]) * 10) / 10 : null,
      liefert: /^(yes|only)$/i.test(tags.delivery || ''),
      geprueft: Boolean(tags.opening_hours) && Boolean(tel || url),
      unsicher: r.ok === false,
    };
    if (!satz.geprueft) verworfen.unvollstaendig++;
    raus.push(satz);
  }

  raus.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || a.name.localeCompare(b.name, 'de'));
  return { saetze: raus, verworfen };
}

module.exports = { transform, art };
