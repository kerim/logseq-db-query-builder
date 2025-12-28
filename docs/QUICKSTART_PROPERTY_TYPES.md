# Property Type Awareness - Implementation Quickstart

## Overview

**Goal**: Transform property filtering from manual text input to intelligent, type-aware UI with autocomplete and appropriate input controls.

**Status**: ✅ Planning Complete | ⏸️ Implementation Pending

**Full Plan**: See `/Users/niyaro/.claude/plans/cryptic-watching-mccarthy.md` for detailed implementation

---

## What This Feature Adds

### Current State (Manual)
- Property names: Type manually (no suggestions)
- Property values: Plain text input (no validation)
- No understanding of property types

### Future State (Type-Aware)
- Property names: **Autocomplete dropdown** with validation
- Property values: **Type-specific inputs**:
  - ✅ Checkbox properties → Radio buttons (checked/unchecked)
  - ✅ Reference properties (single) → Dropdown with actual values
  - ✅ Reference properties (multi) → Checkbox group
  - ✅ Date properties → Date picker + operator dropdown (=, <, >, <=, >=)
  - ✅ Number properties → Number input + operator dropdown
  - ✅ Text properties → Text input (fallback)
- **Tag property suggestions**: When tag selected, show hint with associated properties

---

## Prerequisites

### Verify Current Version
```bash
# Check version in index.html line 6
grep "v0.0" index.html
```
Expected: `v0.0.13` or later

### Test Logseq CLI Access
```bash
# Verify graphs are accessible
logseq list

# Test property schema query
logseq query -g "LSEQ 2025-12-15" -p '[:find (pull ?p [*]) :where [?p :db/ident :logseq.property/status]]'
```

**CRITICAL**: All `logseq` CLI commands in Claude Code require:
```javascript
Bash({
  command: 'logseq query ...',
  dangerouslyDisableSandbox: true  // Required for database access
})
```

### Existing Infrastructure (Already in place)
- ✅ `api.getProperties()` - Fetches property names (lines 180-218 in js/api.js)
- ✅ `Autocomplete` class - Working for tags/pages (js/autocomplete.js)
- ✅ Query generation patterns in queryGenerator.js

---

## 5-Phase Implementation Plan

### Phase 1: API Layer (Foundation)
**Files**: `js/api.js`

Add 4 new methods:

#### 1.1 `getPropertySchema(graphName, propertyName)`
Fetch property metadata (type, cardinality)

```javascript
async getPropertySchema(graphName, propertyName) {
    const query = `[:find (pull ?p [*])
                    :where
                    (or
                      [?p :db/ident :user.property/${propertyName}]
                      [?p :db/ident :logseq.property/${propertyName}])]`;

    const result = await this.executeQuery(graphName, query);
    if (result.data.length > 0) {
        const schema = result.data[0][0];
        return {
            name: schema[':block/title'],
            ident: schema[':db/ident'],
            valueType: schema[':db/valueType'],  // e.g., :db.type/ref
            cardinality: schema[':db/cardinality']  // e.g., :db.cardinality/one
        };
    }
    return null;
}
```

#### 1.2 `getPropertyValues(graphName, propertyIdent)`
For reference properties, fetch all possible values

```javascript
async getPropertyValues(graphName, propertyIdent) {
    const query = `[:find (pull ?val [:block/title :db/id])
                    :where
                    [_ ${propertyIdent} ?val]]`;

    const result = await this.executeQuery(graphName, query);
    return result.data.map(item => ({
        title: item[0][':block/title'],
        id: item[0][':db/id']
    }));
}
```

#### 1.3 `getTagProperties(graphName, tagName)`
Fetch properties associated with a tag

```javascript
async getTagProperties(graphName, tagName) {
    const query = `[:find (pull ?tag [:logseq.property.class/properties])
                    :where
                    [?tag :block/title "${tagName}"]]`;

    const result = await this.executeQuery(graphName, query);
    if (result.data.length > 0) {
        const props = result.data[0][0][':logseq.property.class/properties'];
        return props || [];
    }
    return [];
}
```

#### 1.4 Update `getProperties()` (lines 180-218)
Return metadata objects instead of just names

**Testing Phase 1**:
```javascript
// In browser console after implementing:
const api = new LogseqAPI();
const schema = await api.getPropertySchema('LSEQ 2025-12-15', 'status');
console.log(schema);  // Should show valueType, cardinality, etc.

const values = await api.getPropertyValues('LSEQ 2025-12-15', ':logseq.property/status');
console.log(values);  // Should show Done, Todo, Doing, etc.
```

---

### Phase 2: Property Name Autocomplete
**Files**: `js/autocomplete.js`, `js/filters.js`

#### 2.1 Update `autocomplete.js`
Add support for 'property' type in `fetchSuggestions()`:

```javascript
case 'property':
    const props = await this.api.getProperties(graphName, searchTerm);
    return props.map(p => p.title);
```

#### 2.2 Modify `filters.js` (lines 235-246)
Update property-name input case:

```javascript
case 'property-name':
    const propNameInput = document.createElement('input');
    propNameInput.type = 'text';
    propNameInput.className = 'filter-input';
    propNameInput.placeholder = 'Select property...';
    propNameInput.value = filter.propertyName || '';
    propNameInput.setAttribute('data-autocomplete', 'property');  // Enable autocomplete

    propNameInput.addEventListener('input', async (e) => {
        filter.propertyName = e.target.value;

        // Fetch schema when property selected
        if (filter.propertyName && window.app.state.graph) {
            const schema = await window.app.api.getPropertySchema(
                window.app.state.graph,
                filter.propertyName
            );
            filter.propertySchema = schema;
            // Re-render value input based on schema
            this.renderPropertyValueInput(filter, container);
        }

        this.notifyChange();
    });
    container.appendChild(propNameInput);
    break;
```

**Testing Phase 2**:
- Select graph
- Add property filter
- Click property name input
- Should see autocomplete suggestions

---

### Phase 3: Type-Specific Value Inputs
**Files**: `js/filters.js`

Add new method before `notifyChange()`:

#### 3.1 Dispatcher Method
```javascript
renderPropertyValueInput(filter, container) {
    // Remove existing value input
    const existing = container.querySelector('.property-value-input');
    if (existing) existing.remove();

    if (!filter.propertySchema) {
        this.renderTextInput(filter, container);
        return;
    }

    const schema = filter.propertySchema;

    switch (schema.valueType) {
        case ':db.type/boolean':
            this.renderCheckboxInput(filter, container);
            break;
        case ':db.type/ref':
            this.renderReferenceInput(filter, container, schema);
            break;
        case ':db.type/instant':
            this.renderDateInput(filter, container);
            break;
        case ':db.type/number':
            this.renderNumberInput(filter, container);
            break;
        default:
            this.renderTextInput(filter, container);
    }
}
```

#### 3.2 Input Rendering Methods
Add these methods to FilterManager class (see full plan for complete implementations):

- `renderCheckboxInput()` - Radio buttons for checked/unchecked
- `renderReferenceInput()` - Dropdown (single) or checkboxes (multi)
- `renderDateInput()` - Date picker + operator dropdown
- `renderNumberInput()` - Number input + operator dropdown
- `renderTextInput()` - Plain text input (fallback)

**Key pattern for all inputs**:
```javascript
renderXxxInput(filter, container) {
    // 1. Create wrapper with .property-value-input class
    // 2. Create input element(s)
    // 3. Add change listener that updates filter.value
    // 4. Call this.notifyChange()
    // 5. Append to container
}
```

**Testing Phase 3**:
- Add property filter
- Select "status" → Should show dropdown with Done/Todo/Doing
- Select "year" (if numeric) → Should show number input + operator
- Select "deadline" (if date) → Should show date picker + operator

---

### Phase 4: Query Generation
**Files**: `js/queryGenerator.js`

#### 4.1 Update `buildPropertyClause()` (lines 236-262)
Add type checking before generating query:

```javascript
static buildPropertyClause(filter, entityVar) {
    const { propertyName, propertySchema, operator = 'is', value } = filter;

    const userProp = `:user.property/${propertyName}`;
    const logseqProp = `:logseq.property/${propertyName}`;

    // Handle different value types
    if (propertySchema) {
        switch (propertySchema.valueType) {
            case ':db.type/boolean':
                return this.buildBooleanPropertyClause(entityVar, userProp, logseqProp, value);
            case ':db.type/ref':
                return this.buildRefPropertyClause(entityVar, userProp, logseqProp, value, propertySchema.cardinality);
            case ':db.type/number':
                return this.buildNumberPropertyClause(entityVar, userProp, logseqProp, value, operator);
            case ':db.type/instant':
                return this.buildDatePropertyClause(entityVar, userProp, logseqProp, value, operator);
        }
    }

    // Fallback to string query (existing code)
    // ...
}
```

#### 4.2 Add Type-Specific Query Builders
```javascript
static buildBooleanPropertyClause(entityVar, userProp, logseqProp, value) {
    const boolVal = value === 'checked';
    return `(or-join [${entityVar}]
  [${entityVar} ${userProp} ${boolVal}]
  [${entityVar} ${logseqProp} ${boolVal}])`;
}

static buildRefPropertyClause(entityVar, userProp, logseqProp, value, cardinality) {
    if (Array.isArray(value) && value.length > 0) {
        // Multiple values - OR query
        const clauses = value.map(v => {
            const escaped = this.escapeString(v);
            return `(and [${entityVar} ${userProp} ?ref] [?ref :block/title "${escaped}"])`;
        }).join('\n  ');
        return `(or-join [${entityVar}]
  ${clauses})`;
    } else {
        const escaped = this.escapeString(value);
        return `(or-join [${entityVar}]
  (and [${entityVar} ${userProp} ?ref] [?ref :block/title "${escaped}"])
  (and [${entityVar} ${logseqProp} ?ref] [?ref :block/title "${escaped}"]))`;
    }
}

static buildNumberPropertyClause(entityVar, userProp, logseqProp, value, operator) {
    const numVal = parseFloat(value);
    const op = operator === 'is' ? '=' : operator;
    return `(or-join [${entityVar}]
  (and [${entityVar} ${userProp} ?num] [(${op} ?num ${numVal})])
  (and [${entityVar} ${logseqProp} ?num] [(${op} ?num ${numVal})]))`;
}

static buildDatePropertyClause(entityVar, userProp, logseqProp, value, operator) {
    const timestamp = new Date(value).getTime();
    const op = operator === 'is' ? '=' : operator;
    return `(or-join [${entityVar}]
  (and [${entityVar} ${userProp} ?date] [(${op} ?date ${timestamp})])
  (and [${entityVar} ${logseqProp} ?date] [(${op} ?date ${timestamp})]))`;
}
```

**Testing Phase 4**:
```bash
# Test queries manually first
logseq query -g "GRAPH" -p '[:find (pull ?b [*]) :where [?b :logseq.property/status ?s] [?s :block/title "Done"]]'

# Then test via UI - check generated query matches expected pattern
```

---

### Phase 5: Tag Property Suggestions
**Files**: `js/filters.js`

#### 5.1 Add to tags filter input handler (lines 206-210)
```javascript
autocompleteInput.addEventListener('input', async (e) => {
    filter.value = e.target.value;

    // For tags: show property suggestions
    if (filter.type === 'tags' && filter.value && window.app.state.graph) {
        const tagProps = await window.app.api.getTagProperties(
            window.app.state.graph,
            filter.value
        );

        if (tagProps.length > 0) {
            this.showTagPropertyHint(filter, tagProps, container);
        }
    }

    this.notifyChange();
});
```

#### 5.2 Add hint display method
```javascript
showTagPropertyHint(filter, tagProps, container) {
    // Remove existing hint
    const existing = container.querySelector('.tag-property-hint');
    if (existing) existing.remove();

    const hint = document.createElement('div');
    hint.className = 'tag-property-hint';
    hint.style.cssText = 'margin-top: 8px; font-size: 12px; color: var(--text-secondary); font-style: italic;';

    const propNames = tagProps.map(p => p.split('/').pop()).join(', ');
    hint.textContent = `💡 Tip: This tag has properties: ${propNames}`;

    container.appendChild(hint);
}
```

**Testing Phase 5**:
- Add tags filter
- Select "Task" tag
- Should see hint: "💡 Tip: This tag has properties: status, priority, deadline, scheduled"

---

## Quick Reference

### Property Types in Logseq DB

| Type | `:db/valueType` | Example | Query Pattern |
|------|----------------|---------|---------------|
| Text | `:db.type/string` | "Project Title" | `[?b :user.property/name "value"]` |
| Number | `:db.type/number` | 2024 | `[?b :user.property/year ?n] [(> ?n 2020)]` |
| Date | `:db.type/instant` | 1735689600000 | `[?b :user.property/date ?d] [(> ?d 123...)]` |
| Checkbox | `:db.type/boolean` | true/false | `[?b :user.property/done true]` |
| Reference | `:db.type/ref` | {:db/id 137} | `[?b :user.property/status ?s] [?s :block/title "Done"]` |

### Cardinality

- `:db.cardinality/one` - Single value (use dropdown)
- `:db.cardinality/many` - Multiple values (use checkbox group)

### Property Namespaces

- `:user.property/NAME` - User-defined properties
- `:logseq.property/NAME` - Built-in Logseq properties

**Always try both namespaces in queries** using `or-join`

---

## Code Templates

### Template: Adding New Input Type
```javascript
renderCustomInput(filter, container) {
    // 1. Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'property-value-input';

    // 2. Create input element
    const input = document.createElement('input');
    input.type = 'text';  // or 'number', 'date', etc.
    input.className = 'filter-input';
    input.value = filter.value || '';

    // 3. Add event listener
    input.addEventListener('change', (e) => {
        filter.value = e.target.value;
        this.notifyChange();
    });

    // 4. Append to container
    wrapper.appendChild(input);
    container.appendChild(wrapper);
}
```

### Template: Testing Queries with CLI
```bash
# Test in Claude Code with:
Bash({
  command: 'logseq query -g "GRAPH NAME" -p \'[:find (pull ?b [*]) :where ...]\'',
  description: "Test property query",
  dangerouslyDisableSandbox: true
})

# Always test CLI query BEFORE implementing in UI
```

---

## Testing Checklist

### Phase 1 Testing
- [ ] `getPropertySchema()` returns correct valueType and cardinality
- [ ] `getPropertyValues()` returns actual values for reference properties
- [ ] `getTagProperties()` returns property identifiers for tags
- [ ] Updated `getProperties()` returns metadata objects

### Phase 2 Testing
- [ ] Property name autocomplete shows suggestions
- [ ] Selecting property fetches its schema
- [ ] Value input re-renders when property changes

### Phase 3 Testing
- [ ] Boolean property → Radio buttons appear
- [ ] Reference (single) → Dropdown with values appears
- [ ] Reference (multi) → Checkboxes appear
- [ ] Date property → Date picker + operator dropdown appear
- [ ] Number property → Number input + operator dropdown appear
- [ ] Unknown property → Text input appears (fallback)

### Phase 4 Testing
- [ ] Boolean query generated correctly: `[?b :prop true]`
- [ ] Reference query uses entity lookup: `[?b :prop ?ref] [?ref :block/title "value"]`
- [ ] Number query includes operator: `[?b :prop ?n] [(> ?n 100)]`
- [ ] Date query uses timestamp: `[?b :prop ?d] [(> ?d 123456789)]`
- [ ] Test each query with CLI before implementing

### Phase 5 Testing
- [ ] Tag selection shows property hint
- [ ] Hint displays correct property names
- [ ] Hint disappears when tag deselected

### Integration Testing
- [ ] Select property → correct input appears → generate query → execute → get results
- [ ] Switch between different property types in same filter
- [ ] Multiple property filters with different types
- [ ] Copy generated query and test in Logseq

---

## Common Issues & Solutions

### Issue: Property schema returns null
**Cause**: Property name doesn't exist or wrong namespace
**Solution**: Test with known properties (status, priority, deadline)

### Issue: getPropertyValues returns empty array
**Cause**: Property hasn't been used yet in the graph
**Solution**: Add some test data with that property first

### Issue: Date queries return no results
**Cause**: Timestamp format incorrect (should be milliseconds)
**Solution**: Use `new Date(value).getTime()` for conversion

### Issue: Reference queries don't match
**Cause**: Forgot entity lookup pattern
**Solution**: Always use `[?b :prop ?ref] [?ref :block/title "value"]` pattern

### Issue: Autocomplete not working
**Cause**: Graph not selected or wrong type in `data-autocomplete`
**Solution**: Verify graph selected, check attribute value matches switch case

---

## Version Management

### Before Starting Implementation
1. Check current version: `grep "v0.0" index.html`
2. Plan next version: Increment MINOR for this feature (e.g., v0.0.13 → v0.1.0)

### After Each Phase
1. Update version in:
   - `index.html` (line 6 and line 15)
   - `README.md`
   - `docs/PROJECT_STATUS.md`
2. Update `CHANGELOG.md`
3. Commit immediately:
   ```bash
   git add .
   git commit -m "Add property type awareness - Phase X - v0.1.X"
   git tag v0.1.X
   ```
4. Test AFTER committing

### Final Release
When all 5 phases complete:
- Version: v0.1.0
- Tag: `git tag v0.1.0`
- Push: `git push origin main --tags`

---

## Files to Modify Summary

| Phase | Files | Lines | Methods/Changes |
|-------|-------|-------|----------------|
| 1 | js/api.js | 180-218 + new | Add 3 methods, update 1 |
| 2 | js/autocomplete.js | ~40-60 | Add 'property' case |
| 2 | js/filters.js | 235-246 | Update property-name case |
| 3 | js/filters.js | End of class | Add 6 rendering methods |
| 4 | js/queryGenerator.js | 236-262 + new | Update 1, add 4 builders |
| 5 | js/filters.js | 206-210 + new | Update input handler, add hint method |

**Total estimated additions**: ~400-500 lines of code

---

## Next Steps to Resume

1. **Read this document** to refresh context
2. **Check current version** to determine next version number
3. **Review full plan** at `/Users/niyaro/.claude/plans/cryptic-watching-mccarthy.md`
4. **Start with Phase 1** (API layer)
5. **Test each phase** before proceeding to next
6. **Commit after each phase** with version increment

---

**Plan Created**: 2025-12-27
**Current Status**: Ready to implement
**Estimated Time**: 2-3 hours per phase (10-15 hours total)
**Target Version**: v0.1.0
