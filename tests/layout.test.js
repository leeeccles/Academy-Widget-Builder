/* Layout, in a real browser.

   jsdom does no layout at all, so none of this can be checked there: it does
   not know that an element is off screen, that a row wrapped, or that a
   status message pushed two buttons sideways. Every check here corresponds to
   a bug that was invisible until something measured a rectangle.

   Needs Chromium. `npm run test:browser` after `npx playwright install
   chromium`. The jsdom suites are the ones that run everywhere. */

const path = require("path");
const { suite } = require("./lib/harness");

const PAGE = "file://" + encodeURI(path.join(__dirname, "..", "index.html"));

module.exports = async function run() {
  const s = suite("layout (browser)");
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (e) {
    s.check("playwright is installed", false, "run: npm install && npx playwright install chromium");
    return s;
  }

  const browser = await chromium.launch();

  /* ---- two widgets of the same type on one page ----
     The scoping suffix used to be one random number per page load, so two
     widgets of the same type built in one session always shared it. Two Live
     training decks pasted onto one page therefore shared a radio `name` and
     behaved as a single group: clicking a dot on the second blanked the first,
     measured as one visible slide each becoming three and none. Three element
     ids also appeared twice, so every label drove whichever deck came first.

     This is the check that would have caught it. It only passes while the
     suffix is derived from the widget's settings. */
  {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await p.goto(PAGE);
    await p.waitForTimeout(500);
    await p.click('[data-w="classroom"]');
    await p.waitForTimeout(400);

    const grab = () => p.evaluate(() => {
      const c = document.getElementById("code").textContent;
      const i = c.lastIndexOf("<!-- Reopen");
      return i < 0 ? c : c.slice(0, i);
    });

    const first = await grab();
    // the second deck, built the way anyone would build it: change the heading
    await p.fill('#ctPanel input[type="text"]', "Compliance training");
    await p.waitForTimeout(500);
    const second = await grab();

    const pre = s => (s.match(/class="(ctd\d+)-wrap"/) || [])[1];
    s.check("two decks from one session get different prefixes",
      !!pre(first) && !!pre(second) && pre(first) !== pre(second),
      `${pre(first)} vs ${pre(second)}`);

    const host = await browser.newPage({ viewport: { width: 900, height: 1200 } });
    await host.setContent(`<!doctype html><html><body style="margin:0;background:#fff">
      <div style="width:795px;margin:16px">${first}</div>
      <div style="width:795px;margin:16px">${second}</div></body></html>`);
    await host.waitForTimeout(400);

    const shape = await host.evaluate(() => {
      const ids = [...document.querySelectorAll("input[type=radio]")].map(r => r.id);
      return {
        radioGroups: new Set([...document.querySelectorAll("input[type=radio]")].map(r => r.name)).size,
        duplicateIds: ids.length - new Set(ids).size
      };
    });
    s.check("each deck owns its own radio group", shape.radioGroups === 2, JSON.stringify(shape));
    s.check("no element id appears twice", shape.duplicateIds === 0, JSON.stringify(shape));

    const visible = () => host.evaluate(() =>
      [...document.querySelectorAll('[class$="-deck"]')].map(d =>
        [...d.querySelectorAll("article")].filter(a => getComputedStyle(a).visibility !== "hidden").length));

    s.check("both decks start on exactly one slide",
      JSON.stringify(await visible()) === "[1,1]", JSON.stringify(await visible()));

    // the move that used to blank the first deck
    await host.evaluate(() => {
      const d = [...document.querySelectorAll('[class$="-deck"]')][1];
      d.querySelectorAll('label[class*="-dot"]')[1].click();
    });
    await host.waitForTimeout(400);
    const after = await visible();
    s.check("paging the second deck leaves the first alone",
      JSON.stringify(after) === "[1,1]", JSON.stringify(after));

    await host.close();
    await p.close();
  }

  /* ---- press targets on a touch screen ----
     Heights used to be six ad-hoc numbers for one idea, three of them under the
     44px minimum: the prompt remove button was a fixed 42 while `--icon-btn`
     sat right there going 36 to 44 on a coarse pointer, and segments, Reset and
     the disclosures were 42, 40 and 40. They are all tokens now, so this asserts
     the thing the tokens exist for rather than the tokens themselves.

     Fine pointers are deliberately allowed to be smaller, which is what
     `--icon-btn` and `--tap-compact` are: a mouse can hit 36px, and the header
     keeps a fixed 64px height that a 44px button does not fit inside. */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 860 }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    await p.goto(PAGE);
    await p.waitForTimeout(500);
    const small = [], tight = [];
    for (const w of ["companion", "hero", "classroom"]) {
      await p.click(`[data-w="${w}"]`);
      await p.waitForTimeout(350);
      await p.evaluate(() => document.querySelectorAll(".disclose[aria-expanded=false]").forEach(b => b.click()));
      await p.waitForTimeout(300);
      const r = await p.evaluate(() => {
        const vis = el => {
          const s = getComputedStyle(el), b = el.getBoundingClientRect();
          return s.display !== "none" && b.width > 2 && b.height > 2 && !!el.offsetParent;
        };
        const under = [], gaps = [];
        document.querySelectorAll("button,select").forEach(el => {
          if (!vis(el)) return;
          const b = el.getBoundingClientRect();
          if (Math.min(b.width, b.height) < 44) {
            under.push(((el.className || el.tagName) + "").split(" ")[0] + "@" + Math.round(b.height));
          }
        });
        // 8px is the minimum comfortable gap between two adjacent touch targets
        document.querySelectorAll(".seg,.presets,.prompt-row,.wtype").forEach(g => {
          const k = [...g.children].filter(vis).map(x => x.getBoundingClientRect());
          for (let i = 1; i < k.length; i++) {
            const gap = Math.round(Math.max(k[i].left - k[i - 1].right, k[i].top - k[i - 1].bottom));
            if (gap >= 0 && gap < 8) gaps.push((g.id || g.className.split(" ")[0]) + ":" + gap);
          }
        });
        return { under: [...new Set(under)], gaps: [...new Set(gaps)] };
      });
      r.under.forEach(x => small.push(`${w} ${x}`));
      r.gaps.forEach(x => tight.push(`${w} ${x}`));
    }
    s.check("on a touch screen every press target is at least 44px",
      small.length === 0, small.join(", "));
    s.check("adjacent touch targets keep an 8px gap", tight.length === 0, tight.join(", "));
    await ctx.close();
  }

  /* ---- one type scale ----
     Nine sizes were rendering from five declared tokens: 9.5px on the pills, 10
     on the step numbers and verdict chips, 10.5 on "Soon", all within a point of
     each other and none of the differences meaning anything. 16px is the one
     legitimate off-token value, set on inputs under 640px so iOS does not zoom
     the page when a field takes focus. */
  {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await p.goto(PAGE);
    await p.waitForTimeout(500);
    const sizes = new Set();
    for (const w of ["companion", "hero", "classroom"]) {
      await p.click(`[data-w="${w}"]`);
      await p.waitForTimeout(350);
      await p.evaluate(() => {
        document.querySelectorAll(".disclose[aria-expanded=false]").forEach(b => b.click());
        document.querySelectorAll("details").forEach(d => d.open = true);
      });
      await p.waitForTimeout(300);
      (await p.evaluate(() => {
        const out = [];
        document.querySelectorAll("body *").forEach(el => {
          const s = getComputedStyle(el);
          if (s.display === "none" || !el.offsetParent) return;
          if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
          out.push(parseFloat(s.fontSize));
        });
        return [...new Set(out)];
      })).forEach(v => sizes.add(v));
    }
    const allowed = new Set([11, 12, 13, 14, 16, 19]);
    const off = [...sizes].filter(v => !allowed.has(v)).sort((a, b) => a - b);
    s.check("the builder renders only its declared type scale", off.length === 0, `off-scale: ${off.join(", ")}`);
    await p.close();
  }

  /* ---- the overlay hero has no ring round it ----
     An absolutely positioned child resolves `inset:0` against the padding box,
     not the border box, so the photo stopped 1px short on every side and that
     1px of panel showed through as a border. On the overlay layout the panel's
     fill is the near-black scrim base, so a bright photo came out wearing a
     black outline: measured as a 793x258 image inside a 795x260 panel.

     Geometry rather than the declaration, so any future way of covering the
     panel counts as a fix and the assertion does not care which one is used. */
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await p.goto(PAGE);
    await p.waitForTimeout(600);
    await p.click('[data-w="hero"]');
    await p.waitForTimeout(400);
    await p.click('button[data-layout="overlay"]');
    await p.waitForTimeout(300);
    await p.fill("#imgUrl", "https://example.com/x.jpg");
    await p.waitForTimeout(600);
    const code = await p.evaluate(() => {
      const c = document.getElementById("code").textContent;
      const i = c.lastIndexOf("<!-- Reopen");
      return i < 0 ? c : c.slice(0, i);
    });
    await p.close();

    // a pure white image, so any surviving ring is unmissable to a measurement
    const white = "data:image/svg+xml;base64," + Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700">' +
      '<rect width="1200" height="700" fill="#ffffff"/></svg>').toString("base64");

    const h = await browser.newPage({ viewport: { width: 900, height: 600 } });
    await h.setContent(`<!doctype html><html><body style="margin:0;background:#fff">
      <div style="width:795px;margin:20px">${code.replace("https://example.com/x.jpg", white)}</div>
      </body></html>`);
    await h.waitForTimeout(500);

    const m = await h.evaluate(() => {
      const panel = document.querySelector('[class$="-panel"]');
      const media = document.querySelector('[class$="-media"]');
      if (!panel || !media) return null;
      const pr = panel.getBoundingClientRect(), mr = media.getBoundingClientRect();
      return {
        dx: +(mr.x - pr.x).toFixed(2), dy: +(mr.y - pr.y).toFixed(2),
        dw: +(pr.width - mr.width).toFixed(2), dh: +(pr.height - mr.height).toFixed(2)
      };
    });
    s.check("the overlay photo reaches the panel edge", m &&
      m.dx === 0 && m.dy === 0 && m.dw === 0 && m.dh === 0, JSON.stringify(m));
    await h.close();
  }

  /* ---- card spacing ----
     Every panel opens 16px under the Widget card. Live training alone opened
     flush against it, because the rule was `.panel > .card:first-child` and that
     panel's first child is a container the generated cards go into rather than a
     card. Cheap to assert, and it is the kind of gap that is only obvious once
     somebody notices it. */
  {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await p.goto(PAGE);
    await p.waitForTimeout(500);
    const bad = [];
    for (const w of ["companion", "hero", "classroom"]) {
      await p.click(`[data-w="${w}"]`);
      await p.waitForTimeout(400);
      const gaps = await p.evaluate(() => {
        const cards = [...document.querySelectorAll(".col:first-child section.card")].filter(c => c.offsetParent);
        const out = [];
        for (let i = 1; i < cards.length; i++) {
          out.push(Math.round(cards[i].getBoundingClientRect().top - cards[i - 1].getBoundingClientRect().bottom));
        }
        return out;
      });
      if (gaps.some(g => g !== 16)) bad.push(`${w}: ${gaps.join(", ")}`);
    }
    s.check("every card in every panel is spaced the same", bad.length === 0, bad.join(" | "));
    await p.close();
  }

  /* ---- the header: nothing off screen, nothing that moves ----
     "Start over" used to be pushed off the right edge on a phone and could
     not be reached at all, and the first "Saved" of a session shoved both
     buttons left by the width of the word and never gave it back. */
  const widths = [320, 375, 414, 640, 641, 768, 900, 901, 1024, 1280, 1440, 1800];
  const offscreen = [], shifted = [], overflowed = [], clipped = [];

  for (const width of widths) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    await p.goto(PAGE);
    await p.waitForTimeout(350);

    const before = await p.evaluate(() =>
      ["share", "startOver"].map(id => Math.round(document.getElementById(id).getBoundingClientRect().left)));

    // push every message the note can ever show through its reserved slot
    const fits = await p.evaluate(() => {
      const el = document.getElementById("savedNote");
      if (getComputedStyle(el).clip === "rect(0px, 0px, 0px, 0px)") return true;  // compact mode
      return ["Saved", "Cleared", "Loaded from a link", "Loaded from code", "Saved without the photo"]
        .every(m => { el.textContent = m; el.classList.add("on");
          return el.scrollWidth <= el.clientWidth + 0.5; });
    });

    const after = await p.evaluate(() =>
      ["share", "startOver"].map(id => Math.round(document.getElementById(id).getBoundingClientRect().left)));

    const r = await p.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const b = document.getElementById("startOver").getBoundingClientRect();
      return {
        inView: b.left >= -0.5 && b.right <= vw + 0.5,
        overflow: Math.max(0, document.documentElement.scrollWidth - vw)
      };
    });

    if (!r.inView) offscreen.push(width);
    if (r.overflow > 0) overflowed.push(`${width}px by ${r.overflow}px`);
    if (!fits) clipped.push(width);
    const move = Math.max(...before.map((v, i) => Math.abs(v - after[i])));
    if (move > 0) shifted.push(`${width}px by ${move}px`);
    await p.close();
  }

  s.check("both header buttons stay on screen at every width", offscreen.length === 0, offscreen.join(", "));
  s.check("the saved note never moves the buttons", shifted.length === 0, shifted.join(", "));
  s.check("no horizontal page overflow at any width", overflowed.length === 0, overflowed.join(", "));
  s.check("no saved message is clipped by its slot", clipped.length === 0, clipped.join(", "));

  /* ---- nothing sticks out with every disclosure open ---- */
  {
    const out = [];
    for (const width of [320, 375, 640, 1024, 1440]) {
      const p = await browser.newPage({ viewport: { width, height: 1000 } });
      await p.goto(PAGE);
      await p.waitForTimeout(350);
      await p.evaluate(() => document.querySelectorAll("details").forEach(d => (d.open = true)));
      await p.waitForTimeout(200);
      const over = await p.evaluate(() =>
        Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
      if (over > 0) out.push(`${width}px by ${over}px`);
      await p.close();
    }
    s.check("no overflow with every panel and disclosure expanded", out.length === 0, out.join(", "));
  }

  /* ---- the generated widget fits its column at every width ----
     Replaces the featured-tiles check, which guarded the Signpost's card row
     and went with it on 2026-07-30. The deck is the one layout left and it has
     the same class of risk: a two-track grid, a tile that is a column at one
     width and a band at another, and pills that wrap. Any of those can push
     past the block it was pasted into, and a widget that overflows its column
     on somebody's homepage is the worst thing this builder could ship. */
  {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await p.goto(PAGE);
    await p.waitForTimeout(350);
    await p.click('button[data-w="classroom"]');
    await p.waitForTimeout(500);

    const bad = [];
    for (const [label, setup] of [
      ["3 slides", null],
      ["1 slide", async () => {
        await p.click('#ctPanel [data-k="w2.slides.2.remove"]');
        await p.waitForTimeout(300);
        await p.click('#ctPanel [data-k="w2.slides.1.remove"]');
      }],
      ["no columns", async () => {
        for (const k of ["w2.cols.obj", "w2.cols.who", "w2.cols.why"]) {
          await p.click(`#ctPanel [data-k="${k}"]`);
          await p.waitForTimeout(250);
        }
      }]
    ]) {
      if (setup) { await setup(); await p.waitForTimeout(500); }
      const code = await p.evaluate(() => document.getElementById("code").textContent);

      for (const cw of [320, 380, 460, 540, 620, 700, 820, 980, 1210]) {
        const v = await browser.newPage({ viewport: { width: cw + 32, height: 900 } });
        await v.setContent(`<body style="margin:0;padding:16px"><div id="col" style="width:${cw}px">${code}</div></body>`);
        await v.waitForTimeout(140);
        const over = await v.evaluate(() => {
          const col = document.getElementById("col");
          const limit = col.getBoundingClientRect().right;
          // 0.5px of tolerance: sub-pixel layout rounding is not an overflow
          return [...col.querySelectorAll("*")]
            .filter(e => e.getBoundingClientRect().right > limit + 0.5)
            .map(e => e.className && e.className.toString().split(" ")[0])
            .filter(Boolean).slice(0, 3);
        });
        if (over.length) bad.push(`${label} at ${cw}px overflowed: ${over.join(", ")}`);
        await v.close();
      }
    }
    s.check("the generated widget never overflows its column", bad.length === 0, bad.join(" | "));
    await p.close();
  }

  /* ---- the preview is looked at, not tabbed through, and still clickable ----
     Two bugs in one place, and fixing either one alone reintroduces the other.

     Left alone, the preview puts every control of the generated widget into
     the page's tab order: a Live training deck contributes five radios and up
     to six links, sitting between the last builder control above the preview
     and the first one below it, none of which configure anything.

     The obvious fix is `inert` on the iframe, and it was tried on 2026-07-30.
     It does empty the tab order, and it also swallows every click, so pressing
     Next to look at slide two of your own deck stopped working. The tab stops
     are removed one element at a time instead, plus tabindex="-1" on the frame
     itself, because a frame is a tab stop in its own right even once its
     contents are not.

     So this checks both halves. Going back to `inert` fails the click; losing
     the sweep fails the tab count. */
  {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await p.goto(PAGE);
    await p.waitForTimeout(600);
    await p.click('button[data-w="classroom"]');
    await p.waitForTimeout(1800);

    const checked = () => p.evaluate(() =>
      [...document.getElementById("preview").contentDocument
        .querySelectorAll('input[type="radio"]')].findIndex(r => r.checked));

    const inside = await p.evaluate(() =>
      document.getElementById("preview").contentDocument
        .querySelectorAll("a[href],input,button,select,textarea").length);
    s.check("the deck preview has controls worth keeping out of Tab", inside > 4, `found ${inside}`);

    const before = await checked();
    const at = await p.evaluate(() => {
      const f = document.getElementById("preview"), fr = f.getBoundingClientRect();
      const l = [...f.contentDocument.querySelectorAll("label")].find(e => /Next/.test(e.textContent));
      if (!l) return null;
      const r = l.getBoundingClientRect();
      return { x: fr.x + r.x + r.width / 2, y: fr.y + r.y + r.height / 2 };
    });
    if (at) await p.mouse.click(at.x, at.y);
    await p.waitForTimeout(500);
    const after = await checked();
    s.check("Next inside the preview still changes slide",
      at !== null && after !== before, `slide ${before} -> ${after}`);

    await p.evaluate(() => document.querySelector(".skip").focus());
    let landed = null;
    for (let i = 0; i < 300 && landed === null; i++) {
      await p.keyboard.press("Tab");
      const hit = await p.evaluate(() => {
        const a = document.activeElement;
        return a && (a.id === "preview" || a.tagName === "IFRAME") ? true : null;
      });
      if (hit) landed = i;
    }
    s.check("Tab never lands on or inside the preview",
      landed === null, landed === null ? "" : `reached it at tab stop ${landed}`);
    await p.close();
  }

  /* ---- a hex nobody can parse says so ----
     The colour fields used to signal a bad value with a red border and nothing
     else: colour as the only carrier of meaning, and no help besides. The
     sentence they show now has to appear for input that can never become a
     colour, and stay out of the way while somebody is still typing one.

     "#4a3f" is the case that makes this awkward. It is four characters on the
     way to six, so length alone cannot tell it from junk, and the first
     attempt at the rule waited for seven characters and therefore said nothing
     at all about "zzz". The rule is about content: a character that is not a
     hex digit can never come good, however much more is typed. */
  {
    const p = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await p.goto(PAGE);
    await p.waitForTimeout(600);
    await p.click('button[data-w="hero"]');
    await p.waitForTimeout(400);
    await p.click("#customToggle");
    await p.waitForTimeout(200);

    const hex = "#colors .cfield:first-child input[type=text]";
    const err = "#colors .cfield:first-child .err";
    const wrong = [];
    for (const [value, want] of [
      ["zzz", true], ["#12345g", true], ["nonsense", true],
      ["#4a3f", false], ["#4a3", false], ["#4a3fc4", false], ["", false]
    ]) {
      await p.fill(hex, value);
      await p.waitForTimeout(260);
      const shown = await p.isVisible(err);
      if (shown !== want) wrong.push(`"${value || "(empty)"}" ${shown ? "warned" : "stayed quiet"}`);
    }
    s.check("a hex that cannot come good is explained, a half-typed one is not",
      wrong.length === 0, wrong.join(" | "));

    // and the message is cleared rather than left behind by the next action
    await p.fill(hex, "zzz");
    await p.waitForTimeout(260);
    await p.click('#presets [data-preset="teal"]');
    await p.waitForTimeout(400);
    s.check("picking a preset clears an error left under a colour field",
      !(await p.isVisible(err)));
    await p.close();
  }

  await browser.close();
  return s;
};
