<?php
/**
 * Nimmt PLZ-Wünsche entgegen und hängt sie an anfragen.json.
 * Absichtlich klein gehalten: kein Framework, keine Datenbank, keine Cookies.
 */
declare(strict_types=1);

const DATEI       = __DIR__ . '/daten/anfragen.json';
const MAX_PRO_TAG = 40;   // gesamte Anfragen pro Tag, gegen Zumüllen
const MAX_GESAMT  = 500;

header('Content-Type: application/json; charset=utf-8');

// Die Seite fragt beim Laden kurz nach, ob es dieses Skript überhaupt gibt.
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['ping'])) {
    exit(json_encode(['ok' => true]));
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(['fehler' => 'Nur POST.']));
}

$plz = preg_replace('/\D/', '', (string)($_POST['plz'] ?? ''));
if (strlen($plz) !== 5) {
    http_response_code(400);
    exit(json_encode(['fehler' => 'Bitte eine fünfstellige Postleitzahl angeben.']));
}

// Freitext ist optional und wird hart gekürzt.
$notiz = mb_substr(trim((string)($_POST['notiz'] ?? '')), 0, 200);

@mkdir(dirname(DATEI), 0775, true);
$griff = fopen(DATEI, 'c+');
if (!$griff) {
    http_response_code(500);
    exit(json_encode(['fehler' => 'Konnte die Liste nicht öffnen.']));
}
flock($griff, LOCK_EX);

$roh    = stream_get_contents($griff);
$liste  = $roh ? (json_decode($roh, true) ?: []) : [];
$heute  = date('Y-m-d');
$anzahl = count(array_filter($liste, fn($e) => str_starts_with($e['wann'] ?? '', $heute)));

if ($anzahl >= MAX_PRO_TAG || count($liste) >= MAX_GESAMT) {
    flock($griff, LOCK_UN); fclose($griff);
    http_response_code(429);
    exit(json_encode(['fehler' => 'Heute kamen schon viele Wünsche herein. Bitte morgen nochmal.']));
}

foreach ($liste as &$e) {
    if (($e['plz'] ?? '') === $plz && ($e['status'] ?? '') === 'offen') {
        $e['stimmen'] = ($e['stimmen'] ?? 1) + 1;   // schon gewünscht: nur mitzählen
        $gefunden = true;
        break;
    }
}
unset($e);

if (empty($gefunden)) {
    $liste[] = [
        'plz'     => $plz,
        'notiz'   => $notiz,
        'wann'    => date('c'),
        'stimmen' => 1,
        'status'  => 'offen',
    ];
}

ftruncate($griff, 0);
rewind($griff);
fwrite($griff, json_encode($liste, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
flock($griff, LOCK_UN);
fclose($griff);

echo json_encode(['ok' => true, 'plz' => $plz]);
