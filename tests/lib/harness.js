/* Shared plumbing for the jsdom suites.

   The builder is one self-contained file with no build step and no module
   system, so there is nothing to import: the only way to test it is to load
   the real page and drive the real controls. That is also the honest way to
   test it, because almost every bug this suite has caught lived in the wiring
   between a control and the generated CSS rather than in a function. */

const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const PAGE = path.join(__dirname, "..", "..", "index.html");

/* Loads index.html and runs it. `url` matters: on a file:// origin jsdom
   gives localStorage an opaque origin and every save throws, which would
   make the persistence suite pass for the wrong reason. */
function boot(opts) {
  opts = opts || {};
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", e => errors.push("jsdomError: " + e.message));
  vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

  const dom = new JSDOM(fs.readFileSync(PAGE, "utf8"), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: opts.url || "https://example.test/"
  });

  const w = dom.window;
  const d = w.document;

  return {
    dom, window: w, document: d, errors,
    $: sel => d.querySelector(sel),
    all: sel => Array.from(d.querySelectorAll(sel)),
    click: sel => { const el = d.querySelector(sel); if (!el) throw new Error("no element: " + sel); el.click(); },
    // the builder listens for `input`, not `change`, on its text fields
    fill: (sel, value) => {
      const el = d.querySelector(sel);
      if (!el) throw new Error("no element: " + sel);
      el.value = value;
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
    },
    // the full generated snippet, settings comment and all
    code: () => d.getElementById("code").textContent,
    // just the widget, with the trailing settings comment removed
    widget: () => {
      const c = d.getElementById("code").textContent;
      const i = c.lastIndexOf("<!-- Reopen");
      return i < 0 ? c : c.slice(0, i);
    },
    close: () => w.close()
  };
}

// render(true) debounces at 250ms and saveSoon at 600ms, so anything that
// asserts on generated output has to outlast whichever one it depends on
const wait = ms => new Promise(r => setTimeout(r, ms));

/* A deliberately tiny assertion layer. This project has no build step and no
   framework, and a test suite that needs more setup than the thing it tests
   is a suite nobody runs. */
function suite(name) {
  const results = [];
  return {
    name,
    check(label, ok, detail) {
      results.push({ label, ok: !!ok, detail: detail == null ? "" : String(detail) });
    },
    equal(label, actual, expected) {
      this.check(label, actual === expected,
        actual === expected ? "" : "got " + JSON.stringify(actual) + ", wanted " + JSON.stringify(expected));
    },
    results,
    get failed() { return results.filter(r => !r.ok); }
  };
}

module.exports = { boot, wait, suite, PAGE };
