# Development Plan

## Version Roadmap

### v0.0.1 ✅ (Current - Released 2024-12-26)
**Status**: Complete
- Basic filter interface
- Query generation and execution
- Simple autocomplete
- Theme support
- Core functionality working

---

### v0.1.0 (Next Sprint - Priority: HIGH)
**Goal**: Enhanced search operators and property type support

#### Features to Implement:
1. **Text Search Operators** (2-3 hours)
   - Add operator dropdown to full-text filter
   - Support: contains, equals, starts-with, ends-with
   - Update query generator for each operator
   - Test against real data

2. **Property Type Awareness** (4-5 hours)
   - Fetch property types from graph
   - Type-specific operators (string, number, date, checkbox)
   - Smart input fields based on type
   - Update query generator for typed properties

3. **Property Name Autocomplete** (2-3 hours)
   - Fetch all property names via API
   - Add autocomplete to property name input
   - Show property type in suggestions
   - Cache property list for performance

4. **Enhanced Tag Autocomplete** (2 hours)
   - Show tag count in suggestions
   - Better visual design
   - Keyboard navigation (arrow keys, enter)

**Estimated Time**: 10-13 hours
**Target**: Complete within 2-3 days

---

### v0.2.0 (Sprint 2 - Priority: HIGH)
**Goal**: Boolean logic and nested groups

#### Features to Implement:
1. **Boolean Logic UI** (6-8 hours)
   - Design nested group interface
   - Add "Add Group" functionality
   - Per-group AND/OR selector
   - Visual indentation/grouping

2. **NOT Operator** (2-3 hours)
   - Add NOT checkbox per filter
   - Update query generator
   - Test complex NOT scenarios

3. **Query Generator Refactor** (4-5 hours)
   - Support nested AND/OR/NOT
   - Generate complex `(or-join ...)` patterns
   - Handle arbitrary nesting depth
   - Extensive testing

**Estimated Time**: 12-16 hours
**Target**: Complete within 3-5 days

---

### v0.3.0 (Sprint 3 - Priority: MEDIUM)
**Goal**: Advanced features and UX improvements

#### Features to Implement:
1. **Tag Inheritance** (3-4 hours)
   - "Include subtags" checkbox
   - Query generation with `:logseq.property.class/extends`
   - Test with hierarchical tags

2. **Query Presets** (4-5 hours)
   - Save/load functionality
   - localStorage management
   - Preset browser UI
   - Export/import JSON

3. **Result Enhancements** (3-4 hours)
   - Resolve tag entity references
   - Show property values inline
   - Expandable result items
   - Copy UUID to clipboard

4. **Result Sorting** (2-3 hours)
   - Sort by date (created/updated)
   - Sort by name (alphabetical)
   - UI controls for sorting

**Estimated Time**: 12-16 hours
**Target**: Complete within 3-5 days

---

### v0.4.0 (Sprint 4 - Priority: MEDIUM)
**Goal**: Reverse parsing and query validation

#### Features to Implement:
1. **Reverse Query Parser** (8-10 hours)
   - Parse Datalog syntax
   - Populate filter UI from query
   - Handle simple queries first
   - Gradually support complex patterns

2. **Query Validation** (3-4 hours)
   - Syntax checking
   - Error messages
   - Suggest fixes
   - Test mode (dry run)

3. **Query History** (2-3 hours)
   - Store recent queries
   - Quick re-run
   - Clear history option

**Estimated Time**: 13-17 hours
**Target**: Complete within 4-6 days

---

### v0.5.0 (Sprint 5 - Priority: LOW)
**Goal**: Performance and polish

#### Features to Implement:
1. **Performance Optimizations**
   - Query result caching
   - Debounced query generation
   - Virtualized results list
   - Pagination

2. **UI/UX Improvements**
   - Keyboard shortcuts
   - Drag-and-drop reordering
   - Collapsible groups
   - Syntax highlighting

3. **Documentation**
   - Video tutorial
   - Advanced examples
   - API documentation

**Estimated Time**: 15-20 hours
**Target**: Complete within 5-7 days

---

## Development Workflow

### For Each Feature:
1. **Design** (10% of time)
   - Sketch UI mockup
   - Plan data structures
   - Identify edge cases

2. **Implementation** (60% of time)
   - Write code incrementally
   - Test as you go
   - Commit frequently

3. **Testing** (20% of time)
   - Manual testing with real graph
   - Test edge cases
   - Cross-browser check

4. **Documentation** (10% of time)
   - Update README
   - Add inline comments
   - Update CHANGELOG

### Git Workflow:
```bash
# Start new feature
git checkout -b feature/text-search-operators

# Commit frequently
git add .
git commit -m "Add operator dropdown to full-text filter"

# When complete
git checkout main
git merge feature/text-search-operators
git tag v0.1.0
```

### Testing Checklist:
- [ ] Feature works with simple inputs
- [ ] Feature works with edge cases
- [ ] Query generates correctly
- [ ] API executes successfully
- [ ] Results display properly
- [ ] Error handling works
- [ ] UI is responsive
- [ ] Theme toggle works
- [ ] Browser console has no errors

---

## Current Development Session

### Next Steps (Immediate):
1. ✅ Commit v0.0.1 to git
2. ✅ Create TODO.md
3. ✅ Create CHANGELOG.md
4. ✅ Create DEVELOPMENT.md
5. ⏭️ Begin v0.1.0 development

### v0.1.0 - Task Breakdown:

#### Task 1: Text Search Operators
**Files to modify**: 
- `js/filters.js` - Add operator dropdown
- `js/queryGenerator.js` - Add operator logic
- `styles/main.css` - Style operator dropdown

**Steps**:
1. Update FILTER_TYPES config for full-text
2. Add operator dropdown rendering
3. Update buildFullTextClause() for each operator
4. Test with real queries

#### Task 2: Property Type Awareness
**Files to modify**:
- `js/api.js` - Add getPropertySchema() method
- `js/filters.js` - Dynamic input based on type
- `js/queryGenerator.js` - Type-specific query patterns
- `js/app.js` - Fetch and cache schema

**Steps**:
1. Design API for fetching property types
2. Implement schema caching
3. Update UI to show type-specific inputs
4. Generate queries based on property type
5. Test all property types

#### Task 3: Property Name Autocomplete
**Files to modify**:
- `js/autocomplete.js` - Add property name support
- `js/filters.js` - Attach autocomplete to property input

**Steps**:
1. Update API to fetch property names
2. Extend Autocomplete class for properties
3. Attach to property name input
4. Test autocomplete behavior

#### Task 4: Enhanced Tag Autocomplete
**Files to modify**:
- `js/autocomplete.js` - Improve visual design
- `styles/main.css` - Better dropdown styling

**Steps**:
1. Add keyboard navigation
2. Improve visual design
3. Add tag metadata (count, type)
4. Test keyboard interactions

---

## Notes for Future Development

### Architecture Considerations:
- **State Management**: Consider implementing a state machine pattern for complex logic
- **Query Builder**: May need recursive structure for nested groups
- **Performance**: Virtual scrolling becomes critical with 1000+ results
- **Testing**: Need automated tests before v1.0.0

### Technical Decisions:
- **Framework**: Currently vanilla JS - consider staying framework-free for simplicity
- **Bundler**: Not needed yet, but may help with code organization later
- **TypeScript**: Would help catch type errors, but adds build step
- **Testing**: Jest + Playwright for E2E tests

### User Feedback to Gather:
- Most-used filter types
- Most-wanted features
- Pain points in current UI
- Query patterns they need but can't build

### Integration Opportunities:
- Could this become a Logseq plugin?
- Integration with logseq-sidekick?
- API for other tools to use query builder?
