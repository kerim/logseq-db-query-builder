# TODO - Logseq DB Query Builder

## Phase 2: Enhanced Query Logic & Operators

### High Priority

#### 1. Text Search Operators
- [ ] Add operator dropdown for full-text search
  - [ ] `contains` - partial match (current behavior)
  - [ ] `equals` - exact match
  - [ ] `starts-with` - prefix match
  - [ ] `ends-with` - suffix match
  - [ ] `regex` - regular expression match
- [ ] Update query generator to handle each operator
- [ ] Test all operators against real graph data

#### 2. Boolean Logic & Nesting (AND/OR/NOT)
- [ ] Design UI for nested filter groups
  - [ ] Visual grouping with indentation/boxes
  - [ ] Add "Add Group" button
  - [ ] Group-level logic selector (AND/OR)
- [ ] Implement NOT operator
  - [ ] Add "NOT" checkbox/toggle per filter
  - [ ] Generate `(not ...)` clauses in Datalog
- [ ] Update query generator for complex logic
  - [ ] Support nested `(and ...)` and `(or-join ...)` 
  - [ ] Handle mixed AND/OR within groups
- [ ] Example UI structure:
  ```
  ALL of the following:
    ├─ [filter 1]
    ├─ ANY of the following:
    │   ├─ [filter 2]
    │   └─ [filter 3]
    └─ NOT [filter 4]
  ```

#### 3. Property Type Awareness
- [ ] Detect property types from schema
  - [ ] String properties
  - [ ] Number properties
  - [ ] Date/datetime properties
  - [ ] Checkbox (boolean) properties
  - [ ] Entity reference properties
- [ ] Type-specific operators
  - [ ] String: contains, equals, starts-with, ends-with, regex
  - [ ] Number: =, !=, >, <, >=, <=, between
  - [ ] Date: =, before, after, between, relative (last 7 days, etc.)
  - [ ] Checkbox: is true, is false
  - [ ] Reference: links to [page]
- [ ] Update UI to show relevant operators based on type
- [ ] Smart input fields (date picker for dates, number input for numbers, etc.)

#### 4. Enhanced Autocomplete
- [ ] Property name autocomplete
  - [ ] Fetch all property names from graph schema
  - [ ] Show property type in suggestions
  - [ ] Filter by search term
- [ ] Property value autocomplete
  - [ ] For entity reference properties, show page suggestions
  - [ ] For enum-like properties, show existing values
- [ ] Tag autocomplete improvements
  - [ ] Show tag hierarchy (parent/child relationships)
  - [ ] Visual indicator for tags with children
  - [ ] Option to include inherited tags in query

### Medium Priority

#### 5. Tag Inheritance Queries
- [ ] Add "Include subtags" checkbox for tag filters
- [ ] Generate queries using `:logseq.property.class/extends`
- [ ] Example query pattern:
  ```clojure
  (or-join [?b]
    (and [?b :block/tags ?t]
         [?t :block/title "task"])
    (and [?b :block/tags ?child]
         [?child :logseq.property.class/extends ?parent]
         [?parent :block/title "task"]))
  ```

#### 6. Additional Filter Types
- [ ] Block content (separate from title)
  - [ ] Search `:block/content` in addition to `:block/title`
- [ ] Namespace hierarchies
  - [ ] "Include subpages" option
  - [ ] Query pattern for namespace children
- [ ] Journal date ranges
  - [ ] Last N days
  - [ ] This week/month/year
  - [ ] Custom date ranges
- [ ] Block position filters
  - [ ] Top-level blocks only
  - [ ] Nested blocks only
  - [ ] Specific depth level

#### 7. Query Presets & Templates
- [ ] Save query as preset
  - [ ] Store in localStorage
  - [ ] Name and description
  - [ ] Tags for organization
- [ ] Load saved preset
  - [ ] Dropdown list of saved queries
  - [ ] One-click load
- [ ] Export/Import presets
  - [ ] JSON format
  - [ ] Share with others
- [ ] Built-in templates
  - [ ] Common query patterns
  - [ ] "Recent notes" (last 7 days)
  - [ ] "TODO items" (task tag)
  - [ ] "Tagged articles" (specific tag)

#### 8. Results Enhancements
- [ ] Better result display
  - [ ] Resolve tag entity references to show tag names
  - [ ] Show property values inline
  - [ ] Expandable result items (show all properties)
  - [ ] Click to copy block UUID
  - [ ] Link to open in Logseq (if possible)
- [ ] Result sorting
  - [ ] By created date
  - [ ] By updated date
  - [ ] By title/name (alphabetical)
  - [ ] By relevance (for text search)
- [ ] Result filtering (post-query)
  - [ ] Filter results by additional criteria
  - [ ] Without re-running query
- [ ] Export results
  - [ ] CSV format
  - [ ] JSON format
  - [ ] Markdown list

### Low Priority

#### 9. Reverse Query Parsing
- [ ] Parse existing Datalog query
- [ ] Populate filter UI from parsed query
- [ ] Handle complex nested logic
- [ ] Allow editing via UI
- [ ] Regenerate modified query

#### 10. Query Validation & Testing
- [ ] Syntax validation before execution
- [ ] Helpful error messages
- [ ] Suggest fixes for common errors
- [ ] "Test query" button (dry run)
- [ ] Show estimated result count before full search

#### 11. Performance Optimizations
- [ ] Query result caching
  - [ ] Cache by query string
  - [ ] Invalidate on graph changes (if detectable)
- [ ] Debounced query generation
  - [ ] Don't regenerate on every keystroke
  - [ ] Update only after pause in typing
- [ ] Virtualized result list
  - [ ] Render only visible items
  - [ ] Handle large result sets (1000+ items)
- [ ] Pagination
  - [ ] Load results in chunks
  - [ ] "Load more" button

#### 12. UI/UX Improvements
- [ ] Keyboard shortcuts
  - [ ] Cmd/Ctrl+Enter to search
  - [ ] Cmd/Ctrl+K to add filter
  - [ ] Escape to clear/close
- [ ] Drag-and-drop filter reordering
- [ ] Collapsible filter groups
- [ ] Query history
  - [ ] Recent queries dropdown
  - [ ] Re-run previous query
- [ ] Syntax highlighting in query display
  - [ ] Color-code Datalog keywords
  - [ ] Make it easier to read
- [ ] Mobile responsive design
  - [ ] Better touch interactions
  - [ ] Adaptive layout for smaller screens

#### 13. Advanced Features
- [ ] Multiple graph support
  - [ ] Run same query across multiple graphs
  - [ ] Compare results
- [ ] Query composition
  - [ ] Combine results from multiple queries
  - [ ] Union, intersection, difference operations
- [ ] Aggregation queries
  - [ ] Count results by property
  - [ ] Group by tag/property
  - [ ] Sum/average for number properties
- [ ] Graph visualization
  - [ ] Show relationships between results
  - [ ] Network graph of connected pages/blocks

## Technical Debt & Refactoring

### Code Quality
- [ ] Add JSDoc comments to all functions
- [ ] Create TypeScript definitions
- [ ] Unit tests for query generator
- [ ] Integration tests with mock API
- [ ] E2E tests with real graph

### Architecture
- [ ] Refactor state management
  - [ ] Consider using state machine
  - [ ] Centralized state updates
- [ ] Error handling improvements
  - [ ] Consistent error types
  - [ ] User-friendly error messages
  - [ ] Retry logic for API failures
- [ ] Logging framework
  - [ ] Configurable log levels
  - [ ] Export logs for debugging

### Documentation
- [ ] API documentation
  - [ ] Document all query patterns
  - [ ] Examples for each filter type
- [ ] Contributing guide
  - [ ] How to add new filter types
  - [ ] Code style guide
  - [ ] Testing requirements
- [ ] Video tutorial
  - [ ] Quick start guide
  - [ ] Advanced features walkthrough

## Known Issues & Bugs

- [ ] Fix: Tags in results show as "#tag" instead of actual tag names
  - Need to resolve entity references
- [ ] Fix: Property namespace detection could be improved
  - Sometimes misses user.property vs logseq.property
- [ ] Fix: Date input validation
  - Handle invalid date formats gracefully
- [ ] Fix: Autocomplete positioning on scroll
  - Dropdown may appear off-screen

## Research & Investigation

- [ ] Investigate Logseq plugin API
  - [ ] Could this be a plugin instead of web app?
  - [ ] Benefits of running inside Logseq
- [ ] Study Logseq query syntax evolution
  - [ ] Keep up with new features
  - [ ] Support for new query types
- [ ] Explore Datalog advanced patterns
  - [ ] Recursive queries
  - [ ] Rules and functions
  - [ ] Performance optimization techniques
- [ ] Research property schema discovery
  - [ ] How to efficiently get all property names
  - [ ] How to determine property types
  - [ ] Cache strategy for schema info

## Future Possibilities

- [ ] AI-assisted query building
  - [ ] Natural language to Datalog
  - [ ] "Find my notes about anthropology from last month"
- [ ] Query recommendations
  - [ ] Suggest filters based on graph structure
  - [ ] "Users who searched for X also searched for Y"
- [ ] Collaborative features
  - [ ] Share queries with team
  - [ ] Public query repository
- [ ] Integration with other tools
  - [ ] Zotero integration for bibliography queries
  - [ ] Export to other note-taking apps
