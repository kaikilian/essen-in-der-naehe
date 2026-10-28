<?php
/**
 * Nimmt Noten und Meldungen entgegen und schreibt daraus die öffentliche
 * gemeinschaft.json, die die Seite beim Laden holt.
 *
 * Keine Anmeldung, keine Moderation, kein Freitext - nur Zahlen und ein
 * Melde-Knopf. Damit lohnt sich Spam nicht, und es gibt nichts zu prüfen.
 */
declare(strict_types=1);

const ORDNER      = __DIR__ . '/daten';
const ROH         = ORDNER . '/stimmen.json';          // nicht öffentlich
const OEFFENTLICH = ORDNER . '/gemeinschaft.json';     // holt die Seite
const SALZ_DATEI  = ORDNER . '/.salz';                 // einmalig erzeugt
const MAX_PRO_IP_TAG = 60;
const ARTEN = ['note', 'geschlossen'];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['ping'])) {
    exit(json_encode(['ok' => true]));
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['fehler' => 'Nur POST.']));
}

$id   = (string)($_POST['id'] ?? '');
$art  = (string)($_POST['art'] ?? '');
$wert = $_POST['wert'] ?? null;

// OSM-IDs sehen so aus: node/123456, way/987, relation/42. Eigene Nachträge: hand/<name>
if (!preg_match('~^(node|way|relation|hand)/[A-Za-z0-9ä-üÄ-Ü_.-]{1,80}$~u', $id)) {
    http_response_code(400);
    exit(json_encode(['fehler' => 'Unbekannte Kennung.']));
}
if (!in_array($art, ARTEN, true)) {
    http_response_code(400);
    exit(json_encode(['fehler' => 'Unbekannte Art.']));
}
if ($art === 'note') {
    if ($wert === '' || $wert === null) {
        $wert = null;                       // Note zurückziehen
    } else {
        $wert = (int)$wert;
        if ($wert < 1 || $wert > 5) {
            http_response_code(400);
            exit(json_encode(['fehler' => 'Note muss zwischen 1 und 5 liegen.']));
        }
    }
} else {
    $wert = 1;
}

@mkdir(ORDNER, 0775, true);

// Salz einmalig erzeugen: damit aus dem gespeicherten Schlüssel niemand
// die IP zurückrechnen kann.
if (!file_exists(SALZ_DATEI)) {
    file_put_contents(SALZ_DATEI, bin2hex(random_bytes(16)));
    @chmod(SALZ_DATEI, 0600);
}
$salz = trim((string)file_get_contents(SALZ_DATEI));
$ip   = (string)($_SERVER['REMOTE_ADDR'] ?? '');
$wer  = substr(hash('sha256', $salz . '|' . $ip), 0, 16);
$key  = substr(hash('sha256', $salz . '|' . $ip . '|' . $id . '|' . $art), 0, 20);

$griff = fopen(ROH, 'c+');
if (!$griff) { http_response_code(500); exit(json_encode(['fehler' => 'Speicher nicht erreichbar.'])); }
flock($griff, LOCK_EX);

$roh    = stream_get_contents($griff);
$daten  = $roh ? (json_decode($roh, true) ?: []) : [];
$heute  = date('Y-m-d');

$heuteVonIp = 0;
foreach ($daten as $k => $e) {
    if (($e['wer'] ?? '') === $wer && str_starts_with((string)($e['wann'] ?? ''), $heute)) $heuteVonIp++;
}
if ($heuteVonIp >= MAX_PRO_IP_TAG && !isset($daten[$key])) {
    flock($griff, LOCK_UN); fclose($griff);
    http_response_code(429);
    exit(json_encode(['fehler' => 'Für heute reicht es. Morgen gern wieder.']));
}

if ($art === 'note' && $wert === null) {
    unset($daten[$key]);
} else {
    $daten[$key] = ['id' => $id, 'art' => $art, 'wert' => $wert, 'wer' => $wer, 'wann' => date('c')];
}

// Zusammenfassen
$summe = [];
foreach ($daten as $e) {
    $eid = $e['id'];
    $summe[$eid] ??= ['noten' => [], 'geschlossen' => 0];
    if ($e['art'] === 'note') $summe[$eid]['noten'][] = (int)$e['wert'];
    else $summe[$eid]['geschlossen']++;
}
$oeffentlich = [];
foreach ($summe as $eid => $s) {
    $eintrag = [];
    if ($s['noten']) {
        $eintrag['schnitt'] = round(array_sum($s['noten']) / count($s['noten']), 1);
        $eintrag['anzahl']  = count($s['noten']);
    }
    if ($s['geschlossen'] > 0) $eintrag['geschlossen'] = $s['geschlossen'];
    if ($eintrag) $oeffentlich[$eid] = $eintrag;
}

ftruncate($griff, 0); rewind($griff);
fwrite($griff, json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
flock($griff, LOCK_UN); fclose($griff);

file_put_contents(OEFFENTLICH,
    json_encode(['stand' => date('c'), 'eintraege' => $oeffentlich],
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    LOCK_EX);

echo json_encode(['ok' => true, 'eintrag' => $oeffentlich[$id] ?? null]);
