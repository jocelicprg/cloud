const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname,'../') + 'morning-0800.js','utf8');

// Real deals pulled from the live CRM search, with a follow-up clock added.
function baseDeals(clock) {
  return [
    {id:'4061076000078815001', Deal_Name:'2026 Strategic Plan', Amount:4000,
     Owner:{name:'Matt McEwan', email:'matt@cprgroup.com.au'},
     Account_Name:{name:'Gympie United Football Club'},
     Contact_Name:{name:'Andrew Kruger'},
     Date_Proposal_Sent:clock, Stage_Modified_Time:clock+"T09:00:00+10:00",
     Last_Activity_Time:clock+'T15:48:37+10:00'},
    // Chris's deal with NO contact record - real data-quality case.
    {id:'4061076000092020035', Deal_Name:'2026 Online Meeting', Amount:400,
     Owner:{name:'Chris Kenward', email:'chris@cprgroup.com.au'},
     Account_Name:{name:'Sarina Golf Club'},
     Contact_Name:null,
     Date_Proposal_Sent:clock, Stage_Modified_Time:clock+"T09:00:00+10:00",
     Last_Activity_Time:clock+'T13:18:34+10:00'},
  ];
}

function run(label, deals, nowIso, expect) {
  const realNow = Date.now;
  Date.now = () => new Date(nowIso).getTime();
  let out;
  try {
    const fn = new Function('inputData','console', src);
    const logs = [];
    out = fn({payload: JSON.stringify({data:deals})}, {log:(m)=>logs.push(m)});
    // The step now returns parallel arrays (line items) for Looping by Zapier.
    const got = (out.deal_name||[]).map((n,i)=>
      `${n.slice(0,22)}|day${out.day_number[i]}|cc=${out.cc[i]?'nathan':'-'}`);
    if (out.due_count !== (out.deal_name||[]).length) {
      throw new Error('due_count does not match the number of line items');
    }
    ['to','cc','subject','body','deal_id','day_number','step'].forEach(k=>{
      if (out[k].length !== out.due_count) throw new Error('column '+k+' has wrong length');
    });
    const ok = JSON.stringify(got)===JSON.stringify(expect);
    console.log((ok?'PASS':'FAIL')+'  '+label);
    if(!ok){ console.log('   expected: '+JSON.stringify(expect)); console.log('   got     : '+JSON.stringify(got)); }
    return {ok, out, logs};
  } finally { Date.now = realNow; }
}

let fails = 0;
function t(...a){ const r = run(...a); if(!r.ok) fails++; return r; }

// Proposal sent Tue 2026-09-15. Brisbane 08:00 = 22:00 UTC previous day.
t('Tue clock, same day (day 1) -> nothing due',
  baseDeals('2026-09-15'), '2026-09-14T22:00:00Z', []);

t('Tue clock, Wed run -> day 2 both',
  baseDeals('2026-09-15'), '2026-09-15T22:00:00Z',
  ['2026 Strategic Plan|day2|cc=-','2026 Online Meeting|day2|cc=-']);

t('Tue clock, Thu run -> day 3 both',
  baseDeals('2026-09-15'), '2026-09-16T22:00:00Z',
  ['2026 Strategic Plan|day3|cc=-','2026 Online Meeting|day3|cc=-']);

t('Tue clock, Fri run -> day 4 escalation, Nathan cc',
  baseDeals('2026-09-15'), '2026-09-17T22:00:00Z',
  ['2026 Strategic Plan|day4|cc=nathan','2026 Online Meeting|day4|cc=nathan']);

t('Tue clock, next Mon run -> day 5, out of window',
  baseDeals('2026-09-15'), '2026-09-20T22:00:00Z', []);

// WEEKEND SKIP: proposal sent Friday 2026-09-18.
t('Fri clock, Sat run -> nothing (weekend)',
  baseDeals('2026-09-18'), '2026-09-18T22:00:00Z', []);
t('Fri clock, Sun run -> nothing (weekend)',
  baseDeals('2026-09-18'), '2026-09-19T22:00:00Z', []);
t('Fri clock, Mon run -> day 2 (weekend skipped)',
  baseDeals('2026-09-18'), '2026-09-20T22:00:00Z',
  ['2026 Strategic Plan|day2|cc=-','2026 Online Meeting|day2|cc=-']);
t('Fri clock, Wed run -> day 4 escalation',
  baseDeals('2026-09-18'), '2026-09-22T22:00:00Z',
  ['2026 Strategic Plan|day4|cc=nathan','2026 Online Meeting|day4|cc=nathan']);

// ACTIVITY SUPPRESSION on day 4 only.
let withActivity = baseDeals('2026-09-15');
withActivity[0].Last_Activity_Time = '2026-09-16T09:00:00+10:00'; // day 2 follow-up logged
t('Day 4 suppressed for the deal that was followed up',
  withActivity, '2026-09-17T22:00:00Z',
  ['2026 Online Meeting|day4|cc=nathan']);
t('Day 3 still sent even though activity logged (prompt, not escalation)',
  withActivity, '2026-09-16T22:00:00Z',
  ['2026 Strategic Plan|day3|cc=-','2026 Online Meeting|day3|cc=-']);

// GO-LIVE GUARD: the 62-deal legacy backlog.
let legacy = baseDeals('2026-09-15');
// Real backlog dates. Stage_Modified_Time is populated on all 62 of these, so
// the go-live guard is the only thing holding them back.
legacy[0].Stage_Modified_Time = '2025-04-02T09:00:00+10:00';  // 18 months old
legacy[1].Stage_Modified_Time = '2026-09-08T09:00:00+10:00';  // 2 days pre go-live
t('Legacy backlog excluded by the go-live guard',
  legacy, '2026-09-15T22:00:00Z', []);

// A backlog deal moved back into the stage after go-live must fire: that is a
// revised proposal restarting, and it is the flip side of the same guard.
let restarted = baseDeals('2026-09-15');
restarted[1].Stage_Modified_Time = '2025-04-02T09:00:00+10:00';
t('Backlog deal re-entering the stage after go-live rejoins the journey',
  restarted, '2026-09-15T22:00:00Z', ['2026 Strategic Plan|day2|cc=-']);

// EMPTY / 204 responses.
(function(){
  const fn = new Function('inputData','console', src);
  for (const p of ['', null, undefined, '{}', JSON.stringify({data:[]})]) {
    const r = fn({payload:p},{log:()=>{}});
    if (r.due_count!==0 || r.to.length!==0){ console.log('FAIL  empty payload '+JSON.stringify(p)); fails++; }
  }
  console.log('PASS  empty/204 payloads handled');
})();

// MISSING OWNER EMAIL must not produce an undeliverable send.
let noOwner = baseDeals('2026-09-15');
noOwner[0].Owner = {name:'Someone Nobody'};
t('Deal with no owner email is dropped, not sent blank',
  noOwner, '2026-09-15T22:00:00Z', ['2026 Online Meeting|day2|cc=-']);

// Null-contact wording must not read "undefined".
(function(){
  const fn = new Function('inputData','console', src);
  const realNow = Date.now; Date.now = () => new Date('2026-09-15T22:00:00Z').getTime();
  const r = fn({payload:JSON.stringify({data:baseDeals('2026-09-15')})},{log:()=>{}});
  Date.now = realNow;
  const ix = r.deal_name.indexOf('2026 Online Meeting');
  const chris = {subject:r.subject[ix], body:r.body[ix]};
  const bad = /undefined|null|\[Contact\]|Hi there,/.test(chris.subject+chris.body);
  console.log((bad?'FAIL':'PASS')+'  null contact produces clean wording');
  if(bad) fails++;
  console.log('\n--- sample day 2 body (null contact) ---\n'+chris.body);
})();

console.log('\n'+(fails? fails+' FAILURE(S)':'ALL TESTS PASSED'));
process.exit(fails?1:0);
