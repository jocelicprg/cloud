# Zoho CRM scheduled function

The same follow-up digest, built inside Zoho CRM instead of Zapier.

[`proposal_followup_digest.dg`](proposal_followup_digest.dg)

## Why this is the better home

Every problem the Zapier build ran into disappears here, because the function
runs inside the system that owns the data.

| Problem in Zapier | In Zoho |
|---|---|
| Packaged search returns only **10** records, no way to raise it | `searchRecords` returns **200** per page |
| Search strips the owner's email, so it has to be mapped by hand from a hardcoded list | `Owner.email` comes back on the record |
| Line items flatten to comma-separated strings, so the digest shape is not buildable | Plain lists and maps |
| Public holidays not handled | `workDaysBetween` takes a holiday list |
| Connection went stale twice in one afternoon | No connection involved |
| One task per email | No task cost |
| Lives in one person's Zapier account | Any CRM admin can see and edit it |

## Install

1. **Setup → Automation → Schedules → + New Schedule → Create a New Function.**

   Create it here, not under Developer Space → Functions. A standalone function
   made there does not appear in the schedule's function picker, which cost us
   an afternoon.

   - Function name: `proposal_followup_digest_v2`
   - Paste the whole of
     [`proposal_followup_digest.dg`](proposal_followup_digest.dg), signature
     line and both braces included. This editor starts empty and wants the
     complete function; pasting only the body gives *"Improper code format"*.
   - **The name on line 1 must match the function name field exactly.** A
     mismatch produces the same error.

   Three things about the signature, each learned from a save-time rejection:

   ```
   void schedule.proposal_followup_digest_v2()
   ```

   - **Category `schedule`, not `standalone`.** This editor creates schedule
     functions. Getting it wrong gives *"Invalid return Type string. Category
     schedule returns void"*.
   - **Return type `void`, and no `return` statement.** The run's record is the
     `info summary` line in Execution History instead.
   - **Nothing may sit above the signature**, not even a comment, which is why
     the documentation block is inside the function.

   To run the same code from Developer Space → Functions instead, the signature
   becomes `string standalone.proposal_followup_digest()` and the function needs
   `return summary;` at the end. That category rejects `void`.
2. Set `GO_LIVE` near the top to the date you switch on, and leave
   `SEND_EMAILS = false` for now.

   The email addresses are **not** configurable from the top of the file.
   Deluge validates the `sendmail` address fields when the script is saved, so
   they cannot come from variables — a variable produces *"Invalid email
   address found"*. They are literals in the `sendmail` block near the bottom:

   - `from: zoho.loginuserid` — whoever owns the schedule, and needs no
     separate sender verification. A literal address works too, but only if it
     is already a verified sender in CRM.
   - `cc: "nathan.butcher@cprgroup.com.au"` — day 4 escalations only.
3. **Run it once from the editor.** It sends nothing and logs exactly what it
   would have sent. Check:
   - the final line reads something like
     `Examined 62 deals at Formal Quote Sent, skipped 60, digests sent: 0`
   - **no `WOULD SEND` block mentions a proposal from 2024 or 2025.** If one
     does, `GO_LIVE` is wrong. Do not go further until this is clean.
   - the day numbers look right for the dates shown
4. Set `SEND_EMAILS = true`, run once more, and confirm the real email arrives
   and reads properly.
5. **Finish the schedule** you started in step 1: Daily, 08:00, starting the
   next working day. Confirm the org timezone is Australia/Brisbane.
   - Zoho allows 10 schedules per CRM, so there is room.

Weekend suppression is handled inside the function by `workDaysBetween`, so a
daily schedule is correct — it simply finds nothing due on a Saturday.

## How undated proposals are handled

A proposal with no `Date Proposal Sent` cannot be counted, and cannot be
compared against `GO_LIVE` either. Left alone, the entire undated backlog lands
in someone's inbox on the first morning — the first dry run against live data
would have sent Chris a list of eight proposals, several from 2025.

So the function falls back to the deal's **created date**. A proposal raised
since go-live and missing its date is worth chasing, and appears in that
consultant's digest under a short "please add the date" section. One raised
last year is backlog, and stays in the regular deal review where it belongs.

## Two things to check on the first run

This script has **not been executed** — Deluge cannot be run from outside CRM,
so unlike the JavaScript version it carries no test suite. Two details to
confirm in that first log:

1. **`workDaysBetween` boundaries.** The intent is that the day the proposal was
   sent is Day 1, the next working day is Day 2. If the log shows every deal one
   day out, add or subtract 1 where `day` is calculated.
2. **Date parsing.** `Date_Proposal_Sent` and `Last_Activity_Time` are passed
   through `.toDate()`. If either throws, log the raw value and adjust the
   format.

The logic itself is a direct translation of
[`../zap-code/per-deal-reminder.js`](../zap-code/per-deal-reminder.js), which is
covered by 22 tests, so the rules are settled even though this rendering of them
is not yet proven.

## What it will not do

Same deliberate limits as the Zapier version, minus the holiday one:

- A voicemail counts as activity; `Last_Activity_Time` cannot tell "spoke to
  them" from "left a message"
- Day 4 escalates even if the only follow-up happened on the day the proposal
  went out, because that cannot be told apart from the stage change
- Reminders follow the deal owner, so an administrator owning a deal gets them
- Nothing reaches a client, ever
