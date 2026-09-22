#!/usr/bin/env python3
"""
Pre-delivery check for the query builder: drives the real UI in Chrome against
the live Logseq graph and fails loudly if a filter stops working.

Run it before handing a change to the user, and leave them a running URL.

  # 1. serve the repo (leave it running for the user)
  python3 -m http.server 8123 --bind 127.0.0.1
  # 2. drive it
  python3 scripts/verify-ui.py [url]

Environment:
  LOGSEQ_API_TOKEN  Logseq HTTP API token. Defaults to the local dev token
                    documented in .claude/CLAUDE.md (local-only, 127.0.0.1:12315).

Requirements: Chrome, and Python Playwright
(`pip install playwright`, browsers not needed — Chrome is driven directly).
"""

import os
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8123/'
TOKEN = os.environ.get('LOGSEQ_API_TOKEN', 'slippers-chair-TABLE')
SHOT_DIR = os.environ.get('VERIFY_SHOT_DIR', '/tmp')

# The graph's own data, used as the fixture. If the graph changes, update these.
TAG = 'my projects'
PROPERTY = 'Project Status'
PROPERTY_IDENT = ':user.property/ProjectStatus-IUJoj7Hs'
VALUE = 'Active'
EXPECTED_HITS = 2
TAG_ONLY_HITS = 95

STATE = """() => {
  const rows = [...document.querySelectorAll('.filter-row')];
  const prop = rows.find(r => r.querySelector('select.filter-type-select').value === 'property');
  const f = window.app.state.rootGroup.children.find(c => c.type === 'property');
  const hint = document.querySelector('.property-values-hint');
  return {
    nameInput: prop ? prop.querySelector('input[data-autocomplete="property"]').value : null,
    filterIdent: f ? (f.propertyIdent || null) : null,
    valueType: f && f.propertySchema ? f.propertySchema.valueType : null,
    hintCount: document.querySelectorAll('.property-values-hint').length,
    hintText: hint ? hint.innerText.slice(0, 60) : null,
    count: document.getElementById('result-count').textContent.trim(),
    query: document.getElementById('query-output').textContent,
    errorVisible: document.getElementById('error-state').style.display !== 'none',
    titles: [...document.querySelectorAll('.result-item .result-title')].map(e => e.innerText),
  };
}"""


def add_filter(page, kind):
    """Add a filter row and set its type. Returns a locator for the new row."""
    page.click('#add-filter-btn')
    n = page.locator('.filter-row').count() - 1
    page.locator('.filter-row').nth(n).locator('select.filter-type-select').select_option(kind)
    page.wait_for_timeout(150)
    return page.locator('.filter-row').nth(n)


def add_tags(page):
    row = add_filter(page, 'tags')
    box = row.locator('input.filter-input').first
    box.click()
    box.type(TAG, delay=20)


def add_property(page, pick_from_dropdown):
    """Add the property filter. When pick_from_dropdown is False the name is
    typed but no suggestion is clicked, which is the hand-typed path."""
    row = add_filter(page, 'property')
    box = row.locator('input[data-autocomplete="property"]').first
    box.click()
    box.type(PROPERTY, delay=25)

    if pick_from_dropdown:
        # Wait out the 300ms autocomplete debounce, then click the suggestion by
        # its exact text: the dropdown is shared between inputs, so clicking
        # ".first" blindly can land on a stale entry from another filter.
        page.wait_for_timeout(1200)
        page.get_by_text(PROPERTY, exact=True).first.click()
        page.wait_for_timeout(1500)   # async schema lookup re-renders the value box
    else:
        page.keyboard.press('Escape')
        page.locator('h2').first.click()
        page.wait_for_timeout(300)

    value = row.locator('.property-value-input input.filter-input').first
    value.click()
    value.fill(VALUE)
    return row


def search(page):
    before = page.text_content('#result-count')
    page.click('#search-btn')
    try:
        page.wait_for_function(
            "prev => document.getElementById('result-count').textContent !== prev",
            arg=before, timeout=25000)
    except Exception:
        pass
    page.wait_for_function("() => window.app.state.isSearching === false", timeout=25000)
    page.wait_for_timeout(500)
    return page.evaluate(STATE)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        page = browser.new_page(viewport={'width': 1500, 'height': 1150})

        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        page.goto(URL, wait_until='load')
        print(f'{URL}  ->  {page.title()}')

        page.fill('#api-token', TOKEN)
        page.click('#save-token-btn')
        page.wait_for_function(
            "() => document.getElementById('current-graph').textContent.trim() !== 'Not connected'",
            timeout=20000)
        print(f'graph: {page.text_content("#current-graph").strip()}')

        out = {}

        # A — the normal path: property chosen from the dropdown.
        page.click('#clear-all-btn')
        page.wait_for_timeout(300)
        add_tags(page)
        add_property(page, pick_from_dropdown=True)
        out['A'] = search(page)
        page.screenshot(path=f'{SHOT_DIR}/verify-a-picked.png', full_page=True)

        # B — hand-typed name, suggestion never clicked.
        page.click('#clear-all-btn')
        page.wait_for_timeout(300)
        add_tags(page)
        add_property(page, pick_from_dropdown=False)
        out['B'] = search(page)

        # C — control: the tag alone, which must be unaffected.
        page.click('#clear-all-btn')
        page.wait_for_timeout(300)
        add_tags(page)
        out['C'] = search(page)
        page.screenshot(path=f'{SHOT_DIR}/verify-c-tags.png', full_page=True)

        def hits(state):
            return int(state['count'].split()[0])

        checks = {
            'A: property picked from dropdown returns the expected rows':
                hits(out['A']) == EXPECTED_HITS,
            'A: query names the real property ident':
                PROPERTY_IDENT in out['A']['query'],
            'A: query never falls back to the spaced-out label':
                f':user.property/{PROPERTY}' not in out['A']['query'],
            'A: property storage recognised as a reference':
                out['A']['valueType'] == ':db.type/ref',
            'A: known-values panel is rendered':
                out['A']['hintCount'] == 1 and 'Known values' in (out['A']['hintText'] or ''),
            'B: hand-typed property name returns the same rows':
                hits(out['B']) == EXPECTED_HITS and PROPERTY_IDENT in out['B']['query'],
            'C: tag alone still returns its full set':
                hits(out['C']) == TAG_ONLY_HITS,
            'no error banner shown':
                not any(s['errorVisible'] for s in out.values()),
            'no page errors':
                not errors,
        }

        for label, state in (('A (picked from dropdown)', out['A']),
                             ('B (typed by hand)', out['B']),
                             ('C (tag alone, control)', out['C'])):
            print(f'\n--- {label}: {state["count"]}')
            for title in state['titles'][:4]:
                print(f'      * {title}')
            if state['query']:
                print('    query: ' + ' '.join(
                    line.strip() for line in state['query'].splitlines() if line.strip()))

        print()
        for label, ok in checks.items():
            print(('  PASS  ' if ok else '  FAIL  ') + label)
        if errors:
            for e in errors[:5]:
                print('   page error:', e)

        browser.close()

    ok = all(checks.values())
    print('\nOVERALL:', 'PASS' if ok else 'FAIL')
    print(f'screenshots: {SHOT_DIR}/verify-a-picked.png, {SHOT_DIR}/verify-c-tags.png')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
