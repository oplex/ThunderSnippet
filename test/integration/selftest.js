// In-Thunderbird self-test entry point (test build only): runs every case
// against the real APIs and POSTs a report to the runner.

import { REPORT_URL } from "./config.js";
import { results, post, log, waitFor } from "./util.js";
import { composeTests } from "./tests-compose.js";
import { paletteTests } from "./tests-palette.js";
import { ready } from "../../src/background/background.js";

async function runnerReady() {
  try {
    return (await (await fetch(`${REPORT_URL}ready`)).text()) === "yes";
  } catch {
    return false;
  }
}

async function run() {
  const info = await browser.runtime.getBrowserInfo();
  log(`running in ${info.name} ${info.version}`);
  await waitFor(async () => (await browser.mailTabs.query({})).length > 0, "a mail tab", 60000);
  await waitFor(runnerReady, "runner to be ready", 60000);
  await ready;
  await composeTests();
  await paletteTests();
  await post({ type: "result", version: info.version, tests: results });
}

run().catch((e) => post({ type: "result", version: "?", tests: [...results, { name: "self-test crashed", ok: false, error: String(e?.stack ?? e) }] }));
