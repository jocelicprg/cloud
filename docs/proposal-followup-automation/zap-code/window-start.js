/**
 * CPR Group - Proposal follow-up journey
 * SHARED PRE-STEP for both scheduled Zaps
 *
 * Zapier app:  Code by Zapier  ->  Run JavaScript
 * Position:    Step 2, immediately after the Schedule trigger
 *
 * WHY THIS EXISTS
 *   The Zoho search needs a rolling lower bound on the follow-up clock, so that
 *   it returns only the handful of deals that could plausibly be inside the
 *   Day 2-4 window rather than every deal ever sent. Zapier cannot do date
 *   arithmetic inside a querystring field, so it is done here and referenced in
 *   the next step.
 *
 *   Ten days is deliberately generous for a four-business-day window. It absorbs
 *   long weekends and a Zap that was paused for a day or two, and it costs
 *   nothing because the main Code step re-checks the exact day number anyway.
 *
 * OUTPUT
 *   window_start  ->  e.g. "2026-08-30". Map this into the search criteria.
 *   today         ->  e.g. "2026-09-09". Handy when reading Zap history.
 */

var BRISBANE_OFFSET_MINUTES = 600;
var WINDOW_DAYS = 10;

function isoDate(ms) {
  var d = new Date(ms + BRISBANE_OFFSET_MINUTES * 60000);
  var month = String(d.getUTCMonth() + 1);
  var day = String(d.getUTCDate());
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return d.getUTCFullYear() + '-' + month + '-' + day;
}

var now = Date.now();

return {
  today: isoDate(now),
  window_start: isoDate(now - WINDOW_DAYS * 24 * 60 * 60 * 1000)
};
