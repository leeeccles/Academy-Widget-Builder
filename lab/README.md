# Live training layout lab

A rendering harness for the three Live training layouts. It exists so a layout
can be looked at across every palette, fill and column width in one place,
which the builder's single preview cannot do.

## Using it

Open `lab/live-training-lab.html`. Nothing to install.

Pick a layout on the left, a palette under it, and drag **Column width** or use
a preset. **Compare all** stacks all three at the current width and palette.
The panel underneath measures the pairings the card-side layouts introduce.

## It is generated, and that is the point

```bash
node lab/build-lab.js      # re-run after any change to index.html
```

`build-lab.js` slices 77 definitions straight out of `index.html`, the layouts
included, and pastes them into one self-contained page. Nothing is copied by
hand, so the lab renders the widget the builder actually ships. If `index.html`
renames or removes any of them the build throws rather than emitting a lab that
quietly disagrees.

| file | what it is |
|---|---|
| `build-lab.js` | the generator |
| `lab-shell.html` | the lab's own chrome. Never shipped, never part of a widget. |
| `live-training-lab.html` | generated. Do not edit; re-run the build. |

## One rule for the shell

**No rule in `lab-shell.html` may name a bare element.** The preview holds a
real widget, and a widget is made of `h2`, `h3`, `p`, `ul` and `a`. A chrome
rule such as `.shot h3 {font-size:13px}` is one class plus one type, which
outranks the widget's own single-class `.ct-mqt`. That exact rule silently
repainted the Marquee's 34px display title at 13px, and it read as a fault in
the layout rather than in the page around it. Style `.shot-h`, not `h3`.

## Where the layouts came from

`Live training widget.html`, a design canvas holding five shortlisted designs:
2a Marquee, 2b Typographic, 2c Deck of cards, 2e Ticket, 1e Editorial. They
were rebuilt against the builder's constraints rather than pasted, then cut
down on 2026-08-06 after being seen rendered rather than described.

What survived, and why:

- **Slides** keeps its name and its place as the default, and took 2c's card:
  title and bullets on the card, a tinted rail beside them carrying the
  trainer, the chips and the button. 2c's own stacked ghost cards were dropped
  (the dots and counter already say there are more) along with the gradient
  tile the old Slides used.
- **Marquee** is 2a, and is now the only layout carrying a tile.
- **Typographic** is 2b, with the shipping solid button rather than the
  canvas's underlined link, so buttons match across every layout.
- **Ticket** and **Editorial** were dropped.

What changed coming across from the canvas is documented in `index.html` above
`ctRail`.
