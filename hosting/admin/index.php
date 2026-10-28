<?php
/**
 * Kleine Übersicht der offenen PLZ-Wünsche. Geschützt über .htaccess.
 * Ändert nichts am Repo - der Übernehmen-Schritt ist bewusst Handarbeit:
 * PLZ in orte.json eintragen, pushen, die Action baut und lädt hoch.
 */
declare(strict_types=1);
const DATEI = __DIR__ . '/../daten/anfragen.json';

$liste = file_exists(DATEI) ? (json_decode((string)file_get_contents(DATEI), true) ?: []) : [];

// Status umschalten (offen <-> erledigt <-> abgelehnt)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['plz'], $_POST['status'])) {
    foreach ($liste as &$e) {
        if (($e['plz'] ?? '') === $_POST['plz']) {
            $e['status'] = in_array($_POST['status'], ['offen', 'erledigt', 'abgelehnt'], true)
                ? $_POST['status'] : 'offen';
        }
    }
    unset($e);
    file_put_contents(DATEI, json_encode($liste, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    header('Location: ' . $_SERVER['PHP_SELF']);
    exit;
}

usort($liste, fn($a, $b) => [$a['status'] !== 'offen', -($a['stimmen'] ?? 1)]
                       <=> [$b['status'] !== 'offen', -($b['stimmen'] ?? 1)]);
$e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PLZ-Wünsche</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 52rem; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.4rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #ddd; vertical-align: top; }
  th { font-size: .78rem; text-transform: uppercase; letter-spacing: .05em; color: #666; }
  .plz { font: 600 1rem ui-monospace, monospace; }
  .status { font-size: .75rem; padding: .1rem .5rem; border-radius: 999px; background: #eee; }
  .offen { background: #fde9c8; }
  .erledigt { background: #d8ecd9; }
  button { font: inherit; font-size: .8rem; cursor: pointer; }
  p.hinweis { color: #666; font-size: .88rem; background: #f6f6f4; padding: .8rem 1rem; border-radius: 6px; }
</style>
</head>
<body>
<h1>PLZ-Wünsche</h1>
<p class="hinweis">Zum Übernehmen die PLZ in <code>orte.json</code> im Repo eintragen und pushen —
die Action holt die Daten und lädt die Seite hoch. Danach hier auf „erledigt“ setzen.</p>

<?php if (!$liste): ?>
  <p>Noch keine Wünsche eingegangen.</p>
<?php else: ?>
<table>
  <thead><tr><th>PLZ</th><th>Stimmen</th><th>Notiz</th><th>Eingegangen</th><th>Status</th><th></th></tr></thead>
  <tbody>
  <?php foreach ($liste as $w): ?>
    <tr>
      <td class="plz"><?= $e($w['plz'] ?? '') ?></td>
      <td><?= (int)($w['stimmen'] ?? 1) ?></td>
      <td><?= $e($w['notiz'] ?? '') ?></td>
      <td><?= $e(substr((string)($w['wann'] ?? ''), 0, 10)) ?></td>
      <td><span class="status <?= $e($w['status'] ?? 'offen') ?>"><?= $e($w['status'] ?? 'offen') ?></span></td>
      <td>
        <form method="post" style="display:flex;gap:.3rem">
          <input type="hidden" name="plz" value="<?= $e($w['plz'] ?? '') ?>">
          <button name="status" value="erledigt">erledigt</button>
          <button name="status" value="abgelehnt">ablehnen</button>
          <button name="status" value="offen">zurück</button>
        </form>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
<?php endif; ?>
</body>
</html>
