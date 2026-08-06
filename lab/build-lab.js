/* Builds live-training-lab.html.

   The lab has to render these five layouts with the *real* palette maths, the
   *real* button, the *real* section type. Copying those into the lab would
   mean the thing being reviewed is a lookalike, and every review after the
   first would be reviewing the drift.

   So nothing here is copied. Every definition, the five layouts included, is
   sliced straight out of index.html and pasted into one self-contained page.
   The lab renders the widget the builder actually ships, or it fails.

       node lab/build-lab.js        # re-run after any change to index.html

   If index.html renames or removes one of the functions listed in NEEDED, this
   throws rather than emitting a lab that quietly disagrees with the builder. */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const lines = src.split("\n");

/* The builder is two scripts in one file. The first ends at `})();` around
   line 2934 and owns the course-cover tool, which has its own `lum` and its
   own `blend` with different signatures. Everything wanted here is in the
   second. Anchoring on the marker rather than on a number so the slice
   survives edits above it. */
const START = lines.findIndex((l, i) => i > 2900 && l.trim() === "})();");
if (START < 0) throw new Error("could not find the end of the first script block");

function block(open, close) {
  return (startLine) => {
    let depth = 0, started = false;
    const out = [];
    for (let j = startLine; j < lines.length; j++) {
      out.push(lines[j]);
      for (const ch of lines[j]) {
        if (open.includes(ch)) { depth++; started = true; }
        else if (close.includes(ch)) depth--;
      }
      if (started && depth === 0) return out.join("\n");
    }
    throw new Error("unterminated block at line " + (startLine + 1));
  };
}
const braces = block("{", "}");
const anyBracket = block("{[", "}]");

function grabFn(name) {
  const i = lines.findIndex((l, ix) => ix > START && l.includes("function " + name + "("));
  if (i < 0) throw new Error("index.html no longer defines function " + name + "()");
  return braces(i);
}
function grabVar(prefix) {
  const i = lines.findIndex((l, ix) => ix > START && l.trim().startsWith(prefix));
  if (i < 0) throw new Error("index.html no longer defines " + prefix);
  const line = lines[i];
  // a one-liner such as `var R_PANEL = "16px", R_CARD = ...` has no block to
  // match, so take it as it stands
  if (!/[[{]/.test(line)) {
    let out = [line], j = i;
    while (!/;\s*$/.test(lines[j]) && j < lines.length - 1) out.push(lines[++j]);
    return out.join("\n");
  }
  return anyBracket(i);
}

/* Order matters only in that a `var` initialised by calling one of these has
   to come after it; the function declarations hoist. */
const NEEDED = [
  ["fn", "hash6"], ["fn", "stateSeed"], ["fn", "uid"], ["fn", "esc"], ["fn", "escAttr"],
  ["var", "var R_PANEL ="], ["var", "var FONT_STACK ="],
  ["fn", "buttonCss"], ["fn", "linkCss"],
  ["fn", "clone"], ["fn", "rgbOf"], ["fn", "lum"], ["fn", "ratio"], ["fn", "isHex"],
  ["fn", "toHex"], ["fn", "blend"], ["fn", "rgba"], ["fn", "hslOf"], ["fn", "hslToHex"],
  ["fn", "walkTo"],
  ["var", "var CURATED ="],
  ["fn", "ctPalette"], ["var", "var CT_MONO ="],
  ["fn", "ctEdge"], ["fn", "ctOnAccent"], ["fn", "ctTile"],
  ["var", "var CT_DUR_EDGE_ALPHA ="], ["fn", "ctDurEdge"], ["fn", "ctChipFg"],
  ["var", "var CT_UNITS ="], ["var", "var CT_FORMATS ="],
  ["fn", "ctTrim"], ["fn", "ctDur"], ["fn", "ctFormat"],
  ["fn", "ctHrefOk"], ["fn", "ctSafe"], ["fn", "ctExternal"],
  ["var", "var CT_ICON ="], ["fn", "ctSvg"],
  ["fn", "ctPanelBg"], ["fn", "ctTone"], ["var", "var CT_PAD ="], ["fn", "ctBaseCss"],
  ["fn", "ctLinkHtml"], ["fn", "ctHeadHtml"], ["fn", "ctHeadCss"],
  ["fn", "ctPillsHtml"], ["fn", "ctBtnCss"], ["fn", "ctBtnHtml"],
  ["fn", "ctSectionsCss"], ["fn", "ctWrap"],

  /* ---- the layouts, lifted like everything else ----
     These lived in lab/ct-layouts.js while they were candidates. They shipped
     into index.html on 2026-08-06, and the moment they did, a second copy here
     stopped being a source and started being a fork: the lab would go on
     rendering whatever it was last given while the widget moved underneath it,
     which is the exact opposite of what a lab is for. */
  ["fn", "ctRail"], ["fn", "ctInkOn"], ["fn", "ctPillCss"], ["fn", "ctChipCardCss"],
  ["fn", "ctChipWash"], ["fn", "ctCount"], ["fn", "ctShows"],
  ["fn", "ctObjItems"], ["fn", "ctBlock"], ["fn", "ctObjHtml"], ["fn", "ctProseHtml"],
  ["fn", "ctWhoLine"], ["fn", "ctTrainerHtml"], ["fn", "ctTrainerCss"],
  ["fn", "ctDeckParts"], ["fn", "ctNavHtml"], ["fn", "ctDeckCss"], ["fn", "ctNavAbsCss"],
  ["fn", "ctLayoutSlides"], ["fn", "ctLayoutMarquee"], ["fn", "ctLayoutType"],
  ["var", "var CT_LAYOUTS ="], ["fn", "ctLayoutById"], ["fn", "ctCleanLayout"],
  ["var", "var CT_LAYOUT_FN ="], ["fn", "ctBuildLayout"]
];

/* `var ct` is lifted last and on its own, because it is the one definition
   here that runs code at load: it initialises from `clone(ctById("mist").c)`,
   so both CT_CURATED and ctById have to exist by the time it is reached.
   Function declarations hoist and plain data does not, which is the whole
   reason this file cares about order at all. */
const AFTER = [["fn", "ctById"], ["var", "var ct = {"]];

function lift(list) {
  return list.map(([kind, name]) => (kind === "fn" ? grabFn(name) : grabVar(name))).join("\n\n");
}

// CT_CURATED is built by mapping CURATED through ctPalette, three lines in
// index.html that sit between the two and are cheaper to restate than to
// slice around.
const derived = `
  var CT_CURATED = CURATED.map(function(p) {
    return { id: p.id, name: p.name, mood: p.mood, c: ctPalette(p.seed, p.mood === "dark") };
  }).concat(CT_MONO);
`;

const shell = fs.readFileSync(path.join(__dirname, "lab-shell.html"), "utf8");

const out = shell.replace("/*__BUILDER__*/", () =>
  "/* ---- lifted verbatim from index.html by lab/build-lab.js. Do not edit here. ---- */\n" +
  lift(NEEDED) + "\n" + derived + "\n" + lift(AFTER)
);

fs.writeFileSync(path.join(__dirname, "live-training-lab.html"), out);
console.log("lab/live-training-lab.html written  ·  " +
  NEEDED.length + " definitions lifted, " + (out.length / 1024).toFixed(0) + "kb");
