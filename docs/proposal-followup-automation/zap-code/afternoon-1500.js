/**
 * CPR Group - Proposal follow-up journey
 * AFTERNOON RUN - 15:00 Australia/Brisbane, Monday to Friday
 *
 * Zapier app:  Code by Zapier  ->  Run JavaScript
 * Position:    Step 3 (after Schedule trigger and the Zoho CRM search)
 *
 * WHAT THIS STEP DOES
 *   Catches the Day 2 and Day 3 deals where nothing has been recorded against
 *   the deal yet today, and returns a short Cliq message for each. This is the
 *   "did you get to it?" nudge, not a second full reminder.
 *
 *   Day 4 has no afternoon nudge. The Day 4 morning email is already the
 *   escalation, and following it with a chat message the same afternoon would be
 *   the nagging the team specifically asked us to avoid.
 *
 * THE SAME-DAY ACTIVITY TEST
 *   This was flagged in the planning meeting as the trickiest part of the build.
 *   It is resolved here without any cross-Zap state: this run simply re-reads
 *   Last_Activity_Time and compares its Brisbane date to today. If a consultant
 *   logged anything against the deal since the 08:00 email, the nudge is
 *   suppressed. Nothing needs to be remembered between the two runs.
 *
 * REQUIRED INPUT DATA
 *   payload  ->  the raw response body of the Zoho CRM search step
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

var BRISBANE_OFFSET_MINUTES = 600;
var CRM_DEAL_URL = 'https://crm.zoho.com.au/crm/org691602767/tab/Potentials/';
var GO_LIVE_DATE = '2026-09-10';

// ---------------------------------------------------------------------------
// DATE HELPERS - keep in step with morning-0800.js
// ---------------------------------------------------------------------------

function toBrisbaneParts(value) {
  if (!value) return null;
  var bareDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (bareDate) {
    return [Number(bareDate[1]), Number(bareDate[2]) - 1, Number(bareDate[3])];
  }
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  var shifted = new Date(parsed.getTime() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

function brisbaneToday() {
  var shifted = new Date(Date.now() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

function compareParts(a, b) {
  return Date.UTC(a[0], a[1], a[2]) - Date.UTC(b[0], b[1], b[2]);
}

function businessDaysAfter(from, to) {
  var cursor = new Date(Date.UTC(from[0], from[1], from[2]));
  var end = Date.UTC(to[0], to[1], to[2]);
  var count = 0;
  var safety = 0;
  while (cursor.getTime() < end && safety < 400) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    var weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
    safety++;
  }
  return count;
}

function lookupName(field, fallback) {
  if (field && field.name) return field.name;
  return fallback;
}

function firstNameOf(fullName) {
  if (!fullName) return 'there';
  return String(fullName).trim().split(/\s+/)[0];
}

function readDeals(raw) {
  if (!raw) return [];
  var parsed = raw;
  if (typeof raw === 'string') {
    var text = raw.trim();
    if (!text) return [];
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(
        'Could not parse the Zoho search response as JSON. Check the "payload" ' +
        'input mapping. First 200 characters received: ' + text.slice(0, 200)
      );
    }
  }
  if (Array.isArray(parsed)) return parsed;
  return parsed.data || [];
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

var deals = readDeals(inputData.payload);
var today = brisbaneToday();
var goLive = toBrisbaneParts(GO_LIVE_DATE);
var due = [];
var suppressed = 0;

for (var i = 0; i < deals.length; i++) {
  var deal = deals[i];

  var clockStart = toBrisbaneParts(deal.Followup_Clock_Started);
  if (!clockStart) continue;
  if (compareParts(clockStart, goLive) < 0) continue;
  if (compareParts(clockStart, today) > 0) continue;

  var dayNumber = 1 + businessDaysAfter(clockStart, today);

  // Afternoon nudges exist for Day 2 and Day 3 only.
  if (dayNumber !== 2 && dayNumber !== 3) continue;

  // Suppress if anything at all was recorded against the deal today.
  var lastActivity = toBrisbaneParts(deal.Last_Activity_Time);
  if (lastActivity && compareParts(lastActivity, today) === 0) {
    suppressed++;
    continue;
  }

  var organisation = lookupName(deal.Account_Name, 'this client');
  var consultantFirstName = firstNameOf(lookupName(deal.Owner, ''));

  var text = dayNumber === 2
    ? consultantFirstName + ', nothing is recorded yet today for ' + organisation +
      '. Please send the text message about the proposal, or update the deal if ' +
      'you have already been in touch. ' + CRM_DEAL_URL + deal.id
    : consultantFirstName + ', nothing is recorded yet today for ' + organisation +
      '. Please make the call and, if you do not reach them, send the follow-up ' +
      'email. Update the deal if you have already followed up. ' + CRM_DEAL_URL + deal.id;

  due.push({
    deal_id: deal.id,
    deal_name: deal.Deal_Name || 'Untitled deal',
    day_number: dayNumber,
    step: 'day' + dayNumber + '-pm',
    consultant_email: (deal.Owner && deal.Owner.email) ? deal.Owner.email : '',
    organisation: organisation,
    message: text
  });
}

var sendable = due.filter(function (d) { return d.consultant_email; });

console.log('Afternoon run: ' + deals.length + ' at Formal Quote Sent, ' +
  sendable.length + ' nudge(s) due, ' + suppressed + ' suppressed by same-day activity.');

if (sendable.length > 200) {
  console.log('WARNING: ' + sendable.length + ' nudges due, truncating to 200.');
  sendable = sendable.slice(0, 200);
}

// Parallel arrays, consumed by "Looping by Zapier". See the note in
// morning-0800.js for why this is not a plain array return.
function column(name) {
  return sendable.map(function (d) { return d[name]; });
}

return {
  due_count: sendable.length,
  suppressed_count: suppressed,
  examined_count: deals.length,
  consultant_email: column('consultant_email'),
  message: column('message'),
  deal_id: column('deal_id'),
  deal_name: column('deal_name'),
  day_number: column('day_number'),
  step: column('step')
};
