# Mental-rotation test with response-time recording (Persian, RTL)

A static, self-contained page for a psychology assignment. It shows a reference figure and four options;
exactly two options are rotated copies of the reference, the other two are mirror images or have one
square moved. The participant picks two and confirms. The page records how many seconds each item took.
It measures one component of spatial ability (mental rotation), not general intelligence.

## Files
| File | Role |
|---|---|
| index.html | The finished page (HTML + CSS + JS, item bank inlined). This is what GitHub Pages serves. Generated - do not edit by hand. |
| template.html | Source of the page. Contains one placeholder, `/*__ITEMS__*/null`, replaced by the item bank. Edit this. |
| build.js | `node build.js` inlines items.json into template.html and writes index.html. |
| items.json | Item bank: 2 practice items, 20 scored items, and `generalIds` (the 10 items of the short form). |
| gen.js | Deterministic (seeded, no Math.random) generator for items.json. Same output on every run. |
| validate.js | Independent checker for items.json. Must print "all items valid". |
| e2e.py | Playwright smoke test: plays both forms, checks counts, CSV shape, console errors. |

Workflow after any change to the page: edit template.html -> `node build.js` -> `python3 e2e.py`.
After any change to the items: `node gen.js && node validate.js && node build.js`.
Keep item ids stable once participants have been tested (results are compared across people).

## Item model (items.json)
`{ id, level, nCells, target: [[x,y,colour]...], options: [4 x {cells, angle, kind, correct, disparity}], correct: [i,j], distractorTypes }`
- colour is 0 or 1 (blue #1b6ca8 / orange #e8890c, colour-blind safe); angle is the rotation in degrees.
- kind is "target" (a rotation of the reference), "mirror" (reflection) or "shift" (one square moved).
- Validated rules: the reference is chiral (its mirror is not a rotation of it); both correct options are true
  rotations; both distractors are not; no duplicate option images; correct positions balanced over A-D.

| Level | Items | Squares | Distractors | Rotation of correct options |
|---|---|---|---|---|
| 1 | 3 | 7 | shift + shift | multiples of 90 deg |
| 2 | 5 | 8-9 | mirror + shift | multiples of 45 deg |
| 3 | 6 | 9 | mirror + mirror | one 90-multiple, one oblique |
| 4 | 6 | 11 | mirror / shift mix | both oblique |

Short form (10 items): S01 S02 S04 S05 S06 S07 S09 S10 S11 S12. Long form: all 20 (S01-S20).
Difficulty levels are by design; they are NOT yet calibrated with real data.

## Timing and scoring (as implemented)
- RT starts after the item has been painted (two nested requestAnimationFrame calls) using performance.now(),
  and stops at the confirm click. The time of the first option click is stored too.
- left_tab = the participant left the tab during the item; rapid_guess = RT below RAPID_GUESS_S (2.0 s).
- Fully correct = both chosen options correct. Partial score = number of correct chosen options (0-2) per item.
- Summary: fully correct count, partial score, total time, mean RT, mean RT of fully correct items,
  correct per minute, IES = mean RT of fully correct items / proportion fully correct (lower is better).
- Constants at the top of the script in template.html: RAPID_GUESS_S, SHOW_TIMER (live timer hidden by default),
  STORE_KEY, LEVEL_NAMES.

## Data
- Results are kept in the browser's localStorage (key mrt_results_v1), per browser and device only.
- CSV export (UTF-8 with BOM so Excel shows Persian): one participant, or everyone stored in this browser.
  Columns: participant, mode, finished_at, item_id, level, n_cells, selected, correct_options, correct_picks,
  full_correct, rt_confirm_s, rt_first_click_s, left_tab, rapid_guess, correct_option_angle_disparity,
  distractor_types. selected / correct_options are 1-based option positions joined by ";".

## Known limitations
1. Item difficulty is designed, not empirically calibrated; no norms, so no IQ conversion.
2. Spatial ability only.
3. Data never leaves the participant's browser unless they send the CSV (no server on GitHub Pages).
4. RT differs between touch and mouse devices; input type is not logged.
5. The Vazirmatn font comes from Google Fonts (page still works without it).
