# Team announcement email

**Status: ready to send once the Zap is switched on.** Do not send it before
then. It tells the team that reminders start on their next proposal, so sending
it early means people wait for prompts that never arrive.

- **To:** Nathan, Michael, Steve, Chris, Matt, Scott, Courtney, Adrian, Marcelle, Johnny
- **From:** whichever mailbox you set as the sender in the Zaps
- **Subject:** Proposal follow-up reminders start this week

---

Hi everyone,

Following our discussion about proposals going quiet, the first stage of the
proposal follow-up process is now running in CRM. This note explains what it
does, what it will not do and what we would like your feedback on.

**The short version**

When you move a deal to Formal Quote Sent, you will get a small number of
reminders over the following four business days, prompting you to follow up. The
reminders come to you. Nothing is sent to the client automatically.

**What you will receive**

One email each weekday morning, listing your proposals that need a follow-up
that day and what to do about each. If you have nothing due, you get nothing.

| Business day | What the email asks |
|---|---|
| Day 2 | Send the client a short text message to check the proposal arrived. Suggested wording is included |
| Day 3 | Call them. If you do not get through, leave a voicemail and send a short email straight after |
| Day 4 | Follow up today, or update CRM if you have already been in touch. This one only arrives if nothing has been recorded at all, and Nathan is copied |

Days are counted in business days, so a proposal sent on a Friday reaches Day 2
on the Monday. Nothing is sent on weekends. After Day 4 the proposal drops out
and goes back to the regular deal review.

If a proposal has no proposal date recorded, the email will say so and ask you
to add it, because the follow-up cannot be counted without it.

**Three things worth knowing**

Recording your follow-up against the deal is what stops the reminders. That is
the only switch. If you have called someone but not logged it, the system cannot
tell, and it will keep prompting you.

The reminders stop immediately when a deal moves to Won, Closed Lost or Future
Opportunity. If a proposal is waiting on a grant, move it to Future Opportunity
and the reminders end.

If you revise a proposal and send it again, move the deal out of Formal Quote
Sent and back in. That restarts the four days from the new send date.

**On volume**

We looked at the last ten weeks before building this. Across the whole team we
send about 1.4 proposals per business day, and the busiest of us 0.42. So a
typical morning is one email about one proposal. On the busiest day in those ten
weeks it would have been one email listing three. The proposals already sitting
in Formal Quote Sent will not generate anything. Only proposals sent from now on
enter the process.

**What we are not doing**

The suggested text messages and emails are wording for you to copy, adjust and
send yourself. We considered automating client contact directly and decided
against it. A personal message from you, referring to the conversation you
actually had, will always do more than a system message, and it removes the risk
of a client receiving something that contradicts what you told them the day
before.

**The whole journey on one page**

The full journey, showing what is live and what is still only proposed, is here:

https://claude.ai/code/artifact/cb3b119c-9855-416f-9614-0cf2a0365b1f

It is the quickest way to see where your prompts come from and what stops them.

**What we have deliberately left out for now**

The design continues past Day 4, and we have not switched that part on:

- Day 7, a one-week check-in
- Day 14, a two-week review, aiming to establish whether the client is
  proceeding, needs more time, is waiting on funding or has decided against it
- Day 20, a final review, after which the deal goes back to the regular deal
  review

We also left out an afternoon chat reminder on days 2 and 3, and an immediate
confirmation when you mark a proposal as sent. All of it is designed and easy to
add. We would rather you judge the simple version first than switch on six
things at once and have you turn the lot off.

**What we need from you**

Two habits make the difference between this working and not working:

- move the deal to Formal Quote Sent when the proposal goes out, because that is
  what starts the process
- make sure you are the deal owner, because the reminders follow the owner

**Testing and feedback**

Joceli is on leave from Thursday, so the plan is to run the first four days as
they are and gather your reactions while he is away. Please note anything that
feels wrong, badly timed or unhelpful, particularly the wording, whether 8:00am
is the right time, and whether one digest works better than separate emails per
proposal. We will work through the feedback when he is back.

There are two known rough edges already. Public holidays are not recognised yet,
so a long weekend will shift the day count. A voicemail is recorded as a call,
so the system cannot tell whether you actually spoke to someone.

Thanks

---

## Notes for Joceli, not part of the email

- The volume figure of 1.4 proposals per business day comes from 69 proposals
  across 50 business days, 1 July to 8 September 2026. Recalculate before
  quoting it again later.
- The Day 7, 14 and 20 wording is already drafted in `messages.md` if the team
  asks to see it.
- The journey page is private until you share it from the page's share menu.
  Do that before sending, or the link will not open for anyone else. It still
  shows the fuller six-step journey, so either update it or tell the team it is
  the eventual design rather than what is running.
