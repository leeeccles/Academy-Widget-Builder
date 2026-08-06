# Tests

Regression tests for `index.html`. **Nothing in this folder ships.** The
builder itself has no dependencies and no build step, and that stays true:
these tests load the real page and drive the real controls from outside.

## Running them

```bash
cd tests
npm install
npm test              # the jsdom suites, about 35 seconds, no browser needed
npm run test:browser  # those plus real-layout checks in Chromium
```

The browser suite needs Chromium once:

```bash
npx playwright install chromium
```

`npm test` exits non-zero on failure, so it can be wired into a hook or an
action later without changing anything.

## What each suite covers, and why

### `contrast.test.js`

The builder's central claim is that it cannot hand you an unreadable widget.
This walks **every** palette it offers, in every layout and both fill modes,
and reads the builder's own report back out: 128 hero combinations and 81
Live training ones, being 27 palettes across all three layouts. It is testing
what a user would actually be told, not a reimplementation of the maths.

It also checks that the report *follows* the layout. The three paint different
sets of surfaces, and a fixed list of rows would measure a widget that is not
on screen for two of them. That is not hypothetical: until
2026-07-30 four of eighteen rows described a layout that had been removed
while two live states went unmeasured, one of them at 3.39:1. The rows come
off the surface flags in `CT_LAYOUTS`, and this suite is what holds them to
it.

### `output.test.js`

Every widget is built by concatenating strings, so the failure mode is never
a thrown error. It is a stray `+`, an unbalanced brace, or a value that was
undefined when it was interpolated, all of which produce a snippet that looks
fine in the code box and quietly drops a rule in the browser. Each assertion
here is a bug that actually happened:

| check | the bug it guards |
|---|---|
| braces balance | a missing one silently swallows every rule after it |
| no `NaN` | an invalid colour reached `rgba()` and the panel lost its border |
| no `undefined` | a missing state key landed in the CSS as a literal |
| no em dash | house style for anything a customer reads |
| settings comment present | paste-back is dead without it |
| payload cannot escape its comment | base64url has no `<`, `!` or `>` |

### `state.test.js`

Saved work, shared links, and reopening a widget from its own code all funnel
through `adopt()`, which writes straight into the live state objects. That
makes it the only place in the builder that accepts anything from outside the
session, so it gets the adversarial half.

Sixteen hostile payloads (corrupt base64, a null widget, an array where an
object belongs, invalid hex, a `javascript:` link, a script tag in a heading,
a future settings version). The bar is not "does not crash". It is: **the
message says what is wrong, and whatever the user had on screen is still
there.**

It also proves all four widget types round-trip through their own generated
code **byte for byte**, in a clean session with empty storage, which is the
whole promise of paste-back.

### `layout.test.js` (browser)

jsdom does no layout, so none of this is checkable there. It does not know
that an element is off screen, that a row wrapped, or that a status message
pushed two buttons sideways. Every check is a bug that was invisible until
something measured a rectangle:

- **Start over** used to be pushed off the right edge on a phone, unreachable.
- The first **Saved** of a session shoved both header buttons left by the
  width of the word and never gave it back.
- Featured tiles used to drop into two columns across the whole tablet range,
  leaving the third alone beside an empty cell.

## Adding to them

Two rules keep this useful rather than decorative.

**Drive the real controls.** Do not reach into the builder's internals or
reimplement its logic. If a test would pass while a user is looking at a
broken widget, it is testing the wrong thing.

**Prove a new test can fail.** Break the thing it covers, watch it go red,
put it back. A suite that has never failed is not yet a suite. The
`rgba(NaN)` guard was verified this way: removing the two `cleanColors` calls
turns three checks red immediately.
