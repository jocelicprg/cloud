# Proposal follow-up automation

Prompts a consultant to follow up after a proposal goes out, driven by Zoho CRM
and built in Zapier. It reminds the consultant; it never contacts the client.

**Built: Day 1 to Day 4. Designed but not switched on: Days 7, 14 and 20.**

## Start here

| File | What it is |
|---|---|
| [BUILD-SPEC.md](BUILD-SPEC.md) | How to build the three Zaps, step by step. Read section 1 first — it explains the one design decision everything else follows from |
| [crm-reference.md](crm-reference.md) | Verified field names, stage values, three API traps and the real proposal volumes |
| [messages.md](messages.md) | The reminder wording, including the drafted Day 7, 14 and 20 messages |
| [TEAM-EMAIL.md](TEAM-EMAIL.md) | The announcement to send the team once the Zaps are on |
| [zap-code/](zap-code/) | The JavaScript for each Code step, plus 43 unit tests |

## How it works, in one paragraph

Moving a deal to Formal Quote Sent fires a Zoho workflow rule, which sends the
Day 1 confirmation email. Two scheduled Zaps then wake at 08:00 and 15:00 on
business days, ask the CRM which deals are currently at that stage, and work out
what is due today from Zoho's own `Stage_Modified_Time`. Because every run
re-reads current state, a deal that has been won, lost or parked simply stops
appearing, and no cancellation logic is needed. Nothing is ever written back to
CRM. The 62 deals already at Formal Quote Sent are held out by a go-live date in
the code.

## Run the tests

```
node docs/proposal-followup-automation/zap-code/tests/run-all.js
```

No Zapier account or network access needed.

## Before building

Section 2 of the build spec has the full checklist. The two blocking items: the
Zapier connection to Zoho CRM fails on execution and must be reconnected
(authorise against **zoho.com.au**, not zoho.com), and Zoho Cliq is not
connected at all, which only the 15:00 nudges depend on. No CRM fields need
creating — the automation only reads from Zoho.
