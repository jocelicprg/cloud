# Shared conventions for the Code steps

Both scheduled Zaps use the same helper block. It is duplicated in each file on
purpose: Code by Zapier has no shared-library mechanism, so each step must be
self-contained. If you change a helper, change it in both files.

## Timezone

CPR Group's Zoho org runs `Australia/Queensland` (verified via the CRM
Organization API). Queensland does not observe daylight saving, so the offset is
a fixed **UTC+10:00** all year. The code therefore uses a constant offset rather
than a timezone library, which Code by Zapier does not reliably provide.

## Why business days

A proposal sent on a Friday should reach Day 2 on the Monday, not the Saturday.
All day counting skips Saturday and Sunday. Public holidays are **not** handled
in this version - see the limitations section of BUILD-SPEC.md.
