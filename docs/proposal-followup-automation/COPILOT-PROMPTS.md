# Building it with Zapier Copilot

Zapier Copilot is in open beta on all plans. In a new Zap there is a prompt box:
describe the workflow and it auto-builds as much of the structure as it can.

It will not paste the JavaScript and it does not know CPR Group's field names,
so treat it as a way to get the skeleton up in a minute and then check the
details against [BUILD-SPEC.md](BUILD-SPEC.md).

## The prompt

```
Create a Zap with these steps:

1. Trigger: Schedule by Zapier - Every Day. Time of day 8:00 AM. Trigger on
   weekends: No.
2. Action: Zoho CRM - Find Module Entries. Module: Deals. Field name: Stage.
   Value: Formal Quote Sent. Leave Field name 2 empty.
3. Action: Code by Zapier - Run Javascript. Input Data: a single field named
   payload, mapped to the raw output of step 2.
4. Filter by Zapier: only continue if email_count from step 3 is greater than 0.
5. Looping by Zapier - Create Loop From Line Items. Map these line item fields
   from step 3: to, cc, subject, body.
6. Action: Gmail - Send Email, inside the loop. To = to from the loop step.
   Cc = cc from the loop step. Subject = subject from the loop step.
   Body = body from the loop step. Body type = Plain.

Name the Zap "CPRG proposal follow-up digest".
```

## Then do these four things yourself

1. **Paste the code.** Copilot creates the Code step and leaves it empty. Use
   [`zap-code/daily-digest.js`](zap-code/daily-digest.js).
2. **Set `GO_LIVE_DATE`** at the top of that code to the date you switch on.
   Without it, all 62 open proposals are emailed about on the first morning.
3. **Confirm Body type is `Plain`.** `Html` collapses every line break and the
   email arrives as one run-on paragraph.
4. **Pin the connections.** Two Zoho CRM connections, five Gmail ones with no
   default set.

Copilot is in beta and guesses. The two things most likely to come out wrong
here are the Zoho search field mapping and the loop line-item mapping, and
neither errors — they just produce nothing. Check both before switching on.

## The other route

Zapier has an early-access feature, **Next Gen Zap workflows**, where an
assistant builds and deploys the Zap over MCP instead of you clicking it
together. It is not enabled on this account: the `Workflow Steps by Zapier`
integration shows zero actions and returns "No actions found" when enabled.

To request it, join Zapier Early Access at **zapier.com/early-access** (free)
and ask Zapier support specifically for *Next Gen Zap workflows*. Once it is on,
the tools should appear at:

`https://mcp.zapier.com/mcp/servers/da6f14ed-423a-4de7-b130-f67df75d8b08/config`

Two things that do not help, so nobody spends time on them: **Zapier Skills**
are saved instructions for an assistant and cannot add a Zap-creation
capability, and there is no `build-workflows` skill in the account catalogue or
in Zapier's plugin repository.

Sourcing note: every zapier.com domain is blocked from the environment these
notes were written in, so the Copilot and Early Access details come from search
summaries of Zapier's help pages. Everything about CPR Group's own Zapier
account, Zoho CRM and the action schemas was read from the live systems.
