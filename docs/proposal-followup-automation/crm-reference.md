# Verified CRM reference

Everything on this page was read from the live CPR Group Zoho CRM on
**9 September 2026**, not assumed. Anything not verified is called out as such.

## Organisation

| Item | Value |
|---|---|
| Company | CPR Group |
| Zoho `zgid` | `691602767` |
| Data centre | Australia — API host `https://www.zohoapis.com.au` |
| CRM host | `https://crm.zoho.com.au` |
| Org timezone | `Australia/Queensland` — fixed **UTC+10:00**, no daylight saving |
| Edition | Zoho One Enterprise, 15 user licences |
| Deal record URL | `https://crm.zoho.com.au/crm/org691602767/tab/Potentials/{deal_id}` |

Note the module API name for deals is **`Deals`**, but the *web UI* path segment
is `Potentials`. Both are correct in their own context; do not "fix" either.

## Deal stage values — read this before writing any filter

The Stage picklist stores a **display label**, and the field metadata's
`actual_value` is a stale legacy string that does **not** match what is stored.
Both the REST API and COQL return and filter on the display label.

| Use this (display label) | Do NOT use (metadata `actual_value`) |
|---|---|
| `Formal Quote Sent` | ~~`Proposal`~~ |
| `Closed Lost` | ~~`Lost - Not enough capacity to perform the work`~~ |
| `Future Opportunity` | `Future Opportunity` (same) |
| `Won` | `Won` (same) |

Verified: `select ... where Stage = 'Proposal'` returns **zero** rows, while
`Stage = 'Formal Quote Sent'` returns 62. A filter built on `Proposal` would
silently never fire, which is the worst possible failure for a reminder system.

Stages currently in use: `Cold`, `Warm`, `Short-listed`, `Formal Quote Sent`,
`Future Opportunity`, `Won`, `Closed Lost`.

## Fields used by the automation

| API name | Type | Why it matters |
|---|---|---|
| `Stage` | picklist | Journey entry and every exit |
| `Owner` | ownerlookup | The consultant. Returned as `{name, id, email}` — the email is included, so no extra user lookup is needed |
| `Account_Name` | lookup | Organisation. `{name, id}` |
| `Contact_Name` | lookup | Client contact. `{name, id}` — **can be `null`** |
| `Deal_Name` | text | Used in the message body |
| `Amount` | currency | Used in the Day 4 escalation |
| `Date_Proposal_Sent` | date | The consultant's own record of when the proposal went out |
| `Last_Activity_Time` | datetime | The same-day activity test |
| `Stage_Modified_Time` | datetime | **The journey clock.** When the stage last changed. Zoho maintains it, so no custom field is needed and nothing is written back — but see trap 1, which makes it easy to break |

## Three API traps found while building this

**1. `Stage_Modified_Time` returns `null` if you name it in `fields`.**
`GET /crm/v7/Deals/{id}` returns it correctly. `GET /crm/v7/Deals/search` also
returns it correctly — but only when the `fields` parameter is **omitted**. List
it in `fields` and the API returns the key with a `null` value rather than an
error, so the bug is invisible.

**2. `Stage_Modified_Time` is not selectable in COQL.**
`select Stage_Modified_Time from Deals` fails with
`INVALID_QUERY: column given seems to be invalid`.

**3. `Modified_Time` is not searchable.**
`(Modified_Time:greater_equal:...)` fails with
`the field is not available for search`. Ordinary date fields such as
Ordinary date fields such as `Date_Proposal_Sent` **are** searchable, and
`sort_by` on the search endpoint accepts only `id`, `Created_Time` and
`Modified_Time`.

Taken together, these are why the scheduled Zaps fetch every deal at Formal
Quote Sent and filter in code rather than narrowing the query: the clock they
filter on cannot be expressed in a search criterion or a COQL select.

## Data quality as it stands today

Of the **62 deals** currently at `Formal Quote Sent`:

- **9** have a blank `Date_Proposal_Sent`
- the oldest carries a proposal date of **12 August 2024**
- **~30** belong to one consultant, which matches the "Chris has 30 deals open"
  figure raised in the meeting
- only **7** have a proposal date on or after 1 September 2026

This is exactly why the journey clock is `Stage_Modified_Time` rather than
`Date_Proposal_Sent`: if it keyed off that field, roughly one proposal in seven
would silently never enter the journey — the precise failure the project exists
to fix. `Date_Proposal_Sent` is still shown in the messages, falling back to the
clock when blank.

One deal (`2026 Online Meeting`, Sarina Golf Club) has **no linked contact**, so
the message copy has to degrade gracefully rather than print `undefined`.

## Volume — what the team will actually receive

Measured over 1 July to 8 September 2026 (50 business days, 69 proposals):

| Measure | Value |
|---|---|
| Proposals per business day, whole team | **1.38** |
| Busiest consultant (Matt) | 0.42 per business day |
| Matt's expected concurrent journeys | ~1.7 |
| Busiest single day observed | 7 proposals (23 July) |

So at steady state a consultant should expect **one or two reminder emails on a
typical day**, not the flood the team was worried about. The 62 open deals do
**not** generate reminders — but note that this is enforced by the `GO_LIVE_DATE`
guard in the Code steps, not by anything in the data, since Zoho populates
`Stage_Modified_Time` on every record.

## People

| Name | CRM email | Role in this automation |
|---|---|---|
| Nathan Butcher | `nathan.butcher@cprgroup.com.au` | Copied on the Day 4 escalation |
| Chris Kenward | `chris@cprgroup.com.au` | Consultant |
| Matt McEwan | `matt@cprgroup.com.au` | Consultant |
| Scott Henry | `scott@cprgroup.com.au` | Consultant |
| Courtney Frederiksen | `courtney@cprgroup.com.au` | Consultant / marketing |
| Steve Connelly | `steve@cprgroup.com.au` | Consultant |
| Michael Connelly | `michael@cprgroup.com.au` | Consultant |
| Adrian Wright | `adrian.wright@cprgroup.com.au` | Administration |
| Marcelle Carvalho | `marcelle.carvalho@cprgroup.com.au` | Administration |

Deal ownership is already largely correct — the 62 open proposals are owned by
the consultants, not by an administrator. The routing risk raised in the meeting
is therefore real but small, and the Day 1 email is what surfaces it.
