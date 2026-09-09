# Proposal follow-up automation — Zapier build specification

**Scope of this build: Day 1 to Day 4 only.** Days 7, 14 and 20 are designed and
documented but deliberately not built yet, per the team's decision to run the
first four days, test them, and take feedback before going further.

Everything in here has been checked against the live Zoho CRM. Field names,
stage values, quirks and volumes are in [crm-reference.md](crm-reference.md).
Read the three API traps in that file before you start.

---

## 1. The one design decision worth understanding

Everything else follows from this: **the reminders are driven by scheduled
queries, not by held delays.**

The obvious build is one Zap that catches the stage change and then uses
*Delay by Zapier* between each reminder. Do not build it that way, for two
verified reasons.

First, a queued Zapier delay **cannot be cancelled for a single item**. Zapier
documents only two ways to stop a held task: turn the whole Zap off, which drops
every held run and never resumes them, or manually delete the run in Zap
History. There is no step, action or API for cancelling one queued deal. A
proposal accepted an hour after it was sent would keep receiving reminders all
week. That is precisely the failure Courtney raised, *"if it is changed to lost
or won, it stops the automation… if they sign it one hour later"*, and it is the
fastest way to lose the team's trust in the whole thing.

Second, **held runs are destroyed by any edit to the Zap** — adding, changing or
removing a step. A design that holds deals for four days could not survive
routine maintenance: the queue would silently die, and nobody would know until
somebody noticed the reminders had stopped.

Instead, two scheduled Zaps wake up at 08:00 and 15:00, ask the CRM which deals
are *currently* at Formal Quote Sent, and work out from scratch what is due
today. This gives three properties for free, with no state to maintain:

| Rule from the journey | How it is honoured |
|---|---|
| Won, Closed Lost, Future Opportunity → stop immediately | The deal simply stops matching the query. No cancellation logic exists, so none can fail. |
| Revised proposal → restart from Day 1 | Re-entering the stage resets Zoho's `Stage_Modified_Time`, so the day count restarts by itself. |
| Suppress the reminder if activity was recorded today | Each run re-reads `Last_Activity_Time`. Nothing needs remembering between the 08:00 and 15:00 runs. |
| Nothing is written to CRM | The clock is a field Zoho already maintains, so the automation is read-only. |

That last row is worth calling out, because it was flagged in planning as *"the
trickiest part"* — two workflows that do not talk to each other. With scheduled
queries they do not need to: the afternoon run just looks at the CRM again.

### Where the journey clock comes from

The journey needs to know when a deal entered the stage. It uses Zoho's own
**`Stage_Modified_Time`**, which Zoho maintains automatically.

That means **no custom field, and nothing is ever written back to CRM.** The
automation is read-only against Zoho, which removes three hazards in one go: a
write-back cannot re-trigger the workflow rule, a consultant-entered
`Date_Proposal_Sent` can never be overwritten, and there is no field for anyone
to accidentally clear.

It also gives the "revised proposal restarts the journey" rule for free.
`Stage_Modified_Time` resets whenever the stage changes, so moving a deal out of
Formal Quote Sent and back in restarts the count from that day, with no extra
logic.

Two consequences to understand:

**The go-live date is load-bearing.** Because Zoho populates
`Stage_Modified_Time` on every record, all 62 deals currently sitting at Formal
Quote Sent have a clock. `GO_LIVE_DATE` at the top of both Code steps is the
only thing keeping that backlog out of the automation. Set it to the day you
switch on, and do not clear it. A test covers exactly this.

**The clock cannot be filtered server-side.** `Stage_Modified_Time` is not
searchable and not selectable in COQL, so the search cannot narrow by date. It
returns every deal at Formal Quote Sent — 62 today — and the Code step does the
filtering. That is well inside Zapier's limits, but it is the one thing to watch
as the backlog grows: see the note under section 4.

`Date_Proposal_Sent` was the obvious alternative and is not used as the clock,
because it is **blank on 9 of those 62 deals**. Keying the journey off it would
silently skip roughly one proposal in seven, which is the exact failure this
project exists to fix. It is still used for display in the messages, falling
back to the clock when blank.

## 1b. Could an AI build these Zaps instead?

Partly, and not yet on this account. Checked 9 September 2026.

Zapier has an early-access feature, **Next Gen Zap workflows**, where you
describe a workflow in natural language and the assistant builds and deploys it
to Zapier over MCP. If CPR Group opts into that early-access programme, most of
section 3 to 5 below could be handed to an assistant rather than clicked
together by hand.

It is not available here today. The `Workflow Steps by Zapier` integration
appears in the app catalogue but exposes zero actions, and enabling it returns
"No actions found". The Zapier MCP server currently offers action execution,
connection management and saved Skills, none of which can create a Zap.
`Zapier Manager` manages Zaps that already exist — find, toggle on and off,
approvals, team invites — but cannot create one.

Two related things that do **not** help, so nobody spends time on them:

- **Zapier Skills** are saved markdown instructions for an assistant. They can
  only orchestrate tools the MCP server already exposes, so no skill can add a
  Zap-creation capability. The catalogue ships four: onboard, demo, explore and
  status.
- There is no `build-workflows` skill, in the account catalogue or in Zapier's
  own plugin repository.

Until early access is granted, build sections 3 to 5 by hand. Everything there
has been verified against the live account, so it is data entry rather than
guesswork.

## 2. Prerequisites

Work through these before building. Items 1 and 2 are blocking.

- [ ] **1. Reconnect Zoho CRM in Zapier.** Verified broken on 9 September 2026,
      and it *will* break every Zap here until it is fixed. Both Zoho CRM
      connections on the account fail when an action actually runs: the default
      one reports "stale and needs reconnecting", and the newer one returns
      `401` from the Zoho API. Note that the connection list reports both as
      healthy — the failure only shows up on execution, so do not trust the
      list view.

      Reconnect from the Zapier app's connection settings, or via these direct
      links, then make sure all three Zaps use the same working connection:

      - 2023 connection: `https://mcp.zapier.com/api/v1/connect-auth/ZohoCRMCLIAPI?accountId=16514155&connectionId=41839055`
      - 2024 connection: `https://mcp.zapier.com/api/v1/connect-auth/ZohoCRMCLIAPI?accountId=16514155&connectionId=50277482`

      Because CPR Group is on the Australian data centre, authorise against
      **zoho.com.au**, not zoho.com. An AU org authorised against the US domain
      is the most likely cause of a connection that looks valid but returns
      `401` on every call.
- [ ] **2. Connect Zoho Cliq in Zapier.** Zoho Cliq is available on Zapier and
      has the action we need (`Message to User`, addressed by email address),
      but it is **not currently connected**. Only the 15:00 nudges depend on it,
      so Zaps 1 and 2 can go live without it.
- [ ] **3. Set `GO_LIVE_DATE`** at the top of both scheduled Code steps to the
      Brisbane date you switch on, in `YYYY-MM-DD` form. Nothing that entered
      the stage before that date can produce a reminder, which is what keeps the
      62 existing deals quiet. **No CRM fields need creating or changing** —
      the automation only reads from Zoho.
- [ ] **4. Set a default Gmail connection and decide the sending mailbox.**
      There are **five** Gmail connections on the account and **no default is
      set**, so a Gmail step will not know which mailbox to send from until one
      is chosen. Pin it explicitly in the Zap. See §6.
- [ ] **5. Sort out the schedule timezone.** This one catches people out:
      **Schedule triggers use the timezone on the Zapier *account*, not the
      timezone on the Zap.** Setting the Zap timezone changes nothing about when
      a Schedule trigger fires. You have two options:

      - **Set the account timezone to Australia/Brisbane.** Cleanest, and
        Brisbane has no daylight saving so it never drifts. But it is an
        account-wide change that shifts every other scheduled Zap on the account
        and restamps Zap History, so it needs sign-off first.
      - **Leave the account timezone alone and schedule at the equivalent
        hour.** Work out what time in the account's timezone equals 08:00 and
        15:00 Brisbane, and set those. Nothing else on the account changes. The
        catch is that if the account timezone observes daylight saving, the
        firing time drifts by an hour twice a year and someone has to correct
        it.

      Whichever you pick, the Code steps compute the Brisbane date themselves
      from a fixed UTC+10 offset, so the day arithmetic stays correct either
      way. Only the hour the Zap wakes up is affected. Note also that Zapier
      does not guarantee the exact minute — expect a few minutes of jitter,
      which does not matter for an 08:00 reminder.

---

## 3. Zap 1 — Day 1: start the journey

**Trigger: a Zoho CRM workflow rule, not a Zapier polling trigger.**

Zapier's *Updated Module Entry* trigger fires on *any* edit and cannot tell you
which field changed, so a deal sitting at Formal Quote Sent would restart the
journey every time someone touched it. A Zoho workflow rule fires once, on the
transition itself.

### 3a. In Zoho CRM — create the workflow rule

| Setting | Value |
|---|---|
| Module | Deals |
| Rule name | `Proposal follow-up — journey start` |
| Execute on | Edit → *when Stage is modified* |
| Condition | `Stage` **is** `Formal Quote Sent` |
| Instant action | Webhook (see below) |

Webhook configuration:

| Setting | Value |
|---|---|
| URL | the Catch Hook URL from step 3b |
| Method | `POST` |
| Module | Deals |
| Parameters | `deal_id` = `${Deals.Deal Id}` |

Only the id is sent. The Zap re-reads the deal from the API, so the payload
cannot go stale between the rule firing and the Zap running.

### 3b. In Zapier — build the Zap

| # | App / action | Configuration |
|---|---|---|
| 1 | **Webhooks by Zapier** → Catch Hook | Copy the URL into the Zoho webhook above |
| 2 | **Zoho CRM** → Make API GET Request | URL `https://www.zohoapis.com.au/crm/v7/Deals/{{deal_id}}`, no querystring. This is Zapier's *API Request* action, labelled beta; the packaged *Find Module Entry* action cannot express what is needed here |
| 3 | **Filter by Zapier** | Continue only if `Stage` **exactly matches** `Formal Quote Sent`, and `send` from step 4 is not yet known — so put the stage check here and the send check in step 5 |
| 4 | **Code by Zapier** → Run JavaScript | Paste [`zap-code/day1-start-journey.js`](zap-code/day1-start-journey.js). Input Data: `payload` = the raw response body from step 2 |
| 5 | **Filter by Zapier** | Continue only if `send` from step 4 **exactly matches** `yes` |
| 6 | **Gmail** → Send Email | To `to`, Subject `subject`, Body `body`, all from step 4. Body type `Plain` |

**Nothing is written back to Zoho.** Earlier drafts of this build stamped a
clock field here; that is gone. The Zap reads the deal, decides whether to send,
and sends. If Zoho delivers the webhook twice — which it is known to do
occasionally — the consequence is one duplicate Day 1 email, not corrupted data.
That was judged an acceptable trade for removing every write from the design.

## 4. Zap 2 — 08:00 morning reminders (Day 2, 3 and 4)

| # | App / action | Configuration |
|---|---|---|
| 1 | **Schedule by Zapier** → Every Day | Time `8:00 AM`. **Trigger on weekends: No** |
| 2 | **Zoho CRM** → Make API GET Request | URL `https://www.zohoapis.com.au/crm/v7/Deals/search`, querystring as below |
| 3 | **Code by Zapier** → Run JavaScript | Paste [`zap-code/morning-0800.js`](zap-code/morning-0800.js). Input Data: `payload` = raw response body from step 2 |
| 4 | **Filter by Zapier** | Continue only if `due_count` from step 3 is **greater than** `0` |
| 5 | **Looping by Zapier** → Create Loop From Line Items | Map the arrays from step 3: `to`, `cc`, `subject`, `body`, `deal_name`, `day_number` |
| 6 | **Gmail** → Send Email | Inside the loop. **To** = `to`, **Cc** = `cc`, **Subject** = `subject`, **Body** = `body`, all taken from the **loop** step rather than step 3. Leave **Body type** as `Plain` |

Step 2 querystring — two separate key/value rows, not one string:

| Key | Value |
|---|---|
| `criteria` | `(Stage:equals:Formal Quote Sent)` |
| `per_page` | `200` |

Two things about this that are easy to get wrong:

**Do not add a `fields` parameter.** It looks like an obvious optimisation and it
silently breaks the whole thing: naming `Stage_Modified_Time` in `fields` makes
the API return it as `null` rather than erroring, so every deal would look like
it had no clock and no reminder would ever send. Omitting `fields` returns full
records, which is what the Code step needs.

**Type the criteria literally**, spaces in `Formal Quote Sent` included. Zapier
URL-encodes querystring values itself, so pre-encoding produces a query that
matches nothing.

**Leave Body type as `Plain`.** The Code step builds the message as plain text
with real line breaks. Setting Body type to `Html` collapses every one of them
and the reminder arrives as a single run-on paragraph. The field names above
were read from the live Gmail action, so they can be mapped as written.

### Why there is a Looping step rather than a plain array

A Code step that returns an array of objects is Zapier's documented way to fan
out, and it would let us drop steps 5 and 6. It is not used here on purpose.
There are repeated reports of a Code **action** step returning an array and only
the first item actually being processed, and Zapier's own support answers point
people at Looping by Zapier instead. For most Zaps that is a curiosity. For this
one it would mean that on a day when three proposals are due, two consultants
silently get nothing — the exact failure this project exists to prevent, made
invisible.

So the Code step emits parallel arrays, which Zapier exposes as line items, and
Looping consumes them reliably. Do not "simplify" it back.

The step also writes a one-line summary to the Zap history
(`3 at Formal Quote Sent, 1 reminder(s) due, 2 skipped`) with a per-deal reason
for every skip. That is the first place to look if somebody says they did not get
a reminder.

**Headroom.** Two limits matter, and both have room.

Output volume is a non-issue: Zapier caps a Code step at 250 output items and a
loop at 500 iterations, against a measured 1.4 proposals a business day and a
busiest-ever day of 7. The Code step truncates at 200 and logs a warning if it
ever gets close, so that failure would be loud rather than silent.

Input volume is the one to keep an eye on. Because the clock cannot be filtered
server-side, the search returns every deal at Formal Quote Sent as a full record
— 62 today, roughly 130 KB. A Code step allows 6 MB in and out, so there is
plenty of margin, but this figure grows with the backlog rather than with the
number of reminders. If that stage ever holds many hundreds of deals, page the
search with `per_page` and `page` and pass the pages through separately.

The Cc column is populated only for the Day 4 escalation, where it carries
`nathan.butcher@cprgroup.com.au`. It is empty for Day 2 and Day 3, which Gmail
accepts without complaint.

---

## 5. Zap 3 — 15:00 afternoon nudges (Day 2 and 3 only)

Identical to Zap 2 for steps 1 and 2, then:

| # | App / action | Configuration |
|---|---|---|
| 1 | **Schedule by Zapier** → Every Day | Time `3:00 PM`. **Trigger on weekends: No** |
| 2 | **Zoho CRM** → Make API GET Request | Same URL and querystring as Zap 2 |
| 3 | **Code by Zapier** | [`zap-code/afternoon-1500.js`](zap-code/afternoon-1500.js). Input Data: `payload` = raw response body from step 2 |
| 4 | **Filter by Zapier** | Continue only if `due_count` is **greater than** `0` |
| 5 | **Looping by Zapier** → Create Loop From Line Items | Map `consultant_email`, `message`, `deal_name` |
| 6 | **Zoho Cliq** → Message to User | Inside the loop. To User `consultant_email`, Text `message` — both from the loop step |

The Cliq action addresses people by email address, which is exactly what the
Code step emits, so no user-ID lookup is needed.

There is deliberately **no Day 4 afternoon nudge**. The Day 4 morning email is
already the escalation with Nathan copied; following it with a chat message the
same afternoon is the nagging the team asked us to avoid.

If Zoho Cliq cannot be connected in time, swap step 5 for a Gmail send and mark
it as a temporary substitution — but expect it to feel more intrusive, since the
whole point of using Cliq in the afternoon is that chat is lighter than email.

---

## 6. Which mailbox sends the reminders

Use the **Gmail** action. *Email by Zapier* is not a viable option here, even for
a first test: it is limited to roughly ten sends an hour across the whole
account, it sends from an unchangeable random `@zapiermail.com` address with no
SPF or DKIM alignment to `cprgroup.com.au`, and it appends a marketing
unsubscribe link to every message. Internal reminders from that address will
land in spam and look like spam.

For the Gmail sender, in order of preference:

1. **A dedicated Google Workspace account** such as `crm@cprgroup.com.au`. Clean
   sender, no personal mailbox involved, and replies land somewhere sensible.
2. **Joceli's account.** Fastest to set up, but every reminder appears to come
   from somebody who is on leave.

Two practical warnings:

- **There are five Gmail connections on this Zapier account.** Pin the intended
  one explicitly in every Gmail step, or reminders may go out from the wrong
  mailbox.
- **The Gmail connection may need reauthorising.** An attempt to enumerate the
  available send-as aliases returned an authorisation error, so which alias
  addresses can actually be used is unverified. Check this in the Zap editor
  before assuming a particular From address is available.

Reminders about the same deal will **not** thread together in the inbox. Gmail's
Zapier send action exposes no thread field and no custom headers, and a shared
subject line does not thread on its own. Threading would need a stored thread ID
per deal and the separate *Reply to Email* action, which is not worth it for a
four-day journey.

Whichever mailbox you choose, the *suggested client messages* inside the
reminders are text for the consultant to copy, personalise and send themselves.
Nothing in this build ever emails or texts a client directly. That was the
team's clear decision, and it is worth restating in the announcement so nobody
assumes otherwise.

## 7. Testing before switching on

Do this on a real but low-stakes deal, with the Zaps on and the schedule
triggers temporarily set a few minutes ahead.

1. **Day 1 fires.** Move a test deal into Formal Quote Sent. Confirm the clock
   field is set to today and the Day 1 email arrives.
2. **The backlog stays quiet.** Run Zap 2 manually. Confirm the summary line
   reports the historical deals as skipped for *"clock predates go-live"* and
   that no emails go out for them. **This is the single most important test.**
   Every one of those 62 deals has a populated clock, so `GO_LIVE_DATE` is the
   only thing holding them back. If this fails, do not switch on.
3. **Day 2 fires.** The clock is Zoho's own `Stage_Modified_Time`, so you cannot
   edit it directly. Move the test deal out of Formal Quote Sent and back in
   yesterday, or temporarily set `GO_LIVE_DATE` earlier and use a deal whose
   stage changed the previous business day. Run Zap 2 and confirm the Day 2
   email arrives with the suggested text message.
4. **Same-day activity suppresses the nudge.** Log a call against the test deal,
   then run Zap 3. Confirm nothing is sent and the summary reports one
   suppressed.
5. **Won stops everything.** Move the test deal to Won and run both Zaps.
   Confirm it no longer appears at all.
6. **The weekend is skipped.** Use a deal whose stage changed on a Friday and
   run Zap 2 on the Monday. Confirm it reports Day 2, not Day 4.

7. **Two reminders on the same day both arrive.** Put two test deals into the
   Day 2 window and run Zap 2. Confirm **both** emails go out. This is the
   Looping step doing its job, and it is the one failure mode that would
   otherwise be invisible.

The Code steps also ship with 43 unit tests covering the weekend arithmetic, the
year boundary, the Day 4 activity rules, the go-live backlog guard, a backlog
deal legitimately re-entering the stage, missing contacts, missing owner emails
and empty API responses. They need no
Zapier account and no network access:

```
node docs/proposal-followup-automation/zap-code/tests/run-all.js
```

Run them after editing any Code step. They mock the clock, so they check the
business-day logic against fixed dates rather than whatever today happens to be.

---

## 8. Known limitations — please read before giving feedback

These are deliberate choices for a first version, not oversights.

1. **Public holidays are not handled.** Only Saturday and Sunday are skipped, so
   a proposal sent before Easter will count Good Friday as Day 2. Fixable with a
   holiday list if it proves annoying.
2. **A voicemail counts as activity.** `Last_Activity_Time` cannot distinguish
   "spoke to the client" from "left a message" or even "edited the record", so a
   logged voicemail will suppress a nudge. The meeting accepted this trade-off.
3. **Day 4 escalates unless there was activity on a later day than the proposal
   went out.** Moving a deal into the stage updates `Last_Activity_Time` by
   itself, so same-day activity cannot be told apart from the stage change. The
   effect is that a consultant who followed up on Day 1 and then went quiet will
   still get the Day 4 escalation. Conservative on purpose.
4. **Reminders follow the deal owner.** If an administrator owns the deal, they
   get the reminders. The Day 1 email is what surfaces this, and ownership on
   the 62 open deals is already largely correct.

5. **A stage change made by another automation, or by an import, starts no
   journey.** This is the one gap worth understanding properly. Zoho workflow
   rules do not fire for field updates made by other workflow rules or by
   Deluge functions, and they do not fire for imports at all. So if `Stage` is
   ever set to Formal Quote Sent by anything other than a person editing the
   record, no webhook fires, no clock is written and that proposal quietly gets
   no reminders.

   The saving grace is that this only costs you the **Day 1 email**. Days 2 to
   4 are driven by the scheduled queries, which read `Stage_Modified_Time`
   directly and neither know nor care how the stage got set. So a proposal whose
   stage was set by an import still gets its full run of reminders; it just
   never gets the opening confirmation. Worth knowing, not worth engineering
   around.

6. **An unmonitored Zap is not good enough for the long run.** Zoho CRM
   connections on Zapier have a documented habit of failing to refresh, which
   turns Zaps off — and this one was already found stale before the build
   started. Turn on Zap error notifications, and treat "nobody has mentioned
   the reminders lately" as a reason to check rather than reassurance.
7. **The clock is set when the stage changes, not when the proposal was
   actually emailed.** A proposal sent Friday but marked in CRM on Monday starts
   its clock Monday. This is the honest reading of what CRM knows.

8. **The client's phone number and email are not in the reminders.** The deal
   search returns the contact's name but not their contact details, so the
   reminders name the contact and link to the deal rather than quoting a number.
   Adding them is a small enhancement: one extra search against the Contacts
   module per run, matching on the contact IDs the deal search already returns,
   then interpolating the results in the Code step. Left out of v1 to keep the
   first build to four steps of moving parts.

9. **Reminders do not thread in the inbox.** See section 6.

10. **Nothing reaches a client automatically.** By design.

---

## 9. What is designed but not built

Days 7, 14 and 20 are fully specified in the journey document and need no new
mechanism — they are three more branches in the same 08:00 Zap. They are left
out for now so the team can judge the intensive first four days before deciding
whether the longer tail is useful or just noise. The wording for all three is
already drafted in [messages.md](messages.md).

After Day 20 the journey exits and long-running opportunities go back to the
regular CRM deal review, which is unchanged by any of this.
