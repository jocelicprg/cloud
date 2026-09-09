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
| [zap-code/](zap-code/) | The JavaScript for each Code step, plus 45 unit tests |

## How it works, in one paragraph

Moving a deal to Formal Quote Sent fires a Zoho workflow rule, which starts the
journey and stamps a clock field on the deal. Two scheduled Zaps then wake at
08:00 and 15:00 on business days, ask the CRM which deals are currently at that
stage, and work out what is due today. Because every run re-reads the current
state, a deal that has been won, lost or parked simply stops appearing, and no
cancellation logic is needed. The 62 deals already sitting at Formal Quote Sent
have a blank clock field, so they can never trigger a reminder.

## Run the tests

```
node docs/proposal-followup-automation/zap-code/tests/run-all.js
```

No Zapier account or network access needed.

## Before building

Three prerequisites block the build, and all three are covered in section 2 of
the build spec: the Zapier connection to Zoho CRM is stale and must be
reconnected, Zoho Cliq is not connected at all, and one custom date field needs
creating on the Deals module.
