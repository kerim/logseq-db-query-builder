# Logseq DB Query Builder

A visual query builder for Logseq DB (database) graphs. Build complex Datalog queries using a macOS Finder-style interface, see live results, and copy the generated query to use in Logseq.

## Features

- **Visual Filter Builder**: Add and combine filters using dropdowns and inputs
- **Live Results Preview**: See query results as you build
- **Auto-complete**: Suggestions for tags and page names
- **Copy-Paste Ready**: Generated queries ready to use in Logseq
- **Dark/Light Theme**: Match your Logseq theme preference
- **Graph Management**: Remember last selected graph
- **Multiple Filter Types**: Page names, tags, properties, text search, dates, and more

## Prerequisites

1. **Logseq HTTP Server** must be running
   - Located at: `/Users/niyaro/Documents/Code/Logseq/logseq-http-server`
   - Start with: `python3 logseq_server.py`
   - Server runs on: `http://localhost:8765`

2. **Logseq DB Graph** (not markdown/file-based graphs)

3. **Modern web browser** (Chrome, Firefox, Safari, Edge)

## Quick Start

1. **Start the HTTP server:**
   ```bash
   cd /Users/niyaro/Documents/Code/Logseq/logseq-http-server
   python3 logseq_server.py
   ```

2. **Open the query builder:**
   ```bash
   open /Users/niyaro/Documents/Code/Logseq/logseq-db-query-builder/index.html
   ```
   Or simply double-click `index.html` in Finder.

3. **Select your graph** from the dropdown

4. **Add filters** by clicking "+ Filter"

5. **Click "Search"** to see results

6. **Copy the generated query** and paste into Logseq

## Supported Filters

### Page Filters
- **page**: Match page names
  - Operators: `is`, `contains`, `starts-with`, `ends-with`
  - Example: Find pages containing "anthropology"

### Tag Filters
- **tags**: Find items with specific tags
  - Auto-complete suggests available tags
  - Example: Find all items tagged with `#article`

### Text Search
- **full text search**: Search block content
  - Searches `:block/title` attribute
  - Example: Find blocks containing "fieldwork"

### Property Filters
- **property**: Match property values
  - Manual property name input (Phase 1)
  - Operators: `is`, `contains`
  - Supports both `user.property` and `logseq.property` namespaces
  - Example: Find items where `status = "published"`

### Reference Filters
- **page reference**: Find blocks linking to specific pages
  - Auto-complete for page names
  - Example: Find blocks referencing "Project X"

### Task Filters
- **task**: Find items with task tags
  - Note: DB graphs use tags for tasks (not TODO/DOING markers)
  - Example: Find items tagged with `#task`

### Priority Filters
- **priority**: Filter by priority
  - Options: A, B, C
  - Example: Find all priority A items

### Date Filters
- **between (dates)**: Date range queries
  - Properties: `created-at`, `updated-at`, `journal-day`
  - Example: Find items created in last 7 days

## Usage Tips

### Building Queries

1. **Start simple**: Add one filter, test it, then add more
2. **Use autocomplete**: Start typing in tag/page fields for suggestions
3. **Check results**: Click "Search" to verify your query works
4. **Refine**: Adjust filters based on results

### Using in Logseq

1. Copy the generated query
2. In Logseq, type `/query` and select "Advanced query"
3. Paste the query
4. Press Enter or click outside the editor

### Match Modes

- **All (AND)**: Results must match ALL filters (default)
- **Any (OR)**: Results match ANY filter (coming in Phase 2)

## Query Examples

### Find pages about anthropology
```
Filter: page
Operator: contains
Value: anthropology
```

Generated query:
```clojure
[:find (pull ?p [:block/uuid :block/name :block/title :block/tags :block/created-at :block/updated-at])
 :where
 [?p :block/name ?name]
 [(clojure.string/includes? ?name "anthropology")]]
```

### Find articles tagged with "research"
```
Filter: tags
Value: research
```

Generated query:
```clojure
[:find (pull ?b [:block/uuid :block/name :block/title :block/tags :block/created-at :block/updated-at])
 :where
 [?b :block/tags ?t]
 [?t :block/title "research"]]
```

### Find items with property status = "draft"
```
Filter: property
Property Name: status
Operator: is
Value: draft
```

Generated query:
```clojure
[:find (pull ?b [:block/uuid :block/name :block/title :block/tags :block/created-at :block/updated-at])
 :where
 (or-join [?b]
  [?b :user.property/status "draft"]
  [?b :logseq.property/status "draft"])]
```

## Troubleshooting

### "Disconnected" status
- **Problem**: HTTP server is not running
- **Solution**: Start the server with `python3 logseq_server.py`

### "No graphs listed"
- **Problem**: Server can't find your DB graphs
- **Solution**: Run `logseq list` in terminal to verify graphs are accessible

### "Query execution failed"
- **Problem**: Invalid query or graph access issue
- **Solution**: 
  - Check if the generated query is valid
  - Try a simpler filter first
  - Check server logs: `tail -f logseq-http-server.log`

### "No results found"
- **Problem**: Query is too restrictive or no matching items
- **Solution**:
  - Try fewer filters
  - Use "contains" instead of "is" for text matching
  - Verify tags/properties exist in your graph

### Autocomplete not working
- **Problem**: Graph not selected or API error
- **Solution**:
  - Select a graph first
  - Type at least 2 characters
  - Check browser console for errors

## Architecture

```
index.html          - Main page structure
├── styles/
│   └── main.css    - Logseq-inspired styling
├── js/
│   ├── api.js      - HTTP server communication
│   ├── queryGenerator.js  - Datalog generation
│   ├── filters.js  - Filter UI management
│   ├── autocomplete.js    - Autocomplete component
│   └── app.js      - Main application logic
```

## Development

### Testing Queries Manually

You can test generated queries directly via CLI:

```bash
logseq query 'GENERATED_QUERY_HERE' -g "YOUR_GRAPH_NAME" | jet --to json
```

### Adding New Filter Types

1. Add filter config to `FILTER_TYPES` in `filters.js`
2. Add query generation logic in `queryGenerator.js`
3. Update autocomplete if needed in `autocomplete.js`

## Roadmap

### v0.0.x - Current (Completed)
- ✅ Basic filter types
- ✅ Query generation
- ✅ Live results
- ✅ Auto-complete for tags/pages
- ✅ Dark/light theme
- ✅ Multi-select filters (status, priority)
- ✅ Tag inheritance support
- ✅ UUID resolution in results

### v0.1.0 - Property Type Awareness (Planned - Ready to Implement)
**Status**: Planning complete, implementation ready to begin

See `QUICKSTART_PROPERTY_TYPES.md` for implementation guide.

**Features**:
- [ ] Property name autocomplete with validation
- [ ] Property type detection (boolean, text, reference, date, number)
- [ ] Type-specific input UI (checkboxes, dropdowns, date pickers, number inputs)
- [ ] Operator support for numeric/date properties (=, <, >, <=, >=)
- [ ] Tag-based property suggestions

### v0.2.0 - Future
- [ ] AND/OR/NOT logic per filter
- [ ] Nested filter groups
- [ ] Sort options
- [ ] Save/load query presets
- [ ] Reverse query parsing (paste query → populate UI)
- [ ] Export results as CSV/JSON

## License

MIT

## Credits

Built for Logseq DB graphs. Not affiliated with Logseq official team.
