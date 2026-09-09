/**
 * Tests for per-deal-reminder.js, which runs inside the Looping step and so
 * receives one deal at a time as plain strings. Values below are taken from
 * real records in CPR Group's CRM, including the awkward ones.
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../per-deal-reminder.js'), 'utf8');
const fn = new Function('inputData', 'console', src);

let fails = 0;
function chk(label, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label);
  if (!cond) { fails++; if (extra !== undefined) console.log('   ' + extra); }
}
// Zapier hands Code steps strings, so every input is a string here on purpose.
function deal(over) {
  return Object.assign({
    deal_id: '4061076000092027006',
    deal_name: '2026 Constitution Review',
    owner_id: '4061076000001088001',            // Chris Kenward
    owner_name: 'Chris Kenward',
    account_name: 'Dogs of the Greater Sunshine Coast Agility Club',
    contact_name: 'Matt Mason',
    amount: '3500',
    date_proposal_sent: '2026-09-10',
    last_activity_time: '2026-09-10T08:27:07+10:00'
  }, over);
}
function run(input, nowIso) {
  const real = Date.now, logs = [];
  Date.now = () => new Date(nowIso).getTime();
  try { return { out: fn(input, { log: m => logs.push(m) }), logs }; }
  finally { Date.now = real; }
}
const at = d => d + 'T22:00:00Z';   // Brisbane 08:00 the following day

// --- day counting. 10 Sep 2026 is a Thursday. ------------------------------
chk('day 1 does not send', run(deal(), at('2026-09-09')).out.send === 'no');

let r = run(deal(), at('2026-09-10')).out;      // Fri 11 Sep
chk('day 2 sends', r.send === 'yes' && r.day_number === 2, r.reason);
chk('day 2 addresses the consultant, never the client', r.to === 'chris@cprgroup.com.au');
chk('day 2 includes suggested text', /Suggested text message/.test(r.body));
chk('day 2 does not copy Nathan', r.cc === '');

r = run(deal(), at('2026-09-13')).out;          // Mon 14 Sep, weekend skipped
chk('weekend skipped: monday is day 3', r.day_number === 3, 'day=' + r.day_number);
chk('day 3 includes suggested email', /Suggested email if you do not reach them/.test(r.body));

r = run(deal(), at('2026-09-14')).out;          // Tue 15 Sep
chk('day 4 escalates', r.day_number === 4 && r.cc === 'nathan.butcher@cprgroup.com.au');
chk('day 4 subject signals action', /^Action required:/.test(r.subject), r.subject);

chk('day 5 stops', run(deal(), at('2026-09-15')).out.send === 'no');

// --- activity suppression ---------------------------------------------------
chk('day 4 suppressed once something is logged',
  run(deal({ last_activity_time: '2026-09-11T09:00:00+10:00' }), at('2026-09-14')).out.send === 'no');
chk('day 3 still sends even with activity logged',
  run(deal({ last_activity_time: '2026-09-11T09:00:00+10:00' }), at('2026-09-13')).out.send === 'yes');

// --- go-live guard, protecting the 62-deal backlog --------------------------
chk('pre go-live proposal never sends',
  run(deal({ date_proposal_sent: '2025-04-02' }), at('2026-09-10')).out.send === 'no');
chk('2024 backlog proposal never sends',
  run(deal({ date_proposal_sent: '2024-08-12' }), at('2026-09-10')).out.send === 'no');

// --- real data-quality cases ------------------------------------------------
let res = run(deal({ date_proposal_sent: '' }), at('2026-09-10'));
chk('blank proposal date skips and is logged',
  res.out.send === 'no' && res.logs.some(l => /cannot track it/.test(l)));

r = run(deal({ contact_name: '' }), at('2026-09-10')).out;
chk('missing contact reads cleanly',
  /none is linked to this deal/.test(r.body) && !/undefined/.test(r.body));

res = run(deal({ owner_id: '9999999999' }), at('2026-09-10'));
chk('unknown owner is skipped and named in the log',
  res.out.send === 'no' && res.logs.some(l => /no email address known/.test(l)));

chk('zero amount reads sensibly',
  /value not recorded/.test(run(deal({ amount: '0' }), at('2026-09-10')).out.body));
chk('amount arriving with a currency symbol still parses',
  /\$3,500/.test(run(deal({ amount: '$3500.00' }), at('2026-09-10')).out.body));

// --- never leaks a client address -------------------------------------------
const all = ['2026-09-10', '2026-09-13', '2026-09-14'].map(d => run(deal(), at(d)).out);
chk('every email goes to a cprgroup.com.au address',
  all.every(o => /@cprgroup\.com\.au$/.test(o.to)));
chk('no client email address ever appears in To or Cc',
  all.every(o => !/matt mason/i.test(o.to + o.cc)));
chk('no placeholder leakage anywhere',
  all.every(o => !/undefined|\[object Object\]|\{\{/.test(o.subject + o.body)));

console.log('\n--- ' + all[0].subject + ' ---\n' + all[0].body);
console.log('\n--- day 4 ---\n' + all[2].body);
console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'ALL TESTS PASSED'));
process.exit(fails ? 1 : 0);
