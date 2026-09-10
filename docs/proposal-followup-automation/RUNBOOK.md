# Switch-on runbook

The build is the Zoho CRM scheduled function in
[`zoho-function/`](zoho-function/). The Zapier work was abandoned; see
[`zap-code/SUPERSEDED.md`](zap-code/SUPERSEDED.md).

---

## 1. Create the function

**Setup → Developer Space → Functions → New Function**, category **Standalone**.
Paste [`zoho-function/proposal_followup_digest.dg`](zoho-function/proposal_followup_digest.dg).

Four save-time errors are already handled in the file, but if you retype any of
it, these are the Deluge rules that caused them:

| Error | Cause |
|---|---|
| Improper code format | Needs a signature on line 1, and nothing above it, not even a comment |
| Invalid return type void | The standalone category must return `string` |
| The syntax is incorrect | Deluge will not chain a method onto a `.get()` result |
| Invalid email address found | `sendmail` address fields are validated at save time, so they cannot be variables |

## 2. Set the go-live date

```
GO_LIVE = '10-Sep-2026'.toDate();
```

Format is `dd-MMM-yyyy`. Proposals sent before this date never produce a
reminder. It is the only thing keeping the ~60 proposals already at Formal
Quote Sent quiet, and one of them dates to 2024.

Leave `SEND_EMAILS = false` and `DEBUG_DATES = true` for now.

## 3. Dry run

Execute from the editor. Nothing sends. Check three things:

1. **Dates parse.** Lines read
   `DATES <org> | raw=2026-09-08 | parsed=08-Sep-2026 | today=... | day=3`
2. **Day numbers are right.** Count one yourself. A proposal sent Tuesday, read
   Thursday, is Day 3. A Friday proposal read the following Monday is Day 2.
3. **No `WOULD SEND` block names a 2024 or 2025 proposal.** If one does,
   `GO_LIVE` is wrong. Stop here.

The undated ones should log `UNDATED skipped as pre go-live` with their created
dates.

## 4. Prove the send path before relying on it

`sendmail` has not run at this point, and a scheduled run happens when nobody is
watching. Prove it with a test that reaches nobody else:

1. Temporarily set `GO_LIVE` back far enough to catch a few live proposals
2. `SEND_EMAILS = true`
3. In **both** `sendmail` blocks, temporarily replace `to: addr` with your own
   address as a literal

Run once. Confirm the emails arrive, read properly, and the deal links open.

**Then revert all three**, and check the `to:` lines especially — leaving them
hardcoded sends every consultant's digest to one person.

## 5. Go live

1. `SEND_EMAILS = true`
2. `DEBUG_DATES = false`
3. Save
4. **Setup → Developer Space → Schedules → New Schedule** — the function,
   Daily, 08:00. The org timezone is Australia/Brisbane.

A daily schedule is right even though this is weekday-only: `workDaysBetween`
means nothing is ever due on a Saturday, so weekend runs send nothing.

## 6. Announce

Send [TEAM-EMAIL.md](TEAM-EMAIL.md), and only after step 5.

Digests come from whoever owns the schedule, because the sender is
`zoho.loginuserid`. Say so in the email, and ask people to act on a digest
rather than reply to it.

---

## Monitoring

**Setup → Developer Space → Schedules → execution history.** Each run records
the summary the function returns:

```
Examined 60 deals at Formal Quote Sent. Skipped 58. Digests sent: 2.
```

That one line answers most questions without opening the logs.

| Symptom | Likely cause |
|---|---|
| Nobody gets anything, ever | `GO_LIVE` is in the future, or no proposal has reached day 2 yet |
| A consultant never gets anything | No email address on their CRM user record. The log says `SKIP no owner email` |
| A proposal never appears | Its Date Proposal Sent is blank and the deal predates go-live, so it is treated as backlog |
| Digests stop after a schedule edit | Check the schedule is still active and the function still saves |
| Someone is chased about a dead deal | The deal is still at Formal Quote Sent. Move it to Won, Closed Lost or Future Opportunity |

## Known limitations

1. A voicemail counts as activity. `Last_Activity_Time` cannot tell "spoke to
   them" from "left a message" or "edited the record".
2. Day 4 escalates even when the only follow-up happened on the day the
   proposal went out, because that cannot be told apart from the stage change.
3. Reminders follow the deal owner, so an administrator owning a deal gets them.
4. A blank proposal date keeps a deal out of the count until someone fills it
   in. Deals created since go-live are listed in the digest so it is visible.
5. Public holidays are handled, but the list in `HOLIDAYS` needs topping up
   each year.
6. Nothing reaches a client. By design.
