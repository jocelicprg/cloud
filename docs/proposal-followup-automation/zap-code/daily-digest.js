/**
 * CPR Group - Proposal follow-up digest
 * Runs 08:00 Australia/Brisbane, Monday to Friday
 *
 * Zapier app:  Code by Zapier  ->  Run JavaScript
 * Position:    Step 3, after the Schedule trigger and the Zoho CRM search
 *
 * WHAT THIS DOES
 *   Reads every deal sitting at "Formal Quote Sent", works out which ones need
 *   a follow-up today, and returns one ready-to-send email per consultant.
 *   A consultant with nothing due gets nothing.
 *
 *   One email per person per morning, not one per deal. On the busiest day
 *   observed in the last ten weeks a consultant would receive a single email
 *   listing three proposals.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *   No writes to CRM. No custom fields. No webhooks. Nothing reaches a client.
 *
 * REQUIRED INPUT DATA
 *   payload  ->  the raw response body of the Zoho CRM "Find Module Entries" step
 *
 * RETURNS
 *   Parallel arrays (line items) for "Looping by Zapier", which the Gmail step
 *   sits inside. An array of objects would be Zapier's documented fan-out, but
 *   it is reported to process only the first item, which here would mean
 *   silently skipping consultants.
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

// Fixed UTC+10:00. Queensland has no daylight saving.
var BRISBANE_OFFSET_MINUTES = 600;

// Proposals sent before this date are ignored entirely. This is what keeps the
// 62 deals already sitting at Formal Quote Sent from being emailed about on the
// first morning. Set it to the day you switch on.
var GO_LIVE_DATE = '2026-09-10';

// Copied in when a proposal has gone four business days with nothing recorded.
var ESCALATION_CC = 'nathan.butcher@cprgroup.com.au';

var CRM_DEAL_URL = 'https://crm.zoho.com.au/crm/org691602767/tab/Potentials/';

// What to prompt on each business day after the proposal went out.
var PLAN = {
  2: 'Send a short, personal text to check it arrived.',
  3: 'Give them a call. If you do not get through, leave a voicemail and send a short email straight after.',
  4: 'Nothing has been recorded yet. Follow up today, or update the deal if you have already been in touch.'
};

// ---------------------------------------------------------------------------
// DATES - everything is Brisbane wall-clock
// ---------------------------------------------------------------------------

function toParts(value) {
  if (!value) return null;
  var bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (bare) return [Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])];
  var d = new Date(value);
  if (isNaN(d.getTime())) return null;
  var shifted = new Date(d.getTime() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

function today() {
  var shifted = new Date(Date.now() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

function compare(a, b) {
  return Date.UTC(a[0], a[1], a[2]) - Date.UTC(b[0], b[1], b[2]);
}

/** Business days strictly after `from`, up to and including `to`. */
function businessDaysAfter(from, to) {
  var cursor = new Date(Date.UTC(from[0], from[1], from[2]));
  var end = Date.UTC(to[0], to[1], to[2]);
  var n = 0, guard = 0;
  while (cursor.getTime() < end && guard < 400) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    var dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
    guard++;
  }
  return n;
}

function longDate(parts) {
  if (!parts) return 'no date recorded';
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  return parts[2] + ' ' + months[parts[1]] + ' ' + parts[0];
}

// ---------------------------------------------------------------------------
// FIELDS
// ---------------------------------------------------------------------------

function nameOf(field, fallback) {
  return (field && field.name) ? field.name : fallback;
}

function firstName(full) {
  return full ? String(full).trim().split(/\s+/)[0] : 'there';
}

function money(amount) {
  var n = Number(amount);
  if (!n || isNaN(n)) return 'value not recorded';
  return '$' + n.toLocaleString('en-AU');
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
      throw new Error('The Zoho response was not JSON. Check the "payload" input ' +
        'is mapped to the search step. First 200 characters: ' + text.slice(0, 200));
    }
  }
  if (Array.isArray(parsed)) return parsed;
  return parsed.data || [];
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

var deals = readDeals(inputData.payload);
var now = today();
var goLive = toParts(GO_LIVE_DATE);

// consultant email -> { name, due: [], undated: [] }
var byConsultant = {};

function bucket(deal) {
  var email = (deal.Owner && deal.Owner.email) ? deal.Owner.email : '';
  if (!email) return null;
  if (!byConsultant[email]) {
    byConsultant[email] = { name: firstName(nameOf(deal.Owner, '')), due: [], undated: [] };
  }
  return byConsultant[email];
}

var examined = 0, skipped = 0;

for (var i = 0; i < deals.length; i++) {
  var deal = deals[i];
  examined++;

  var org = nameOf(deal.Account_Name, 'client not recorded');
  var contact = nameOf(deal.Contact_Name, null);
  var sent = toParts(deal.Date_Proposal_Sent);

  // No proposal date means the clock cannot be counted. Rather than drop these
  // silently, list them so the consultant can fix the record.
  if (!sent) {
    var b0 = bucket(deal);
    if (b0) b0.undated.push({ org: org, name: deal.Deal_Name || 'Untitled deal', id: deal.id });
    continue;
  }

  if (compare(sent, goLive) < 0 || compare(sent, now) > 0) { skipped++; continue; }

  var day = 1 + businessDaysAfter(sent, now);
  if (day < 2 || day > 4) { skipped++; continue; }

  // Anything recorded on a later day than the proposal went out counts as a
  // follow-up. Same-day activity is not counted, because moving the deal into
  // the stage updates Last_Activity_Time by itself.
  var last = toParts(deal.Last_Activity_Time);
  var followedUp = last && compare(last, sent) > 0;

  // Days 2 and 3 are the plan for the day and go out regardless. Day 4 is an
  // escalation, so it only goes out if genuinely nothing has happened.
  if (day === 4 && followedUp) { skipped++; continue; }

  var b = bucket(deal);
  if (!b) { skipped++; continue; }

  b.due.push({
    day: day,
    org: org,
    contact: contact,
    name: deal.Deal_Name || 'Untitled deal',
    sent: longDate(sent),
    amount: money(deal.Amount),
    id: deal.id,
    escalate: day === 4
  });
}

// ---------------------------------------------------------------------------
// BUILD ONE EMAIL PER CONSULTANT
// ---------------------------------------------------------------------------

var to = [], cc = [], subject = [], body = [], counts = [];

Object.keys(byConsultant).forEach(function (email) {
  var c = byConsultant[email];
  if (!c.due.length && !c.undated.length) return;

  c.due.sort(function (a, b) { return b.day - a.day; });
  var escalating = c.due.some(function (d) { return d.escalate; });

  var lines = ['Hi ' + c.name + ','];

  if (c.due.length) {
    lines.push('',
      c.due.length === 1
        ? 'One proposal needs a follow-up today.'
        : c.due.length + ' proposals need a follow-up today.');

    c.due.forEach(function (d) {
      lines.push('',
        '- ' + d.org + (d.contact ? ' (' + d.contact + ')' : ' - no contact linked to this deal'),
        '  ' + d.name + ', ' + d.amount + ', sent ' + d.sent,
        '  Day ' + d.day + ': ' + PLAN[d.day],
        '  ' + CRM_DEAL_URL + d.id);
    });

    lines.push('',
      'Recording the follow-up against the deal is what stops the reminders. The',
      'check reads only what is in CRM, so a conversation you have not logged looks',
      'the same as no contact at all.');
  }

  if (c.undated.length) {
    lines.push('',
      'These proposals have no proposal date, so they cannot be tracked. Please add',
      'the date and they will join the follow-up list:');
    c.undated.forEach(function (u) {
      lines.push('- ' + u.org + ', ' + u.name + '  ' + CRM_DEAL_URL + u.id);
    });
  }

  if (escalating) {
    lines.push('', 'Nathan is copied on this one, because a proposal has gone four',
      'business days with nothing recorded.');
  }

  var subj = c.due.length
    ? (escalating ? 'Action required: ' : 'Proposal follow-ups today: ') +
      c.due.length + (c.due.length === 1 ? ' proposal' : ' proposals')
    : 'Proposals missing a proposal date';

  to.push(email);
  cc.push(escalating ? ESCALATION_CC : '');
  subject.push(subj);
  body.push(lines.join('\n'));
  counts.push(c.due.length);
});

console.log('Examined ' + examined + ' deals at Formal Quote Sent, skipped ' +
  skipped + ', emailing ' + to.length + ' consultant(s).');

return {
  email_count: to.length,
  examined: examined,
  to: to,
  cc: cc,
  subject: subject,
  body: body,
  due_count: counts
};
