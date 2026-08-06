#!/usr/bin/env node
/* Runs the suites and exits non-zero if anything failed, so this is usable
   from a hook or an action later without changing anything.

   `node tests/run.js`          the jsdom suites, no browser needed
   `node tests/run.js --browser` those plus the real-layout checks */

const wantBrowser = process.argv.includes("--browser");

const SUITES = [
  "./contrast.test.js",
  "./output.test.js",
  "./state.test.js",
  "./covers.test.js"
].concat(wantBrowser ? ["./layout.test.js"] : []);

const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", OFF = "\x1b[0m";

(async () => {
  let passed = 0, failed = 0;
  const started = Date.now();

  for (const file of SUITES) {
    let s;
    try {
      s = await require(file)();
    } catch (e) {
      failed++;
      console.log(`${RED}✗${OFF} ${file} threw before it could report`);
      console.log(`  ${DIM}${e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n  ") : e}${OFF}`);
      continue;
    }
    console.log(`\n${s.name}`);
    for (const r of s.results) {
      if (r.ok) { passed++; console.log(`  ${GREEN}✓${OFF} ${r.label}`); }
      else {
        failed++;
        console.log(`  ${RED}✗ ${r.label}${OFF}`);
        if (r.detail) console.log(`    ${DIM}${r.detail}${OFF}`);
      }
    }
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${failed ? RED : GREEN}${passed} passed, ${failed} failed${OFF}  ${DIM}in ${secs}s${OFF}`);
  if (!wantBrowser) console.log(`${DIM}layout checks skipped, run with --browser to include them${OFF}`);
  process.exit(failed ? 1 : 0);
})();
