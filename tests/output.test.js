/* The generated code itself: well formed, complete, and free of the specific
   ways this generator has gone wrong before.

   Every widget is built by concatenating strings, so the failure mode is
   never a thrown error. It is a stray `+`, an unbalanced brace, or a value
   that was undefined at the moment it was interpolated, all of which produce
   a snippet that looks fine in the code box and quietly drops a rule in the
   browser. Each check below corresponds to a real bug:

   - braces:    a missing one silently swallows every rule after it
   - NaN:       an invalid colour reached rgba() and the panel lost its border
   - undefined: a state key was missing and landed in the CSS as a literal
   - em dash:   a house style rule for anything a customer will read */

const { boot, wait, suite } = require("./lib/harness");

function braceBalance(css) {
  let depth = 0, underflow = 0;
  for (const ch of css) {
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth < 0) underflow++; }
  }
  return { depth, underflow };
}

module.exports = async function run() {
  const s = suite("output");
  const t = boot();
  await wait(300);

  const variants = [
    ["companion", () => {}],
    ["hero, text and image", () => {
      t.click('button[data-w="hero"]');
      t.fill("#imgUrl", "https://example.test/a.jpg");
      t.fill("#href", "/paths/abc/home");
    }],
    ["hero, overlay", () => t.click('button[data-layout="overlay"]')],
    ["hero, gradient panel", () => {
      t.click('button[data-layout="textFirst"]');
      t.click('button[data-fill="gradient"]');
    }],
    ["hero, dark palette", () => t.click('#presets [data-preset="midnight"]')],
    ["hero, no button", () => t.click('button[data-btn="off"]')],
    ["path slides", () => t.click('button[data-w="classroom"]')],
    ["path slides, solid panel", () => t.click('button[data-ctfill="flat"]')],
    ["path slides, gradient panel", () => t.click('button[data-ctfill="gradient"]')],
    ["path slides, no panel", () => t.click('button[data-ctfill="none"]')],
    ["path slides, dark palette", () => {
      t.click("#ctMoreToggle");
      t.click('#ctMoodSeg button[data-ctmood="dark"]');
      t.click('#ctMorePresets [data-ctpreset="navy"]');
    }]
  ];

  for (const [label, setup] of variants) {
    setup();
    await wait(400);
    const full = t.code();
    const widget = t.widget();
    const style = widget.slice(widget.indexOf("<style>"));
    const b = braceBalance(style);

    s.check(`${label}: CSS braces balanced`, b.depth === 0 && b.underflow === 0,
      `depth ${b.depth}, underflow ${b.underflow}`);
    s.check(`${label}: no NaN or undefined in the widget`, !/NaN|undefined|\[object/.test(widget));
    s.check(`${label}: no em dash`, !/[—–]/.test(full));
    s.check(`${label}: carries its settings for reopening`, /awb:1:[A-Za-z0-9_-]+ -->/.test(full));
    // base64url has no <, ! or >, so the payload can never close the comment
    s.check(`${label}: settings payload cannot break out of its comment`,
      !/awb:1:[A-Za-z0-9_-]*(-->|<!--)/.test(full));
    s.check(`${label}: no script tag in the output`, !/<script[\s>]/i.test(widget));
  }

  /* ---- the deck's own heading is optional ----
     Some pages already carry a title from the section the widget sits in, so
     the marketing line is a second one. Turning it off must remove the heading
     and keep the link, and turning both off must leave the deck with no header
     row at all rather than an empty one holding its bottom margin. */
  {
    const d = boot();
    await wait(300);
    d.click('button[data-w="classroom"]');
    await wait(400);
    const heading = /-h">Workshops worth clearing/;
    const link = /-link"/;

    s.check("heading renders while it is switched on", heading.test(d.widget()));

    const [headingToggle, linkToggle] = d.all('#ctPanel input[type="checkbox"]');
    headingToggle.click();
    await wait(500);
    s.check("switching the heading off removes it", !heading.test(d.widget()));
    s.check("the link survives the heading being removed", link.test(d.widget()));

    // both off: no header row, so no stray 14px margin above the first card
    d.all('#ctPanel input[type="checkbox"]')[1].click();
    await wait(500);
    const bare = d.widget();
    s.check("with no heading and no link there is no header row",
      !/-head"/.test(bare), bare.slice(0, 120));
    s.check("the deck itself still renders", /-slide /.test(bare));
    s.check("no page errors across the heading toggle", d.errors.length === 0, d.errors.join(" | "));
    d.close();
  }

  /* ---- the deck's controls ----
     Matched to the platform's own gallery carousel on 2026-07-30: 44px squares
     holding a chevron and nothing else. They were 44 tall and 80-odd wide with
     the words "Back" and "Next" set beside the chevron, which read as a control
     from a different product when the two sat on one page.

     Both are present on every slide and they wrap, so the row cannot change
     width as you page. And an icon-only control still needs a name: the word is
     hidden rather than deleted. */
  {
    const d = boot();
    await wait(300);
    d.click('button[data-w="classroom"]');
    await wait(400);
    const w = d.widget();

    s.check("the controls are 44px squares", /-bk,\.[a-z0-9]+-nx\{[^}]*width:44px;height:44px/.test(w),
      (w.match(/-bk,[^{]*\{[^}]{0,90}/) || [""])[0]);
    s.check("no visible label is set beside the chevron",
      !/>Back<\/label>|>Next<\/label>/.test(w) && !/-nx[^"]*">Next/.test(w));
    s.check("both controls exist on the first slide",
      /-bk1"/.test(w) && /-nx1"/.test(w));
    // wrap: Back on slide 1 points at slide 3, Next on slide 3 points at slide 1
    s.check("Back on the first slide wraps to the last", /-bk1" for="[a-z0-9]+-s3"/.test(w));
    s.check("Next on the last slide wraps to the first", /-nx3" for="[a-z0-9]+-s1"/.test(w));
    s.check("each control still carries a name for a screen reader",
      /-sr">Back<\/span>/.test(w) && /-sr">Next<\/span>/.test(w));
    s.check("no page errors across the deck controls", d.errors.length === 0, d.errors.join(" | "));
    d.close();
  }

  s.check("no page errors while generating every variant", t.errors.length === 0, t.errors.join(" | "));
  t.close();
  return s;
};
