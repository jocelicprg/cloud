# Proposal follow-up digest

Each weekday morning, every consultant gets one email listing the proposals that
need chasing and what to do about each. It prompts the consultant; it never
contacts the client.

**One Zap. No CRM configuration, no writes to CRM, no new fields.**

## Start here

| File | What it is |
|---|---|
| [RUNBOOK.md](RUNBOOK.md) | **Start here.** Ordered switch-on steps, the tests to run first, and a troubleshooting table |
| [BUILD-SPEC.md](BUILD-SPEC.md) | How to build the Zap. Section 1 explains why it is shaped this way; section 5 is the one thing not to get wrong |
| [COPILOT-PROMPTS.md](COPILOT-PROMPTS.md) | A prompt that gets Zapier Copilot to scaffold it, and how to request the early access that would let Claude build it |
| [crm-reference.md](crm-reference.md) | Verified field names, stage values, three API traps and the real proposal volumes |
| [messages.md](messages.md) | The wording, including the drafted Day 7, 14 and 20 messages that are not switched on |
| [TEAM-EMAIL.md](TEAM-EMAIL.md) | The announcement to send once the Zap is on |
| [zap-code/daily-digest.js](zap-code/daily-digest.js) | The one Code step, plus 25 unit tests |

## How it works

At 08:00 on weekdays the Zap asks CRM for every deal at `Formal Quote Sent`,
works out how many business days each has been out, and emails each consultant a
digest of theirs. Day 2 prompts a text message, day 3 a call, day 4 escalates
with Nathan copied. Because it re-reads current state each morning, a deal that
has been won, lost or parked simply stops appearing — there is no cancellation
logic to go wrong.

## Run the tests

```
node docs/proposal-followup-automation/zap-code/tests/run-all.js
```

No Zapier account or network access needed.

## Before building

One blocking prerequisite: the Zapier connection to Zoho CRM fails when an
action runs and must be reconnected, authorising against **zoho.com.au**, not
zoho.com. Full checklist in section 2 of the build spec.
