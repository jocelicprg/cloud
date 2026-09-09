# Switch-on runbook

Follow these in order. Roughly 30 to 40 minutes. Steps 1 to 3 are account
settings, 4 to 8 are the build and test, 9 and 10 go live.

---

## 1. Reconnect Zoho CRM in Zapier

Zapier → App Connections → Zoho CRM → reconnect.

**Authorise against `zoho.com.au`, not `zoho.com`.** CPR Group is on the
Australian data centre, and a US-domain authorisation is the likely reason both
connections currently return `401`.

There are two Zoho CRM connections, from 2023 and 2024. Reconnect one and use
that same one throughout.

**Done when:** testing any Zoho step returns data. Do not trust the connection
list — it currently reports both connections as healthy while they fail on
execution.

## 2. Pin a Gmail connection

There are five Gmail connections and no default set, so a Gmail step has no
mailbox to send from until one is chosen.

Prefer a shared mailbox such as `crm@cprgroup.com.au` over a personal one, so
the reminders do not appear to come from someone who is on leave.

## 3. Check the schedule timezone

Zapier account settings → Timezone.

**Schedule triggers use the account timezone, not the Zap timezone.** Setting it
on the Zap changes nothing.

- Already Australia/Brisbane → nothing to do.
- Otherwise → either change it, which shifts every other scheduled Zap on the
  account, or work out which hour equals 08:00 Brisbane and use that in step 4.

## 4. Build the Zap

New Zap, then paste the prompt in [COPILOT-PROMPTS.md](COPILOT-PROMPTS.md), or
build the six steps by hand from [BUILD-SPEC.md](BUILD-SPEC.md) section 3.

If Copilot built it, check its work. It is in beta, and the two things it is
most likely to get wrong here are the step 2 field mapping and the step 5
line-item mapping. Neither errors — they just quietly produce nothing.

## 5. Paste the code and set the date

Paste [`zap-code/daily-digest.js`](zap-code/daily-digest.js) into the Code step.

Set `GO_LIVE_DATE` at the top to the Brisbane date you are switching on.

Confirm the Gmail step has **Body type = `Plain`**. `Html` collapses every line
break and the email arrives as one run-on paragraph.

## 6. Test the search step

Test step 2. Expect roughly **62 deals**.

Open one record and confirm it contains `Date_Proposal_Sent`,
`Last_Activity_Time`, `Owner` **including an email address**, `Account_Name`
and `Contact_Name`.

**If `Owner` has no email address, stop.** The digest addresses each email using
that field, and the code needs changing before going further.

## 7. The backlog test

Test the Code step against that real data.

- `email_count` must be **0**
- the log line should read like
  `Examined 62 deals at Formal Quote Sent, skipped 60, emailing 0 consultant(s)`

**If `email_count` is above 0, do not switch on.** Those 62 open proposals go
back as far as 2024, and switching on would email the whole team about all of
them on the first morning. Check `GO_LIVE_DATE` first.

A small number of undated proposals may legitimately produce one email asking
for the date to be filled in. That is expected behaviour, not a failure.

## 8. See one real email

Temporarily set `GO_LIVE_DATE` to about a week ago and re-test the Code step.
One or two proposals should now appear. Test the Gmail step to send yourself a
real email. Check it reads properly and the deal link opens.

**Then set `GO_LIVE_DATE` back before publishing.** This is the easiest thing in
the whole process to forget, and forgetting it causes exactly the flood step 7
is guarding against.

## 9. Publish

Turn the Zap on. It fires on the next weekday at 08:00. Nothing reaches anyone
until a proposal sent from now on reaches its second business day.

## 10. Email the team

Send [TEAM-EMAIL.md](TEAM-EMAIL.md), and only after step 9 — it tells people
reminders start on their next proposal.

Before sending, share the journey page from its share menu, or the link will not
open for anyone else. Note that the page still shows the fuller six-step journey
rather than the digest that is actually running, so either update it or say so.

---

## If something looks wrong later

The Zap history log line is the first place to look. It reports how many deals
were examined, how many were skipped and how many consultants were emailed.

Common causes, in the order worth checking:

| Symptom | Likely cause |
|---|---|
| Nobody gets anything, ever | `GO_LIVE_DATE` is in the future, or the search returned nothing because the Zoho connection is stale again |
| One consultant gets an email, others do not | The Looping step is misconfigured, or was removed |
| The email is one run-on paragraph | Gmail Body type is set to `Html` instead of `Plain` |
| A proposal never appears | Its `Date Proposal Sent` is blank. It should be listed in that consultant's digest under the undated section |
| Reminders go to the wrong person | The deal owner is an administrator rather than the consultant |
| It fires at the wrong hour | The Zapier **account** timezone, not the Zap's |
