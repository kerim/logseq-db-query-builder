# Logseq DB Query Builder

A visual query builder for [Logseq](https://logseq.com/) database graphs. Build complex Datalog queries using a macOS Finder-style interface with nested filter groups, see live results, and copy the generated query to use in Logseq.

**[Try it online](https://kerim.github.io/logseq-db-query-builder/)** (requires local server - see Prerequisites)

## Features

- **Visual Filter Builder** - Add and combine filters using dropdowns and inputs
- **Nested Filter Groups** - Create complex boolean logic with ANY/ALL/NONE groups (like macOS Finder)
- **Live Results Preview** - See query results as you build
- **Property Type Awareness** - Automatic type detection with smart input controls
- **Auto-complete** - Suggestions for tags, pages, and properties
- **Copy-Paste Ready** - Generated queries ready to use in Logseq
- **Dark/Light Theme** - Match your Logseq theme preference

## Prerequisites

This tool requires the **Logseq HTTP Server** to be running locally:

1. **Clone and start the server:**
   ```bash
   git clone https://github.com/kerim/logseq-http-server.git
   cd logseq-http-server
   python3 logseq_server.py
   ```
   Server runs on `http://localhost:8765`

2. **Logseq DB Graph** - This tool works with database graphs only (not markdown/file-based graphs)

3. **[Logseq CLI](https://www.npmjs.com/package/@logseq/cli)** - The server uses the `@logseq/cli` tool. Install with:
   ```bash
   npm i @logseq/cli
   ```

## Quick Start

### Option 1: Use Online (Recommended)

1. Start the HTTP server locally (see Prerequisites)
2. Open **[https://kerim.github.io/logseq-db-query-builder/](https://kerim.github.io/logseq-db-query-builder/)**
3. Select your graph from the dropdown
4. Start building queries!

### Option 2: Run Locally

1. Clone this repository:
   ```bash
   git clone https://github.com/kerim/logseq-db-query-builder.git
   ```

2. Open `index.html` in your browser (or use a local server)

3. Make sure the HTTP server is running on `localhost:8765`

## How to Use

### Basic Filtering

1. **Select your graph** from the dropdown
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
| **task** | Find task items | Status filter with multi-select |
| **priority** | Filter by priority | Urgent, High, Medium, Low |
| **between (dates)** | Date range queries | created-at, updated-at, journal-day |

## Property Type Detection

When you select a property, the tool automatically detects its type and provides appropriate input controls:

- **Reference properties** → Dropdown or checkboxes with actual values
- **Boolean properties** → Checked/Unchecked radio buttons
- **Date properties** → Date picker with comparison operators
- **Number properties** → Number input with comparison operators
- **Text properties** → Text input

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
    ├── api.js          - HTTP server communication
    ├── queryGenerator.js - Datalog query generation
    ├── filters.js      - Filter UI and tree structure
    ├── autocomplete.js - Auto-complete component
    └── app.js          - Main application logic
```

## Related Projects

- **[logseq-http-server](https://github.com/kerim/logseq-http-server)** - Required HTTP server for this tool
- **[Logseq](https://logseq.com/)** - The knowledge management app
- **[@logseq/cli](https://www.npmjs.com/package/@logseq/cli)** - Logseq command-line interface

## Troubleshooting

### "Disconnected" status (most common)

**1. HTTP server not running**
- Start the server: `python3 logseq_server.py`
- Verify it's running: visit `http://localhost:8765/health` in your browser

**2. Ad blocker blocking localhost requests**
- **Brave Browser:** Click the Shields icon → disable for this site
- **uBlock Origin:** Click icon → click the power button to disable for this site
- **Other ad blockers:** Whitelist `localhost:8765` or disable temporarily

This is especially common when using the [online version](https://kerim.github.io/logseq-db-query-builder/) since ad blockers may block requests from external sites to localhost.

### "No graphs listed"
- **Problem:** Server can't find your DB graphs
- **Solution:** Run `logseq list` in terminal to verify graphs are accessible

### "Query execution failed"
- **Problem:** Invalid query or graph access issue
- **Solution:** Try a simpler filter first, check server logs

## Version History

- **v0.2.0** - Nested filter groups with AND/OR/NOT logic
- **v0.1.x** - Property type awareness, auto-complete
- **v0.0.x** - Initial release with basic filters

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.

## License

MIT

## Credits

Built for Logseq DB graphs. Not affiliated with Logseq official team.
