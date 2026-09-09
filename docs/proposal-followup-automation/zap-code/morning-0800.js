/**
 * CPR Group - Proposal follow-up journey
 * MORNING RUN - 08:00 Australia/Brisbane, Monday to Friday
 *
 * Zapier app:  Code by Zapier  ->  Run JavaScript
 * Position:    Step 3 (after Schedule trigger and the Zoho CRM search)
 *
 * WHAT THIS STEP DOES
 *   Takes the list of deals currently sitting at "Formal Quote Sent", works out
 *   which business day of the follow-up journey each one is on, and returns one
 *   object per deal that needs a reminder today. Each object already contains
 *   the finished subject line, body and recipients, so the email step after this
 *   one is a straight field mapping with no branching.
 *
 * RETURN CONTRACT
 *   Returning an array makes Zapier run every following step once per element.
 *   Returning an empty array ends the run quietly, which is the normal outcome
 *   on a day when nothing is due.
 *
 * REQUIRED INPUT DATA (set these in the "Input Data" section of the step)
 *   payload  ->  the raw response body of the Zoho CRM search step
 *
 * DELIBERATELY NOT HANDLED HERE
 *   Exits for Won / Closed Lost / Future Opportunity need no code. The search
 *   in the previous step only ever returns deals at "Formal Quote Sent", so a
 *   deal that has moved on simply stops appearing and its journey stops.
 */

// ---------------------------------------------------------------------------
// CONFIG - safe to edit in the Zapier UI
// ---------------------------------------------------------------------------

// Fixed UTC+10:00. Queensland has no daylight saving.
var BRISBANE_OFFSET_MINUTES = 600;

// Escalation recipient for the Day 4 email.
var ESCALATION_CC = 'nathan.butcher@cprgroup.com.au';

// Used to build a clickable deal link. zgid verified via the Organization API.
var CRM_DEAL_URL = 'https://crm.zoho.com.au/crm/org691602767/tab/Potentials/';

// Nothing before this Brisbane date can start a journey. This is what keeps the
// 62 historical deals already sitting at "Formal Quote Sent" out of the
// automation. Leave it set to the go-live date.
var GO_LIVE_DATE = '2026-09-10';

// ---------------------------------------------------------------------------
// DATE HELPERS - all dates are Brisbane wall-clock dates
// ---------------------------------------------------------------------------

/** Convert anything date-ish into a Brisbane [year, monthIndex, day] triple. */
function toBrisbaneParts(value) {
  if (!value) return null;

  // A bare "2026-09-08" from a Zoho date field is already a Brisbane date.
  // Parsing it as UTC and shifting would roll it forward a day, so return as is.
  var bareDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (bareDate) {
    return [Number(bareDate[1]), Number(bareDate[2]) - 1, Number(bareDate[3])];
  }

  // Otherwise it is a full timestamp such as 2026-09-09T14:17:45+10:00.
  var parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  var shifted = new Date(parsed.getTime() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

/** Today's date in Brisbane, as a [year, monthIndex, day] triple. */
function brisbaneToday() {
  var shifted = new Date(Date.now() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

/** Compare two triples. Returns <0, 0 or >0. */
function compareParts(a, b) {
  return Date.UTC(a[0], a[1], a[2]) - Date.UTC(b[0], b[1], b[2]);
}

/** Count Monday-to-Friday days strictly after `from`, up to and including `to`. */
function businessDaysAfter(from, to) {
  var cursor = new Date(Date.UTC(from[0], from[1], from[2]));
  var end = Date.UTC(to[0], to[1], to[2]);
  var count = 0;
  // Guard against a runaway loop if a date is wildly wrong.
  var safety = 0;
  while (cursor.getTime() < end && safety < 400) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    var weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
    safety++;
  }
  return count;
}

/** Format a triple as "Tuesday 8 September 2026" for use in message bodies. */
function formatLongDate(parts) {
  if (!parts) return 'an unrecorded date';
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  var d = new Date(Date.UTC(parts[0], parts[1], parts[2]));
  return days[d.getUTCDay()] + ' ' + parts[2] + ' ' + months[parts[1]] + ' ' + parts[0];
}

// ---------------------------------------------------------------------------
// FIELD HELPERS - Zoho lookup fields arrive as {name, id} or null
// ---------------------------------------------------------------------------

function lookupName(field, fallback) {
  if (field && field.name) return field.name;
  return fallback;
}

function firstNameOf(fullName) {
  if (!fullName) return 'there';
  return String(fullName).trim().split(/\s+/)[0];
}

function formatAmount(amount) {
  var n = Number(amount);
  if (!n || isNaN(n)) return 'not recorded';
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// PARSE THE SEARCH RESPONSE
// ---------------------------------------------------------------------------

function readDeals(raw) {
  if (!raw) return [];
  var parsed = raw;
  if (typeof raw === 'string') {
    var text = raw.trim();
    // A search that matches nothing returns HTTP 204 with an empty body.
    if (!text) return [];
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(
        'Could not parse the Zoho search response as JSON. Check that the ' +
        '"payload" input is mapped to the raw response body of the search step. ' +
        'First 200 characters received: ' + text.slice(0, 200)
      );
    }
  }
  if (Array.isArray(parsed)) return parsed;
  return parsed.data || [];
}

// ---------------------------------------------------------------------------
// MESSAGE BUILDERS
// ---------------------------------------------------------------------------

function day2Email(ctx) {
  return {
    subject: 'Follow up today: ' + ctx.organisation + ' proposal',
    body: [
      'Hi ' + ctx.consultantFirstName + ',',
      '',
      'You sent a proposal to ' + ctx.contactFullName + ' at ' + ctx.organisation + ' on',
      ctx.sentDateLong + '. Today\'s step is a short, personal text message to confirm it',
      'arrived and to open the door to any questions.',
      '',
      'Please adjust the wording below to suit the conversation you had with them.',
      '',
      'Suggested text message:',
      'Hi ' + ctx.contactFirstName + ', just checking that the proposal I sent through arrived',
      'all right. If you have any questions or would like to talk anything through, let me',
      'know. ' + ctx.consultantFirstName,
      '',
      'Once you have sent it, record the activity against the deal. That is what stops the',
      'prompts.',
      '',
      'Deal: ' + ctx.dealName,
      'Value: ' + ctx.amount,
      'Deal record: ' + ctx.dealLink
    ].join('\n')
  };
}

function day3Email(ctx) {
  return {
    subject: 'Call today: ' + ctx.organisation + ' proposal',
    body: [
      'Hi ' + ctx.consultantFirstName + ',',
      '',
      'Today\'s step for ' + ctx.organisation + ' is a call to ' + ctx.contactFullName + '. The',
      'proposal went out on ' + ctx.sentDateLong + ', so the aim is to confirm it reached them,',
      'answer any questions and understand where they are up to.',
      '',
      'If you do not reach them, leave a voicemail where that is appropriate and send a short',
      'email straight afterwards. Suggested wording is below, and it is worth adjusting to',
      'sound like you.',
      '',
      'Suggested email:',
      'Subject: Following up on the proposal',
      '',
      'Hi ' + ctx.contactFirstName + ',',
      '',
      'I tried to call you today to follow up on the proposal I sent through on',
      ctx.sentDateLong + '. I wanted to make sure it reached you and to see whether you have',
      'any questions or need anything further from me.',
      '',
      'There is no rush if you are still working through it. Give me a call or reply to this',
      'email whenever suits.',
      '',
      'Thanks,',
      ctx.consultantFirstName,
      '',
      'Please record the call against the deal so the prompts stop.',
      '',
      'Deal: ' + ctx.dealName,
      'Value: ' + ctx.amount,
      'Deal record: ' + ctx.dealLink
    ].join('\n')
  };
}

function day4Email(ctx) {
  return {
    subject: 'Action required: ' + ctx.organisation + ' proposal follow-up',
    body: [
      'Hi ' + ctx.consultantFirstName + ',',
      '',
      'The proposal for ' + ctx.organisation + ' went out ' + ctx.daysSince + ' days ago and there is',
      'still no follow-up activity recorded against the deal.',
      '',
      'Deal: ' + ctx.dealName,
      'Contact: ' + ctx.contactFullName,
      'Proposal sent: ' + ctx.sentDateLong,
      'Value: ' + ctx.amount,
      'Deal record: ' + ctx.dealLink,
      '',
      'Any one of these closes it off today:',
      '  - contact ' + ctx.contactFirstName + ' and record it against the deal',
      '  - update the deal if you have already been in touch and it is not recorded yet',
      '  - move the deal to Future Opportunity or Closed Lost if it is no longer live.',
      '',
      'The check reads only what is recorded against the deal, so a conversation that has not',
      'been logged looks the same as no contact at all.',
      '',
      'Nathan Butcher is copied so he can see where the proposal stands. Once the deal is up',
      'to date, the prompts stop.'
    ].join('\n')
  };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

var deals = readDeals(inputData.payload);
var today = brisbaneToday();
var goLive = toBrisbaneParts(GO_LIVE_DATE);
var due = [];
var skipped = [];

for (var i = 0; i < deals.length; i++) {
  var deal = deals[i];

  // The journey clock. Written by the Day 1 Zap when the deal enters the stage.
  var clockStart = toBrisbaneParts(deal.Followup_Clock_Started);

  if (!clockStart) {
    // Every deal that pre-dates go-live falls in here and is ignored.
    skipped.push({ id: deal.id, reason: 'no follow-up clock set' });
    continue;
  }
  if (compareParts(clockStart, goLive) < 0) {
    skipped.push({ id: deal.id, reason: 'clock predates go-live' });
    continue;
  }
  if (compareParts(clockStart, today) > 0) {
    skipped.push({ id: deal.id, reason: 'clock is in the future' });
    continue;
  }

  // Day 1 is the day the proposal went out, so Day 2 is the next business day.
  var dayNumber = 1 + businessDaysAfter(clockStart, today);
  if (dayNumber < 2 || dayNumber > 4) {
    skipped.push({ id: deal.id, reason: 'day ' + dayNumber + ' is outside the 2-4 window' });
    continue;
  }

  var lastActivity = toBrisbaneParts(deal.Last_Activity_Time);

  // Any activity on a day AFTER the proposal went out counts as a follow-up.
  // Same-day activity is not counted, because moving the deal into the stage
  // updates Last_Activity_Time by itself and would mask a genuine miss.
  var hasFollowedUp = lastActivity && compareParts(lastActivity, clockStart) > 0;

  // Day 4 is an escalation, so it only goes out if nothing has happened at all.
  if (dayNumber === 4 && hasFollowedUp) {
    skipped.push({ id: deal.id, reason: 'day 4 escalation not needed, activity recorded' });
    continue;
  }

  var consultantName = lookupName(deal.Owner, '');
  // One deal at this stage currently has no linked contact, so the wording has
  // to degrade into something a person can still act on.
  var hasContact = !!(deal.Contact_Name && deal.Contact_Name.name);
  var contactFullName = hasContact
    ? deal.Contact_Name.name
    : 'the contact (none is linked to this deal in CRM)';

  var ctx = {
    dealName: deal.Deal_Name || 'Untitled deal',
    dealLink: CRM_DEAL_URL + deal.id,
    organisation: lookupName(deal.Account_Name, 'the client'),
    contactFullName: contactFullName,
    contactFirstName: hasContact ? firstNameOf(deal.Contact_Name.name) : 'the contact',
    consultantFirstName: firstNameOf(consultantName),
    amount: formatAmount(deal.Amount),
    // Prefer the consultant's own recorded proposal date; fall back to the clock.
    sentDateLong: formatLongDate(toBrisbaneParts(deal.Date_Proposal_Sent) || clockStart),
    daysSince: Math.round(
      (Date.UTC(today[0], today[1], today[2]) -
       Date.UTC(clockStart[0], clockStart[1], clockStart[2])) / 86400000
    )
  };

  var message =
    dayNumber === 2 ? day2Email(ctx) :
    dayNumber === 3 ? day3Email(ctx) :
                      day4Email(ctx);

  due.push({
    deal_id: deal.id,
    deal_name: ctx.dealName,
    day_number: dayNumber,
    step: 'day' + dayNumber + '-am',
    to: (deal.Owner && deal.Owner.email) ? deal.Owner.email : '',
    cc: dayNumber === 4 ? ESCALATION_CC : '',
    subject: message.subject,
    body: message.body,
    organisation: ctx.organisation,
    has_followed_up: hasFollowedUp ? 'yes' : 'no',
    contact_missing: (deal.Contact_Name ? 'no' : 'yes')
  });
}

// Anything without a deal owner email cannot be delivered. Surface it rather
// than letting the email step fail with an empty recipient.
var undeliverable = due.filter(function (d) { return !d.to; });
if (undeliverable.length) {
  console.log('Deals with no owner email, not sent: ' +
    undeliverable.map(function (d) { return d.deal_id; }).join(', '));
}
var sendable = due.filter(function (d) { return d.to; });

console.log('Morning run: ' + deals.length + ' at Formal Quote Sent, ' +
  sendable.length + ' reminder(s) due, ' + skipped.length + ' skipped.');
console.log(JSON.stringify(skipped));

// Guard against the documented 250-item ceiling on a Code step's output. At
// roughly 1.4 proposals a business day this can never be reached in practice,
// but truncating loudly beats failing silently.
if (sendable.length > 200) {
  console.log('WARNING: ' + sendable.length + ' reminders due, truncating to 200. ' +
    'Investigate before trusting this run.');
  sendable = sendable.slice(0, 200);
}

// RETURN SHAPE - please do not "simplify" this to `return sendable`.
//
// Returning an array of objects is Zapier's documented fan-out, but there are
// repeated reports of only the FIRST item being actioned, and this Zap must
// never drop a reminder. Parallel arrays are exposed to Zapier as line items,
// which "Looping by Zapier" consumes reliably. The email step lives inside the
// loop. See BUILD-SPEC.md section 4.
function column(name) {
  return sendable.map(function (d) { return d[name]; });
}

return {
  due_count: sendable.length,
  skipped_count: skipped.length,
  examined_count: deals.length,
  to: column('to'),
  cc: column('cc'),
  subject: column('subject'),
  body: column('body'),
  deal_id: column('deal_id'),
  deal_name: column('deal_name'),
  day_number: column('day_number'),
  step: column('step'),
  contact_missing: column('contact_missing')
};
