// Display helpers. Pure functions, unit-tested.

const UNITS = ["", "k", "M", "B", "T", "Qa", "Qi"];

/**
 * Format a (possibly fractional) number for display, abbreviating large values:
 *   42 -> "42", 1000 -> "1k", 1234 -> "1.2k", 1500000 -> "1.5M".
 * Values are floored first so partial fish never show.
 */
export function format(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);

  let tier = 0;
  let val = n;
  while (val >= 1000 && tier < UNITS.length - 1) {
    val /= 1000;
    tier++;
  }
  // Rounding to one decimal can push a value to "1000.0"; roll it up a tier
  // (e.g. 999999 -> "1M", not "1000k").
  if (Number(val.toFixed(1)) >= 1000 && tier < UNITS.length - 1) {
    val /= 1000;
    tier++;
  }
  return val.toFixed(1).replace(/\.0$/, "") + UNITS[tier];
}
