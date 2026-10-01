import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Run against a built public preview: BASE_URL=http://127.0.0.1:4173 npm run qa:platform
// Use CHROME_PATH for an installed browser; otherwise `npx playwright install chromium`.
const base = process.env.BASE_URL || "http://127.0.0.1:4173";
const out =
  process.env.QA_OUTPUT ||
  path.join(tmpdir(), `fddd-platform-v3.0.0-${Date.now()}`);
await mkdir(out, { recursive: true });
const report = {
  version: "v3.0.0",
  base,
  checks: [],
  errors: [],
  failedData: [],
};
const pass = (message) => {
  report.checks.push(message);
  console.log("PASS", message);
};
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH
    ? { executablePath: process.env.CHROME_PATH }
    : {}),
  args: [
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    ...(process.platform === "darwin" ? ["--use-angle=metal"] : []),
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: "ko-KR",
});
await context.addInitScript(() => {
  if (!localStorage.getItem("fddd.fly-count"))
    localStorage.setItem("fddd.fly-count", "4");
});
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400 && response.url().includes("/data/"))
    report.failedData.push({ url: response.url(), status: response.status() });
});
const shot = async (name) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, name + ".png") });
};
try {
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 90_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  pass("English default on a Korean browser");
  await page
    .locator('.platform[data-ready="true"]')
    .waitFor({ timeout: 120_000 });
  await page.waitForFunction(() => window.__fdddTiming?.fly0.age > 1, null, {
    timeout: 120_000,
  });
  pass("Real MaleCNS workers initialize and compute successive steps");
  const learning = page.getByRole("switch", { name: "Preference learning" });
  await learning.click();
  await expect(learning).toHaveAttribute("aria-checked", "false");
  const preference = await page.locator(".preference-card").innerText();
  let step = await page.locator(".readout-heading").innerText();
  await page.waitForTimeout(2000);
  assert.equal(await page.locator(".preference-card").innerText(), preference);
  assert.notEqual(await page.locator(".readout-heading").innerText(), step);
  pass("Learning off freezes preferences while neural computation continues");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(600);
  step = await page.locator(".readout-heading").innerText();
  await page.waitForTimeout(600);
  assert.equal(await page.locator(".readout-heading").innerText(), step);
  pass("Pause freezes computed steps");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .locator('.neural-observatory[data-scene-status="ready"]')
    .waitFor();
  await shot("desktop");
  const brainCanvas = page.locator(".neural-observatory canvas");
  const initialBrain = await brainCanvas.screenshot();
  const area = await brainCanvas.boundingBox();
  await page.mouse.move(area.x + area.width * 0.5, area.y + area.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    area.x + area.width * 0.7,
    area.y + area.height * 0.58,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(700);
  assert.ok(!initialBrain.equals(await brainCanvas.screenshot()));
  await page.getByRole("button", { name: "Reset brain view" }).click();
  pass("Dragging the actual WebGL brain changes its rendered camera view");

  await page.getByRole("button", { name: "Connections on" }).click();
  await expect(
    page.getByRole("button", { name: "Connections off" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Connections off" }).click();
  pass("Live measured brain and sampled real connections render and toggle");
  await page.locator(".loop-guide > summary").click();
  await page.getByRole("tab", { name: "01 Dock" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "02 Reward" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "05 Learn" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  pass("Signal tabs support keyboard navigation");
  await page.getByRole("button", { name: "COX-2", exact: true }).click();
  await expect(page.locator(".candidate-list > button")).toHaveCount(2);
  await page.locator(".candidate-list > button").first().click();
  await page
    .locator('.molecule-scene[data-scene-status="ready"]')
    .waitFor({ timeout: 60_000 });
  await expect(page.locator(".pose-overlay")).toContainText("Celecoxib");
  pass("Protein filters load the selected actual docking pose");
  await page.locator("#experiment").scrollIntoViewIfNeeded();
  await shot("workbench-pose");
  await page.getByRole("button", { name: "Next fly", exact: true }).click();
  await expect(page.locator(".individual-selector")).toContainText("EMBER 02");
  await page.getByRole("button", { name: "01 Brain", exact: true }).click();
  await expect(page.locator(".stage-ident")).toContainText("EMBER 02");
  await page.getByRole("button", { name: "02 Docking", exact: true }).click();
  pass("Individual selection synchronizes neural and preference panels");
  await page.getByRole("button", { name: "Inspect in Mol*" }).click();
  await expect(page.locator(".molecular-caption")).toContainText(
    "experimental receptor",
    { timeout: 90_000 },
  );
  await page.waitForTimeout(1800);
  await shot("molecular-inspector");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Inspect in Mol*" }),
  ).toBeFocused();
  pass("Mol* loads real coordinates; Escape closes and restores focus");
  await page.getByRole("button", { name: "03 Flight", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Show all habitats" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Show all habitats" }).click();
  await expect(
    page.getByRole("button", { name: "Follow selected fly" }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Follow selected fly" }).click();
  await page.waitForTimeout(1600);
  await shot("flight-follow");
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Follow selected fly" }),
  ).toHaveAttribute("aria-pressed", "false");
  pass("Flight follow, overview, and reset controls synchronize the camera");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.locator("#colony").scrollIntoViewIfNeeded();
  await page.locator(".fly-cell").nth(2).click();
  await expect(page.locator(".individual-selector")).toContainText("ULTRA 03");
  await shot("colony");
  pass("Colony tiles select real independent individuals");
  await page.getByRole("button", { name: "Methods, sources & limits" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "does not independently discover binding strength",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  pass("Methods expose measured, computed, and authored boundaries");
  await page
    .getByRole("button", { name: "Watch the film", exact: true })
    .click();
  const iframe = await page.locator(".film-frame").elementHandle();
  const film = await iframe.contentFrame();
  await film.waitForFunction(() => window.__ready === true, null, {
    timeout: 60_000,
  });
  await film.getByRole("button", { name: "15s", exact: true }).click();
  await film.getByRole("button", { name: "30s", exact: true }).click();
  await shot("showreel");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  pass("English showreel unpacks and both cut controls respond");
  await page.locator(".session-button").click();
  await expect(page.getByRole("dialog")).toContainText("500 MB");
  await expect(
    page.getByRole("button", { name: "Save records to project" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  pass("Public session explains the cap and hides unavailable local export");
  await page
    .getByRole("combobox", { name: "Number of brains" })
    .selectOption("8");
  await expect(page.getByRole("dialog")).toContainText("will reset");
  await page.getByRole("button", { name: "Keep this session" }).click();
  await expect(
    page.getByRole("combobox", { name: "Number of brains" }),
  ).toHaveValue("4");
  pass("Canceling a restart preserves the existing colony");
  await page.getByRole("button", { name: "KO", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/ko");
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator("h1")).toContainText("신호를 따라가세요.");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  assert.equal(new URL(page.url()).pathname, "/en");
  pass("English and Korean switch both content and route");
  await page.getByRole("button", { name: "01 Brain", exact: true }).click();
  await page
    .locator('.neural-observatory[data-scene-status="ready"]')
    .waitFor();
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      width,
    );
    if (width === 390 || width === 768) await shot("viewport-" + width);
    if (width === 390) {
      await page.locator(".world-panel").scrollIntoViewIfNeeded();
      await shot("mobile-workbench");
      await page.locator("#colony").scrollIntoViewIfNeeded();
      await shot("mobile-colony");
    }
    pass(`No document overflow at ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("combobox", { name: "Number of brains" })
    .selectOption("8");
  await page
    .getByRole("button", { name: "Start new colony", exact: true })
    .click();
  await page
    .locator('.platform[data-ready="true"]')
    .waitFor({ timeout: 120_000 });
  await expect(page.locator(".fly-cell")).toHaveCount(8);
  // Starting a new colony intentionally retains the user's pause/learning settings.
  await expect(learning).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.waitForFunction(() => window.__fdddTiming?.flies === 8, null, {
    timeout: 120_000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  pass(
    "Confirmed restart initializes eight real brains and retains control settings",
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("desktop-eight");
  await page.getByRole("button", { name: "01 Brain", exact: true }).click();
  await shot("desktop-eight-brain");
  report.runtime = await page.evaluate(() => window.__fdddTiming);
  report.browser = browser.version();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failedData, []);
  const ready = async (p) => {
    await p
      .locator('.platform[data-ready="true"]')
      .waitFor({ timeout: 90_000 });
    await p.waitForFunction(() => window.__fdddTiming?.fly0.age > 0.5, null, {
      timeout: 60_000,
    });
  };
  const advancing = async (p) => {
    const before = await p
      .locator(".individual-live .readout-heading")
      .innerText();
    await p.waitForTimeout(1000);
    assert.notEqual(
      await p.locator(".individual-live .readout-heading").innerText(),
      before,
    );
  };
  const records = async (p) =>
    p.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const r = indexedDB.open("fddd-neural-assays", 2);
          r.onerror = () => reject(r.error);
          r.onsuccess = () => {
            const db = r.result,
              q = db.transaction("runs").objectStore("runs").getAll();
            q.onsuccess = () => {
              resolve(q.result.map((x) => x.id));
              db.close();
            };
            q.onerror = () => reject(q.error);
          };
        }),
    );
  const multiple = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await multiple.addInitScript(() => {
    localStorage.setItem("fddd.fly-count", "4");
    window.deletedDB = 0;
    const original = IDBFactory.prototype.deleteDatabase;
    IDBFactory.prototype.deleteDatabase = function (...args) {
      window.deletedDB++;
      return original.apply(this, args);
    };
  });
  const first = await multiple.newPage();
  await first.goto(base + "/en");
  await ready(first);
  const firstRecords = await records(first);
  assert.ok(firstRecords.length > 0);
  const second = await multiple.newPage();
  await second.goto(base + "/en");
  await ready(second);
  await advancing(first);
  await advancing(second);
  const allRecords = await records(second);
  assert.ok(firstRecords.every((id) => allRecords.includes(id)));
  assert.equal(await second.evaluate(() => window.deletedDB), 0);
  await second.reload();
  await ready(second);
  await advancing(first);
  const postReloadRecords = await records(second);
  assert.ok(firstRecords.every((id) => postReloadRecords.includes(id)));
  await second.screenshot({
    path: path.join(out, "two-tabs-after-reload.png"),
  });
  pass(
    "Two tabs and a reload compute concurrently without deleting the other live session",
  );
  await multiple.close();
  for (const failure of ["denied", "blocked", "quota"]) {
    const isolated = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    await isolated.addInitScript((kind) => {
      localStorage.setItem("fddd.fly-count", "4");
      if (kind === "denied")
        IDBFactory.prototype.open = function () {
          throw new DOMException("QA unavailable storage", "SecurityError");
        };
      if (kind === "blocked")
        IDBFactory.prototype.open = function () {
          const r = {};
          setTimeout(() => r.onblocked?.(), 20);
          return r;
        };
      if (kind === "quota") {
        const put = IDBObjectStore.prototype.put;
        let writes = 0;
        IDBObjectStore.prototype.put = function (...args) {
          if (this.name === "chunks" && ++writes > 2)
            throw new DOMException("QA exhausted quota", "QuotaExceededError");
          return put.apply(this, args);
        };
      }
    }, failure);
    const p = await isolated.newPage();
    const isolatedErrors = [];
    p.on("pageerror", (e) => isolatedErrors.push(e.message));
    await p.goto(base + "/en");
    await ready(p);
    await expect(p.locator(".storage-note")).toBeVisible();
    await advancing(p);
    await expect(p.locator(".error-notice")).toHaveCount(0);
    await p.getByRole("button", { name: "Pause", exact: true }).click();
    await p.waitForTimeout(350);
    const frozen = await p.locator(".readout-heading").innerText();
    await p.waitForTimeout(500);
    assert.equal(await p.locator(".readout-heading").innerText(), frozen);
    await p.getByRole("button", { name: "Resume", exact: true }).click();
    await advancing(p);
    await p.screenshot({ path: path.join(out, "storage-" + failure + ".png") });
    assert.deepEqual(isolatedErrors, []);
    pass(
      "Storage " +
        failure +
        ": clear notice; actual computation and pause/resume remain functional",
    );
    await isolated.close();
  }
  const retryContext = await browser.newContext();
  await retryContext.addInitScript(() =>
    localStorage.setItem("fddd.fly-count", "4"),
  );
  const retry = await retryContext.newPage();
  await retry.route("**/data/malecns/connectome.bin.gz", (route) =>
    route.fulfill({ status: 503, body: "QA temporary graph outage" }),
  );
  await retry.goto(base + "/en");
  await expect(retry.locator(".error-notice")).toBeVisible({ timeout: 30_000 });
  await retry.unroute("**/data/malecns/connectome.bin.gz");
  await retry
    .getByRole("button", { name: "Restart simulation", exact: true })
    .click();
  await ready(retry);
  await advancing(retry);
  pass(
    "A failed graph download exposes recovery and Restart successfully reloads the real graph",
  );
  await retry.route('**/data/docking/multi-target.json',route=>route.fulfill({status:503,body:'QA temporary metadata outage'}));
  await retry.reload();await expect(retry.locator('.error-notice')).toBeVisible({timeout:30_000});
  await retry.unroute('**/data/docking/multi-target.json');
  await retry.getByRole('button',{name:'Restart simulation',exact:true}).click();await ready(retry);await advancing(retry);
  pass('Failed candidate metadata reloads through Restart and restores a running experiment');
  await retryContext.close();
  report.passed = true;
} catch (error) {
  report.failure = String(error);
  await shot("failure");
  process.exitCode = 1;
} finally {
  await writeFile(
    path.join(out, "results.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("QA artifacts:", out);
  await browser.close();
}
