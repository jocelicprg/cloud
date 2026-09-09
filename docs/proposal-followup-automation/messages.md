# Reminder wording

The Day 1 to Day 4 wording lives in the Code steps, because each message is
assembled there and handed to the email step ready to send. This page is the
readable copy of it, plus the drafted wording for Days 7, 14 and 20, which are
designed but not built.

House style applies: Australian English, no Oxford commas, no contractions.

## What the automation can put in a message

Only these values are available. Anything else would need an extra lookup step.

| Value | Source |
|---|---|
| Consultant first name | `Owner.name`, first word |
| Consultant email | `Owner.email` |
| Organisation | `Account_Name.name` |
| Contact full name and first name | `Contact_Name.name` |
| Deal name | `Deal_Name` |
| Deal link | built from the record id |
| Proposal sent date | `Date_Proposal_Sent`, falling back to the journey clock |
| Value | `Amount` |
| Days since the proposal | calculated from the journey clock |

The client's phone number and email address are **not** available. The deal
record carries only the contact's name. See limitation 8 in
[BUILD-SPEC.md](BUILD-SPEC.md) for how to add them later.

## Built and running

### Day 1, on the stage change: email

> **Subject:** Proposal follow-up started: [Organisation]

Confirms the journey has started, states the deal facts and asks the consultant
to check they are the deal owner and that the record is complete. Where a deal
has no linked contact, the email says so and asks for it to be added, because
the later reminders cannot say who to call.

### Day 2, 8:00am: email

> **Subject:** Follow up today: [Organisation] proposal

Asks for a short personal text message and supplies suggested wording:

> Hi [First name], just checking that the proposal I sent through arrived all
> right. If you have any questions or would like to talk anything through, let
> me know. [Consultant]

### Day 2, 3:00pm: Cliq, only when nothing was recorded that day

> [Consultant], nothing is recorded against [Organisation] yet today. Please
> send the text message about the proposal, or update the deal if you have
> already been in touch. [link]

### Day 3, 8:00am: email

> **Subject:** Call today: [Organisation] proposal

Asks for a call and supplies a suggested follow-up email for when the call is
not answered:

> **Subject:** Following up on the proposal
>
> Hi [First name],
>
> I tried to call you today to follow up on the proposal I sent through on
> [date]. I wanted to make sure it reached you and to see whether you have any
> questions or need anything further from me.
>
> There is no rush if you are still working through it. Give me a call or reply
> to this email whenever suits.
>
> Thanks, [Consultant]

### Day 3, 3:00pm: Cliq, only when nothing was recorded that day

> [Consultant], nothing is recorded against [Organisation] yet today. Please
> make the call and, if you do not reach them, send the follow-up email. Update
> the deal if you have already followed up. [link]

### Day 4, 8:00am: email, only when nothing has been recorded at all

> **Subject:** Action required: [Organisation] proposal follow-up

States how many days the proposal has been out, lists the deal facts and offers
three ways to close it off: contact the client and record it, update the deal if
contact has already happened, or move the deal to Future Opportunity or Closed
Lost if it is no longer live. Nathan Butcher is copied.

It also spells out the limitation plainly, so the escalation does not feel
arbitrary:

> The check reads only what is recorded against the deal, so a conversation that
> has not been logged looks the same as no contact at all.

## Designed, not built

These need no new mechanism. Each is another branch in the 08:00 Zap.

### Day 7: one-week check-in

> **Subject:** One-week proposal check-in: [Organisation]
>
> Hi [Consultant],
>
> It has been a week since the proposal went to [Organisation]. Please review
> what has happened so far and follow up with [Contact] today, using whichever
> channel makes sense given the history.
>
> The aim is to understand where things are at and whether they need anything
> further from us. Please record the outcome and the next step against the deal.
>
> Deal record: [link]

### Day 14: two-week review

> **Subject:** Two-week proposal review: [Organisation]
>
> Hi [Consultant],
>
> This proposal has been open for two weeks. Please follow up with [Contact] and
> try to establish where it actually stands. Are they proceeding, do they need
> more time, are they waiting on something such as committee approval or
> funding, or have they decided against it?
>
> Please record the outcome and, where it applies, a specific next follow-up
> date.
>
> Deal record: [link]

### Day 20: final review

> **Subject:** Final proposal review: [Organisation]
>
> Hi [Consultant],
>
> This proposal has been open for 20 days. Please review it today and either
> update or close the deal, or record a specific reason and a future follow-up
> date for keeping it open.
>
> This is the last reminder in the proposal follow-up journey. After today the
> deal is managed through the regular deal review.
>
> Deal record: [link]

After Day 20 the journey exits. Longer-term opportunities go back to the regular
CRM deal review, which none of this changes.
