/**
 * CPR Group - Proposal follow-up reminder
 * Runs 08:00 Australia/Brisbane, Monday to Friday, once per deal
 *
 * Zapier app:  Code by Zapier -> Run JavaScript
 * Position:    Step 4, INSIDE the Looping step
 *
 * WHY IT SITS INSIDE THE LOOP
 *   Zapier's packaged "Find Module Entries" action exposes its results as line
 *   items, and mapping line items into a Code step flattens them into
 *   comma-separated strings. There is no way to hand the step the whole
 *   response. Looping first means this code sees one deal at a time as plain
 *   scalar values, which removes that whole class of problem.
 *
 * WHAT IT DOES
 *   Decides whether this one deal needs a follow-up today, and if so builds the
 *   email. Writes nothing to CRM. Never addresses a client.
 *
 * INPUT DATA - map each of these from the LOOP step, not from the search step
 *   deal_id              results[]entries[]id
 *   deal_name            results[]entries[]Deal_Name
 *   owner_id             results[]entries[]Owner_id
 *   owner_name           results[]entries[]Owner_name
 *   account_name         results[]entries[]Account_Name_name
 *   contact_name         results[]entries[]Contact_Name_name
 *   amount               results[]entries[]Amount
 *   date_proposal_sent   results[]entries[]Date_Proposal_Sent
 *   last_activity_time   results[]entries[]Last_Activity_Time
 *
 * OUTPUT
 *   send     'yes' or 'no'  -> the Filter step after this checks for 'yes'
 *   to, cc, subject, body   -> map these into the Gmail step
 *   reason                  -> why it was skipped, visible in Zap history
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

var BRISBANE_OFFSET_MINUTES = 600;   // UTC+10, Queensland has no daylight saving

// Proposals sent before this date never produce a reminder. This is the only
// thing keeping the 62 proposals already at Formal Quote Sent quiet. Set it to
// the day you switch on.
var GO_LIVE_DATE = '2026-09-10';

var ESCALATION_CC = 'nathan.butcher@cprgroup.com.au';
var CRM_DEAL_URL = 'https://crm.zoho.com.au/crm/org691602767/tab/Potentials/';

// The search action returns Owner_id and Owner_name but no email address, so
// the id has to be mapped here. Read from the CRM user list, 9 September 2026.
// KEEP CURRENT: an owner missing from this list gets no reminders at all,
// though the Zap history will name them.
var OWNER_EMAILS = {
  '4061076000000222013': 'michael@cprgroup.com.au',
  '4061076000001087001': 'steve@cprgroup.com.au',
  '4061076000001088001': 'chris@cprgroup.com.au',
  '4061076000014390001': 'matt@cprgroup.com.au',
  '4061076000038403001': 'scott@cprgroup.com.au',
  '4061076000000764001': 'courtney@cprgroup.com.au',
  '4061076000043863001': 'nathan.butcher@cprgroup.com.au',
  '4061076000002094001': 'jess@cprgroup.com.au',
  '4061076000039956001': 'joceli@cprgroup.com.au',
  '4061076000072395001': 'adrian.wright@cprgroup.com.au',
  '4061076000078172001': 'marcelle.carvalho@cprgroup.com.au',
  '4061076000072484005': 'patrisha@cprgroup.com.au',
  '4061076000072551001': 'gabriela.silva@cprgroup.com.au',
  '4061076000072561001': 'rafaela.ramos@cprgroup.com.au',
  '4061076000077269001': 'johnny.ramalho@cprgroup.com.au'
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function text(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toParts(value) {
  var v = text(value);
  if (!v) return null;
  var bare = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (bare && v.length === 10) {
    return [Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])];
  }
  var d = new Date(v);
  if (isNaN(d.getTime())) return null;
  var shifted = new Date(d.getTime() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

function todayParts() {
  var shifted = new Date(Date.now() + BRISBANE_OFFSET_MINUTES * 60000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()];
}

function compare(a, b) { return Date.UTC(a[0], a[1], a[2]) - Date.UTC(b[0], b[1], b[2]); }

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
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  return parts[2] + ' ' + months[parts[1]] + ' ' + parts[0];
}

function money(value) {
  var n = Number(text(value).replace(/[^0-9.\-]/g, ''));
  if (!n || isNaN(n)) return 'value not recorded';
  return '$' + n.toLocaleString('en-AU');
}

function skip(reason) {
  return { send: 'no', reason: reason, to: '', cc: '', subject: '', body: '', day_number: 0 };
}

// ---------------------------------------------------------------------------
// MAIN - one deal
// ---------------------------------------------------------------------------

var dealId = text(inputData.deal_id);
var dealName = text(inputData.deal_name) || 'Untitled deal';
var org = text(inputData.account_name) || 'client not recorded';
var contact = text(inputData.contact_name);
var ownerName = text(inputData.owner_name);
var ownerFirst = ownerName ? ownerName.split(/\s+/)[0] : 'there';

var sent = toParts(inputData.date_proposal_sent);
var today = todayParts();
var goLive = toParts(GO_LIVE_DATE);

// A proposal with no date cannot be counted. Say so in the log rather than
// failing quietly, so the gap is visible in Zap history.
if (!sent) {
  console.log('No proposal date on "' + dealName + '" (' + org + '), cannot track it. ' +
    CRM_DEAL_URL + dealId);
  return skip('no proposal date recorded');
}

if (compare(sent, goLive) < 0) return skip('proposal predates go-live');
if (compare(sent, today) > 0) return skip('proposal date is in the future');

var day = 1 + businessDaysAfter(sent, today);
if (day < 2 || day > 4) return skip('day ' + day + ' is outside the day 2 to 4 window');

// Anything recorded on a later day than the proposal went out counts as a
// follow-up. Same-day activity is not counted, because moving the deal into the
// stage updates Last_Activity_Time by itself.
var last = toParts(inputData.last_activity_time);
var followedUp = last && compare(last, sent) > 0;

// Days 2 and 3 are the plan for the day and go out regardless. Day 4 is the
// escalation, so it is suppressed as soon as anything has been recorded.
if (day === 4 && followedUp) return skip('day 4 escalation not needed, activity recorded');

var email = OWNER_EMAILS[text(inputData.owner_id)];
if (!email) {
  console.log('WARNING: no email address known for deal owner "' + ownerName +
    '" (id ' + text(inputData.owner_id) + '). They received nothing. Add them to OWNER_EMAILS.');
  return skip('no email address known for the deal owner');
}

var ACTION = {
  2: 'Please send them a short, personal text today to check it arrived. Adjust the wording to suit the conversation you had.',
  3: 'Please give them a call today. If you do not get through, leave a voicemail where that suits and send a short email straight afterwards.',
  4: 'Nothing has been recorded against this deal since the proposal went out. Please follow up today, or update the deal if you have already been in touch.'
};

var who = contact ? contact : 'the contact (none is linked to this deal in CRM)';

var lines = [
  'Hi ' + ownerFirst + ',',
  '',
  'Day ' + day + ' on the proposal for ' + org + '.',
  '',
  ACTION[day],
  '',
  'Contact: ' + who,
  'Deal: ' + dealName,
  'Value: ' + money(inputData.amount),
  'Proposal sent: ' + longDate(sent),
  CRM_DEAL_URL + dealId
];

if (day === 2) {
  lines.push('',
    'Suggested text message:',
    'Hi ' + (contact ? contact.split(/\s+/)[0] : 'there') + ', just checking that the ' +
      'proposal I sent through arrived all right. If you have any questions or would ' +
      'like to talk anything through, let me know. ' + ownerFirst);
}

if (day === 3) {
  lines.push('',
    'Suggested email if you do not reach them:',
    'Subject: Following up on the proposal',
    '',
    'Hi ' + (contact ? contact.split(/\s+/)[0] : 'there') + ',',
    '',
    'I tried to call you today to follow up on the proposal I sent through on ' +
      longDate(sent) + '. I wanted to make sure it reached you and to see whether you ' +
      'have any questions or need anything further from me.',
    '',
    'There is no rush if you are still working through it. Give me a call or reply to ' +
      'this email whenever suits.',
    '',
    'Thanks,',
    ownerFirst);
}

if (day === 4) {
  lines.push('',
    'Any one of these closes it off today:',
    '  - contact them and record it against the deal',
    '  - update the deal if you have already been in touch',
    '  - move the deal to Future Opportunity or Closed Lost if it is no longer live',
    '',
    'Nathan is copied so he can see where the proposal stands.');
}

lines.push('',
  'Recording your follow-up against the deal is what stops these reminders. The check',
  'reads only what is in CRM, so a conversation you have not logged looks the same as',
  'no contact at all.');

return {
  send: 'yes',
  reason: 'day ' + day,
  day_number: day,
  to: email,
  cc: day === 4 ? ESCALATION_CC : '',
  subject: (day === 4 ? 'Action required: ' : 'Proposal follow-up: ') + org,
  body: lines.join('\n')
};
