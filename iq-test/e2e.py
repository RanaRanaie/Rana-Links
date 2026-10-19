"""Smoke test for index.html (Playwright, headless Chromium).

Plays both test forms with scripted answers and checks: item counts, partial scoring,
CSV shape, and that the page logs no JavaScript errors.
Setup:  pip install playwright && playwright install chromium
Usage:  python3 e2e.py [path/to/index.html]      (default: index.html next to this file)
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

PAGE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(__file__).with_name('index.html')
PAGE = PAGE.resolve()
EXPECTED = {'general': 10, 'specialised': 20}


async def run_mode(browser, mode):
    pg = await browser.new_page(viewport={'width': 420, 'height': 900})
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    # a blocked Google Fonts request (offline / sandbox) is not a bug in the page
    pg.on('console', lambda m: errors.append(m.text)
          if m.type == 'error' and 'Failed to load resource' not in m.text else None)

    await pg.goto(PAGE.as_uri())
    await pg.fill('#name', 'T-' + mode)
    await pg.click(f'input[value={mode}]')
    await pg.click('#btn-start')

    for step in range(40):
        practice = await pg.evaluate('queue[qi].practice')
        correct = await pg.evaluate('queue[qi].item.correct')
        await pg.wait_for_timeout(120)                     # the timer starts after two animation frames
        wrong_one = (not practice) and step % 3 == 1       # exercise partial scoring
        picks = [correct[0], next(i for i in range(4) if i not in correct)] if wrong_one else correct
        for i in picks:
            await pg.click(f'.opt[data-i="{i}"]')
        await pg.click('#btn-confirm')
        if practice:
            await pg.wait_for_selector('#feedback:not([hidden])')
            await pg.click('#btn-confirm')                 # "next"
        else:
            await pg.wait_for_timeout(350)
        if await pg.is_visible('#screen-result'):
            break

    await pg.wait_for_selector('#screen-result:not([hidden])')
    n = await pg.evaluate('results.length')
    partial = await pg.evaluate('results.filter(r => r.nCorrect === 1).length')
    csv_lines = await pg.evaluate(
        'toCSV([{participant, mode, finishedAt: finishedAt.toISOString(), results}]).split("\\r\\n").length')
    await pg.close()

    problems = []
    if n != EXPECTED[mode]:
        problems.append(f'{mode}: {n} results, expected {EXPECTED[mode]}')
    if partial < 1:
        problems.append(f'{mode}: no partial-credit item was recorded')
    if csv_lines != EXPECTED[mode] + 1:
        problems.append(f'{mode}: CSV has {csv_lines} lines, expected {EXPECTED[mode] + 1}')
    problems += [f'{mode}: page error: {e}' for e in errors]
    print(f'{mode:12s} items={n} partial={partial} csv_lines={csv_lines} page_errors={len(errors)}')
    return problems


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        problems = []
        for mode in EXPECTED:
            problems += await run_mode(browser, mode)
        await browser.close()
    if problems:
        print('FAILED:')
        for x in problems:
            print(' -', x)
        sys.exit(1)
    print('e2e ok')


asyncio.run(main())
