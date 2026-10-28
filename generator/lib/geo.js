'use strict';
/** Luftlinie in km zwischen zwei Punkten. */
function km(a, b) {
  const R = 6371, rad = d => d * Math.PI / 180;
  const p1 = rad(a[0]), p2 = rad(b[0]);
  const dp = p2 - p1, dl = rad(b[1] - a[1]);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
module.exports = { km };
