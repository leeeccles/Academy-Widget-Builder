/* Course and path covers.

   The fourth tool is the first that makes an image rather than a snippet, so
   almost nothing the other three suites assert applies to it: there is no
   generated string to balance braces in, no settings comment, and no
   paste-back. What it has instead is a pile of things that can only be got
   wrong quietly.

   Two of those are the reason this file exists at all.

   The module is a second closure in a page that was one. Both halves define
   esc, isHex, toHex, lum, render and checkContrast, and three of those are
   const in one and function in the other, which is a SyntaxError rather than
   a shadowing bug. If the two ever end up in one scope the page stops
   parsing, and every check here goes red at boot rather than one of them
   pointing at the cause. That is the intended failure.

   The other is that it must not build itself at load. jsdom has no
   ResizeObserver and no 2d canvas context, which is what the lab version of
   this code reached for on its first line; dropped in as written it threw
   here, and because the builder is one script it took every other suite with
   it. The module now checks for both before using either, so an eager build
   would no longer crash. `loads without touching the document` guards the
   thing that is still true and still costs: a 35KB font and fourteen live
   thumbnails built for the three widget users who never open this tool. */

const { boot, wait, suite } = require("./lib/harness");

/* A share link, which is how a cover actually travels between sessions.
   Storage cannot be used for this: jsdom gives every instance its own
   localStorage, so writing in one session and booting another proves nothing.
   It is also the more honest hostile vector, because a link is the thing
   somebody else can hand you. Same base64url the builder writes. */
const link = obj => "https://example.test/#s=" +
  Buffer.from(JSON.stringify(obj)).toString("base64url");

module.exports = async function run() {
  const s = suite("covers");

  /* ---- it stays out of the way until it is asked for ---- */
  {
    const t = boot();
    await wait(300);
    s.check("the module loads without touching the document",
      !t.document.getElementById("cvCoverCss"));
    s.check("the builder still boots with it present", t.errors.length === 0, t.errors.join(" | "));
    s.check("the covers tool is offered, not marked Soon",
      !!t.$('button[data-w="covers"]') &&
      t.$('button[data-w="covers"]').getAttribute("aria-disabled") !== "true");
    s.check("no Soon badge is left inside the covers button",
      !t.$('button[data-w="covers"]').querySelector(".soon"));

    /* Covers sits with the tools that work, not below the two that are still
       coming. A working tool parked underneath a pair of greyed-out ones
       reads as greyed out too, which is the whole reason the order matters
       rather than being a preference. */
    const list = t.all("#wtype button");
    const covers = list.findIndex(b => b.getAttribute("data-w") === "covers");
    const firstSoon = list.findIndex(b => b.getAttribute("aria-disabled") === "true");
    s.check("covers comes straight after live training",
      list[covers - 1] && list[covers - 1].getAttribute("data-w") === "classroom",
      list.map(b => b.getAttribute("data-w") || "soon").join(" > "));
    s.check("no working tool is listed below a Soon one",
      covers < firstSoon,
      `covers at ${covers}, first Soon at ${firstSoon}`);

    // opening it is what builds it
    t.click('button[data-w="covers"]');
    await wait(400);
    s.check("opening it injects the cover stylesheet once",
      t.all("#cvCoverCss").length === 1);
    s.check("opening it builds the catalogue",
      t.all("#cvTemplates button").length === 14,
      t.all("#cvTemplates button").length);
    s.check("opening it builds the palette",
      t.all("#cvBrands button").length === 10,
      t.all("#cvBrands button").length);
    s.check("opening it builds the symbol set",
      t.all("#cvSymbols button").length === 31,
      t.all("#cvSymbols button").length);
    s.check("no page errors from opening it", t.errors.length === 0, t.errors.join(" | "));
    t.close();
  }

  /* ---- the right column belongs to whichever tool is open ---- */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    const hidden = id => t.document.getElementById(id).hidden;
    s.check("the widget preview gives way to the cover previews",
      hidden("previewCard") && !hidden("coversPreview"));
    s.check("the code card gives way to the save card",
      hidden("output") && !hidden("coversOutput"));
    s.check("the skip link points at something that exists here",
      t.$("#skipLink").getAttribute("href") === "#coversOutput");

    t.click('button[data-w="hero"]');
    await wait(400);
    s.check("going back to a widget restores its preview",
      !hidden("previewCard") && hidden("coversPreview"));
    s.check("going back to a widget restores the code card",
      !hidden("output") && hidden("coversOutput"));
    s.check("going back restores the skip link",
      t.$("#skipLink").getAttribute("href") === "#output");
    s.check("no page errors switching back and forth", t.errors.length === 0, t.errors.join(" | "));
    t.close();
  }

  /* ---- single-choice groups are announced as single-choice groups ----
     The builder learned this once already, on its own palettes: the keyboard
     behaviour was the radio-group pattern exactly while the markup said
     `role=group` full of aria-pressed toggles, so a screen reader read out
     "toggle button, pressed" and gave no reason to think an arrow key would
     reveal anything. The covers tool arrived from the lab with the same
     mistake in it, three times over and fifty-five buttons wide. */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    ["cvTemplates", "cvBrands", "cvSymbols"].forEach(id => {
      const g = t.document.getElementById(id);
      const btns = Array.from(g.querySelectorAll("button"));
      s.check(`#${id} is a radiogroup`, g.getAttribute("role") === "radiogroup");
      s.check(`#${id} holds radios, not toggles`,
        btns.every(b => b.getAttribute("role") === "radio") &&
        btns.every(b => !b.hasAttribute("aria-pressed")));
      s.check(`#${id} has exactly one checked`,
        btns.filter(b => b.getAttribute("aria-checked") === "true").length === 1,
        btns.filter(b => b.getAttribute("aria-checked") === "true").length);
      s.check(`#${id} is one tab stop, not ${btns.length}`,
        btns.filter(b => b.tabIndex === 0).length === 1,
        btns.filter(b => b.tabIndex === 0).length);
    });
    t.close();
  }

  /* ---- the fields on screen are the fields the template draws ----
     A title box on a template with no title is a promise the image does not
     keep. */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    const hidden = id => t.document.getElementById(id).hidden;

    t.click('#cvTemplates button[data-cvdesign="1g"]');   // type plate: kicker + title
    await wait(300);
    s.check("a words template shows the words card", !hidden("cvTextCard"));
    s.check("it shows only the fields it draws",
      !hidden("cvFKicker") && !hidden("cvFTitle") && hidden("cvFSubtitle"));
    s.check("a template that draws no symbol hides the symbol card", hidden("cvSymbolCard"));

    t.click('#cvTemplates button[data-cvdesign="2a"]');   // solid: symbol only
    await wait(300);
    s.check("a symbol template hides the words card", hidden("cvTextCard"));
    s.check("a symbol template shows the symbol card", !hidden("cvSymbolCard"));

    t.click('#cvTemplates button[data-cvdesign="1d"]');   // editorial: all three plus symbol
    await wait(300);
    s.check("a template that draws everything shows everything",
      !hidden("cvFKicker") && !hidden("cvFTitle") && !hidden("cvFSubtitle") && !hidden("cvSymbolCard"));

    /* The steps are renumbered for whatever is on screen, because this is the
       only panel whose shape changes with the choice made in it. Numbered in
       the markup, the sequence read 1, 2, 3, 5 on a symbol template, 1, 2, 4,
       5 on a words one and 1, 2, 5 on a plain pattern. A gap in a numbered
       list says a step exists that you have not found, in the one panel where
       which steps exist is the actual question. */
    const runs = [];
    for (const id of ["2a", "1g", "1d", "1f", "1b"]) {
      t.click(`#cvTemplates button[data-cvdesign="${id}"]`);
      await wait(250);
      const nums = t.all("#panelCovers > section.card")
        .filter(c => !c.hidden)
        .map(c => (c.querySelector("h2 .num") || {}).textContent);
      const want = nums.map((_, i) => String(i + 1));
      if (nums.join() !== want.join()) runs.push(`${id}: ${nums.join(",")}`);
    }
    s.check("the steps always count 1 upwards with no gap",
      runs.length === 0, runs.join(" | "));
    t.close();
  }

  /* ---- the verdict sits with the control that causes it ----
     It used to be in the right column, below three preview surfaces and about
     700px from the hex field, so somebody dialling in a brand red never saw
     the warning: they were looking at the swatch. Every other tool puts the
     contrast report directly under the colours. */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    const notes = t.document.getElementById("cvNotes");
    s.check("the contrast verdict is inside the brand colour card",
      !!notes.closest("section.card") &&
      notes.closest("section.card").contains(t.document.getElementById("cvBrandHex")));
    t.close();
  }

  /* ---- no working shown to the user ----
     The type fitter's status sentences quoted the fitted size, unrounded:
     "One line at 282.6041765543427px". These are read by sales and customer
     success staff, and a type size is not a number they can act on. */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    const leaked = [];
    for (const id of ["1b", "1c", "1d", "1g"]) {
      t.click(`#cvTemplates button[data-cvdesign="${id}"]`);
      await wait(250);
      for (const title of ["GDPR", "CYBER SECURITY", "Advanced Workplace Health And Safety Training"]) {
        t.fill("#cvTitle", title);
        await wait(250);
        const note = t.$("#cvTitleNote").textContent || "";
        if (/\d+\.\d{3,}/.test(note) || /\d+px/.test(note)) leaked.push(`${id}: ${note.slice(0, 60)}`);
      }
    }
    s.check("no pixel value reaches the words a user reads",
      leaked.length === 0, leaked.join(" | "));
    t.close();
  }

  /* ---- words are held per template ----
     One shared set made the catalogue read as four versions of one cover, and
     losing what was typed on the way back to a template is worse than that. */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    t.click('#cvTemplates button[data-cvdesign="1g"]');
    await wait(250);
    t.fill("#cvTitle", "FIRE SAFETY");
    await wait(300);
    t.click('#cvTemplates button[data-cvdesign="1c"]');
    await wait(300);
    s.check("another template keeps its own title",
      t.$("#cvTitle").value !== "FIRE SAFETY", t.$("#cvTitle").value);
    t.click('#cvTemplates button[data-cvdesign="1g"]');
    await wait(300);
    s.check("coming back finds the words still there",
      t.$("#cvTitle").value === "FIRE SAFETY", t.$("#cvTitle").value);
    t.close();
  }

  /* ---- saved, shared and restored like any other widget ---- */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    t.click('#cvTemplates button[data-cvdesign="3b"]');
    t.click('#cvBrands button[data-cvbrand="#0f7b5f"]');
    t.click('#cvSymbols button[data-cvsym="rocket"]');
    t.fill("#cvImgName", "Fire safety induction");
    await wait(800);
    const saved = JSON.parse(t.window.localStorage.getItem("awb.state.v1"));
    s.check("the open tool is remembered", saved.active === "covers", saved.active);
    s.check("the cover is remembered",
      saved.covers && saved.covers.design === "3b" && saved.covers.symbol === "rocket" &&
      saved.covers.brand === "#0f7b5f" && saved.covers.imgName === "Fire safety induction",
      JSON.stringify(saved.covers));

    let url = null;
    t.window.navigator.clipboard = { writeText: v => { url = v; return Promise.resolve(); } };
    t.click("#share");
    await wait(50);
    s.check("a cover can be shared", !!url && url.indexOf("#s=") > 0);
    t.close();

    const u = boot({ url });
    await wait(700);
    s.check("a shared cover reopens on the covers tool",
      !u.document.getElementById("panelCovers").hidden);
    s.check("a shared cover comes back exactly",
      u.$("#cvImgName").value === "Fire safety induction" &&
      u.$('#cvTemplates button[data-cvdesign="3b"]').getAttribute("aria-checked") === "true" &&
      u.$('#cvSymbols button[data-cvsym="rocket"]').getAttribute("aria-checked") === "true",
      JSON.stringify({
        name: u.$("#cvImgName").value,
        design: u.window.AWBCovers.state.design,
        symbol: u.window.AWBCovers.state.symbol
      }));
    s.check("no page errors restoring a cover", u.errors.length === 0, u.errors.join(" | "));
    u.close();
  }

  /* ---- anything from outside the session, deliberately wrong ----
     A template id and a symbol key are both names read out of a saved object
     and used as lookup keys, which is the trap the builder already knows
     about from its own widget list: "constructor" and "__proto__" answer any
     such lookup with an inherited member that passes every truthiness test a
     validator would write. Three separate lookups here could take one. */
  {
    const hostile = [
      ["an inherited template id", { design: "constructor" }],
      ["a prototype symbol key", { symbol: "__proto__" }],
      ["a toString template id", { design: "toString" }],
      ["a template that does not exist", { design: "9z" }],
      ["a colour that is not one", { brand: "javascript:alert(1)" }],
      ["an array where the words belong", { text: [1, 2, 3] }],
      ["a number where a title belongs", { text: { "2a": { title: 42 } } }],
      ["a null row", { text: { "2a": null } }],
      ["a file type that is not offered", { format: "image/svg+xml" }]
    ];
    for (const [label, patch] of hostile) {
      const u = boot({ url: link({ v: 1, active: "covers", covers: patch }) });
      await wait(700);
      const st = u.window.AWBCovers.state;
      s.check(`${label}: is replaced with something real`,
        !!u.window.document.querySelector(`#cvTemplates button[data-cvdesign="${st.design}"]`) &&
        (st.symbol === "none" || !!u.window.document.querySelector(`#cvSymbols button[data-cvsym="${st.symbol}"]`)) &&
        /^#[0-9a-f]{3,6}$/i.test(st.brand) &&
        (st.format === "image/jpeg" || st.format === "image/png"),
        JSON.stringify({ design: st.design, symbol: st.symbol, brand: st.brand, format: st.format }));
      s.check(`${label}: Object.prototype is untouched`,
        typeof ({}).title === "undefined" && typeof ({}).design === "undefined");
      s.check(`${label}: no page errors`, u.errors.length === 0, u.errors.join(" | "));
      u.close();
    }
  }

  /* ---- Start over reaches the covers tool too ---- */
  {
    const t = boot();
    await wait(300);
    t.click('button[data-w="covers"]');
    await wait(400);
    t.click('#cvTemplates button[data-cvdesign="3b"]');
    t.fill("#cvImgName", "Something else entirely");
    await wait(700);
    t.window.confirm = () => true;
    t.click("#startOver");
    await wait(600);
    const st = t.window.AWBCovers.state;
    s.check("Start over returns the cover to its default",
      st.design === "2a" && st.imgName === "Course cover",
      JSON.stringify({ design: st.design, imgName: st.imgName }));
    s.check("no page errors on Start over from covers", t.errors.length === 0, t.errors.join(" | "));
    t.close();
  }

  return s;
};
