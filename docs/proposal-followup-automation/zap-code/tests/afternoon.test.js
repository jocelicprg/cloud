const fs=require('fs');
const src=fs.readFileSync(require('path').join(__dirname,'../') + 'afternoon-1500.js','utf8');
const fn=new Function('inputData','console',src);
let fails=0;
function run(label, deals, nowIso, expect){
  const real=Date.now; Date.now=()=>new Date(nowIso).getTime();
  const logs=[]; const r=fn({payload:JSON.stringify({data:deals})},{log:m=>logs.push(m)});
  Date.now=real;
  const got=(r.deal_name||[]).map((n,i)=>`${n.slice(0,20)}|day${r.day_number[i]}`);
  if (r.due_count !== (r.deal_name||[]).length) throw new Error('due_count mismatch');
  const ok=JSON.stringify(got)===JSON.stringify(expect);
  console.log((ok?'PASS':'FAIL')+'  '+label);
  if(!ok){console.log('   expected '+JSON.stringify(expect)+'\n   got      '+JSON.stringify(got)); fails++;}
  return {r,logs};
}
function d(clock, lastActivity, name='Deal A', email='matt@cprgroup.com.au'){
  return {id:'111', Deal_Name:name, Owner:{name:'Matt McEwan',email}, Account_Name:{name:'Gympie United FC'},
          Contact_Name:{name:'Andrew Kruger'}, Followup_Clock_Started:clock, Last_Activity_Time:lastActivity};
}

// Proposal Tue 15 Sep. Afternoon run = 15:00 Brisbane = 05:00 UTC same day.
run('Day 2, no activity today -> nudge', [d('2026-09-15','2026-09-15T15:48:00+10:00')], '2026-09-16T05:00:00Z', ['Deal A|day2']);
run('Day 2, activity logged today -> suppressed', [d('2026-09-15','2026-09-16T09:30:00+10:00')], '2026-09-16T05:00:00Z', []);
run('Day 3, no activity today -> nudge', [d('2026-09-15','2026-09-16T09:30:00+10:00')], '2026-09-17T05:00:00Z', ['Deal A|day3']);
run('Day 3, activity logged today -> suppressed', [d('2026-09-15','2026-09-17T11:00:00+10:00')], '2026-09-17T05:00:00Z', []);
run('Day 4 -> NO afternoon nudge (escalation already sent)', [d('2026-09-15','2026-09-15T15:48:00+10:00')], '2026-09-18T05:00:00Z', []);
run('Day 1 -> no nudge', [d('2026-09-15',null)], '2026-09-15T05:00:00Z', []);
run('Weekend -> no nudge', [d('2026-09-18','2026-09-18T10:00:00+10:00')], '2026-09-19T05:00:00Z', []);
run('Legacy null clock -> excluded', [{...d('2026-09-15',null), Followup_Clock_Started:null}], '2026-09-16T05:00:00Z', []);
run('Pre go-live clock -> excluded', [d('2026-09-01',null)], '2026-09-02T05:00:00Z', []);
run('No owner email -> dropped', [d('2026-09-15','2026-09-15T15:00:00+10:00','Deal A',null)], '2026-09-16T05:00:00Z', []);

// Boundary: activity at 23:59 Brisbane yesterday must NOT suppress today.
run('Activity 23:59 yesterday does not suppress today', [d('2026-09-15','2026-09-15T23:59:00+10:00')], '2026-09-16T05:00:00Z', ['Deal A|day2']);
// Boundary: activity at 00:01 Brisbane today MUST suppress.
run('Activity 00:01 today suppresses', [d('2026-09-15','2026-09-16T00:01:00+10:00')], '2026-09-16T05:00:00Z', []);
// A UTC-formatted timestamp (Zoho can return Z form) must be shifted correctly.
// 2026-09-15T23:30:00Z = 2026-09-16 09:30 Brisbane -> counts as today.
run('UTC "Z" timestamp converted to Brisbane date', [d('2026-09-15','2026-09-15T23:30:00Z')], '2026-09-16T05:00:00Z', []);

const x=run('sample message', [d('2026-09-15','2026-09-15T15:48:00+10:00')], '2026-09-16T05:00:00Z', ['Deal A|day2']);
console.log('\n--- day 2 Cliq message ---\n'+x.r.message[0]);
console.log('\n--- log line ---\n'+x.logs.join('\n'));
console.log('\n'+(fails?fails+' FAILURE(S)':'ALL TESTS PASSED'));
process.exit(fails?1:0);
