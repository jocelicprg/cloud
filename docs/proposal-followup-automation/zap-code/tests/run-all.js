/**
 * Runs both suites:
 *   digest.test.js       - unit tests with a mocked clock
 *   live-payload.test.js - against a payload captured from the real Zapier
 *                          action on CPR Group's live CRM
 * Usage: node docs/proposal-followup-automation/zap-code/tests/run-all.js
 */
var path = require('path');
var child = require('child_process');
var failed = [];
['digest.test.js', 'live-payload.test.js'].forEach(function (suite) {
  console.log('\n=== ' + suite + ' ===');
  if (child.spawnSync(process.execPath, [path.join(__dirname, suite)], { stdio: 'inherit' }).status !== 0) {
    failed.push(suite);
  }
});
console.log('\n' + (failed.length ? 'FAILED: ' + failed.join(', ') : 'All suites passed.'));
process.exit(failed.length ? 1 : 0);
