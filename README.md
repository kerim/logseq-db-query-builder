# Logseq DB Query Builder

A visual query builder for [Logseq](https://logseq.com/) database graphs. Build complex Datalog queries using a macOS Finder-style interface with nested filter groups, see live results, and copy the generated query to use in Logseq.

**[Try it online](https://kerim.github.io/logseq-db-query-builder/)** (requires Logseq API enabled - see Prerequisites)

## Features

- **Visual Filter Builder** - Add and combine filters using dropdowns and inputs
- **Nested Filter Groups** - Create complex boolean logic with ANY/ALL/NONE groups (like macOS Finder)
- **Live Results Preview** - See query results as you build
- **Property Type Awareness** - Automatic type detection with smart input controls
- **Auto-complete** - Suggestions for tags, pages, and properties
- **Copy-Paste Ready** - Generated queries ready to use in Logseq
- **Dark/Light Theme** - Match your Logseq theme preference
- **No extra server needed** - Connects directly to Logseq's built-in HTTP API

## Prerequisites

This tool connects to **Logseq's built-in HTTP API** (no extra server needed):

1. **Enable Developer Mode:** Logseq → Settings → Advanced → enable "Developer mode"
2. **Restart Logseq**
3. **Enable HTTP API:** Settings → API Server → enable "HTTP APIs server"
4. **Create a token:** Click "Authorization tokens" → create a token
5. **Logseq DB Graph** - This tool works with database graphs only (not markdown/file-based graphs)

## Quick Start

### Option 1: Use Online (Recommended)

1. Enable the Logseq HTTP API (see Prerequisites)
2. Open **[https://kerim.github.io/logseq-db-query-builder/](https://kerim.github.io/logseq-db-query-builder/)**
3. Paste your API token and click **Connect**
4. Start building queries!

> **Note:** Safari does not support the online version (it blocks HTTPS-to-localhost requests). Use Chrome or Firefox instead, or run locally.

### Option 2: Run Locally

1. Clone this repository:
   ```bash
   git clone https://github.com/kerim/logseq-db-query-builder.git
   ```

2. Open `index.html` in your browser (or use a local server)

3. Enable the Logseq HTTP API and paste your token

## How to Use

### Basic Filtering

1. **Paste your API token** and click Connect
2. **Click "+ Filter"** to add a filter
3. **Choose filter type** (tags, page, property, etc.)
4. **Set the value** and click **Search**
5. **Copy the query** to use in Logseq

### Nested Groups (Boolean Logic)

Create complex queries with nested groups:

1. Click **"+ Group"** to add a nested filter group
2. Choose the group's match mode:
   - **ALL** - All filters must match (AND)
   - **ANY** - Any filter can match (OR)
   - **NONE** - No filters should match (NOT)
3. Add filters or more groups inside

**Example:** Find tasks that are either urgent OR high priority, but NOT archived:
```
ALL of the following:
  ├─ [tags] is [Task]
  ├─ ANY of the following:
  │    ├─ [priority] is [Urgent]
  │    └─ [priority] is [High]
  └─ NONE of the following:
       └─ [tags] is [archived]
```

## Supported Filters

| Filter Type | Description | Options |
|-------------|-------------|---------|
| **page** | Match page names | is, contains, starts-with, ends-with |
| **tags** | Find items with specific tags | Include child tags option |
| **full text search** | Search block content | contains, equals |
| **property** | Match property values | Auto-detects type (text, reference, boolean, date, number) |
| **page reference** | Find blocks linking to pages | Auto-complete |
| **parent links page** | Find blocks whose immediate parent links to a page | Auto-complete |
| **block on page** | Find blocks that live on a specific page | Auto-complete |
| **task** | Find task items | Status filter (multi-select). "Todo" also matches Task-tagged blocks with no explicit status, matching Logseq's task UI |
| **priority** | Filter by priority | Urgent, High, Medium, Low |
| **deadline / scheduled** | Filter blocks by whether deadline and/or scheduled properties are present at all | Field: deadline or scheduled / deadline / scheduled. State: is not set / is set. Pairs with the task filter to find tasks with no dates |
| **between (dates)** | Date range queries | created-at, updated-at, journal-day. Absolute mode (date pickers) or Relative mode (Last/Next N days, custom range) |

## Property Type Detection

When you select a property, the tool automatically detects its type and provides appropriate input controls:

- **Reference properties** → Dropdown or checkboxes with actual values
- **Boolean properties** → Checked/Unchecked radio buttons
- **Date properties** (e.g. `deadline`, `scheduled`, custom `:date`/`:datetime`) → Absolute/Relative mode toggle. Absolute = date picker + operator. Relative = presets like "Last 7 days", "Next 30 days", custom offset range. Wrapped queries use Logseq's input keywords (`?-7d`, `?today`, `?+1d-start`, …) so the window is easy to widen by hand.
- **Number properties** → Number input with comparison operators
- **Text properties** → Text input

Schema is discovered from the property's `:logseq.property/type` (Logseq DB's source of truth), so user-defined properties with UUID suffixes and properties with no values set yet are still recognized.

## Using Generated Queries in Logseq

1. Copy the generated query
2. In Logseq, type `/query` and select "Advanced query"
3. Paste the query
4. Press Enter to execute

## Architecture

```
logseq-db-query-builder/
├── index.html          - Main page
├── styles/
│   └── main.css        - Logseq-inspired styling
└── js/
    ├── api.js          - Logseq built-in API communication
    ├── queryGenerator.js - Datalog query generation
    ├── filters.js      - Filter UI and tree structure
    ├── autocomplete.js - Auto-complete component
    └── app.js          - Main application logic
```

## Related Projects

- **[Logseq](https://logseq.com/)** - The knowledge management app

## Troubleshooting

### "Disconnected" status (most common)

**1. Logseq API not enabled**
- Open Logseq → Settings → Advanced → enable "Developer mode"
- Restart Logseq
- Settings → API Server → enable "HTTP APIs server"

**2. Invalid token**
- Go to Settings → API Server → "Authorization tokens"
- Create a new token or copy an existing one
- Paste it in the token field and click Connect

**3. Ad blocker blocking localhost requests**
- **Brave Browser:** Click the Shields icon → disable for this site
- **uBlock Origin:** Click icon → click the power button to disable for this site
- **Other ad blockers:** Whitelist `127.0.0.1:12315` or disable temporarily

This is especially common when using the [online version](https://kerim.github.io/logseq-db-query-builder/) since ad blockers may block requests from external sites to localhost.

**4. Browser blocking local network access**

When using the online version (HTTPS), your browser may block requests to the local Logseq API (`http://127.0.0.1:12315`). Here's the browser compatibility:

| Browser | HTTPS → HTTP localhost | What to do |
|---------|----------------------|------------|
| **Chrome/Edge/Brave/Opera** (v142+, Oct 2025) | Permission prompt appears | Click "Allow". If denied: Settings → Privacy & Security → Site Settings → Local Network Access → allow for this site. [Details](https://developer.chrome.com/blog/local-network-access) |
| **Chrome/Edge** (pre-142) | Works | Loopback addresses exempted from mixed content blocking |
| **Firefox** (55+) | Works | `http://127.0.0.1` treated as secure since Firefox 55 ([bug #903966](https://bugzilla.mozilla.org/show_bug.cgi?id=903966)) |
| **Safari** | **Does not work** | Safari blocks all HTTPS→HTTP localhost requests. WebKit [bug #171934](https://bugs.webkit.org/show_bug.cgi?id=171934) open since 2017, unresolved. Use Chrome, Firefox, or run locally. |
| **Brave** | Same as Chrome | Also disable Shields for this site (click Shields icon → disable) |

### "Query execution failed"
- **Problem:** Invalid query or graph access issue
- **Solution:** Try a simpler filter first, check browser console for details

## Version History

- **v0.9.0** - New "deadline / scheduled" filter: find blocks where deadline and/or scheduled is set or not set (pair with the task filter to find tasks with no dates)
- **v0.8.0** - New "parent links page" and "block on page" filters; fix full-text search for terms containing punctuation (e.g. `gmail.com`, `(draft)`, `what?`)
- **v0.7.6** - UX: ref-type property value inputs now have inline autocomplete (filtered from known values as you type)
- **v0.7.5** - UX: ref-type property values now use a text input with a 25-item comma-separated hint list instead of an unwieldy dropdown or checkbox list
- **v0.7.4** - Fix: built-in block-namespace properties (alias, tags, refs, etc.) now appear in the property dropdown with correct schema/type detection; internal system properties hidden
- **v0.7.0** - Page-reference filter gains a three-mode scope selector (parent only / parent + extensions / extensions only), walking the `:block/parent` chain via Logseq's recursive `parent` rule
- **v0.6.2** - Task filter "Todo" now also matches Task-tagged blocks with no explicit status (matches Logseq's task-UI semantics)
- **v0.6.1** - Wrapped query uses Logseq input keywords (`?-7d`, `?today`, `?+1d-start`, etc.) instead of raw timestamps — easy to edit by hand
- **v0.6.0** - Relative-date support for "between" filter and date-typed properties (deadline, scheduled, projectdeadline); fix absolute journal-day range returning zero results
- **v0.5.0** - Disconnect button, HTTPS/browser detection for local network access
- **v0.4.5** - Fix journal-date dropdowns layout (side-by-side instead of stacked)
- **v0.4.4** - Fix autocomplete on GitHub Pages (cache-busting for JS/CSS)
- **v0.4.3** - Fix "Untitled" results display with short-key fallbacks
- **v0.4.1** - Fix quote escaping, entity-reference schema handling, result flattening
- **v0.4.0** - Migrate to Logseq built-in API (no extra server needed)
- **v0.3.1** - Journal-date relative filtering, autocomplete positioning fix
- **v0.2.0** - Nested filter groups with AND/OR/NOT logic
- **v0.1.x** - Property type awareness, auto-complete
- **v0.0.x** - Initial release with basic filters

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License

MIT

## Credits

Built for Logseq DB graphs. Not affiliated with Logseq official team.
