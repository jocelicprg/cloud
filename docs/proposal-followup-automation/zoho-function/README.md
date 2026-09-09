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

1. **Setup → Developer Space → Functions → New Function**
   - Category: **Standalone**, Display name: `Proposal follow-up digest`
   - Zoho requires a function signature as the very first line, and rejects
     bare code with *"Improper code format"*. The file already carries one:

     ```
     string standalone.proposal_followup_digest()
     ```

     The return type must be `string`, not `void` — the standalone category
     requires one, and the function ends with `return summary;` to satisfy it.
     A useful side effect: that summary line is what the schedule's execution
     history shows for each run.

     **The name in that line must match the function name Zoho assigned.**
     When you create the function, Zoho derives an API name from the display
     name and pre-fills the signature in the editor. Either keep Zoho's
     signature line and paste only the body between its braces, or paste the
     whole file and edit `proposal_followup_digest` to match the name Zoho
     shows. A mismatch produces the same error.
   - Nothing may sit above the signature, not even a comment, which is why the
     documentation block is inside the function.
   - Paste [`proposal_followup_digest.dg`](proposal_followup_digest.dg), save.
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
5. **Setup → Developer Space → Schedules → New Schedule**
   - Function: the one above. Daily, 08:00. Confirm the org timezone is
     Australia/Brisbane.
   - Zoho allows 10 schedules per CRM, so there is room.

Weekend suppression is handled inside the function by `workDaysBetween`, so a
daily schedule is correct — it simply finds nothing due on a Saturday.

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
