/**
 * CPR Group - Proposal follow-up journey
 * DAY 1 - runs the moment a deal is moved to "Formal Quote Sent"
 *
 * Zapier app:  Code by Zapier  ->  Run JavaScript
 * Position:    Step 4, after the Catch Hook, the deal re-read and the Filter
 *
 * WHAT THIS STEP DOES
 *   Starts the journey clock and builds the Day 1 confirmation email. The clock
 *   is what every later reminder counts from, and it is set here rather than
 *   inferred, for two reasons:
 *
 *   1. Date_Proposal_Sent is blank on 9 of the 62 deals currently at this stage,
 *      so keying the journey off it would silently skip roughly one proposal in
 *      seven.
 *   2. Writing the clock on each entry to the stage gives the "revised proposal
 *      restarts the journey" rule for free. Move a deal out of Formal Quote Sent
 *      and back in, and the clock resets to that day.
 *
 *   It also fills in Date_Proposal_Sent when the consultant left it blank. That
 *   is a free data-quality win for the weekly reporting, and it never overwrites
 *   a date a consultant has actually entered.
 *
 * REQUIRED INPUT DATA
 *   payload  ->  the raw response body of the "re-read the deal" GET step
 *
 * OUTPUT
 *   One object. The steps after this one map its fields directly.
 */

var BRISBANE_OFFSET_MINUTES = 600;
var CRM_DEAL_URL = 'https://crm.zoho.com.au/crm/org691602767/tab/Potentials/';
var EXPECTED_STAGE = 'Formal Quote Sent';

function brisbaneTodayIso() {
  var d = new Date(Date.now() + BRISBANE_OFFSET_MINUTES * 60000);
  var month = String(d.getUTCMonth() + 1);
  var day = String(d.getUTCDate());
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return d.getUTCFullYear() + '-' + month + '-' + day;
}

function formatLongDate(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return 'an unrecorded date';
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return days[d.getUTCDay()] + ' ' + Number(m[3]) + ' ' + months[Number(m[2]) - 1] + ' ' + m[1];
}

function lookupName(field, fallback) {
  if (field && field.name) return field.name;
  return fallback;
}

function formatAmount(amount) {
  var n = Number(amount);
  if (!n || isNaN(n)) return 'not recorded';
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function readDeal(raw) {
  if (!raw) throw new Error('No deal payload received. Check the "payload" input mapping.');
  var parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error('Deal payload was not valid JSON. First 200 characters: ' +
        String(raw).slice(0, 200));
    }
  }
  var list = parsed.data || (Array.isArray(parsed) ? parsed : [parsed]);
  if (!list.length) throw new Error('Deal payload contained no records.');
  return list[0];
}

// ---------------------------------------------------------------------------

var deal = readDeal(inputData.payload);
var today = brisbaneTodayIso();

// The Filter step should already have caught this. Checked again here because a
// consultant can move a deal on within the second or two the webhook takes.
if (deal.Stage !== EXPECTED_STAGE) {
  return {
    send: 'no',
    reason: 'Deal is at "' + deal.Stage + '", not "' + EXPECTED_STAGE + '". No journey started.',
    clock_date: '',
    set_proposal_date: '',
    to: '',
    subject: '',
    body: ''
  };
}

// Zoho is documented to deliver some webhooks twice. The clock field makes an
// idempotency check free: if it already reads today, this journey has started
// and a second Day 1 email would just be noise.
if (deal.Followup_Clock_Started === today) {
  return {
    send: 'no',
    reason: 'Journey already started today for this deal. Treating as a duplicate webhook.',
    clock_date: '',
    set_proposal_date: '',
    contact_missing: '',
    deal_id: deal.id,
    to: '',
    subject: '',
    body: ''
  };
}

var organisation = lookupName(deal.Account_Name, 'the client');
var contactName = lookupName(deal.Contact_Name, null);
var ownerName = lookupName(deal.Owner, '');
var ownerFirstName = ownerName ? String(ownerName).trim().split(/\s+/)[0] : 'there';
var ownerEmail = (deal.Owner && deal.Owner.email) ? deal.Owner.email : '';

// Only fill the proposal date when the consultant has left it blank.
var setProposalDate = deal.Date_Proposal_Sent ? '' : today;
var effectiveSentDate = deal.Date_Proposal_Sent || today;

var lines = [
  'Hi ' + ownerFirstName + ',',
  '',
  'The proposal for ' + organisation + ' is now marked as sent, so the follow-up',
  'reminders start from today.'
];

if (contactName) {
  lines.push('', 'Contact: ' + contactName);
} else {
  lines.push(
    '',
    'This deal has no contact linked to it. Please add the contact in CRM, otherwise',
    'the follow-up reminders cannot tell you who to call.'
  );
}

lines.push(
  'Deal: ' + (deal.Deal_Name || 'Untitled deal'),
  'Proposal sent: ' + formatLongDate(effectiveSentDate),
  'Value: ' + formatAmount(deal.Amount),
  CRM_DEAL_URL + deal.id,
  '',
  'Please take a moment to check the deal is complete and that you are the deal',
  'owner. The reminders go to whoever owns the deal, so if that is not you, the',
  'prompts will go to the wrong person.',
  '',
  'What happens next, on business days only:',
  '  Day 2  a reminder to send a short text message',
  '  Day 3  a reminder to call',
  '  Day 4  an escalation, only if nothing has been recorded against the deal',
  '',
  'Recording your follow-up against the deal is what stops the reminders.'
);

if (!deal.Date_Proposal_Sent) {
  lines.push(
    '',
    'Note: the proposal date was blank, so it has been set to today.'
  );
}

return {
  send: ownerEmail ? 'yes' : 'no',
  reason: ownerEmail ? 'ok' : 'Deal has no owner email, so no Day 1 email was sent.',
  clock_date: today,
  set_proposal_date: setProposalDate,
  contact_missing: contactName ? 'no' : 'yes',
  deal_id: deal.id,
  to: ownerEmail,
  subject: 'Proposal follow-up started - ' + organisation,
  body: lines.join('\n')
};
