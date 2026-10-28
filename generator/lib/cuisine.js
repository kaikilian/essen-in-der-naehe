'use strict';

/* OSM-cuisine-Werte -> [Anzeigename, Gruppe].
   Reihenfolge zählt: der erste Treffer im cuisine-Feld gewinnt. */
const MAP = [
  ['fine_dining',   ['Fine Dining',      'Gehoben']],
  ['sushi',         ['Sushi',            'Asiatisch']],
  ['japanese',      ['Japanisch',        'Asiatisch']],
  ['vietnamese',    ['Vietnamesisch',    'Asiatisch']],
  ['thai',          ['Thai',             'Asiatisch']],
  ['chinese',       ['Chinesisch',       'Asiatisch']],
  ['indian',        ['Indisch',          'Asiatisch']],
  ['asian',         ['Asiatisch',        'Asiatisch']],
  ['noodle',        ['Nudeln',           'Asiatisch']],
  ['kebab',         ['Kebap',            'Türkisch & Kebap']],
  ['turkish',       ['Türkisch',         'Türkisch & Kebap']],
  ['pizza',         ['Pizza',            'Italienisch & Pizza']],
  ['italian',       ['Italienisch',      'Italienisch & Pizza']],
  ['greek',         ['Griechisch',       'Griechisch & Mediterran']],
  ['tapas',         ['Tapas',            'Griechisch & Mediterran']],
  ['spanish',       ['Spanisch',         'Griechisch & Mediterran']],
  ['portuguese',    ['Portugiesisch',    'Griechisch & Mediterran']],
  ['mediterranean', ['Mediterran',       'Griechisch & Mediterran']],
  ['croatian',      ['Kroatisch',        'Osteuropäisch']],
  ['balkan',        ['Balkan',           'Osteuropäisch']],
  ['hungarian',     ['Ungarisch',        'Osteuropäisch']],
  ['mexican',       ['Mexikanisch',      'Sonstiges']],
  ['ethiopian',     ['Äthiopisch',       'Sonstiges']],
  ['african',       ['Afrikanisch',      'Sonstiges']],
  ['french',        ['Französisch',      'Gehoben']],
  ['steak_house',   ['Steak',            'Steak, Grill & BBQ']],
  ['barbecue',      ['BBQ',              'Steak, Grill & BBQ']],
  ['grill',         ['Grill',            'Steak, Grill & BBQ']],
  ['burger',        ['Burger',           'Imbiss & Grill']],
  ['chicken',       ['Hähnchen',         'Imbiss & Grill']],
  ['sausage',       ['Wurst',            'Imbiss & Grill']],
  ['fries',         ['Pommes',           'Imbiss & Grill']],
  ['sandwich',      ['Sandwich',         'Imbiss & Grill']],
  ['american',      ['Amerikanisch',     'Imbiss & Grill']],
  ['schnitzel',     ['Schnitzel',        'Deutsch & Badisch']],
  ['german',        ['Deutsch',          'Deutsch & Badisch']],
  ['regional',      ['Regional',         'Deutsch & Badisch']],
  ['local',         ['Regional',         'Deutsch & Badisch']],
  ['bavarian',      ['Bayrisch',         'Deutsch & Badisch']],
  ['seafood',       ['Fisch',            'Deutsch & Badisch']],
  ['ice_cream',     ['Eis',              'Café, Eis & Bäckerei']],
  ['cake',          ['Kuchen',           'Café, Eis & Bäckerei']],
  ['coffee_shop',   ['Kaffee',           'Café, Eis & Bäckerei']],
  ['breakfast',     ['Frühstück',        'Café, Eis & Bäckerei']],
  ['bakery',        ['Bäckerei',         'Café, Eis & Bäckerei']],
  ['international', ['International',    'Sonstiges']],
  ['vegetarian',    ['Vegetarisch',      'Sonstiges']],
  ['vegan',         ['Vegan',            'Sonstiges']],
];

/* Wenn cuisine fehlt, entscheidet die Art des Eintrags. */
const BY_KIND = {
  cafe:        ['Café',        'Café, Eis & Bäckerei'],
  ice_cream:   ['Eisdiele',    'Café, Eis & Bäckerei'],
  bakery:      ['Bäckerei',    'Café, Eis & Bäckerei'],
  deli:        ['Feinkost',    'Café, Eis & Bäckerei'],
  pub:         ['Kneipe',      'Kneipe & Bar'],
  bar:         ['Bar',         'Kneipe & Bar'],
  biergarten:  ['Biergarten',  'Kneipe & Bar'],
  fast_food:   ['Imbiss',      'Imbiss & Grill'],
  restaurant:  ['',            'Sonstiges'],
};

function klassifiziere(cuisine, kind) {
  const roh = (cuisine || '').toLowerCase().split(';').map(s => s.trim()).filter(Boolean);
  const namen = [];
  let gruppe = null;
  for (const wert of roh) {
    const treffer = MAP.find(([k]) => k === wert);
    if (!treffer) continue;
    const [anzeige, g] = treffer[1];
    if (anzeige && !namen.includes(anzeige)) namen.push(anzeige);
    if (!gruppe) gruppe = g;
  }
  const basis = BY_KIND[kind] || BY_KIND.restaurant;
  if (!gruppe) gruppe = basis[1];
  if (!namen.length && basis[0]) namen.push(basis[0]);
  // Imbiss bleibt Imbiss, auch wenn die Küche italienisch ist
  if (kind === 'fast_food' && gruppe === 'Sonstiges') gruppe = 'Imbiss & Grill';
  if ((kind === 'pub' || kind === 'bar' || kind === 'biergarten') && !roh.length) gruppe = 'Kneipe & Bar';
  return { kueche: namen.slice(0, 2).join(', ') || 'Unbekannt', gruppe };
}

module.exports = { klassifiziere, GRUPPEN: [...new Set(MAP.map(m => m[1][1]).concat(Object.values(BY_KIND).map(b => b[1])))] };
