# Logseq DB Query Builder - Project Status

## v0.8.0 (2026-06-12)

**Current Version**: v0.8.0

### What's New in v0.8.0

- **New filter: "parent links page"** — matches blocks whose immediate parent block references a chosen page.
- **New filter: "block on page"** — matches blocks that live on a chosen page.

## v0.7.5 (2026-06-01)

### What's New in v0.7.5

- **UX: ref-type property values use text input with hint list.** Instead of a dropdown or checkbox list (which was unwieldy for open-ended properties like Alias), ref properties now render a text input. A comma-separated list of the first 25 known values appears below as a reference hint.

### What's in v0.7.4

- **Fix: built-in block-namespace properties now appear in dropdown.** The property autocomplete now uses a definition-based query, surfacing `:block/*` built-ins (alias, tags, refs, etc.) that the old value-scan silently omitted. Additionally, the Logseq HTTP API strips the `block/` namespace from these idents (returning `"alias"` instead of `":block/alias"`), so the ident is now reconstructed on the client. Internal/system properties (`public? = false`) are filtered out.

### What's in v0.7.0
- **Page-reference filter scope selector.** Replaces the inert "Include extensions" checkbox on page-reference filters with a three-mode selector:
  - **parent only** (default, current behavior) — match the named page exactly
  - **parent + extensions** — match the page OR any descendant via the `:block/parent` chain
  - **extensions only** — match descendants only, excluding the named page
  Uses Logseq's built-in recursive `parent` rule, so the walk is unbounded by depth.
- **Variable-collision fix in page-reference clauses.** Multiple page-reference filters in the same AND group now bind independent `?ref0`, `?ref1`, etc. variables — previously they all bound to `?ref` and silently returned zero results.

## v0.6.2 (2026-05-20)

### What's New in v0.6.2
- **Task filter "Todo" matches Logseq UI semantics.** Task-tagged blocks with no explicit `:logseq.property/status` are now included when "Todo" is selected (Logseq treats these as implicit Todo via the property's `:default-value`).

## v0.6.1 (2026-05-20)

### What's New in v0.6.1
- **Wrapped query uses human-readable Logseq input keywords.** Relative-date clauses in the wrapped query now use `?today`, `?-7d`, `?+14d`, `?start-of-today-ms`, `?-7d-start`, etc., with the matching keywords declared in `:inputs [:today :-7d ...]`. Easy to tweak by hand — change `?-7d` to `?-30d` to widen the window. Raw query (sent via API) still uses literals.

## v0.6.0 (2026-05-20)

### What's New in v0.6.0
- **Between filter Absolute/Relative mode toggle**: Pick presets like "Last 7 days" or "Custom range" instead of two calendar dates. Works for `created-at`, `updated-at`, and `journal-day`.
- **Property filter relative dates for date-typed properties**: `deadline`, `scheduled`, `projectdeadline`, and any user-defined `:date`/`:datetime` property now render the Absolute/Relative mode toggle alongside the date picker.
- **Schema-by-ident discovery**: New `getPropertySchemaByIdent` API call queries `:logseq.property/type` directly — works for user properties with UUID suffixes (`:user.property/foo-abc123`) and properties with zero values set in the graph. Sample-value inference remains the fallback.
- **Fixed pre-existing bug**: between filter absolute mode + `journal-day` was emitting millisecond comparisons against YYYYMMDD integers, silently returning zero results. Now uses local-time-correct `dateStringToYYYYMMDD` conversion.

## v0.4.5 (2026-02-13)

### What's New in v0.4.5
- Fix journal-date dropdowns stacking vertically instead of side-by-side
- Removed `width: 100%` from `.date-mode-content` so flex items sit on one row

### What's New in v0.1.7
- 🐛 **CRITICAL FIX**: Property filters with checkbox selection now included in queries
- ✅ Fixed `isValidFilter()` to handle array values (not just strings)
- ✅ Arrays don't have `.trim()` method - now checks `Array.isArray()` first
- ✅ Tag-based property suggestions workflow now fully functional
- ✅ **Phase 5 Complete!** Tag autocomplete → property suggestions → query generation all working

### Recent Releases

#### v0.1.6 (2025-12-28)
- 🐛 **FIX**: Property suggestions now show readable property names
- ✅ Fixed `getTagProperties()` to use nested pull pattern
- ✅ Changed from entity references `{db/id: 169}` to full property objects
- ✅ Query now pulls `:db/ident` and `:block/title` for each property

#### v0.1.5 (2025-12-28)
- 🐛 **FIX**: Property suggestions display correctly (no more `[object Object]`)
- ✅ Fixed property name extraction to handle multiple formats
- ✅ Handles string identifiers, objects with db/ident, and objects with block/title
- ✅ Filters out unknown formats to prevent display errors

#### v0.1.4 (2025-12-28)
- 🐛 **FIX**: Tag autocomplete now appears when typing
- ✅ Fixed `getTags()` result parsing - removed nested array assumption
- ✅ Changed from `item[0]['block/title']` to `item['block/title']`
- ✅ Checks both key formats (with/without `:` prefix)

#### v0.1.3 (2025-12-28)
- 🔧 **DIAGNOSTIC**: Added comprehensive logging to trace autocomplete flow
- ✅ Console logging at every step: FOCUS, ATTACH, INPUT, FETCH, SHOW
- ✅ Identified silent failure in `getTags()` returning empty results

#### v0.1.2 (2025-12-28)
- 🐛 **FIX**: Property suggestions now appear after selecting tag
- ✅ Fixed getTagProperties() data structure access (data[0] not data[0][0])
- ✅ Fixed key access to check both formats (with/without ':' prefix)

#### v0.1.1 (2025-12-28)
- 🐛 **CRITICAL FIX**: Tag autocomplete now works correctly
- ✅ Fixed case-sensitive matching issue in getTags() query
- ✅ Changed from Datalog filtering to JavaScript filtering
- ✅ Now uses case-insensitive matching: toLowerCase().includes()
- ✅ Matches the working pattern from getProperties()

#### v0.1.0 (2025-12-28)
- 🚀 **NEW FEATURE**: Tag-based property suggestions
- ✅ Property hints appear when tags are selected
- ✅ Shows associated properties using Logseq's class/property relationships
- ✅ Updates immediately on autocomplete selection
- ✅ Clean property name display (strips UUID suffixes)
- ✅ Completes Phase 5 of Property Type Awareness milestone

#### v0.0.28 (2025-12-28)
- 🐛 **FIX**: Property dropdowns no longer duplicate when changing properties
- ✅ Fixed async race conditions in all render methods
- ✅ Dropdowns now cleanly replace when property selection changes
- ✅ All input types (text, number, date, boolean, ref) handle rapid changes correctly

#### v0.0.27 (2025-12-28)
- 🐛 **FIX**: Property values now populate dropdown correctly
- ✅ Fixed result key access (keys don't have `:` prefix)
- ✅ Removed nested array assumption in `getPropertyValues`

#### v0.0.26 (2025-12-28)
- 🐛 **FIX**: Property type now correctly detected as reference
- ✅ Type inference checks both `'db/id'` and `':db/id'` formats
- ✅ Dropdowns now render for reference properties

#### v0.0.25 (2025-12-28)
- 🐛 **FIX**: Query result data structure access corrected
- ✅ Changed from `data[0][0][key]` to `data[0][key]` for pull queries
- ✅ Sample value extraction now works correctly

#### v0.0.24 (2025-12-28)
- 🐛 **FIX**: Property identifiers now have required `:` prefix in queries
- ✅ Queries no longer fail with "Cannot compare :block/refs" error
- ✅ All query generation adds `:` prefix when needed

#### v0.0.23 (2025-12-28)
- 🔧 **DIAGNOSTIC**: Added comprehensive logging to debug property dropdown
- ✅ Console logging at every step of property-name input handler
- ✅ Created detailed debugging plan (PROPERTY_DROPDOWN_DEBUG_PLAN.md)

#### v0.0.22 (2025-12-27)

#### v0.0.21 (2025-12-27)
- 🐛 **CRITICAL FIX**: Property autocomplete dropdown no longer re-appears after selection
- ✅ Fixed duplicate autocomplete attachment
- ✅ Added debug logging to track property type detection

#### v0.0.20 (2025-12-27)
- 🐛 **CRITICAL FIX**: Property type detection now works for user properties
- ✅ Changed from schema lookup to type inference from sample values
- ✅ Infers type from actual property usage instead of schema entities

#### v0.0.19 (2025-12-27)
- 🐛 **CRITICAL FIX**: Property identifiers now include UUID suffixes
- ✅ Autocomplete passes full property identifier (e.g., `:user.property/ProjectStatus-IUJoj7Hs`)

#### v0.0.18 (2025-12-27)
- 🐛 **FIX**: Removed duplicate property value inputs
- ✅ Property filters no longer render generic value input

#### v0.0.17 (2025-12-27)
- 🚀 **Property Type Awareness - Phase 3 & 4 Complete!**
- ✅ **Type-specific value inputs** - Property values now show appropriate UI
- ✅ **Automatic correct query generation** - No more manual property identifiers
- ✅ **Full UUID handling** and **Entity lookup pattern**

#### v0.0.16 (2025-12-27)
- 🐛 **CRITICAL FIX**: Property autocomplete now actually works!
- ✅ Fixed query result parsing bug in `getProperties()`
- ✅ Property autocomplete now shows all 168 properties from your graph
- ✅ Phase 2 is now fully functional

#### v0.0.15 (2025-12-27) - BROKEN, use v0.0.16 instead
- ❌ Property autocomplete was broken due to parsing bug
- Added autocomplete UI but `getProperties()` returned empty array

#### v0.0.14 (2025-12-27)
- 🚀 **Property Type Awareness - Phase 1 Complete!**
- ✅ New API methods for property metadata: `getPropertySchema()`, `getPropertyValues()`, `getTagProperties()`
- ✅ Updated `getProperties()` to return metadata objects with type information
- ✅ Foundation for type-aware UI (autocomplete, type-specific inputs coming in future phases)

#### v0.0.13 (2025-12-27)
- 🐛 **CRITICAL FIX**: Clear stale results when filters change
- ✅ Prevents confusion from seeing old search results that don't match current filter settings
- ✅ Shows message "Filters changed - click Search to update results" when filters are modified
- ✅ User must click Search button to see updated results after changing filters

#### v0.0.12 (2025-12-27)
- ✅ UI Layout: Stacked both checkboxes vertically in the same column
- ✅ Better visual separation between status selection and extensions toggle

#### v0.0.11 (2025-12-27)
- ✅ **Second checkbox for task filter**: "Include all status properties" alongside existing "Include extensions"
- ✅ Independent control over tag inheritance and class property matching
- ✅ Three-branch or-join query logic for flexible task filtering

#### v0.0.10 (2025-12-26)
- 🐛 **CRITICAL FIX**: Task filter was using lowercase "task" instead of capitalized "Task" tag name
- ✅ Task filter now correctly checks for "Task" tag (matching Logseq DB tag naming)

#### v0.0.9 (2025-12-26)
- ✅ **Tag inheritance support**: New "Include extensions" checkbox for task and tags filters
- ✅ Uses `or-join` with `:logseq.property.class/extends` to query tag hierarchy

#### v0.0.8 (2025-12-26)
- ✅ **UUID resolution**: Block references in results now show readable titles
- ✅ Multi-select support for priority filter
- ✅ Checkbox-based UI for task status and priority filters

#### v0.0.7 (2025-12-26)
- 🐛 **CRITICAL FIX**: Task status query was completely broken (used `:block/tags` instead of `:logseq.property/status`)
- ✅ Task status now correctly queries the status property with entity lookup
- ✅ **Multi-select support** - Select multiple statuses at once

---

## ✅ v0.1.0 - Property Type Awareness **COMPLETE**

**Status**: ✅ **ALL PHASES COMPLETE** (v0.1.0)

**Phase 1 Completed**: 2025-12-27 (v0.0.14) - API methods for property metadata
**Phase 2 Completed**: 2025-12-27 (v0.0.16) - Property name autocomplete
**Phase 3 Completed**: 2025-12-27 (v0.0.17) - Type-specific input UI
**Phase 4 Completed**: 2025-12-28 (v0.0.23-0.0.28) - Query generation & bug fixes
**Phase 5 Completed**: 2025-12-28 (v0.1.0) - Tag-based property suggestions

### Features Delivered

Property filtering transformed from manual text input to intelligent, type-aware UI:

#### Core Features
- ✅ **Property name autocomplete** - Dropdown with validation against existing properties (v0.0.16)
- ✅ **Property type detection** - Automatic detection of boolean, text, reference, date, number types (v0.0.14)
- ✅ **Type-specific input UI** (v0.0.17):
  - Checkbox properties → Radio buttons (checked/unchecked)
  - Reference properties (single) → Dropdown with actual values
  - Reference properties (multi) → Checkbox group
  - Date properties → Date picker + operator dropdown (=, <, >, <=, >=)
  - Number properties → Number input + operator dropdown
  - Text properties → Text input (fallback)
- ✅ **Tag-based property suggestions** - Show hint with associated properties when tag is selected (v0.1.0)

#### Implementation Progress
**5 phases** completed with comprehensive testing:
1. ✅ **API Layer** - Add methods to fetch property metadata, values, and tag associations (v0.0.14)
2. ✅ **Property Autocomplete** - Enable autocomplete for property names (v0.0.16)
3. ✅ **Type-Specific Inputs** - Render appropriate UI controls based on property type (v0.0.17)
4. ✅ **Query Generation & Bug Fixes** - Generate correct Datalog queries for each property type (v0.0.17-0.0.28)
   - Fixed property identifier prefix handling (v0.0.24)
   - Fixed query result data structure parsing (v0.0.25)
   - Fixed type inference for reference properties (v0.0.26)
   - Fixed property values dropdown population (v0.0.27)
   - Fixed duplicate dropdowns on property change (v0.0.28)
5. ✅ **Tag Suggestions** - Show property hints when tags are selected (v0.1.0)

#### Documentation
- **Quickstart Guide**: `QUICKSTART_PROPERTY_TYPES.md` - Concise implementation guide
- **Full Implementation Plan**: `/Users/niyaro/.claude/plans/cryptic-watching-mccarthy.md` - Detailed technical specifications

#### Estimated Effort
- **Time**: 10-15 hours (2-3 hours per phase)
- **Code**: ~400-500 lines across 4 files
- **Files Modified**: js/api.js, js/filters.js, js/queryGenerator.js, js/autocomplete.js

#### User Decisions (Approved)
- ✅ Show operator dropdown for numeric/date properties (=, <, >, <=, >=)
- ✅ Only allow existing properties (validation required, no freeform input)
- ✅ Show property suggestions when tag is selected

#### Ready to Start
All planning, investigation, and user decisions are complete. Implementation can begin immediately following the quickstart guide.

---

## Previous Releases

### v0.0.6 (2025-12-26)
- ✅ Fixed priority filter to use correct DB values: Urgent, High, Medium, Low (not A/B/C)
- ✅ Added task status dropdown with Logseq DB statuses

### v0.0.5 (2025-12-26)
- ✅ Fixed case-insensitive full-text search using regex patterns with `(?i)` flag
- ✅ Added `escapeRegex()` helper method

### v0.0.4 (2024-12-26) [BROKEN - DO NOT USE]
- ❌ Used `clojure.string/lower-case` which doesn't work in Logseq CLI
- ❌ Function throws "Unknown function" error
- ⚠️ Use v0.0.6 instead

### v0.0.3 (2024-12-26) [BROKEN - DO NOT USE]
- ❌ Tried to call `clojure.string/lower-case` on string literal - doesn't work in Datalog
- ❌ Search returned no results
- ⚠️ Use v0.0.4 instead

### v0.0.2 (2024-12-26) [BROKEN - DO NOT USE]
- ❌ Full-text search case-insensitivity was broken (only matched lowercase)
- ✅ Added operator dropdown (contains/equals)
- ⚠️ Use v0.0.4 instead

### v0.0.1 (2024-12-26)

### ✅ What's Working

#### Core Features
- ✅ 8 filter types implemented
- ✅ Real-time Datalog query generation
- ✅ Live results from graph
- ✅ Query copy to clipboard
- ✅ Dark/light themes
- ✅ Graph selection & connection status
- ✅ Tag autocomplete (basic)
- ✅ Page name autocomplete (basic)
- ✅ Result limiting (25/50/100/500)

#### Filter Types
- ✅ Page name (contains, starts-with, ends-with, is)
- ✅ Tags (with autocomplete)
- ✅ Full-text search (block titles)
- ✅ Properties (manual name entry)
- ✅ Page references (with autocomplete)
- ✅ Tasks (tag-based)
- ✅ Priority (A, B, C)
- ✅ Date ranges (between dates)

#### Technical
- ✅ Vanilla JavaScript (no dependencies)
- ✅ Clean, modular code structure
- ✅ Logseq-inspired UI
- ✅ HTTP server integration
- ✅ localStorage for preferences
- ✅ Git repository initialized

### 📝 Known Limitations

- ⚠️ AND logic only (no OR/NOT yet)
- ⚠️ No nested filter groups
- ⚠️ Property names must be typed manually
- ⚠️ Tags show as entity refs in results (not resolved)
- ⚠️ No tag inheritance support
- ~~⚠️ Full-text only has "contains" operator~~ ✅ Fixed in v0.0.2
- ⚠️ No query validation/testing

---

## 🎯 Next Up: v0.2.0 - Boolean Logic (HIGH Priority)
- Nested filter groups
- AND/OR/NOT operators per group
- Visual grouping interface
- Complex query generation

**Timeline**: 3-5 days after v0.1.0

### v0.3.0 - Advanced Features (MEDIUM Priority)
- Tag inheritance queries
- Query presets & templates
- Enhanced results display
- Result sorting & export

**Timeline**: 3-5 days after v0.2.0

### v0.4.0 - Reverse Parsing (MEDIUM Priority)
- Paste query → populate UI
- Query validation & testing
- Query history
- Syntax highlighting

**Timeline**: 4-6 days after v0.3.0

### v0.5.0 - Performance & Polish (LOW Priority)
- Result caching
- Virtualized lists
- Keyboard shortcuts
- Drag-and-drop
- Documentation & tutorials

**Timeline**: 5-7 days after v0.4.0

---

## 📊 Development Metrics

### Code Statistics
- **Total Files**: 9
- **Total Lines**: ~2,400
- **JavaScript**: ~1,800 lines
- **CSS**: ~500 lines
- **HTML**: ~100 lines

### File Structure
```
logseq-db-query-builder/
├── index.html              # Main page (100 lines)
├── README.md               # Documentation (500 lines)
├── TODO.md                 # Feature list (400 lines)
├── CHANGELOG.md            # Version history (100 lines)
├── DEVELOPMENT.md          # Roadmap (500 lines)
├── styles/
│   └── main.css           # Styling (500 lines)
└── js/
    ├── api.js             # HTTP API (200 lines)
    ├── app.js             # Main logic (400 lines)
    ├── queryGenerator.js  # Datalog generation (300 lines)
    ├── filters.js         # Filter UI (300 lines)
    └── autocomplete.js    # Autocomplete (150 lines)
```

### Git History
- **Commits**: 2
- **Current Branch**: main
- **Latest Tag**: v0.0.1

---

## 🎓 Lessons Learned

### What Worked Well
- ✅ Modular JavaScript architecture (easy to extend)
- ✅ Clear separation of concerns (API, UI, logic)
- ✅ Real-time query preview (great UX)
- ✅ Starting simple and iterating
- ✅ Testing against real graph data

### Challenges Overcome
- 🔧 Understanding Datalog query syntax
- 🔧 Property namespace detection (user.property vs logseq.property)
- 🔧 Result format from HTTP server (not nested arrays as expected)
- 🔧 Query wrapping format (`{:query ...}` for Logseq, raw for API)
- 🔧 Entity reference resolution in results

### Areas for Improvement
- 📈 Need automated tests (currently manual testing only)
- 📈 Query validation before execution
- 📈 Better error messages for users
- 📈 Performance optimization for large result sets
- 📈 More comprehensive documentation

---

## 🤝 Contributing

### How to Get Involved
1. **Try it out**: Use with your Logseq graph
2. **Report issues**: Found a bug? Let us know!
3. **Suggest features**: What would make this more useful?
4. **Contribute code**: See DEVELOPMENT.md for roadmap

### Development Setup
```bash
# Clone repository
cd /Users/niyaro/Documents/Code/Logseq/logseq-db-query-builder

# Start HTTP server (in separate terminal)
cd /Users/niyaro/Documents/Code/Logseq/logseq-http-server
python3 logseq_server.py

# Open query builder
open index.html

# Start developing!
```

### Coding Standards
- Vanilla JavaScript (ES6+)
- Clear function names and comments
- Modular, reusable code
- Test with real graph data
- Update documentation

---

## 📞 Support & Resources

### Documentation
- `README.md` - User guide & examples
- `TODO.md` - Feature roadmap
- `DEVELOPMENT.md` - Developer guide
- `CHANGELOG.md` - Version history

### Related Projects
- [logseq-http-server](../logseq-http-server) - API server for Logseq CLI
- [logseq-checklist](https://github.com/kerim/logseq-checklist) - Production DB plugin
- Logseq DB Plugin API Skill - Development knowledge

### Getting Help
- Check browser console (F12) for errors
- Verify HTTP server is running (green status dot)
- Test queries manually with `logseq query`
- Review generated Datalog syntax

---

## 🎊 Acknowledgments

### Built With
- Vanilla JavaScript (no frameworks!)
- Logseq HTTP Server API
- Logseq DB graph data
- macOS-inspired design patterns

### Inspiration
- Logseq's built-in query interface
- macOS Finder advanced search
- Database query builders (SQL, MongoDB)

---

**Last Updated**: 2026-06-01
**Version**: 0.7.5
**Status**: Active Development
**Maintainer**: P. Kerim Friedman
