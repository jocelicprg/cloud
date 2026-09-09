/**
 * Runs daily-digest.js against a payload captured verbatim from Zapier's
 * "Find Module Entries" action on CPR Group's live Zoho CRM, 10 September 2026.
 * This is the shape the Zap will actually receive, flattened lookup fields and
 * all, so it catches the class of bug that unit tests with invented data miss.
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../daily-digest.js'), 'utf8');
const fn = new Function('inputData', 'console', src);
const payload = fs.readFileSync(path.join(__dirname, 'real-payload.json'), 'utf8');

let fails = 0;
function chk(label, cond, extra) {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + label);
  if (!cond) { fails++; if (extra !== undefined) console.log('   ' + extra); }
}
function run(nowIso) {
  const real = Date.now, logs = [];
  Date.now = () => new Date(nowIso).getTime();
  try { return { out: fn({ payload }, { log: m => logs.push(m) }), logs }; }
  finally { Date.now = real; }
}

// Brisbane 08:00 on Friday 11 September 2026.
let { out, logs } = run('2026-09-10T22:00:00Z');

chk('parses the results/entries envelope', out.examined === 10, 'examined=' + out.examined);
chk('resolves owner emails despite no email in the payload',
  out.to.every(e => /@cprgroup\.com\.au$/.test(e)), JSON.stringify(out.to));
chk('no unresolved owners', !logs.some(l => /no email address known/.test(l)),
  logs.filter(l => /no email/.test(l)).join(' '));
chk('warns that results hit the search cap', logs.some(l => /maximum Zapier returns/.test(l)));
// These names exist only as flattened Account_Name_name / Contact_Name_name
// keys in the real payload, so reading them proves the flattened handling.
chk('reads flattened Account_Name_name',
  out.body.join('\n').includes('Dogs of the Greater Sunshine Coast Agility Club') &&
  out.body.join('\n').includes('Townsville Sailing Club Inc'));
chk('reads flattened Contact_Name_name',
  out.body.join('\n').includes('Matt Mason'));
chk('never prints undefined or [object Object]',
  !/undefined|\[object Object\]/.test(out.body.join('\n') + out.subject.join('\n')));
chk('surfaces the two undated proposals',
  out.body.join('\n').includes('no proposal date'));

// Go-live guard: with GO_LIVE_DATE at 2026-09-10, the 26 August proposal must
// not produce anything.
chk('pre go-live proposal excluded',
  !out.body.join('\n').includes('Helensvale Cricket Club'));

chk('also exposes emails[] for loops wired that way',
  Array.isArray(out.emails) && out.emails.length === out.email_count &&
  out.emails.every(e => e.to && e.subject && e.body !== undefined));
chk('emails[] matches the parallel arrays',
  out.emails.every((e, i) => e.to === out.to[i] && e.subject === out.subject[i]));

console.log('\nemails: ' + out.email_count + ' -> ' + JSON.stringify(out.to));
console.log('\n--- ' + out.subject[0] + ' ---\n' + out.body[0]);
if (out.body[1]) console.log('\n--- ' + out.subject[1] + ' ---\n' + out.body[1]);
console.log('\nlog:\n  ' + logs.join('\n  '));

console.log('\n' + (fails ? fails + ' FAILURE(S)' : 'ALL TESTS PASSED'));
process.exit(fails ? 1 : 0);
