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
| `Date_Proposal_Sent` | date | **The journey clock.** Searchable, already used by the team, and exposed by Zapier's packaged search action. Blank on 9 of 62 open deals, which the digest surfaces rather than hides |
| `Last_Activity_Time` | datetime | The same-day activity test |
| `Stage_Modified_Time` | datetime | Not used by the current build. Considered as the journey clock and rejected: it cannot be filtered server-side and is not exposed by Zapier's packaged search action. See traps 1 and 2 |

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

Taken together, these are why the build counts from `Date_Proposal_Sent` rather
than `Stage_Modified_Time`, and why the Zap fetches every deal at Formal Quote
Sent and filters in code rather than narrowing the query.

## Data quality as it stands today

Of the **62 deals** currently at `Formal Quote Sent`:

- **9** have a blank `Date_Proposal_Sent`
- the oldest carries a proposal date of **12 August 2024**
- **~30** belong to one consultant, which matches the "Chris has 30 deals open"
  figure raised in the meeting
- only **7** have a proposal date on or after 1 September 2026

The 9 blanks are the weak point of counting from `Date_Proposal_Sent`. Rather
than let roughly one proposal in seven silently never enter the journey — the
precise failure the project exists to fix — the digest lists undated proposals
in a short section of the same email and asks for the date. Visible, not
dropped.

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

So a typical morning is **one email listing one proposal**. On the busiest day
in those ten weeks it would have been one email listing three. The 62 open deals
generate nothing, enforced by the `GO_LIVE_DATE` guard in the Code step.

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
