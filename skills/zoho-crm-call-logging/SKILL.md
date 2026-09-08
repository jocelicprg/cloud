---
name: zoho-crm-call-logging
description: Use this skill whenever the user dictates or pastes notes from a phone call/conversation and asks to "record", "log", or "note" it against a person in Zoho CRM — especially phrasing like "log this call under [name]", "record a call note for [name]", "add this as a closed activity", or "record this under [name] at [organisation]". Also trigger on garbled variants of "closed activity" (e.g. "close activities", "class activity") since these are near-certain voice-to-text errors for the same request. The person may be a contact or a lead, so trigger equally on "log this against the lead [name]" or when the name only exists in the Leads module. The skill finds the right contact or lead (handling misspelled or mis-transcribed names) and logs a completed Call record in Zoho CRM so it appears under that person's Closed Activities.
---

# Zoho CRM Call Logging

Turns a person's dictated call notes into a completed `Calls` record in Zoho CRM, attached to the right contact or lead, so it shows up under that record's **Closed Activities**.

## When this triggers

The user gives you:
1. A person's name (sometimes with an organisation/account to disambiguate or confirm). The person may be a contact or a lead in CRM, and the user won't always say which.
2. A date the call happened (sometimes no time of day)
3. A list of bullet-point notes, often dictated via voice-to-text (expect typos, mis-transcribed names, run-on bullets, stray "•" characters)

## Step 1: Load the Zoho CRM tools

These are deferred tools. Call `tool_search` for `"Zoho CRM search records"`, `"Zoho CRM create record"` and `"Zoho CRM update record"` if they aren't already loaded in this session. You need the update tool for Step 3b.

## Step 2: Find the person (contact or lead)

Use `Zoho CRM:searchRecords` on the `Contacts` module with a criteria search on last name:
```
criteria: (Last_Name:equals:<LastName>)
```

If the user explicitly calls the person a lead ('our new lead', 'log this against the lead'), search the `Leads` module first with the same criteria and fall back to Contacts. Otherwise start with Contacts and, if no plausible match survives the fuzzy handling below, run the identical search on `Leads`.

**Handle name mismatches gracefully — this happens often (voice-to-text, misremembering).** If there's no exact match:
- Search by first name instead, or drop to a broader search, and scan results for phonetically similar full names (e.g. "Ross Simons" → "Ross Symonds", "Daniel Smith" → "Dan Smith").
- Cross-check the organisation/account name the user gave — a phonetic match at the *same organisation* is strong confirmation.
- Proceed with the best match, but **always flag the substitution to the user** in your final confirmation (state it plainly, don't bury it) so they can correct you if wrong.

These rules apply to both modules. One difference: leads don't have `Account_Name`, so cross-check the organisation against the lead's `Company` field instead.

**Handle multiple people with the same name** by filtering on the `Account_Name` (contacts) or `Company` (leads) the user mentioned. If still ambiguous, ask the user rather than guessing.

**If the person exists in both modules**, log against the contact and flag it in the confirmation (converted leads live on as contacts, so a leftover lead record is usually stale). Only choose the lead in that case when the user explicitly said the person is a lead.

Grab the record's `id`, note which module it came from, and confirm the `Account_Name` (contacts) or `Company` (leads) matches what the user described before logging.

## Step 3: Create the Call record

Use `Zoho CRM:createRecords` with `path_variables: {"module": "Calls"}`. Known field names for this org's Calls module (no need to re-run `getFields` each time — these are stable):

| Field | Value |
|---|---|
| `Who_Id` | `{"id": "<contact id>"}` (contacts only, see the lead variant below) |
| `Call_Type` | `"Outbound"`, `"Inbound"` or `"Missed"` — **layout-mandatory, never assume it.** Infer from the notes ("I called X" / "I rang" → Outbound; "X called me" / "X rang in" / "got a call from" → Inbound; "missed call from" → Missed). If the notes don't make the direction clear, **ask** — this field feeds the Last Inbound Interaction reporting, so guessing it wrong corrupts the report. |
| `Outgoing_Call_Status` | `"Completed"` — **this is what makes it a Closed Activity** rather than an open/scheduled one. Outbound calls only: omit this field entirely when `Call_Type` is `"Inbound"` or `"Missed"`, since Zoho treats those as already completed and the field does not apply. |
| `Call_Start_Time` | ISO 8601 with Brisbane offset, e.g. `"2026-06-29T11:00:00+10:00"`. Queensland does not observe daylight saving, so the offset is always `+10:00`. Use the date the user gave; if no time of day was specified, default to `11:00:00` and don't ask — it's a minor detail that doesn't change the record's usefulness. |
| `Call_Duration` | `"HH:MM"` format. Default to `"00:15"` if not specified. |
| `Subject` | A short "Call re: X" line summarizing the topic — this is what shows in list views, so make it scannable. |
| `Description` | The dictated notes, cleaned up (see Step 4). |

**If the person is a lead**, the association works differently. Zoho's Calls API only accepts contact ids in `Who_Id`, so drop `Who_Id` entirely and send these two fields instead (everything else in the table stays the same):

| Field | Value |
|---|---|
| `What_Id` | `{"id": "<lead id>"}` |
| `$se_module` | `"Leads"` (tells Zoho the `What_Id` points at the Leads module, which is what attaches the call to the lead) |

If Zoho rejects a lead call or it doesn't appear under the lead afterwards, run `Zoho CRM:getFields` on the Calls module once to check the current field names, then retry. This hasn't been needed for contacts and shouldn't be for leads.

## Step 3a: Mandatory-field gate — do not skip this

Writing through the API bypasses the field rules the Zoho web form would have enforced, so this skill has to enforce them itself. Verified against the live CRM layouts (8 Sep 2026):

**Layout-mandatory on the `Calls` module** — the record cannot be trusted without them:

| Field | If not supplied |
|---|---|
| `Call_Type` | **Ask.** Never default it. See the table above. |
| `Call_Start_Time` | Ask only for the *date* if the user didn't give one. Time of day may default to `11:00:00`. |
| `Call_Duration` | May default to `"00:15"` without asking. |

**Layout-mandatory on `Leads` and `Contacts`** is only `Last_Name`, which the user has by definition already given. So the real risk is not blank required fields — it is *stale status*, covered next.

**Business-critical fields to prompt for (leads only).** These are not layout-mandatory, but leaving them stale is what breaks the weekly follow-up and exception reporting. After the call record is created, read the lead back and check:

| Field | Prompt when |
|---|---|
| `Lead_Status` | Still `New/not contacted` (or `-None-`) even though a completed call now exists. This is the single most common data-quality failure in this CRM — see Step 3b. |
| `Owner` | The lead owner is not the person logging the call. Point it out; don't reassign it silently. |
| `Lead_Source` | Blank. Offer the picklist. |
| `Number_of_contact_attempts` | Offer to increment it by one. |
| `Lead_Status_Reason` | Only when the new status is `Qualified, not ready to buy`, `Lost Lead` or `Junk Lead` — Zoho does not enforce this pairing, so ask for it. |

Ask for everything you need in **one** message, not one field at a time. If the user declines or says "just log it", log the call anyway and state plainly in the Step 5 confirmation which fields you left stale — never block the call record on a status update, and never silently write a value the user didn't give you.

## Step 3b: Update the lead status after logging

A completed call against a lead still reading `New/not contacted` is wrong, and it is wrong in a way that flows straight into the weekly follow-up reports. So after creating the call record, if the person came from `Leads`:

1. Read the lead's current `Lead_Status`.
2. If it is `New/not contacted` or `-None-`, propose the status the notes actually support and write it with `Zoho CRM:updateRecord` once the user confirms:

| What the notes describe | Propose |
|---|---|
| Tried to reach them, no answer, left a message | `Outbound contact attempted` |
| Actually spoke with them | `Response received` |
| Agreed a scoping call or meeting | `Scoping call/meeting booked` |
| Held the scoping call or meeting | `Scoping call/meeting held` |
| Sent, or agreed to send, a scoping email | `Scoping email sent` |
| Interested but not buying yet | `Qualified, not ready to buy` (+ `Lead_Status_Reason`) |
| Not proceeding | `Lost Lead` (+ `Lead_Status_Reason`) |
| Not a real lead — spam, vendor pitch, job seeker | `Junk Lead` (+ `Lead_Status_Reason`) |

The full `Lead_Status` picklist is: `New/not contacted`, `Outbound contact attempted`, `Response received`, `Scoping call/meeting booked`, `Scoping call/meeting held`, `Scoping email sent`, `Qualified, not ready to buy`, `Deal created for existing contact`, `Lost Lead`, `Junk Lead`.

If the status is already further along than the call implies, **leave it alone** — don't move a lead backwards.

Contacts have no equivalent status field, so this step applies to leads only.

**Don't touch the `Last_Interaction_*` fields.** `Last_Interaction_Date`, `Last_Interaction_Summary`, `Last_Interaction_Type`, `Last_Interaction_By` and `Last_Inbound_Interaction` are populated automatically from calls, meetings, emails and SMS. Creating the call record is what updates them; writing them by hand would corrupt the automation.

## Step 4: Clean up the notes into `Description`

The user's dictated bullets are the source of truth — don't editorialize or add interpretation they didn't give you. But do:
- Fix obvious voice-to-text garbles when the correction is unambiguous from context (e.g. "back deck" → "back at his desk"). If a fix is *not* obviously safe, leave the original wording rather than guessing.
- Preserve bullet hierarchy (sub-bullets stay indented/nested under their parent point).
- Turn stray `•`, `◦`, and other bullet artifacts into a clean `- ` markdown-style list.
- Don't compress or summarize away specific numbers, names, or details — this is a record, not a summary.
- It's fine to lead the description with a one-line context header (e.g. "Discussion with X:") before the bullets if it helps readability, matching the Subject topic.

## Step 5: Confirm back to the user

After the record is created, give a short confirmation (not a wall of text) that:
- Names the person and organisation the note was logged against, and says plainly when they're a lead rather than a contact
- States the date
- Briefly recaps what was covered (a few bullet points, not a full repeat of the input)
- **Explicitly flags any name substitution or assumption made in Step 2**, including when the person turned up in Leads instead of Contacts (or in both), so the user can correct it if needed
- States the `Call_Type` you used, and whether you inferred it or were told it
- Names any field you updated beyond the call record itself (e.g. "also moved her lead status from New/not contacted to Response received")
- Names any field from Step 3a you left stale because the user declined or didn't answer, so it's visible rather than silently wrong

## Example (contact)

**User:** "Record a call note under closed activities for Ross Simons in CRM. Ross Simons is at Softball Queensland... [notes]"

**What happens:**
1. Search `Contacts` for `Last_Name:equals:Simons` → no results.
2. Broaden search, find "Ross Symonds" at Softball Queensland, CEO. Phonetic match + same org → proceed, but flag it.
3. Notes say "I called Ross" → `Call_Type` = "Outbound", no need to ask. Create `Calls` record: `Who_Id` = Ross Symonds' id, `Outgoing_Call_Status` = "Completed", `Call_Start_Time` = today's date at 11:00 (since no time given), `Subject` = "Call re: [topic]", `Description` = cleaned-up notes.
4. He's a contact, so no lead status to check (Step 3b is leads-only).
5. Confirm: "Logged under Ross Symonds (CEO, Softball Queensland)... One thing to flag: I couldn't find a 'Ross Simons' — the closest match is Ross Symonds, so I logged it against him. Worth double-checking."

## Example (lead)

**User:** "Log a call under closed activities for Madalyn Buckley, she's from the Queensland Government sport team... [notes]"

**What happens:**
1. Search `Contacts` for `Last_Name:equals:Buckley` → no results, and no near-miss either.
2. Run the same search on `Leads` → "Madalyn Buckley", `Company` matches the Queensland Government sport area. Proceed.
3. Create the `Calls` record as normal but with `What_Id` = her lead id, `$se_module` = "Leads" and no `Who_Id`.
4. Read her lead back: `Lead_Status` is still `New/not contacted`, and the notes describe an actual conversation. `Lead_Source` is blank. Ask both in one message: "Her lead status still reads New/not contacted — shall I move it to Response received? And Lead Source is blank; do you want it set?"
5. On confirmation, `updateRecord` on Leads with the new status.
6. Confirm: "Logged under Madalyn Buckley (Queensland Government) as an Outbound call... She's in CRM as a lead rather than a contact, so the call now sits under her lead record's Closed Activities. I also moved her lead status from New/not contacted to Response received. Lead Source is still blank — you didn't want it set."
