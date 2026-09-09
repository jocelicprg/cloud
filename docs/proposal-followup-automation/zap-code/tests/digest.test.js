/**
 * Tests for daily-digest.js. No Zapier account, no network.
 *   node docs/proposal-followup-automation/zap-code/tests/digest.test.js
 * The clock is mocked so business-day arithmetic is checked against fixed dates.
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../daily-digest.js'), 'utf8');
const fn = new Function('inputData', 'console', src);

let fails = 0;
function chk(label, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label);
  if (!cond) { fails++; if (extra !== undefined) console.log('   ' + extra); }
}
function run(deals, nowIso) {
  const real = Date.now;
  Date.now = () => new Date(nowIso).getTime();
  try { return fn({ payload: JSON.stringify({ data: deals }) }, { log: () => {} }); }
  finally { Date.now = real; }
}
// Real records from the live CRM.
function deal(over) {
  return Object.assign({
    id: '4061076000091979025',
    Deal_Name: '2026 Bylaws Review',
    Stage: 'Formal Quote Sent',
    Amount: 3850,
    Owner: { name: 'Matt McEwan', email: 'matt@cprgroup.com.au' },
    Account_Name: { name: 'Woodford Golf Club' },
    Contact_Name: { name: 'Dean Dagan' },
    Date_Proposal_Sent: '2026-09-15',
    Last_Activity_Time: '2026-09-15T15:00:00+10:00'
  }, over);
}
// Brisbane 08:00 == 22:00 UTC the previous day.
const at = d => d + 'T22:00:00Z';

// --- day counting -----------------------------------------------------------
let r = run([deal()], at('2026-09-14'));           // proposal day itself
chk('day 1 sends nothing', r.email_count === 0);

r = run([deal()], at('2026-09-15'));
chk('day 2 emails the consultant', r.email_count === 1 && r.due_count[0] === 1);
chk('day 2 asks for a text message', /Day 2: Send a short, personal text/.test(r.body[0]));
chk('day 2 does not copy Nathan', r.cc[0] === '');

r = run([deal()], at('2026-09-16'));
chk('day 3 asks for a call', /Day 3: Give them a call/.test(r.body[0]));

r = run([deal()], at('2026-09-17'));
chk('day 4 escalates and copies Nathan', r.cc[0] === 'nathan.butcher@cprgroup.com.au');
chk('day 4 subject says action required', /^Action required/.test(r.subject[0]), r.subject[0]);

r = run([deal()], at('2026-09-20'));
chk('day 5 stops', r.email_count === 0);

// --- weekends ---------------------------------------------------------------
const fri = { Date_Proposal_Sent: '2026-09-18', Last_Activity_Time: '2026-09-18T15:00:00+10:00' };
chk('saturday sends nothing', run([deal(fri)], at('2026-09-18')).email_count === 0);
chk('sunday sends nothing', run([deal(fri)], at('2026-09-19')).email_count === 0);
r = run([deal(fri)], at('2026-09-20'));
chk('friday proposal reaches day 2 on monday', /Day 2/.test(r.body[0] || ''), r.body[0]);

// --- activity suppression ---------------------------------------------------
r = run([deal({ Last_Activity_Time: '2026-09-16T09:00:00+10:00' })], at('2026-09-17'));
chk('day 4 suppressed once a follow-up is logged', r.email_count === 0);
r = run([deal({ Last_Activity_Time: '2026-09-16T09:00:00+10:00' })], at('2026-09-16'));
chk('day 3 still sent - it is the plan, not a chase', r.email_count === 1);

// --- the 62-deal backlog ----------------------------------------------------
chk('backlog excluded by go-live date',
  run([deal({ Date_Proposal_Sent: '2025-04-02', Last_Activity_Time: '2026-09-14T09:00:00+10:00' })],
      at('2026-09-15')).email_count === 0);

// --- blank proposal date is surfaced, never dropped --------------------------
r = run([deal({ Date_Proposal_Sent: null })], at('2026-09-15'));
chk('undated proposal still emails the consultant', r.email_count === 1);
chk('undated proposal is named as untrackable', /no proposal date/.test(r.body[0]));
chk('undated-only email has no follow-up count', r.due_count[0] === 0);

// --- one email per consultant, not per deal ---------------------------------
r = run([
  deal(),
  deal({ id: '2', Deal_Name: '2026 Strategic Plan', Account_Name: { name: 'Gympie United FC' } }),
  deal({ id: '3', Deal_Name: '2026 Constitution Review', Account_Name: { name: 'Sarina Golf Club' },
         Owner: { name: 'Chris Kenward', email: 'chris@cprgroup.com.au' } })
], at('2026-09-15'));
chk('two consultants get one email each', r.email_count === 2, JSON.stringify(r.to));
const matt = r.to.indexOf('matt@cprgroup.com.au');
chk('matt gets both his proposals in one email', r.due_count[matt] === 2);
chk('subject counts the proposals', /2 proposals/.test(r.subject[matt]), r.subject[matt]);

// --- data quality edge cases ------------------------------------------------
r = run([deal({ Contact_Name: null })], at('2026-09-15'));
chk('missing contact is flagged, not printed as undefined',
  /no contact linked/.test(r.body[0]) && !/undefined/.test(r.body[0]));
chk('deal with no owner email is dropped',
  run([deal({ Owner: { name: 'Nobody' } })], at('2026-09-15')).email_count === 0);
chk('zero amount reads sensibly',
  /value not recorded/.test(run([deal({ Amount: 0 })], at('2026-09-15')).body[0]));

// --- malformed input --------------------------------------------------------
['', null, undefined, '{}', JSON.stringify({ data: [] })].forEach(p => {
  const out = fn({ payload: p }, { log: () => {} });
  if (out.email_count !== 0) { console.log('FAIL  empty payload ' + JSON.stringify(p)); fails++; }
});
console.log('PASS  empty and 204 payloads handled');
try { fn({ payload: 'not json' }, { log: () => {} }); chk('bad JSON throws', false); }
catch (e) { chk('bad JSON throws a clear error', /was not JSON/.test(e.message)); }

// --- sample output ----------------------------------------------------------
r = run([
  deal(),
  deal({ id: '9', Deal_Name: '2026 Strategic Plan', Account_Name: { name: 'Gympie United FC' },
         Date_Proposal_Sent: '2026-09-14', Last_Activity_Time: '2026-09-14T10:00:00+10:00' }),
  deal({ id: '7', Deal_Name: '2026 Online Meeting', Account_Name: { name: 'Sarina Golf Club' },
         Contact_Name: null, Date_Proposal_Sent: null })
], at('2026-09-17'));
console.log('\n--- subject ---\n' + r.subject[0] + '\n--- body ---\n' + r.body[0]);

console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'ALL TESTS PASSED'));
process.exit(fails ? 1 : 0);
