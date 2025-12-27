# Changelog

All notable changes to the Logseq DB Query Builder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.17] - 2025-12-27

### Added
- **Property Type Awareness - Phase 3 & 4 Complete!**
- **Type-specific value inputs:**
  - Reference properties → Dropdown (single) or checkboxes (multi) with actual values
  - Boolean properties → Radio buttons (checked/unchecked)
  - Date properties → Date picker + operator dropdown (=, <, >, <=, >=)
  - Number properties → Number input + operator dropdown
  - Text properties → Plain text input (fallback)
- **Automatic query generation for all property types:**
  - Reference properties use entity lookup pattern: `[?b :property ?val] [?val :block/title "value"]`
  - Uses full property identifier with UUID automatically
  - Boolean queries use true/false values
  - Number/date queries include comparison operators
- Property value autocomplete populated from actual graph data

### Changed
- Property name selection now triggers automatic schema fetch and value input re-rendering
- Query builder now uses `filter.propertySchema.ident` (with UUID) for accurate property matching
- Eliminated manual property identifier construction errors

### Technical
- Added 6 new rendering methods to FilterManager: renderPropertyValueInput(), renderReferenceInput(), renderCheckboxInput(), renderDateInput(), renderNumberInput(), renderTextInput()
- Added 4 new query builders to QueryGenerator: buildBooleanPropertyClause(), buildRefPropertyClause(), buildNumberPropertyClause(), buildDatePropertyClause()
- Property schema stored in filter.propertySchema for type-aware rendering and querying

## [0.0.16] - 2025-12-27

### Fixed
- **CRITICAL BUG**: Property autocomplete was completely broken in v0.0.15
- Fixed `getProperties()` parsing - query returns strings, not arrays
- Changed `item[0]` to `item` when processing query results
- Property autocomplete now works correctly with all 168 properties

### Technical
- The Logseq query `[:find ?prop ...]` returns flat strings like `["logseq.property/priority"]`
- Previous code incorrectly expected nested arrays like `[["logseq.property/priority"]]`
- Bug caused `item[0]` to extract first character "l" instead of full property name

## [0.0.15] - 2025-12-27

### Added
- **Property Type Awareness - Phase 2: Property Name Autocomplete**
- Property name input now shows autocomplete dropdown with suggestions
- Type to search and select from existing properties in your graph
- Automatic property schema fetching when property is selected (prepares for Phase 3)

### Changed
- Property name input placeholder updated to "Select property..." for better UX
- Property name input handler is now async to support schema fetching
- Added 'property' case to autocomplete.js fetchSuggestions() method

### Technical
- Property name input has `data-autocomplete="property"` attribute
- Property schema stored in `filter.propertySchema` for future type-specific UI (Phase 3)
- Autocomplete uses existing infrastructure from tags/page-reference autocomplete

## [0.0.14] - 2025-12-27

### Added
- **Property Type Awareness - Phase 1: API Layer**
- New API methods for property metadata and type information:
  - `getPropertySchema(graphName, propertyName)` - Fetch property type, cardinality, and other metadata
  - `getPropertyValues(graphName, propertyIdent)` - Get all possible values for reference properties
  - `getTagProperties(graphName, tagName)` - Get properties associated with a tag

### Changed
- Updated `getProperties()` to return metadata objects `{title, ident, namespace}` instead of plain strings
- Prepares foundation for type-aware UI in future phases (autocomplete, type-specific inputs)

### Technical
- Property schema queries check both `:user.property/` and `:logseq.property/` namespaces
- All new API methods include error handling with console logging
- Case-insensitive search filtering in updated `getProperties()` method

## [0.0.13] - 2025-12-27

### Fixed
- **Clear stale results when filters change**: Results now clear when checkboxes or filters are modified
- Prevents confusion from seeing old search results that don't match current filter settings
- Shows message "Filters changed - click Search to update results" when filters are modified

### Changed
- `onFiltersChange()` now clears existing results to avoid displaying stale data
- User must click Search button to see updated results after changing filters

## [0.0.12] - 2025-12-27

### Changed
- **UI Layout**: Stacked both checkboxes vertically in the same column
- Extensions column now uses `flex-direction: column` for vertical stacking
- Removed unnecessary `<br>` element, using flexbox gap for spacing instead
- Both "Include extensions" and "Include all status properties" now appear stacked in right column

## [0.0.11] - 2025-12-27

### Added
- **Second checkbox for task filter**: "Include all status properties" alongside existing "Include extensions"
- Independent control over tag inheritance and class property matching
- Three-branch or-join query logic: direct Task tag + optional extends branch + optional status property branch
- Four distinct query configurations possible:
  - Neither checked: Only direct Task tag (2 results in test graph)
  - Only "Include extensions": Task + tags extending Task (6 results)
  - Only "Include all status properties": Task + tags with status property (6 results)
  - Both checked: All three branches (7 results, matching Logseq's behavior)

### Changed
- Updated `buildTaskClause()` to handle both checkboxes independently with conditional or-join branches
- Increased margin between status checkboxes and extensions column (from 16px to 32px)
- Extensions column now uses `var(--spacing-xl)` for better visual separation

### Technical
- Added `filter.includeAllStatusProperties` boolean property to filter objects
- Query dynamically builds or-join with 1-3 branches based on checkbox states
- Third branch checks for `:logseq.property.class/properties :logseq.property/status`

## [0.0.10] - 2025-12-26

### Fixed
- **CRITICAL FIX**: Task filter was using lowercase "task" instead of capitalized "Task" tag name
- Task filter now correctly checks for "Task" tag (matching Logseq DB tag naming)
- Without extensions: finds blocks with direct "Task" tag (2 results in test graph)
- With extensions: finds blocks with "Task" OR tags extending "Task" (6 results in test graph)
- Fixed example text to show correct direction: "Task → shopping" (shopping extends Task)

### Changed
- Task filter ALWAYS checks for Task tag (not just when extensions enabled)
- Extensions checkbox controls whether to include child tags, not whether to check tags at all
- Moved extensions checkbox from bottom to right column (separate from status checkboxes)
- Updated UI layout to match intended design with checkbox in right column
- Removed separator line (no longer needed with column layout)

### UI Improvements
- Extensions checkbox now appears in separate column with left border
- Cleaner visual separation between status selection and extensions toggle
- Better use of horizontal space

## [0.0.9] - 2025-12-26

### Added
- **Tag inheritance support**: New "Include extensions" checkbox for task and tags filters
- When enabled, searches include both direct tags and tags that extend the target tag
- Example: Searching for "task" with extensions enabled will also find blocks tagged with "shopping" if shopping extends task
- Uses `or-join` with `:logseq.property.class/extends` to query tag hierarchy
- Visual separator between status checkboxes and extensions checkbox
- Styled extensions checkbox with italic text and secondary color

### Changed
- Modified `buildTaskClause()` to add tag inheritance check when `includeExtensions` is true
- Modified `buildTagsClause()` to wrap tag matching in `or-join` when `includeExtensions` is true
- Task filter now explicitly checks for "task" tag (or its extensions) when extensions enabled

### Technical
- Added `filter.includeExtensions` boolean property to filter objects
- Added `.checkbox-separator` and `.extensions-checkbox` CSS classes
- Query pattern uses `(or-join [?b] (and [?b :block/tags ?t] ...) (and [?b :block/tags ?child] [?child :logseq.property.class/extends ?parent] ...))` for inheritance

## [0.0.8] - 2025-12-26

### Added
- **UUID resolution**: Block references in results (e.g., `[[uuid]]`) are now automatically resolved to show readable titles (e.g., `[[Title]]`)
- Multi-select support for priority filter (can now select multiple priorities like "Urgent OR High")
- Checkbox-based UI for task status and priority filters (replaced highlighting-based dropdown)
- CSS styles for checkbox groups with hover effects and proper spacing

### Changed
- Priority filter now supports multi-select with OR query generation (matching task status behavior)
- Task status and priority filters now use checkbox groups instead of multi-select dropdowns
- Results display now resolves all UUID references before rendering
- Improved user experience with visual checkbox selection

### Technical
- Added `resolveUUIDs()` method to `LogseqAPI` class for UUID-to-title resolution
- Updated `executeSearch()` to call UUID resolution before displaying results
- Modified `buildPriorityClause()` to handle array values and generate OR queries
- Added `.checkbox-group` and `.checkbox-label` CSS classes with theme-aware styling

## [0.0.7] - 2025-12-26

### Fixed
- **CRITICAL FIX**: Task status query was completely broken (used :block/tags instead of :logseq.property/status)
- Task status now correctly uses `:logseq.property/status` property with entity reference lookup
- Query pattern: `[?b :logseq.property/status ?status] [?status :block/title "Doing"]`
- Selecting "Doing" now returns correct results (was returning zero)

### Added
- **Multi-select support** for task status filter
- Can now select multiple statuses (e.g., Doing OR Todo) without adding separate filters
- Multi-select dropdown shows all 6 statuses at once for easy selection
- OR query generation for multiple selected statuses

### Changed
- Task status dropdown now uses `multiple` attribute with `size="6"`
- Task filter value is now an array (supports multiple selections)
- Query generator handles both single and multiple status values
- Updated validation logic to handle array values

## [0.0.6] - 2025-12-26

### Fixed
- **CRITICAL FIX**: Priority filter used wrong values (A/B/C are markdown, not DB)
- Priority filter now uses correct Logseq DB values: Urgent, High, Medium, Low
- Priority query now correctly uses `:logseq.property/priority` with entity reference lookup
- Query pattern: `[?b :logseq.property/priority ?priority] [?priority :block/title "Urgent"]`

### Added
- Task filter now uses dropdown menu with Logseq DB task statuses
- Pre-populated task status options: Backlog, Todo, Doing, In Review, Done, Canceled
- Matches Logseq DB graph task status system shown in Set Status menu

### Changed
- Task filter changed from text input to dropdown select
- Priority filter values updated to match DB graph system
- Updated FILTER_TYPES configuration for both task and priority filters
- Added 'task-status-select' input type rendering

## [0.0.5] - 2025-12-26

### Fixed
- **CRITICAL BUG FIX**: Full-text search case-insensitivity completely broken in v0.0.4
- `clojure.string/lower-case` is not available in Logseq CLI's DataScript implementation
- Now uses case-insensitive regex patterns: `[(re-pattern "(?i)search") ?pattern] [(re-find ?pattern ?title)]`
- "contains" operator: Uses `re-find` with `(?i)` flag for substring matching
- "equals" operator: Uses `re-matches` with `(?i)^...$` anchors for exact matching
- Added regex character escaping to treat search terms as literal text (not regex patterns)
- Search now properly matches "Friedman" when searching for "fri", "FRI", "Fri", etc.

### Changed
- Removed non-functional `clojure.string/lower-case` calls from query generation
- Added `escapeRegex()` helper method to escape regex special characters

## [0.0.4] - 2024-12-26

### Fixed
- **CRITICAL BUG FIX**: Full-text search completely broken in v0.0.3
- Fixed incorrect attempt to call `clojure.string/lower-case` on string literal in query
- Now correctly lowercases search term in JavaScript, then compares lowercased title against lowercase literal
- Query pattern now matches working v0.0.1 approach: lowercase title variable, compare to lowercase string literal
- Searches like "lin" with contains operator now work correctly

### Changed
- Reverted to proper pattern: lowercase in JS for literal string, lowercase title in Datalog
- Updated `buildFullTextClause()` to use `escapedValue.toLowerCase()` in JavaScript

## [0.0.3] - 2024-12-26 [BROKEN - DO NOT USE]

### Fixed
- **CRITICAL BUG FIX**: Full-text search case-insensitivity was broken
- Previously converted search term to lowercase in JavaScript, causing queries to only match lowercase text
- Now correctly converts both title and search term to lowercase within Datalog query
- Uses two `clojure.string/lower-case` calls to compare lowercased versions
- Search now properly matches "Lim", "LIM", "lim" regardless of how user types search term

### Changed
- Updated `buildFullTextClause()` to use variable bindings for lowercased comparisons
- Search term stays as-typed, lowercase conversion happens in query execution

## [0.0.2] - 2024-12-26 [BROKEN - DO NOT USE]

### Added
- Full-text search operator dropdown with "contains" and "equals" options
- Case-insensitive exact match capability for text search
- Helps distinguish between exact matches (e.g., "Lim" surname) and partial matches (e.g., "limit")

### Changed
- Updated `buildFullTextClause()` in queryGenerator.js to support multiple operators
- Modified FILTER_TYPES config in filters.js to include operators for full-text search
- Both operators now use `clojure.string/lower-case` for case-insensitive matching

### Fixed
- Full-text search no longer limited to only "contains" functionality

## [0.0.1] - 2024-12-26

### Added
- Initial release of Logseq DB Query Builder
- Visual filter interface with 8 filter types:
  - Page name matching (contains, starts-with, ends-with, is)
  - Tag filtering with autocomplete
  - Full-text search across block titles
  - Property filtering (manual property name entry)
  - Page reference filtering with autocomplete
  - Task filtering (tag-based)
  - Priority filtering (A, B, C)
  - Date range filtering (between dates)
- Real-time Datalog query generation
- Live results preview from Logseq graph
- Query copy to clipboard with visual feedback
- Dark/light theme toggle
- Graph selection with connection status indicator
- Auto-complete functionality for tags and page names
- Result limiting (25, 50, 100, 500)
- Logseq-inspired UI design
- Comprehensive documentation in README.md
- Help section with usage instructions

### Technical Details
- Vanilla JavaScript (no framework dependencies)
- Communicates with logseq-http-server (localhost:8765)
- Uses `[*]` syntax to pull all block attributes
- Generates queries in `{:query ...}` format for Logseq compatibility
- API receives raw Datalog format
- localStorage for graph preference and theme

### Known Limitations
- AND logic only (OR logic not yet supported)
- No nested filter groups
- Property names must be typed manually (no autocomplete)
- Tag entity references not resolved in results display
- No tag inheritance queries
- No NOT operator support
- Limited text search operators (only "contains")

## [Unreleased]

### v0.1.0 - Property Type Awareness (PLANNED - Implementation Ready)
Planning completed 2025-12-27. See `QUICKSTART_PROPERTY_TYPES.md` for implementation guide.

**Planned Features:**
- **Property name autocomplete** - Dropdown with validation against existing properties
- **Property type detection** - Automatic detection of boolean, text, reference, date, number types
- **Type-specific input UI** - Smart input controls based on property type:
  - Checkbox properties: Radio buttons (checked/unchecked)
  - Reference properties (single): Dropdown with actual values
  - Reference properties (multi): Checkbox group
  - Date properties: Date picker with operator dropdown (=, <, >, <=, >=)
  - Number properties: Number input with operator dropdown
  - Text properties: Text input (fallback)
- **Tag-based property suggestions** - Show hint with associated properties when tag is selected

**Implementation Plan:** 5 phases (API layer → autocomplete → type inputs → query generation → tag suggestions)
**Full Details:** `/Users/niyaro/.claude/plans/cryptic-watching-mccarthy.md`

### Planned for v0.2.0
- ~~Text search operators (equals, starts-with, ends-with, regex)~~ Partially done: contains/equals in v0.0.2
- More text search operators (starts-with, ends-with, regex)
- Boolean logic support (AND/OR/NOT)
- Nested filter groups
- Enhanced tag autocomplete with hierarchy

### Future Versions
- Reverse query parsing (paste query → populate UI)
- Query presets and templates
- Tag inheritance queries
- Result sorting and export
- Advanced aggregation queries
- Query validation and testing tools
