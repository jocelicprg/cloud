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

## Zap 1 — Day 1

> Create a Zap that starts with a Catch Hook from Webhooks by Zapier. Then add a
> Zoho CRM API Request action that makes a GET request. Then add a Filter step.
> Then add a Code by Zapier step running JavaScript. Then add a second Filter
> step. Then add a Gmail Send Email action. Do not add any other steps.

Then correct by hand:

- Step 2 URL: `https://www.zohoapis.com.au/crm/v7/Deals/{{deal_id}}`, no querystring
- Step 3 filter: `Stage` exactly matches `Formal Quote Sent`
- Step 4: paste [`zap-code/day1-start-journey.js`](zap-code/day1-start-journey.js), input `payload` = step 2 raw body
- Step 5 filter: `send` exactly matches `yes`
- Step 6: To/Subject/Body from step 4, Body type `Plain`

The Zoho workflow rule that calls the hook is set up in Zoho, not Zapier. See
build spec section 3a.

---

## Zap 2 — 08:00 morning reminders

> Create a Zap triggered by Schedule by Zapier every day at 8am, not on
> weekends. Then add a Zoho CRM API Request action that makes a GET request.
> Then add a Code by Zapier step running JavaScript. Then add a Filter step.
> Then add a Looping by Zapier step that creates a loop from line items. Then
> add a Gmail Send Email action inside the loop.

Then correct by hand:

- Trigger: confirm the **account** timezone, not the Zap timezone, governs when
  this fires. Build spec prerequisite 5.
- Step 2 URL `https://www.zohoapis.com.au/crm/v7/Deals/search`, querystring
  `criteria` = `(Stage:equals:Formal Quote Sent)` and `per_page` = `200`.
  **Do not add a `fields` parameter** — it silently breaks the clock.
- Step 3: paste [`zap-code/morning-0800.js`](zap-code/morning-0800.js), input
  `payload` = step 2 raw body. Set `GO_LIVE_DATE` at the top of the code.
- Step 4 filter: `due_count` greater than `0`
- Step 5 loop: map `to`, `cc`, `subject`, `body`, `deal_name`, `day_number`
- Step 6: map from the **loop** step, Body type `Plain`

---

## Zap 3 — 15:00 afternoon nudges

> Create a Zap triggered by Schedule by Zapier every day at 3pm, not on
> weekends. Then add a Zoho CRM API Request action that makes a GET request.
> Then add a Code by Zapier step running JavaScript. Then add a Filter step.
> Then add a Looping by Zapier step that creates a loop from line items. Then
> add a Zoho Cliq action that sends a direct message to a user, inside the loop.

Then correct by hand, as for Zap 2, using
[`zap-code/afternoon-1500.js`](zap-code/afternoon-1500.js) and mapping
`consultant_email` and `message` from the loop.

Zoho Cliq must be connected in Zapier first, or this step cannot be configured.

---

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
