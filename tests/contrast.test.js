/* Readability, measured across every palette the builder offers.

   The builder's whole claim is that it cannot hand you an unreadable widget.
   That claim is only worth anything if something checks it on every palette,
   in every layout, in both fill modes, rather than on the one preset someone
   happened to look at. This walks all of them and reads the builder's own
   report back out, so it is testing what a user would actually be told.

   Hero: 7 recommended presets plus 25 curated ones, times 2 layouts, times
   2 fills. Live training: 27 palettes times 3 layouts, since Marquee and
   Typographic shipped alongside Slides on 2026-08-06. */

const { boot, wait, suite } = require("./lib/harness");

module.exports = async function run() {
  const s = suite("contrast");
  const t = boot();
  await wait(300);

  /* ---- Live training: the pair-by-pair report, every layout ---- */
  /* Every palette in every layout, because the three do not paint the same
     surfaces and so do not run the same rows. Slides has chips on a card and
     a tinted booking rail, Marquee has chips on a tile and flips the button
     onto the field, Typographic has no chips at all. Walking palettes against
     a single layout would have said "all pass" while two thirds of the widget
     went unmeasured.

     That is not a hypothetical. The Marquee's Back and Next carried the
     canvas's white-at-0.30 outline, which composites to 1.8:1 on the tile
     against the 3:1 a boundary needs, and it failed on all 27 palettes the
     first time the report was pointed at that layout. */
  t.click('button[data-w="classroom"]');
  t.click("#ctMoreToggle");
  let ctChecked = 0;
  const ctFails = [];
  const ctLayouts = t.all("#ctLayoutSeg button[data-ctlayout]").map(b => b.dataset.ctlayout);

  s.check("Live training: all three layouts are offered",
    ctLayouts.length === 3, ctLayouts.join(","));

  for (const layout of ctLayouts) {
    t.click(`#ctLayoutSeg button[data-ctlayout="${layout}"]`);
    // a layout that runs no rows at all is a report that has stopped looking
    let rowsSeen = 0;
    for (const mood of ["calm", "warm", "bold", "earthy", "dark"]) {
      t.click(`#ctMoodSeg button[data-ctmood="${mood}"]`);
      for (const btn of t.all("#ctMorePresets [data-ctpreset]")) {
        btn.click();
        ctChecked++;
        rowsSeen = Math.max(rowsSeen, t.all("#ctChecks .chk").length);
        const bad = t.all("#ctChecks .chk.bad").map(x => x.textContent.trim());
        if (bad.length) ctFails.push(`${layout}/${btn.dataset.ctpreset}: ${bad.join("; ")}`);
      }
    }
    s.check(`Live training: ${layout} measures something`, rowsSeen >= 12, `${rowsSeen} rows`);
  }
  s.check(`Live training: ${ctChecked} palette and layout pairings all pass`,
    ctFails.length === 0, ctFails.slice(0, 3).join(" | "));

  /* The report has to follow the layout, not just run. Marquee measures its
     field; Typographic has no tile and must not claim to have measured one.
     This is the check that would have caught the four dead rows the report
     carried until 2026-07-30, and it is why CT_LAYOUTS declares surfaces. */
  t.click('#ctLayoutSeg button[data-ctlayout="marquee"]');
  const slidesRows = t.all("#ctChecks .chk").map(x => x.textContent);
  t.click('#ctLayoutSeg button[data-ctlayout="type"]');
  const typeRows = t.all("#ctChecks .chk").map(x => x.textContent);
  s.check("Live training: Marquee measures its field",
    slidesRows.some(r => /tile/i.test(r)));
  s.check("Live training: Typographic claims no tile it does not paint",
    !typeRows.some(r => /tile/i.test(r)), typeRows.filter(r => /tile/i.test(r)).join(" | "));
  t.click('#ctLayoutSeg button[data-ctlayout="slides"]');

  /* ---- Hero: the sentence-form warnings ---- */
  t.click('button[data-w="hero"]');
  t.fill("#href", "/paths/abc123/home");
  t.click("#moreToggle");

  const presets = t.all("#presets [data-preset]");
  for (const mood of ["calm", "warm", "bold", "earthy", "dark"]) {
    t.click(`#moodSeg button[data-mood="${mood}"]`);
    presets.push(...t.all("#morePresets [data-preset]"));
  }

  let heroChecked = 0;
  const heroFails = [];
  for (const btn of presets) {
    btn.click();
    for (const layout of ["textFirst", "overlay"]) {
      t.click(`button[data-layout="${layout}"]`);
      for (const fill of ["solid", "gradient"]) {
        const f = t.$(`button[data-fill="${fill}"]`);
        // the overlay layout hides the fill choice, so it has only one case
        if (f && !t.$("#fillField").hidden) f.click();
        heroChecked++;
        const warn = t.all("#contrast p.warn").map(x => x.textContent.trim());
        if (warn.length) heroFails.push(`${btn.dataset.preset}/${layout}/${fill}: ${warn[0]}`);
      }
    }
  }
  s.check(`Hero: ${heroChecked} palette, layout and fill combinations all pass`,
    heroFails.length === 0, heroFails.slice(0, 3).join(" | "));

  /* ---- Companion gradients ----
     This widget had no contrast check at all until 2026-07-30, which made the
     builder's promise untrue for one widget in three. Its colours are type: the
     gradient is painted through the word "Companion" with background-clip:text
     and the widget has no background of its own, so every stop is a foreground
     colour on a white 360Learning page.

     The default is the platform's own gradient with its end stop deepened from
     #ec4899 to #d61675, because the platform's pink measures 3.53:1 and the word
     sets below the 18.66px where bold type may sit at 3:1. That deepening is the
     kind of thing a later tidy-up reverts on the grounds that it does not match
     the brand, so it gets a test of its own. */
  {
    const g = boot();
    await wait(300);

    const ids = g.all("#cwPresets [data-cwpreset]").map(b => b.dataset.cwpreset);
    s.check("every Companion gradient is offered", ids.length === 7, ids.join(", "));

    const gradFails = [];
    for (const id of ids) {
      g.$(`#cwPresets [data-cwpreset="${id}"]`).click();
      await wait(300);
      const bad = g.all("#cwChecks .chk.bad").map(x => x.textContent.trim());
      if (bad.length) gradFails.push(`${id}: ${bad.join("; ")}`);
    }
    s.check(`Companion: all ${ids.length} gradients pass, the default included`,
      gradFails.length === 0, gradFails.join(" | "));

    // Grey has to be grey. cwGradient keeps a seed's hue, and every slate grey a
    // UI palette ships carries a few degrees of blue, so this is one seed away
    // from a gradient nobody would call grey.
    g.$('#cwPresets [data-cwpreset="grey"]').click();
    await wait(300);
    const greyStops = /linear-gradient\(100deg,(#[0-9a-f]{6}) 0%,(#[0-9a-f]{6}) 55%,(#[0-9a-f]{6}) 100%\)/i
      .exec(g.widget());
    s.check("Grey emits three stops", !!greyStops);
    if (greyStops) {
      const stops = greyStops.slice(1, 4);
      const tinted = stops.filter(h => {
        const r = parseInt(h.slice(1, 3), 16), q = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
        return Math.max(r, q, b) - Math.min(r, q, b) > 8;
      });
      s.check("Grey is achromatic", tinted.length === 0, `tinted: ${tinted.join(", ")}`);
      // three copies of one grey is a flat fill wearing a gradient's clothes
      s.check("Grey still travels", new Set(stops).size === 3, stops.join(" "));
    }

    /* A seed is a hue, not a colour: a pale brand colour has to come back deeper
       than it was picked or it cannot be type on a white page. Yellow is the
       case that proves it, being the brightest hue there is. */
    g.click("#cwCustomToggle");
    for (const seed of ["#eab308", "#ffffff", "#e11d48", "#000000", "#737373"]) {
      g.$("#cwSeedColor").value = seed;
      g.click("#cwBuildFromSeed");
      await wait(300);
      const bad = g.all("#cwChecks .chk.bad").map(x => x.textContent.trim());
      s.check(`a gradient built from ${seed} is readable`, bad.length === 0, bad.join("; "));
    }

    s.check("no page errors across the Companion gradients", g.errors.length === 0, g.errors.join(" | "));
    g.close();
  }

  /* ---- the two monochrome palettes ----
     These exist so a customer can have a black or grey widget with no panel.
     The sweep above already proves they are readable. What it cannot prove is
     the two things that make them different from the Dark mood palettes, and
     both are easy to undo by accident:

       they must stay achromatic. Every generator in this file floors the
       saturation of something, and each floor is a chance for grey to come
       back tinted.

       they must keep "No panel" available. A dark-mode palette disables it,
       because a white heading on a white 360Learning page is invisible. These
       are light-mode palettes with dark ink, so the option has to survive. */
  {
    const m = boot();
    await wait(300);
    m.click('button[data-w="classroom"]');
    await wait(50);

    for (const id of ["black", "grey"]) {
      const btn = m.$(`#ctPresets [data-ctpreset="${id}"]`);
      s.check(`${id}: offered in the recommended row`, !!btn);
      if (!btn) continue;
      btn.click();
      await wait(300);

      // straight off the generated code, so this is the colour a learner sees
      const css = m.widget();
      const hexes = (css.match(/#[0-9a-f]{6}\b/gi) || []).map(h => h.toLowerCase());
      const tinted = hexes.filter(h => {
        const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
        // a hue anyone could name needs more spread between channels than this
        return Math.max(r, g, b) - Math.min(r, g, b) > 16;
      });
      s.check(`${id}: every colour in the output is achromatic`,
        tinted.length === 0, `tinted: ${tinted.slice(0, 4).join(", ")}`);

      const noPanel = m.$('#ctFillSeg button[data-ctfill="none"]');
      s.check(`${id}: "No panel" stays available`,
        noPanel.getAttribute("aria-disabled") !== "true");
      s.check(`${id}: no panel is what it actually renders`,
        !/-panel\{[^}]*background:/.test(css), css.slice(0, 80));
      s.check(`${id}: every pairing passes`, m.all("#ctChecks .chk.bad").length === 0,
        m.all("#ctChecks .chk.bad").map(x => x.textContent.trim()).join("; "));
    }

    /* Editing a colour by hand hands the tile back to the deriving walk, or the
       tile would stay grey while everything around it moved.

       On the Marquee, because since 2026-08-06 it is the only layout that
       paints a tile: Slides took the card from the design canvas and left the
       gradient thumbnail behind. The tile maths is unchanged and still has to
       be checked, so the check follows it to the layout that uses it. */
    m.click('#ctLayoutSeg button[data-ctlayout="marquee"]');
    m.click('#ctPresets [data-ctpreset="black"]');
    await wait(250);
    const blackTile = /linear-gradient\(134deg,(#[0-9a-f]{6})/i.exec(m.widget());
    m.click("#ctCustomToggle");
    m.fill('#ctColors input[type="text"][aria-label^="Accent"]', "#c42a92");
    await wait(400);
    const movedTile = /linear-gradient\(134deg,(#[0-9a-f]{6})/i.exec(m.widget());
    s.check("editing the accent moves a stated tile with it",
      !!blackTile && !!movedTile && blackTile[1] !== movedTile[1],
      `${blackTile && blackTile[1]} -> ${movedTile && movedTile[1]}`);

    s.check("no page errors across the monochrome palettes", m.errors.length === 0, m.errors.join(" | "));
    m.close();
  }

  s.check("no page errors while sweeping every palette", t.errors.length === 0, t.errors.join(" | "));
  t.close();
  return s;
};
