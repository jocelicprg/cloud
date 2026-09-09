# Proposal follow-up digest — build specification

One Zap. Every weekday at 08:00 it asks CRM which proposals need chasing and
sends each consultant a single email listing theirs. Nothing is written to CRM,
nothing reaches a client, and no CRM configuration is needed.

Field names, stage values and the API quirks behind this are in
[crm-reference.md](crm-reference.md).

---

## 1. Why it is shaped this way

**Scheduled, not triggered.** The thing being detected is that a consultant
*has not* followed up. Nothing changes in CRM when somebody fails to do
something, so there is no update event to trigger on. Only a scheduled check can
ask "is it day 3, and is there still nothing recorded?"

That also rules out the obvious alternative of one Zap per proposal using
*Delay by Zapier*. A queued delay **cannot be cancelled for a single item**, and
held runs are destroyed by any edit to the Zap. A proposal won an hour after it
was sent would keep receiving reminders all week. Re-reading current state each
morning avoids that entirely: a deal that has been won, lost or parked simply
stops appearing in the results.

**One email per consultant, not per proposal.** Measured over ten weeks, the
team sends 1.4 proposals per business day and the busiest consultant 0.42. So a
typical morning is one email listing one proposal; the busiest day observed in
ten weeks would have been one email listing three. This was the team's main
worry, and it is the main reason for the digest shape.

**Anchored on `Date_Proposal_Sent`.** It is a real field the consultants already
fill in, it is searchable, and it needs nothing new. It is blank on 9 of the 62
open proposals, so rather than silently skipping those, the digest lists them in
a short "cannot track these" section and asks for the date. Nothing is lost
quietly.

---

## 2. Prerequisites

- [ ] **Reconnect Zoho CRM in Zapier.** Both connections currently fail when an
      action runs: the default reports itself stale, the other returns `401`.
      The connection list wrongly reports both as healthy, so trust a test run,
      not the list. CPR Group is on the Australian data centre, so authorise
      against **zoho.com.au**, not zoho.com — an AU org authorised against the
      US domain is the likely cause.
- [ ] **Set a default Gmail connection.** There are five, with no default, so a
      Gmail step has no mailbox to send from until one is pinned.
- [ ] **Set `GO_LIVE_DATE`** at the top of the Code step to the Brisbane date
      you switch on. See section 5 — this one matters more than it looks.
- [ ] **Check the schedule timezone.** Schedule triggers use the timezone on the
      Zapier **account**, not on the Zap. Either set the account to
      Australia/Brisbane, which affects every other scheduled Zap on the
      account, or set the hour that equals 08:00 Brisbane in whatever timezone
      the account uses.

---

## 3. The Zap

| # | App / action | Configuration |
|---|---|---|
| 1 | **Schedule by Zapier** → Every Day | Time `8:00 AM`. **Trigger on weekends: No** |
| 2 | **Zoho CRM** → Find Module Entries | Module `Deals`, Field name `Stage`, Value `Formal Quote Sent`. Leave *Field name 2* empty |
| 3 | **Looping by Zapier** → Create Loop From Line Items | Map the nine deal fields from step 2, listed below |
| 4 | **Code by Zapier** → Run JavaScript | Inside the loop. Paste [`zap-code/per-deal-reminder.js`](zap-code/per-deal-reminder.js). Nine Input Data fields, mapped from the **loop** step |
| 5 | **Filter by Zapier** | Inside the loop. Continue only if `send` from step 4 **exactly matches** `yes` |
| 6 | **Gmail** → Send Email | Inside the loop. **To** = `to`, **Cc** = `cc`, **Subject** = `subject`, **Body** = `body`, all from step 4. **Body type** = `Plain` |

### The loop comes before the code, and that is not arbitrary

The obvious order is search, process everything, then loop to send. It does not
work with a packaged Zoho action.

`Find Module Entries` exposes its results as **line items**, and mapping line
items into a Code step flattens them into comma-separated strings. There is no
"raw response body" field to hand the step, the way an API Request action would
provide. So a Code step placed before the loop cannot reliably see the records.

Looping first means the Code step receives one deal at a time as plain scalar
values. No arrays, no comma-joining, no ambiguity. The cost is one email per
proposal rather than one digest per consultant, which at 1.4 proposals a
business day is typically one email and occasionally three.

### Loop and Code step field mappings

Map these nine from step 2 into the loop, then map the loop's version of each
into the Code step's Input Data under exactly these names:

| Input Data name | Map from |
|---|---|
| `deal_id` | `results[]entries[]id` |
| `deal_name` | `results[]entries[]Deal_Name` |
| `owner_id` | `results[]entries[]Owner_id` |
| `owner_name` | `results[]entries[]Owner_name` |
| `account_name` | `results[]entries[]Account_Name_name` |
| `contact_name` | `results[]entries[]Contact_Name_name` |
| `amount` | `results[]entries[]Amount` |
| `date_proposal_sent` | `results[]entries[]Date_Proposal_Sent` |
| `last_activity_time` | `results[]entries[]Last_Activity_Time` |

### What this action actually returns

Tested against CPR Group's live CRM rather than assumed, because it does three
surprising things the Code step has to absorb.

**It flattens lookup fields.** `Account_Name` comes back as `Account_Name_name`
plus `Account_Name_id`, not a nested object — and when the lookup is empty the
flattened keys are missing and a bare `null` appears instead. Same for
`Contact_Name` and `Owner`.

**It does not return the owner's email address.** Only `Owner_id` and
`Owner_name`. Since the whole digest is addressed off that, the Code step
carries an `OWNER_EMAILS` map from Zoho user id to address, built from the CRM
user list. **Keep it current:** somebody who joins, is given deals and is not in
that map receives nothing at all. The step logs their name as a warning when it
happens, so check the Zap history if a consultant says they get nothing.

**It returns at most 10 records.** There is no page or limit parameter to raise
it. With 62 deals at this stage, that is a real truncation. It is survivable
because the action returns the most recently modified records first and a
proposal in its day 2 to 4 window has necessarily been touched recently, but it
is the thing most likely to bite as the pipeline grows. The Code step logs a
loud warning whenever exactly 10 come back. If that warning becomes routine, see
section 7.

**Zapier's raw API Request action is not an option here.** It returns `401`
against both Zoho data centre domains and on both connections, while the
packaged action works fine on the same credentials.

### Three things that are easy to get wrong:

**Body type must be `Plain`.** The Code step builds the email with real line
breaks. `Html` collapses every one of them into a single run-on paragraph.

**The Code step never addresses a client.** It resolves the recipient from the
deal owner's Zoho user id through a fixed map, and the tests assert that every
generated email goes to a `cprgroup.com.au` address and that no contact name or
address appears in To or Cc. If you regenerate this code with an AI assistant,
check that first: an earlier generated version addressed the email to the client
contact, which is the one thing this design must never do.

**Empty `cc` is fine.** It is only populated when a proposal has reached the
Day 4 escalation, and Gmail accepts a blank Cc without complaint.

---

## 4. What each consultant receives

Days are counted in business days from the proposal date, so a proposal sent on
a Friday reaches Day 2 on the Monday.

| Business day | What the digest says | Sent when |
|---|---|---|
| 2 | Send a short, personal text to check it arrived | Always |
| 3 | Call. If no answer, leave a voicemail and email straight after | Always |
| 4 | Nothing has been recorded. Follow up today, or update the deal | Only if nothing has been logged since the proposal went out. Copies Nathan |

Days 2 and 3 go out regardless of activity, because they are the plan for the
day rather than a chase. Day 4 is the escalation, so it is suppressed as soon as
anything is recorded.

After Day 4 the proposal drops out of the digest and is managed through the
regular deal review.

The step also writes a summary line to Zap history — `Examined 62 deals at
Formal Quote Sent, skipped 60, emailing 1 consultant(s)` — which is the first
place to look if somebody says they did not get their email.

---

## 5. The go-live date, and why it matters

`GO_LIVE_DATE` at the top of the Code step excludes any proposal sent before it.

That is the only thing standing between the switch-on and **62 open proposals**
generating a digest for every consultant on the first morning. Some of those
date back to 2024. Set it to the day you turn the Zap on, and test it before
enabling: run the Zap manually and confirm the summary line reports the
historical deals as skipped and no emails go out for them.

---

## 6. Testing before switching on

1. **The backlog stays quiet.** Run the Zap manually. Confirm no emails go to
   anyone about the 62 existing proposals. **If this fails, do not switch on.**
2. **A real proposal produces a real email.** Take a deal whose proposal date is
   one or two business days ago, temporarily set `GO_LIVE_DATE` earlier, and run
   the Zap. Check the email reads correctly and the deal link opens.
3. **Two proposals for one consultant produce one email.** This is the digest
   working, and the loop running more than once.
4. **Won stops it.** Move the test deal to Won and re-run. It should vanish from
   the results entirely.

The Code step ships with 25 unit tests covering the day counting, weekends, the
year boundary, activity suppression, the go-live guard, undated proposals,
deals with no contact or no owner, and malformed API responses. No Zapier
account or network needed:

```
node docs/proposal-followup-automation/zap-code/tests/run-all.js
```

---

## 7. If the truncation warning becomes routine

The 10-record cap is the one limit with a plausible path to causing a miss. If
the Zap history starts showing the warning most days, the fix is to stop asking
for every deal at the stage and ask for specific dates instead:

1. Add a Code step before the search that returns the three dates matching
   business days 2, 3 and 4 back from today.
2. Replace the single search with three Find Module Entries steps, each using
   *Field name* `Stage` = `Formal Quote Sent` and *Field name 2*
   `Date Proposal Sent` = one of those dates.
3. Feed all three results into the digest step.

Each search then returns a handful of records and the cap stops mattering. The
cost is losing the undated-proposal section, since a blank date cannot be
searched for.

## 8. Known limitations

Deliberate choices for a first version, not oversights.

1. **Public holidays are not recognised.** Only Saturday and Sunday are skipped,
   so a long weekend shifts the day count.
2. **A voicemail counts as activity.** `Last_Activity_Time` cannot tell "spoke
   to them" from "left a message" or even "edited the record".
3. **Day 4 is conservative.** A follow-up made on the same day the proposal went
   out cannot be distinguished from the stage change itself, so it may still
   escalate.
4. **Reminders follow the deal owner.** If an administrator owns a deal, they
   get the reminder. Ownership on the 62 open deals is already largely correct.
5. **A blank proposal date delays a proposal entering the journey** until
   someone fills it in. It is listed in the digest rather than dropped, so it is
   visible, but it will not be counted until dated.
6. **The owner email map is maintained by hand.** See section 3. A new starter
   who owns deals and is not in it gets nothing, though the Zap history says so.
7. **At most 10 proposals are examined per run.** See section 7.
8. **Nothing reaches a client automatically.** By design.

---

## 9. What was cut, and what it would take to add back

Earlier drafts had three Zaps: an instant Day 1 confirmation driven by a Zoho
workflow rule and webhook, this morning digest, and a 15:00 Zoho Cliq nudge on
days 2 and 3. That needed CRM-side configuration, a Zoho Cliq connection that
does not exist yet, and raw API Request steps.

None of it is needed for the substance of days 2 to 4, so it is gone. If the
team asks for it after the trial:

- **The 15:00 Cliq nudge** is the easiest to add: duplicate this Zap, change the
  time, and swap Gmail for Zoho Cliq's *Message to User*. Zoho Cliq has to be
  connected in Zapier first.
- **The Day 1 confirmation** would need either a Zoho workflow rule calling a
  Catch Hook, or Zapier's *Updated Module Entry* trigger with a filter — the
  latter fires on every edit, so it needs care to avoid repeat emails.
- **Days 7, 14 and 20** are drafted in [messages.md](messages.md) and would be
  three more entries in the `PLAN` object at the top of the Code step, plus
  widening the day window.
