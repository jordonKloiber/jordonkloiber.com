import fs from 'node:fs';

// Converts a Playwright JSON report into test-run-api's canonical payload
// shape and posts it. Never fails the CI run on its own. Does not block deploy.

const REPORT_PATH = process.env.PW_JSON_REPORT ?? 'playwright-report/results.json';
const API_URL = 'https://test-run-api-796881713635.us-central1.run.app';
const API_KEY = process.env.TEST_RUN_API_KEY;
const SOURCE = 'jordonkloiber.com';

if (!API_KEY) {
  console.log('TEST_RUN_API_KEY not set — skipping test-run-api report.');
  process.exit(0);
}

if (!fs.existsSync(REPORT_PATH)) {
  console.log(`No Playwright JSON report at ${REPORT_PATH} — skipping test-run-api report.`);
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

function statusFor(pwStatus) {
  if (pwStatus === 'passed') return 'pass';
  if (pwStatus === 'skipped') return 'skip';
  return 'fail'; // failed, timedOut, interrupted
}

// A suite tree nests arbitrarily deep (one level per describe block), and
// specs can appear at any level, so this has to recurse.
function collectSpecs(suite, titlePath = []) {
  const path = suite.title ? [...titlePath, suite.title] : titlePath;
  const specs = (suite.specs ?? []).map((spec) => ({ spec, path }));
  for (const child of suite.suites ?? []) {
    specs.push(...collectSpecs(child, path));
  }
  return specs;
}

const allSpecs = (report.suites ?? []).flatMap((s) => collectSpecs(s));

const results = allSpecs.map(({ spec, path }) => {
  const test = spec.tests[0];
  const finalResult = test.results[test.results.length - 1];
  const totalDurationMs = test.results.reduce((sum, r) => sum + (r.duration ?? 0), 0);
  const status = statusFor(finalResult.status);

  return {
    test_name: [...path, spec.title].join(' > '),
    status,
    duration_ms: Math.round(totalDurationMs),
    error_message: status === 'fail' ? (finalResult.error?.message ?? 'unknown error') : null,
  };
});

if (results.length === 0) {
  console.log('No test results in report — nothing to send.');
  process.exit(0);
}

try {
  const res = await fetch(`${API_URL}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ suite_name: 'jordonkloiber.com-playwright', source: SOURCE, results }),
  });

  if (!res.ok) {
    console.log(`test-run-api responded ${res.status}: ${await res.text()}`);
    process.exit(0);
  }

  console.log(`Reported ${results.length} test results to test-run-api.`);
} catch (err) {
  console.log(`Failed to reach test-run-api: ${err.message}`);
}

// Flaky check runs independently of the post above-- a failure here
// shouldn't be read as the report itself failing.
try {
  const res = await fetch(`${API_URL}/flaky?source=${encodeURIComponent(SOURCE)}&n=10`);

  if (!res.ok) {
    console.log(`test-run-api flaky check responded ${res.status}: ${await res.text()}`);
  } else {
    const flaky = (await res.json()).filter((t) => t.is_flaky);

    if (flaky.length === 0) {
      console.log('No flaky tests over the last 10 runs.');
    } else {
      console.log(`${flaky.length} flaky test(s) over the last 10 runs:`);
      for (const t of flaky) {
        console.log(`  ${t.test_name} — pass rate ${(t.pass_rate * 100).toFixed(0)}% (${t.runs_considered} runs)`);
      }
    }
  }
} catch (err) {
  console.log(`Failed to check flaky status: ${err.message}`);
}
