# Team announcement email

**Status: ready to send.** The scheduled function is live in Zoho CRM and the
first digest goes out at 08:00 on Friday 11 September.

- **To:** Nathan, Michael, Steve, Chris, Matt, Scott, Courtney, Adrian, Marcelle, Johnny
- **From:** Joceli. The function sends as whoever owns the schedule, so the
  digests will arrive from Joceli's address even while he is on leave.
- **Subject:** Proposal follow-up reminders start tomorrow

---

Hi everyone,

Following our discussion about proposals going quiet, the first stage of the
proposal follow-up process is now running in CRM. It starts tomorrow morning.
This note explains what it does, what it will not do and what we would like your
feedback on.

**The short version**

When you send a proposal, you will get a small number of reminders over the
following four business days, prompting you to follow up. The reminders come to
you. Nothing is sent to the client automatically, ever.

**What you will receive**

One email at 8:00am each weekday, listing your proposals that need a follow-up
that day and what to do about each. If you have nothing due, you get nothing.

| Business day | What the email asks |
|---|---|
| Day 2 | Send the client a short, personal text to check the proposal arrived |
| Day 3 | Call them. If you do not get through, leave a voicemail where that suits and send a short email straight after |
| Day 4 | Follow up today, or update the deal if you have already been in touch. This one only arrives if nothing has been recorded at all, and Nathan is copied |

Day 1 is the day the proposal went out, so the first prompt reaches you the next
working day. Days are counted in business days and public holidays are skipped,
so a proposal sent on the Thursday before Easter reaches Day 2 on the Tuesday.
After Day 4 the proposal drops out and goes back to the regular deal review.

**What starts the clock, exactly**

The **Date Proposal Sent** field on the deal, together with the stage being
**Formal Quote Sent**. Both have to be right.

That field is doing the counting, not the stage change. If you move a deal into
Formal Quote Sent and leave the date blank, the system cannot count anything, so
instead of prompting you it will list the deal separately and ask you to add the
date. If you revise a proposal and send it again, update **Date Proposal Sent**
to the new date. That is what restarts the four days. Moving the deal out of the
stage and back in does nothing on its own.

**Three things worth knowing**

The Day 2 and Day 3 prompts arrive whether or not you have already followed up.
They are a plan for your day rather than a judgement about whether you have done
your job, and working out from CRM whether a text message was sent is not
something we can do reliably. If you have already been in touch, delete it.

Day 4 is the one that watches. It only arrives if nothing at all has been
recorded against the deal since the proposal went out, and Nathan is copied when
it does. Logging your follow-up is what prevents it. The system reads only what
is in CRM, so a conversation you have not logged looks the same as no contact at
all.

Everything stops the moment a deal leaves Formal Quote Sent. Won, Closed Lost or
Future Opportunity all end it immediately. If a proposal is waiting on a grant
round, move it to Future Opportunity and you will hear no more about it.

**On volume**

We looked at the last ten weeks before building this. Across the whole team we
send about 1.4 proposals per business day, and the busiest of us 0.42. So a
typical morning is one email about one proposal. On the busiest day in those ten
weeks it would have been one email listing three.

The 60 proposals already sitting in Formal Quote Sent will not generate
anything. Only proposals dated from today onwards enter the process, so nobody
wakes up to a backlog.

**What we are not doing**

The suggested text messages and emails are wording for you to copy, adjust and
send yourself. We considered automating client contact directly and decided
against it. A personal message from you, referring to the conversation you
actually had, will always do more than a system message, and it removes the risk
of a client receiving something that contradicts what you told them the day
before.

**The whole journey on one page**

The full design, including the later stages we have not switched on, is here:

https://claude.ai/code/artifact/cb3b119c-9855-416f-9614-0cf2a0365b1f

**What we have deliberately left out for now**

The design continues past Day 4, and none of that is running:

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

- fill in **Date Proposal Sent** when the proposal goes out, because that is
  what starts the process
- make sure you are the deal owner, because the reminders follow the owner

**Testing and feedback**

Joceli is on leave from today, so the plan is to run the first four days as they
are and gather your reactions while he is away. Please note anything that feels
wrong, badly timed or unhelpful, particularly the wording, whether 8:00am is the
right time, and whether one digest works better than separate emails per
proposal. We will work through the feedback when he is back.

Two known rough edges. A voicemail is recorded as a call, so the system cannot
tell whether you actually spoke to someone. And deal values currently print
without a thousands separator, so $14900 rather than $14,900.

Thanks

---

## Notes for Joceli, not part of the email

- The volume figure of 1.4 proposals per business day comes from 69 proposals
  across 50 business days, 1 July to 8 September 2026. Recalculate before
  quoting it again later.
- The Day 7, 14 and 20 wording is already drafted in `messages.md` if the team
  asks to see it.
- The journey page is private until you share it from the page's share menu.
  Do that before sending, or the link will not open for anyone else. It also
  still shows the fuller six-step journey, which is why the email introduces it
  as the full design rather than as what is running.
- Two claims from the Zapier-era draft were removed because the live code does
  not behave that way: that logging a follow-up stops all the reminders (it
  only suppresses Day 4), and that moving a deal out of the stage and back in
  restarts the clock (the count comes from `Date_Proposal_Sent`).
- Chris is the first live case. His *2026 Constitution Review* was dated
  10 September, so he should receive a Day 2 digest at 08:00 on Friday. Worth
  asking him to confirm it arrived.
