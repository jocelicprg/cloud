const fs=require('fs');
const fn=new Function('inputData','console',fs.readFileSync(require('path').join(__dirname,'../') + 'day1-start-journey.js','utf8'));
let fails=0;
function chk(label, cond, extra){ console.log((cond?'PASS':'FAIL')+'  '+label); if(!cond){fails++; if(extra)console.log('   '+extra);} }
const real=Date.now; Date.now=()=>new Date('2026-09-14T23:00:00Z').getTime(); // 09:00 Brisbane 15 Sep

// Real record shape from GET /crm/v7/Deals/{id}
const base = {data:[{
  id:'4061076000091979025', Deal_Name:'2026 Bylaws Review', Stage:'Formal Quote Sent', Amount:3850,
  Owner:{name:'Matt McEwan', id:'x', email:'matt@cprgroup.com.au'},
  Account_Name:{name:'Woodford Golf Club', id:'y'},
  Contact_Name:{name:'Dean Dagan', id:'z'},
  Date_Proposal_Sent:'2026-09-08'
}]};
let r = fn({payload:JSON.stringify(base)},{log:()=>{}});
chk('sends when owner email present', r.send==='yes');
chk('writes nothing back to CRM', !('clock_date' in r) && !('set_proposal_date' in r));
chk('keeps consultant proposal date in body', r.body.includes('Tuesday 8 September 2026'));
chk('subject names the organisation', r.subject==='Proposal follow-up started - Woodford Golf Club', r.subject);
chk('no placeholder leakage', !/undefined|null|\[Contact\]|\{\{/.test(r.subject+r.body));

// Blank proposal date -> stamp it
let blank = JSON.parse(JSON.stringify(base)); blank.data[0].Date_Proposal_Sent=null;
r = fn({payload:JSON.stringify(blank)},{log:()=>{}});
chk('flags a blank proposal date without writing it', r.proposal_date_blank==='yes');
chk('explains the blank date does not affect reminders', r.body.includes('does not affect the reminders'));

// Missing contact -> prompt to fix, no "undefined"
let noContact = JSON.parse(JSON.stringify(base)); noContact.data[0].Contact_Name=null;
r = fn({payload:JSON.stringify(noContact)},{log:()=>{}});
chk('flags missing contact', r.contact_missing==='yes' && r.body.includes('no contact linked'));
chk('missing contact prints no undefined', !/undefined/.test(r.body));

// Wrong stage (race) -> do not start
let moved = JSON.parse(JSON.stringify(base)); moved.data[0].Stage='Won';
r = fn({payload:JSON.stringify(moved)},{log:()=>{}});
chk('does not start journey if deal already Won', r.send==='no', r.reason);

// No owner email
let noOwner = JSON.parse(JSON.stringify(base)); noOwner.data[0].Owner={name:'Nobody'};
r = fn({payload:JSON.stringify(noOwner)},{log:()=>{}});
chk('flags missing owner email instead of sending blank', r.send==='no' && /no owner email/i.test(r.reason));

// Bad payloads
try{ fn({payload:'not json'},{log:()=>{}}); chk('bad JSON throws',false);}catch(e){ chk('bad JSON throws a clear error', /not valid JSON/.test(e.message), e.message); }
try{ fn({payload:JSON.stringify({data:[]})},{log:()=>{}}); chk('empty data throws',false);}catch(e){ chk('empty data throws a clear error', /no records/.test(e.message)); }

Date.now=real;
console.log('\n--- Day 1 email ---\n'+fn({payload:JSON.stringify(base)},{log:()=>{}}).body);
console.log('\n'+(fails?fails+' FAILURE(S)':'ALL TESTS PASSED'));
process.exit(fails?1:0);
