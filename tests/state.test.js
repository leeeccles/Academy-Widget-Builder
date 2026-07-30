/* Saved work, shared work, and reopening a widget from its own code.

   These three paths all funnel through adopt(), which writes straight into
   the live state objects. That makes it the one place where bad input can do
   real damage, and the only place in the builder that accepts anything from
   outside the session. So it gets the adversarial half of this file.

   The bar for a bad input is not "does not crash". It is: the message says
   what is wrong, and whatever the user had on screen is still there. */

const { boot, wait, suite } = require("./lib/harness");

const mark = obj => "<!-- awb:1:" + Buffer.from(JSON.stringify(obj)).toString("base64url") + " -->";
/* The scoping suffix is derived from the widget's settings, so two sessions
   holding the same settings now agree on it and these comparisons could be made
   without normalising at all. Kept, because the round-trip assertions are about
   the widget being the same widget, and tying them to the hash function would
   mean every future change to what feeds the seed reads as a round-trip failure.
   Width-tolerant, since the suffix went from 4 digits to 6. */
const norm = s => s.replace(/\b(cw|hw|cts|ctd)\d{4,8}\b/g, "$1X");

module.exports = async function run() {
  const s = suite("state");

  /* ---- autosave and restore ---- */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="classroom"]');
    t.fill('#ctPanel input[type="text"]', "Workshops for the autumn");
    await wait(900);   // saveSoon debounces at 600ms

    const stored = t.window.localStorage.getItem("awb.state.v1");
    s.check("autosave writes to localStorage", !!stored);
    s.check("autosave contains the edit", /autumn/.test(stored || ""));

    /* ---- share link round trip into a clean session ---- */
    let url = null;
    t.window.navigator.clipboard = { writeText: v => { url = v; return Promise.resolve(); } };
    t.click("#share");
    await wait(50);
    s.check("share link is built", !!url && url.indexOf("#s=") > 0);

    if (url) {
      const u = boot({ url });
      await wait(400);
      s.equal("share link restores the edit",
        u.$('#ctPanel input[type="text"]').value, "Workshops for the autumn");
      // left in place, a refresh would silently discard everything done since
      s.check("share link hash is stripped after loading", u.window.location.hash === "");
      s.check("share link opens on the right widget", !u.$("#panelClassroom").hidden);
      u.close();
    }
    t.close();
  }

  /* ---- a corrupt save must not brick the page ---- */
  {
    const t = boot();
    t.window.localStorage.setItem("awb.state.v1", '{"active":"hero","hero":{"c":null,"prompts":42}}');
    t.close();
    const u = boot();
    await wait(400);
    s.check("a corrupt save recovers to a working builder", u.code().length > 400);
    u.close();
  }

  /* ---- reopening from the widget's own code, byte for byte ---- */
  {
    const t = boot();
    await wait(300);
    const made = [];

    t.click('button[data-w="hero"]');
    t.fill("#h1", "Autumn programme");
    t.fill("#h2i", "for new managers");
    t.fill("#href", "/paths/xyz789/home");
    t.fill("#imgUrl", "https://example.test/a.jpg");
    t.fill("#alt", "A photo");
    t.click('#presets [data-preset="plum"]');
    t.click('button[data-fill="gradient"]');
    t.click('button[data-layout="imageFirst"]');
    await wait(500); made.push(["hero", t.code()]);

    t.click('button[data-w="classroom"]');
    await wait(500); made.push(["path slides", t.code()]);

    t.click("#ctMoreToggle");
    t.click('#ctMoodSeg button[data-ctmood="dark"]');
    t.click('#ctMorePresets [data-ctpreset="navy"]');
    await wait(500); made.push(["path slides, dark", t.code()]);

    t.click('button[data-w="companion"]');
    t.fill("#prompts input", "What training is on this month?");
    await wait(500); made.push(["companion", t.code()]);
    t.close();

    // a clean session with no saved work, the way a colleague would arrive
    const u = boot();
    await wait(400);
    for (const [label, code] of made) {
      u.$("#loadCode").value = code;
      u.click("#loadBtn");
      await wait(500);
      s.check(`${label}: round-trips through its own code byte for byte`,
        norm(u.code()) === norm(code));
    }
    u.close();
  }

  /* ---- anything from outside the session, deliberately wrong ---- */
  {
    const t = boot();
    await wait(300);
    // something on screen that must survive every bad paste below
    t.click('button[data-w="classroom"]');
    t.fill('#ctPanel input[type="text"]', "Work in progress");
    await wait(400);

    const hostile = [
      ["not builder code", "hello world"],
      ["empty paste", ""],
      ["marker with a corrupt payload", "<!-- awb:1:zzzzINVALIDzzzz -->"],
      ["valid base64 that is not a state", mark("just a string")],
      ["a widget type that does not exist", mark({ v: 1, active: "wat", hero: { h1: "x" } })],
      ["a null widget", mark({ v: 1, active: "hero", hero: null })],
      ["an array where an object belongs", mark({ v: 1, active: "hero", hero: [1, 2, 3] })],
      ["empty prompt list", mark({ v: 1, active: "companion", companion: { prompts: [] } })],
      ["empty slide list", mark({ v: 1, active: "classroom", classroom: { layout: "deck", w2: { slides: [] } } })],
      ["invalid hex colours", mark({ v: 1, active: "hero", hero: { c: {
        panel: "nonsense", heading: "#zzz", accent: "", body: null,
        btnBg: "#fff", btnFg: "#000", panel2: "#eee" } } })],
      // deliberately the pre-2026-07-30 shape: a saved link or a pasted widget
      // from before the Signpost was removed still has to load without throwing
      ["a removed layout, with its data", mark({ v: 1, active: "classroom", classroom: {
        layout: "signpost", w1: { items: [{ title: "T", dur: "two hours" }] } } })],
      ["a duration that is a string", mark({ v: 1, active: "classroom", classroom: {
        w2: { slides: [{ title: "T", dur: "two hours" }] } } })],
      ["a bullet list that is not a list", mark({ v: 1, active: "classroom", classroom: {
        layout: "deck", w2: { slides: [{ title: "T", obj: "nope", cad: {} }] } } })],
      ["a script tag in a heading", mark({ v: 1, active: "hero", hero: {
        h1: "<script>alert(1)</script>", alt: '"><img src=x onerror=y>',
        imgMode: "url", imgUrl: "https://example.test/a.jpg" } })],
      ["a javascript: link", mark({ v: 1, active: "hero", hero: {
        showBtn: true, btnText: "Go", linkMode: "external", hrefExternal: "javascript:alert(1)" } })],
      ["a protocol-relative link", mark({ v: 1, active: "classroom", classroom: {
        w2: { allOn: true, allText: "Go", allHref: "//evil.example" } } })],
      ["a future settings version", "<!-- awb:2:" + Buffer.from("{}").toString("base64url") + " -->"]
    ];

    for (const [label, payload] of hostile) {
      t.$("#loadCode").value = payload;
      t.click("#loadBtn");
      await wait(400);
      const widget = t.widget();
      s.check(`${label}: produces clean output`, !/NaN|undefined|\[object/.test(widget), widget.slice(0, 80));
      s.check(`${label}: says something`, t.$("#loadMsg").textContent.trim().length > 0);
    }

    // the injection cases are the ones worth looking at directly
    t.$("#loadCode").value = mark({ v: 1, active: "hero", hero: {
      h1: "<script>alert(1)</script>", alt: '"><img src=x onerror=y>',
      imgMode: "url", imgUrl: "https://example.test/a.jpg" } });
    t.click("#loadBtn");
    await wait(400);
    const w = t.widget();
    s.check("a script tag is escaped, not emitted", /&lt;script&gt;/.test(w) && !/<script[\s>]/i.test(w));
    s.check("an attribute-breaking alt is escaped", /alt="[^"]*&quot;/.test(w));
    s.check("no javascript: link survives to the output", !/javascript:/i.test(w));

    s.check("no page errors across every hostile paste", t.errors.length === 0, t.errors.join(" | "));
    t.close();
  }

  /* ---- resets and pastes have to be total ----
     `absorb` merges a restored state key by key rather than replacing the
     object, so the panel's live references survive. The cost is that a key
     present on the current palette and absent from the incoming one survives
     the merge, and only the two monochrome palettes state a `tile`. So picking
     Black and pressing Start over left the black tile sitting under Mist's
     colours: a black thumbnail beside a blue button. Reported from real use.

     Fixed by every palette declaring `tile`, as null when it derives one. These
     assert the behaviour rather than the null, so any other route to a total
     reset stays valid. */
  {
    const norm = s => s.replace(/\b(cw|hw|ctd)\d{4,8}\b/g, "$1X");

    // what a clean session produces, to compare a reset against
    const fresh = boot();
    await wait(400);
    fresh.click('button[data-w="classroom"]');
    await wait(400);
    const pristine = norm(fresh.widget());
    const pristineCode = fresh.code();

    // a Black widget, for the paste direction
    const blackSession = boot();
    await wait(400);
    blackSession.click('button[data-w="classroom"]');
    await wait(400);
    blackSession.$('#ctPresets [data-ctpreset="black"]').click();
    await wait(400);
    const blackWidget = norm(blackSession.widget());
    const blackCode = blackSession.code();
    s.check("the Black palette actually paints a black tile", blackWidget.includes("#2b2b30"));

    /* Start over */
    {
      const t = boot();
      await wait(400);
      t.click('button[data-w="classroom"]');
      await wait(400);
      t.$('#ctPresets [data-ctpreset="black"]').click();
      await wait(400);
      t.window.confirm = () => true;
      t.click("#startOver");
      await wait(500);
      t.click('button[data-w="classroom"]');
      await wait(500);
      const after = norm(t.widget());
      s.check("Start over leaves no trace of the Black palette", !after.includes("#2b2b30"));
      s.check("Start over restores the widget a clean session would build",
        after === pristine, after.slice(0, 100));
      s.check("no page errors on Start over", t.errors.length === 0, t.errors.join(" | "));
      t.close();
    }

    /* pasting a coloured widget over a monochrome one, and back */
    {
      const t = boot();
      await wait(400);
      t.click('button[data-w="classroom"]');
      await wait(400);
      t.$('#ctPresets [data-ctpreset="black"]').click();
      await wait(400);
      t.$("#loadCode").value = pristineCode;
      t.click("#loadBtn");
      await wait(500);
      s.check("pasting a coloured widget over Black drops the black tile",
        norm(t.widget()) === pristine, norm(t.widget()).slice(0, 100));
      t.close();
    }
    {
      const t = boot();
      await wait(400);
      t.click('button[data-w="classroom"]');
      await wait(400);
      t.$("#loadCode").value = blackCode;
      t.click("#loadBtn");
      await wait(500);
      s.check("pasting Black over a coloured widget applies the black tile",
        norm(t.widget()) === blackWidget, norm(t.widget()).slice(0, 100));
      t.close();
    }

    fresh.close();
    blackSession.close();
  }

  /* ---- the palette a widget starts on is the first one offered ----
     Live training defaulted to Misty blue while Black sat first in the row, so
     the swatch in the top-left corner was not the one pressed. */
  {
    const t = boot();
    await wait(400);
    const rows = {
      companion: "#cwPresets [data-cwpreset]",
      hero: "#presets [data-preset]",
      classroom: "#ctPresets [data-ctpreset]"
    };
    for (const [w, sel] of Object.entries(rows)) {
      t.click(`button[data-w="${w}"]`);
      await wait(350);
      const btns = t.all(sel);
      // aria-checked, not aria-pressed: these are radios in a radiogroup as of
      // 2026-07-30. They were toggle buttons in a plain group, which meant a
      // screen reader announced one control and gave no reason to think the
      // arrow keys the builder already implements would do anything.
      const pressed = btns.filter(b => b.getAttribute("aria-checked") === "true");
      s.check(`${w}: exactly one palette is pressed on a clean session`,
        pressed.length === 1, `pressed ${pressed.length}`);
      s.check(`${w}: the pressed palette is the first one offered`,
        pressed.length === 1 && pressed[0] === btns[0],
        `first is "${(btns[0].textContent || "").trim()}", pressed "${pressed.map(b => (b.textContent || "").trim()).join(",")}"`);
    }
    t.close();
  }

  /* ---- prototype pollution ----
     `absorb` merges a pasted or linked state straight into the live objects,
     and JSON.parse makes `__proto__` a real own key, so before the guard a
     payload of {"hero":{"__proto__":{"x":1}}} wrote onto Object.prototype and
     every object on the page inherited it. Confirmed reproducible 2026-07-30.

     These have to be built as JSON text, not with JSON.stringify on an object
     literal: in a literal `__proto__` sets the prototype rather than becoming a
     key, so stringify would quietly produce `{}` and the test would pass
     against nothing at all. */
  {
    const raw = str => "<!-- awb:1:" + Buffer.from(str, "utf8").toString("base64url") + " -->";
    const attacks = [
      ["one level down", String.raw`{"v":1,"active":"hero","hero":{"__proto__":{"AWB_POLLUTED":1}}}`],
      ["two levels down", String.raw`{"v":1,"active":"hero","hero":{"c":{"__proto__":{"AWB_POLLUTED":1}}}}`],
      ["via constructor", String.raw`{"v":1,"active":"hero","hero":{"constructor":{"prototype":{"AWB_POLLUTED":1}}}}`],
      ["an inherited widget name", String.raw`{"v":1,"active":"constructor","hero":{}}`]
    ];

    for (const [label, payload] of attacks) {
      const t = boot();
      await wait(300);
      t.$("#loadCode").value = raw(payload);
      t.click("#loadBtn");
      await wait(400);
      s.check(`${label}: Object.prototype is untouched`,
        t.window.Object.prototype.AWB_POLLUTED === undefined);
      s.check(`${label}: the builder still renders`, t.widget().length > 400);
      s.check(`${label}: no page errors`, t.errors.length === 0, t.errors.join(" | "));
      t.close();
    }
  }

  /* ---- a hostile tile ----
     The two monochrome palettes state their tile outright rather than deriving
     it, which puts a restored value straight into a linear-gradient(). It is
     the one colour role cleanColors does not cover, because the default palette
     has no tile for it to validate against, so ctTile hex-checks it at the
     point of use and falls back to the walk. Without that, this closes the
     declaration and writes its own rules. */
  {
    const t = boot();
    await wait(300);
    t.$("#loadCode").value = mark({ v: 1, active: "classroom", classroom: { fill: "none", presetId: null,
      c: { dark: false, panel: "#f4f4f5", panel2: "#e8e8ea", card: "#ffffff", line: "#e4e4e7",
           heading: "#111114", accent: "#3f3f46", body: "#52525b", btnBg: "#18181b", btnFg: "#ffffff",
           tile: ["red 0%,blue 100%);}body{display:none}.x{background:linear-gradient(red", "#000000"] } } });
    t.click("#loadBtn");
    await wait(400);
    const widget = t.widget();
    s.check("a hostile tile cannot escape its declaration",
      !widget.includes(".x{background") && !widget.includes("blue 100%"));
    s.check("the tile falls back to a real colour",
      /linear-gradient\(140deg,#[0-9a-f]{6} 0%,#[0-9a-f]{6} 100%\)/i.test(widget),
      (widget.match(/linear-gradient\(140deg[^)]*\)/) || ["none"])[0]);
    s.check("no page errors on a hostile tile", t.errors.length === 0, t.errors.join(" | "));
    t.close();
  }

  return s;
};
