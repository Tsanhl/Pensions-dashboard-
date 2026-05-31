import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "visual-regression", "latest");
const REQUIRED_VIEWS = ["overview", "pensions", "contributions", "investments", "target", "insights", "documents", "assistant", "settings"];
const REQUIRED_VARIABLES = ["--content-max", "--page-x", "--space-section", "--fs-top-title", "--fs-page-title", "--fs-card-title", "--fs-body"];

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function extractVariables(css) {
  const vars = {};
  for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[match[1]] = match[2].trim();
  return vars;
}

async function main() {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });
  const [html, css, appJs, serverJs, guide] = await Promise.all([
    readFile(path.join(ROOT, "index.html"), "utf8"),
    readFile(path.join(ROOT, "styles.css"), "utf8"),
    readFile(path.join(ROOT, "app.js"), "utf8"),
    readFile(path.join(ROOT, "server.js"), "utf8"),
    readFile(path.join(ROOT, "server", "prompts", "ANSWER_QUALITY_GUIDE.md"), "utf8")
  ]);
  const failures = [];
  const variables = extractVariables(css);

  for (const view of REQUIRED_VIEWS) {
    assert(new RegExp(`<section\\s+class="view[^>]*id="${view}"|<section\\s+id="${view}"[^>]*class="view`, "i").test(html), `Missing ${view} view section.`, failures);
    assert(new RegExp(`data-view="${view}"`, "i").test(html), `Missing navigation or action for ${view}.`, failures);
  }

  for (const variable of REQUIRED_VARIABLES) assert(Boolean(variables[variable]), `Missing design-system variable ${variable}.`, failures);

  assert(/font-family:\s*"Inter"/.test(css), "Inter should be the single declared UI font.", failures);
  assert(!/Calibri/.test(css), "Do not mix Calibri into the UI.", failures);
  assert(/\.topbar,\s*\.view,\s*\.alerts-popover[\s\S]*width:\s*min\(100%,\s*var\(--content-max\)\)/.test(css), "Topbar, views and alert popover must share the same content width.", failures);
  assert(/\.segment-btn\.active[\s\S]*color:\s*#fff/.test(css), "Selected projection tabs must have readable high-contrast text.", failures);
  assert(!/Drag across the chart|scroll inside the chart/i.test(html + appJs), "Remove chart drag/scroll instruction copy.", failures);
  assert(!/Latest uploaded facts update the dashboard automatically|If a scanned value is wrong/i.test(html + appJs), "Remove old document auto-update copy.", failures);
  const targetSection = (html.match(/<section class="view" id="target"[\s\S]*?<section class="view" id="insights"/) || [""])[0];
  assert(!/Ask AI/i.test(targetSection), "Target summary should not show an Ask AI button.", failures);
  assert(/Ask AI/i.test(html), "Investment review should include an Ask AI action for personalised suggestions.", failures);

  assert(/Connection settings \(API testing\)/.test(html), "Assistant must include API testing connection settings.", failures);
  assert(/data-api-provider/.test(appJs) && /data-api-key/.test(appJs) && /data-api-model/.test(appJs) && /data-api-endpoint/.test(appJs), "API provider/key/model/endpoint controls must be wired in app.js.", failures);
  assert(/\/api\/test-connection/.test(serverJs), "Server must expose API connection testing endpoint.", failures);
  assert(/\/api\/investment-review/.test(serverJs), "Server must expose investment style review endpoint.", failures);
  assert(/\/api\/portfolio/.test(serverJs), "Server must expose backend portfolio snapshot endpoint.", failures);
  assert(/body\.provider|resolveProvider\(body\)/.test(serverJs), "Assistant endpoint should respect user-selected provider for testing.", failures);
  assert(/appendDataUsedSection/.test(serverJs), "Assistant answers must pass through backend output cleanup.", failures);
  assert(!/Data used in this answer\\n\$\\{dataUsedLines/.test(serverJs), "Assistant answers should not append a visible data-used section.", failures);
  assert(/buildAssistantInstructions/.test(serverJs), "Answering guide must remain in the backend prompt path.", failures);
  assert(guide.length > 1000, "Server-side answer guide should be retained.", failures);
  assert(!existsSync(path.join(ROOT, "ANSWER_QUALITY_GUIDE.md")), "Answer guide must not be in the public root.", failures);
  assert(/PUBLIC_FILES/.test(serverJs) && /\.md/.test(serverJs) && /\.env/.test(serverJs), "Static serving must continue to allowlist files and block guide/env files.", failures);

  const report = {
    generatedAt: new Date().toISOString(),
    checkedViews: REQUIRED_VIEWS,
    variables: Object.fromEntries(REQUIRED_VARIABLES.map((name) => [name, variables[name] || null])),
    checks: {
      consistentInter: /font-family:\s*"Inter"/.test(css),
      readableProjectionTabs: /\.segment-btn\.active[\s\S]*color:\s*#fff/.test(css),
      apiTestingUi: /Connection settings \(API testing\)/.test(html),
      investmentReviewEndpoint: /\/api\/investment-review/.test(serverJs),
      backendPortfolioEndpoint: /\/api\/portfolio/.test(serverJs),
      guideRetainedServerSide: guide.length > 1000
    },
    failures
  };
  await writeFile(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  if (failures.length) {
    console.error(failures.map((failure) => `- ${failure}`).join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Visual/static checks passed. Report written to ${path.relative(ROOT, path.join(OUT_DIR, "report.json"))}.`);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
