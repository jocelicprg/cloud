/**
 * CPR Group - Proposal follow-up journey
 * DAY 1 - runs the moment a deal is moved to "Formal Quote Sent"
 *
 * Zapier app:  Code by Zapier  ->  Run JavaScript
 * Position:    Step 4, after the Catch Hook, the deal re-read and the Filter
 *
 * WHAT THIS STEP DOES
 *   Builds the Day 1 confirmation email. That is all it does.
 *
 *   This step writes NOTHING back to CRM. The journey clock is Zoho's own
 *   Stage_Modified_Time, which Zoho maintains for free, so there is no custom
 *   field to create and no field to stamp. That also removes two hazards: a
 *   write-back cannot re-trigger the workflow rule, and a consultant-entered
 *   Date_Proposal_Sent can never be overwritten.
 *
 *   The trade-off is that Stage_Modified_Time is populated on every deal
 *   already sitting at this stage, so the go-live date in the scheduled Zaps
 *   is what keeps the existing backlog out. See BUILD-SPEC.md section 1.
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
    'The proposal date on this deal is blank. It does not affect the reminders,',
    'which count from the stage change, but it does feed the weekly reporting,',
    'so it is worth filling in.'
  );
}

return {
  send: ownerEmail ? 'yes' : 'no',
  reason: ownerEmail ? 'ok' : 'Deal has no owner email, so no Day 1 email was sent.',
  contact_missing: contactName ? 'no' : 'yes',
  proposal_date_blank: deal.Date_Proposal_Sent ? 'no' : 'yes',
  deal_id: deal.id,
  to: ownerEmail,
  subject: 'Proposal follow-up started - ' + organisation,
  body: lines.join('\n')
};
