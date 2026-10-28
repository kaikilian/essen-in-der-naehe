# Essen in der Nähe

Erzeugt aus OpenStreetMap statische Seiten mit allen Lokalen rund um eine Postleitzahl —
sortierbar nach Küche, eigener Note und Entfernung, filterbar, ohne Tracking,
ohne externe Ressourcen zur Laufzeit.

Aktuell gebaut: **76337 Waldbronn** und **65510 Idstein**.

## Wie es läuft

```
orte.json          welche PLZ gebaut werden
   ↓  npm run hole      Nominatim + Overpass  →  roh/<plz>.json
   ↓  npm run bau       + korrekturen/<plz>.json  →  web/index.html
GitHub Action      lädt web/ per FTPS hoch
```

Der Abruf und der Bau sind getrennt. `bau` braucht kein Netz und liefert aus
denselben Rohdaten immer dasselbe Ergebnis. Die Rohdaten liegen im Repo, man
sieht im Verlauf also, was sich in OpenStreetMap geändert hat.

## Eine PLZ aufnehmen

1. Eintrag in `orte.json` anlegen:

```json
"65183": {
  "label": "Wiesbaden",
  "mitte": [50.0825, 8.2400],
  "radius": 8000,
  "bundesland": "Hessen",
  "intro": "in Wiesbaden und Umgebung. Spaltenkopf antippen zum Sortieren.",
  "kmnote": "Entfernung ist Luftlinie, keine Fahrzeit.",
  "reihenfolge": 3,
  "veroeffentlicht": true
}
```

`mitte` darf fehlen, dann sucht `hole.js` die Koordinaten über Nominatim.
Eigene Koordinaten sind aber besser, weil der PLZ-Mittelpunkt oft neben dem
Ortskern liegt. `veroeffentlicht: false` baut den Ort nicht mit — praktisch,
solange man die Korrekturen noch sammelt.

2. `npm run alles` lokal laufen lassen, `web/index.html` im Browser prüfen.
3. Committen und pushen. Die Action baut und lädt hoch.

## Korrekturen

`korrekturen/<plz>.json` wird beim Bauen über die OSM-Daten gelegt. Das ist der
Teil, der mit der Zeit wertvoll wird — OpenStreetMap kennt rund 10 bis 15 Prozent
der Lokale nicht und ist stellenweise veraltet.

```json
{
  "eintraege": {
    "node/123456": { "name": "Dönerbar", "hinweis": "früher Orient Kebap" },
    "node/234567": { "loeschen": true, "warum": "hat 2025 zugemacht" },
    "node/345678": { "dublette_von": "node/123456" }
  },
  "zusaetzlich": [
    { "name": "Beef Republic", "kueche": "BBQ, Steak", "gruppe": "Steak, Grill & BBQ",
      "ort": "Karlsbad-Ittersbach", "tel": "0173 6832961", "ruhetag": "Mo", "km": 5.3 }
  ]
}
```

Überschreibbar sind `name`, `kueche`, `gruppe`, `note`, `tel`, `url`, `ruhetag`,
`hinweis`, `ort`, `km`, `liefert`, `geprueft`. Zeigt eine Korrektur auf eine
OSM-ID, die es nicht mehr gibt, warnt der Bau — dann wurde das Objekt in OSM
gelöscht oder neu angelegt.

Die OSM-ID findet man am schnellsten über `daten/<plz>.json` oder auf
openstreetmap.org am Objekt selbst.

## Einrichtung

**GitHub Secrets** (Settings → Secrets and variables → Actions):

| Name | Inhalt |
|---|---|
| `FTP_HOST` | FTP-Server des Hosters |
| `FTP_USER` | FTP-Benutzer |
| `FTP_PASS` | FTP-Passwort |

Optional als *Variable* `FTP_ZIEL`, Vorgabe `/essen`.

**Auf dem Webspace**, falls Besucher PLZ wünschen können sollen: den Inhalt von
`hosting/` einmalig hochladen. `anfrage.php` sammelt die Wünsche in
`daten/anfragen.json`, `admin/` zeigt sie an. Den Verzeichnisschutz für `admin/`
legt man bei Alfahosting am einfachsten im Kundenmenü an — der erzeugt `.htpasswd`
und trägt den absoluten Pfad ein. Ohne `anfrage.php` blendet die Seite das
Wunschformular einfach aus.

Der Übernehmen-Schritt bleibt Handarbeit: PLZ in `orte.json` eintragen, pushen.
Das ist Absicht — so entscheidet ein Mensch, was auf der Seite landet.

## Was die Seite kann

Sortieren nach jeder Spalte, Volltextsuche, Filter nach Küchengruppe, Umkreis,
Lieferdienst und „heute geöffnet“. Die **Note** vergibt jeder Besucher selbst,
sie liegt in `localStorage` und geht an niemanden. Ruhetage werden aus den
OSM-Öffnungszeiten gerechnet, inklusive Saisonregeln. Routenlinks gehen wahlweise
zu Google Maps oder OpenStreetMap.

Die Seite ist eine einzige HTML-Datei ohne Abhängigkeiten zur Laufzeit —
keine Schriften, keine Skripte, keine Zählpixel von außen.

## Rücksicht auf die Datenquellen

Nominatim und Overpass sind von Freiwilligen bezahlte Infrastruktur.
`hole.js` hält sich deshalb zurück: eine Nominatim-Anfrage pro Sekunde,
vier Sekunden Pause zwischen zwei Overpass-Abfragen, eigener User-Agent,
Wiederholung mit wachsendem Abstand. Rohdaten älter als 25 Tage werden neu
geholt, alles andere nicht. Wer viele PLZ baut, sollte über einen eigenen
Overpass-Server nachdenken.

Kartendaten © OpenStreetMap-Mitwirkende, Lizenz ODbL. Die Attribution steht
im Fuß jeder erzeugten Seite und muss dort bleiben.

## Lizenz

MIT für den Code. Die Daten gehören OpenStreetMap und stehen unter ODbL.
