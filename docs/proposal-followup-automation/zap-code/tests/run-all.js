/**
 * Runs every Code-step test. Usage, from the repository root:
 *   node docs/proposal-followup-automation/zap-code/tests/run-all.js
 *
 * Each test file mocks Date.now() so the business-day arithmetic can be checked
 * against fixed dates, and feeds the Code steps the same JSON shape the Zoho
 * API actually returns. No network access and no Zapier account required.
 */
var path = require('path');
var child = require('child_process');

var suites = ['day1.test.js', 'morning.test.js', 'afternoon.test.js'];
var failed = [];

suites.forEach(function (suite) {
  console.log('\n=== ' + suite + ' ===');
  var result = child.spawnSync(process.execPath, [path.join(__dirname, suite)], { stdio: 'inherit' });
  if (result.status !== 0) failed.push(suite);
});

console.log('\n' + (failed.length ? 'FAILED: ' + failed.join(', ') : 'All suites passed.'));
process.exit(failed.length ? 1 : 0);
