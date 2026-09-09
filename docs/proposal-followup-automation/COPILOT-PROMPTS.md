# Building the Zaps with Zapier Copilot

Zapier Copilot is in open beta on all plans. In a new Zap there is a Copilot
prompt box: describe the workflow and it auto-builds as much of the structure as
it can. It will not paste the JavaScript for you, and it will not know CPR
Group's field names, so treat it as a way to get the skeleton up quickly and
then correct the details against [BUILD-SPEC.md](BUILD-SPEC.md).

**Always check what it built.** Copilot guesses. The two things it is most
likely to get wrong here are the exact Zoho search criteria and the schedule
timezone, and both fail silently rather than erroring.

---

Build them in this order. **Zap A alone delivers Days 2, 3 and 4** — every
email including the escalation — and needs neither the Zoho webhook nor Zoho
Cliq, so it is the one that gets value fastest.

---

## Zap A — 08:00 reminders (Days 2, 3 and 4)

```
Create a Zap with these steps:

1. Trigger: Schedule by Zapier - Every Day. Time of day 8:00 AM. Trigger on
   weekends: No.
2. Action: Zoho CRM - API Request. Method GET. URL:
   https://www.zohoapis.com.au/crm/v7/Deals/search
   Query string parameters, as two separate rows:
     criteria = (Stage:equals:Formal Quote Sent)
     per_page = 200
   Do not add a "fields" query string parameter.
3. Action: Code by Zapier - Run Javascript. Input Data: a single field named
   payload, mapped to the raw response body from step 2.
4. Filter by Zapier: only continue if due_count from step 3 is greater than 0.
5. Looping by Zapier - Create Loop From Line Items. Map these line item fields
   from step 3: to, cc, subject, body, deal_name, day_number.
6. Action: Gmail - Send Email, inside the loop. To = to from the loop step.
   Cc = cc from the loop step. Subject = subject from the loop step.
   Body = body from the loop step. Body type = Plain.

Name the Zap "CPRG proposal follow-up - 8am reminders".
```

Code step: [`zap-code/morning-0800.js`](zap-code/morning-0800.js)

---

## Zap B — Day 1 confirmation

```
Create a Zap with these steps:

1. Trigger: Webhooks by Zapier - Catch Hook.
2. Action: Zoho CRM - API Request. Method GET. URL:
   https://www.zohoapis.com.au/crm/v7/Deals/{{deal_id}}
   using the deal_id value from the catch hook. No query string parameters.
3. Filter by Zapier: only continue if Stage from step 2 exactly matches
   Formal Quote Sent
4. Action: Code by Zapier - Run Javascript. Input Data: a single field named
   payload, mapped to the raw response body from step 2.
5. Filter by Zapier: only continue if send from step 4 exactly matches yes
6. Action: Gmail - Send Email. To = to from step 4. Subject = subject from
   step 4. Body = body from step 4. Body type = Plain.

Name the Zap "CPRG proposal follow-up - Day 1".
```

Code step: [`zap-code/day1-start-journey.js`](zap-code/day1-start-journey.js)

The Zoho workflow rule that calls the Catch Hook is configured in Zoho CRM, not
Zapier. See build spec section 3a. Copy the Catch Hook URL into it.

---

## Zap C — 15:00 nudges (Days 2 and 3)

```
Create a Zap with these steps:

1. Trigger: Schedule by Zapier - Every Day. Time of day 3:00 PM. Trigger on
   weekends: No.
2. Action: Zoho CRM - API Request. Method GET. URL:
   https://www.zohoapis.com.au/crm/v7/Deals/search
   Query string parameters, as two separate rows:
     criteria = (Stage:equals:Formal Quote Sent)
     per_page = 200
   Do not add a "fields" query string parameter.
3. Action: Code by Zapier - Run Javascript. Input Data: a single field named
   payload, mapped to the raw response body from step 2.
4. Filter by Zapier: only continue if due_count from step 3 is greater than 0.
5. Looping by Zapier - Create Loop From Line Items. Map these line item fields
   from step 3: consultant_email, message, deal_name.
6. Action: Zoho Cliq - Message to User, inside the loop.
   To User = consultant_email from the loop step. Text = message from the
   loop step.

Name the Zap "CPRG proposal follow-up - 3pm nudges".
```

Code step: [`zap-code/afternoon-1500.js`](zap-code/afternoon-1500.js)

Zoho Cliq must be connected in Zapier before this step can be configured.

---

## Four things Copilot cannot do for you

1. **Paste the JavaScript.** Copilot creates the Code step and leaves it empty.
2. **Set `GO_LIVE_DATE`** at the top of the code in Zaps A and C, to the
   Brisbane date you switch on. This is the only thing keeping the 62 proposals
   already at Formal Quote Sent from firing reminders. Get it wrong and the
   whole team receives a flood on the first morning.
3. **Check the schedule timezone.** Schedule triggers use the timezone on the
   Zapier **account**, not on the Zap. See build spec prerequisite 5.
4. **Pin the connections.** There are two Zoho CRM connections and five Gmail
   connections with no default set.

## The other route: Next Gen Zap workflows

Zapier also has an early-access feature, **Next Gen Zap workflows**, where an
assistant builds and deploys the Zap over MCP rather than you clicking it
together. That would let Claude build these directly.

It is not enabled on this account: the `Workflow Steps by Zapier` integration
shows zero actions and returns "No actions found" when enabled. To request it,
join Zapier Early Access at **zapier.com/early-access** (free), and ask Zapier
support or your account contact specifically for *Next Gen Zap workflows*.

Once it is on, the workflow-building tools should appear on the Zapier MCP
server at the configuration URL below, and the build can be handed to Claude
instead:

`https://mcp.zapier.com/mcp/servers/da6f14ed-423a-4de7-b130-f67df75d8b08/config`

Note on sourcing: every zapier.com domain is blocked from the environment these
notes were written in, so the Copilot and Early Access details above come from
search summaries of Zapier's help pages rather than the live pages. The exact
in-product wording may differ. Everything about CPR Group's own Zapier account,
Zoho CRM and the action schemas was read directly from the live systems.
