# Superseded

This directory holds the Zapier build, which was abandoned in favour of the
Zoho CRM scheduled function in [`../zoho-function/`](../zoho-function/).

Kept for reference, not for use. Two reasons not to pick it back up as-is:

1. Zapier's packaged Zoho search returns **at most 10 records** against 61 deals
   at that stage, with no way to raise it. The Zoho function reads all of them.
2. `daily-digest.js` has the same undated-proposal bug that live testing found
   in the Deluge version: a proposal with no date bypasses the go-live guard,
   so the whole undated backlog would be emailed on the first morning. Only the
   Deluge version carries the fix.

The message wording and the day 2 to 4 rules were worked out here and are still
the source of the logic, so the tests in `tests/` remain meaningful as a record
of the intended behaviour.
