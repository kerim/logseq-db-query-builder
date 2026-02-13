# CLAUDE.md

Logseq DB Query Builder — a vanilla JS web app that generates Datalog queries for Logseq database graphs. No build process, no frameworks.

## Architecture

### Module Dependency Graph

```
index.html loads (in order):
  api.js        → LogseqAPI class (HTTP client for logseq-http-server)
  queryGenerator.js → QueryGenerator class (filter tree → Datalog)
  filters.js    → FilterManager class (UI + filter tree state) + FILTER_TYPES config
  autocomplete.js → Autocomplete class (dropdown suggestions)
  app.js        → App class (coordinator, wires everything together)
```

All classes are exposed as `window.*` globals. `App` is instantiated on DOMContentLoaded as `window.app`.

### Data Flow

```
User interacts with filter UI
  → FilterManager updates its rootGroup tree (in-memory)
  → FilterManager calls onChange(rootGroup)
  → App.onFiltersChange() stores rootGroup in state
  → App.generateQuery() passes rootGroup to QueryGenerator.generate()
  → QueryGenerator recursively walks the tree, produces raw + wrapped Datalog strings
  → App displays wrapped query in UI

User clicks Search
  → App sends raw query to LogseqAPI.executeQuery()
  → API POSTs to http://localhost:8765/query
  → Results come back, UUIDs get resolved, results displayed
```

### Filter Tree Structure

The core data model is a **recursive tree of groups and filters**:

```
rootGroup (type: 'group', matchMode: 'all'|'any'|'none')
├── filter (type: 'tags', value: 'Book')
├── filter (type: 'property', propertyName: 'status', propertySchema: {...}, value: 'Done')
└── group (type: 'group', matchMode: 'any')    ← nested group
    ├── filter (type: 'full-text', value: 'foo')
    └── filter (type: 'task', value: ['Todo', 'Doing'])
```

- Groups have `matchMode`: `'all'` (AND), `'any'` (OR), `'none'` (NOT)
- Filters have `type` matching a key in `FILTER_TYPES`
- Filter objects carry all their state: `value`, `operator`, `propertyName`, `propertySchema`, `startDate`, `endDate`, etc.

### Recursive Query Generation (queryGenerator.js)

`QueryGenerator.generate(rootGroup)` walks the tree:

1. **Flatten** all filters to validate and determine entity type (`?p` for pages, `?b` for blocks)
2. **Recursively** call `buildGroupClause(group, entityVar)`:
   - For each child: if group → recurse; if filter → `buildWhereClause(filter, entityVar)`
   - Combine child clauses based on `matchMode`:
     - `'all'` → concatenate clauses (AND = just place them together in `:where`)
     - `'any'` → wrap in `(or-join [entityVar] (and ...) (and ...))`
     - `'none'` → bind entity var, then `(not-join [entityVar] ...combined clauses...)`
3. **Assemble** `[:find (pull ?b [*]) :where ...clauses...]`
4. **Return** both `raw` (for API) and `wrapped` (for Logseq's `{:query [...]}` format)

### Property Type Handling Pipeline

When user selects a property in the filter UI:

1. **Autocomplete** (`autocomplete.js`) fetches property names from graph, stores `ident` (e.g., `:user.property/email`)
2. **Schema inference** (`filters.js:renderFilterInputs`) queries a sample value to infer `valueType` and `cardinality`
3. **Type-specific UI** renders based on inferred type:
   - `:db.type/boolean` → radio buttons (checked/unchecked)
   - `:db.type/ref` → dropdown (single cardinality) or checkboxes (many cardinality), populated from `getPropertyValues()`
   - `:db.type/number` → number input + comparison operator
   - `:db.type/instant` → date picker + comparison operator
   - Default → text input with is/contains operators
4. **Query generation** (`queryGenerator.js:buildPropertyClause`) dispatches on `propertySchema.valueType`:
   - Boolean: `[?b :prop true/false]`
   - Ref (single): `[?b :prop ?val] [?val :block/title "X"]`
   - Ref (multi): `(or-join [?b] (and [?b :prop ?ref] [?ref :block/title "X"]) ...)`
   - Number/Date: `[?b :prop ?num] [(op ?num val)]`
   - Fallback (no schema): tries both `:user.property/` and `:logseq.property/` namespaces via `or-join`

### Filter Types (FILTER_TYPES in filters.js)

| Type | Entity | Key Behavior |
|------|--------|-------------|
| `page` | `?p` | Name matching: is/contains/starts-with/ends-with |
| `tags` | `?b` or `?p` | Tag title match, optional `extends` support |
| `full-text` | `?b` | Regex-based case-insensitive search on `:block/title` |
| `property` | `?b` or `?p` | Type-aware (see pipeline above) |
| `page-reference` | `?b` | Matches `:block/refs` → `:block/name` |
| `task` | `?b` | Status property match with optional extensions/all-status-properties |
| `priority` | `?b` | Priority property match (Urgent/High/Medium/Low) |
| `between` | `?b` | Date range on created-at/updated-at/journal-day using timestamps |

### API Layer (api.js)

Connects to **`http://localhost:8765`** (logseq-http-server). Key endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Connection check |
| GET | `/list` | List available graphs |
| POST | `/query` | Execute Datalog query (body: `{graph, query}`) |
| GET | `/search?q=&graph=` | Page search |

Notable methods beyond basic CRUD:
- `getPropertySchema()` — pulls full entity with `[*]` to get `:db/valueType` and `:db/cardinality`
- `getTagProperties()` — nested pull to get `:logseq.property.class/properties` for a tag
- `resolveUUIDs()` — post-processes results to replace `[[uuid]]` refs with `[[title]]`

## Key Conventions

### Version Management

- **Current version**: check `index.html` line 6 (authoritative source)
- **Increment with every change**: PATCH for fixes, MINOR for features
- **Update in**: `index.html` (title + header), `README.md`, `docs/PROJECT_STATUS.md`, `CHANGELOG.md`
- **Tag every commit**: `git tag vX.Y.Z`

### Test Query Syntax Before Implementing

Always verify Datalog patterns with the Logseq CLI before writing code. All `logseq` CLI commands require `dangerouslyDisableSandbox: true` because they read from `~/Library/Application Support/Logseq/`.

```bash
logseq list                    # see available graphs
logseq query -g "GRAPH" -- '[:find (pull ?b [*]) :where ...]'
```

The CLI works whether or not the Logseq desktop app is running. If you get "unable to open database file" errors, debug the actual issue — don't assume it's an app lock.

### Fix Tools, Don't Work Around Them

If the CLI, git, or any workflow tool fails, debug and fix it. Never assume a query works without testing. Never commit untested code based on assumptions.

### File Organization

```
logseq-db-query-builder/
├── .claude/           # Claude instructions
├── docs/              # Documentation (git-ignored)
├── tests/             # Test scripts (git-ignored)
├── js/                # Source code (api.js, queryGenerator.js, filters.js, autocomplete.js, app.js)
├── styles/            # CSS (main.css)
├── index.html         # Entry point
├── README.md
└── CHANGELOG.md
```

Source in `js/` and `styles/` only. Docs in `docs/`. Tests in `tests/`.

## Common Tasks

### Adding a New Filter Type

1. Add entry to `FILTER_TYPES` in `js/filters.js` (defines label, operators, input types)
2. Add `renderFilterInputs` case if custom UI needed (in `js/filters.js`)
3. Create `build[TypeName]Clause(filter, entityVar)` in `js/queryGenerator.js`
4. Add case to `buildWhereClause()` switch
5. Update `isValidFilter()` if validation logic differs
6. Update `determineEntityType()` if the filter is page-only or block-only
7. Test with CLI, then in browser

### Modifying Query Generation

1. Edit the relevant `build*Clause()` method in `js/queryGenerator.js`
2. Test the generated Datalog with `logseq query` CLI first
3. Verify in browser
4. Update version, commit, tag

### UI Changes

1. Filter UI → `js/filters.js`
2. Styles → `styles/main.css` (test both light and dark themes)
3. Layout → `index.html`

## Technical Notes

- Queries are case-insensitive: full-text uses `re-pattern "(?i)..."`, page uses `:block/name` (already lowercase)
- Property namespaces: user properties are `:user.property/name-UUID`, logseq built-ins are `:logseq.property/name`
- Entity refs in query results appear as `[[uuid]]` — `resolveUUIDs()` replaces them with titles
- The `extends` pattern queries `:logseq.property.class/extends` for tag inheritance
- Task filter has three scoping modes: direct Task tag only, include extensions, include all entities with status property
