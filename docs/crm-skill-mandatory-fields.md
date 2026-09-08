# CRM skills: mandatory-field capture

Action item from **Marketing, Process and Automation Tasks Updates**, 25 August 2026.

## The problem we are solving

Claude writes to Zoho through the API, not through the web form. Layout-mandatory
fields and any prompting the UI would have done are therefore bypassed entirely.
Marcelle's words on the call: *"mandated fields are no longer mandatory anymore
with Claude."*

The visible symptom is the one demonstrated in the meeting — a lead that has just
been called still reads `New/not contacted`. That feeds straight into the new
`Last_Interaction_*` fields and into the weekly follow-up reports Marcelle wants
to send the advisers each Monday, so the report is wrong before anyone reads it.

The fix has to live in the skill text, because the skill is the only place we
control between the user's request and the API call.

## What the live layouts actually say

Audited against the CRM on 8 September 2026 via the layouts API. Worth noting
that `getFields` does **not** return mandatory flags — they are layout-specific,
so `getLayouts` is the only source of truth here.

| Module | Layout-mandatory fields |
|---|---|
| Leads | `Last_Name` |
| Contacts | `Last_Name` |
| Calls | `Call_Type`, `Call_Start_Time`, `Call_Duration` |

So very little is genuinely mandatory. The data-quality problem is not blank
required fields — it is **stale status and silently defaulted values**. That
changes what the skills need to do: less blocking on empty fields, more reading
the record back and challenging what no longer makes sense.

## The pattern to apply to every CRM-write skill

1. **Never hardcode a value into a mandatory picklist.** The call-logging skill
   was hardcoding `Call_Type` to `Outbound`. Every inbound call logged through it
   was recorded as outbound, which corrupts the `Last_Inbound_Interaction` field
   that Marcelle asked for. Infer where the wording is unambiguous, otherwise ask.
2. **Distinguish safe defaults from unsafe ones.** Defaulting a call to 15
   minutes or 11:00 am costs nothing. Defaulting a direction, an owner or a
   status costs a report.
3. **Read the record back after writing, and challenge what is now inconsistent.**
   A completed call against a lead reading `New/not contacted` is the check that
   catches the failure the meeting was about.
4. **Ask for everything in one message.** Field-by-field interrogation is how
   people stop using the skill.
5. **Never block the primary write.** If the person says "just log it", log it —
   then say in the confirmation which fields were left stale. Visible staleness
   is recoverable; silent staleness is not.
6. **Never write a value the user did not give you.** Prompting is the goal, not
   inference dressed up as helpfulness.
7. **Leave the automated fields alone.** `Last_Interaction_Date`,
   `Last_Interaction_Summary`, `Last_Interaction_Type`, `Last_Interaction_By` and
   `Last_Inbound_Interaction` are derived from calls, meetings, emails and SMS.
   Writing them by hand corrupts the automation.

## Honest limitation

This makes the skills prompt reliably. It is **not** enforcement. Anyone who
bypasses the skill and asks Claude to write to the CRM directly still writes
whatever they like. If we want real enforcement it has to be a Zoho-side
validation rule or workflow, not a skill.

## Status

- [x] `zoho-crm-call-logging` — mandatory-field gate added (Steps 3a and 3b),
      `Call_Type` no longer hardcoded, confirmation now reports what was changed
      and what was left stale.
- [ ] Harry's CRM skills — not yet received from Marcelle, so not yet reviewed.
      Same pattern to be applied to each write path.

## Separate issues found while auditing (not part of this action item)

- `Organisation_Type` on Leads is a **free-text** field, not a picklist. Johnny
  raised this field specifically as one used for segmentation. Free text cannot
  be segmented reliably.
- Field order on the Leads layout confirms Marcelle's complaint: the
  `Last_Interaction_*` fields sit near the bottom of Lead Information, below
  the UTM and legacy fields.
- `Lead_Status_Reason` is not enforced by Zoho against any `Lead_Status` value,
  so the pairing has to be prompted for in the skill.
