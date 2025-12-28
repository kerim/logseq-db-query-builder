# Property Dropdown Debugging Plan (Revised)

**Status**: Issue remains unresolved after v0.0.22
**Last Updated**: 2025-12-28

## Problem Summary

Property value dropdowns are not appearing when selecting properties from autocomplete.

**What's Working:**
- Autocomplete doesn't re-trigger after selection (v0.0.21)
- `notifyChange()` timing fixed (v0.0.22)

**What's Broken:**
- Schema remains undefined after async completes
- Property value dropdown never appears
- Console shows: `renderPropertyValueInput called {hasSchema: false, schema: undefined}`

## How to Reproduce

1. Open `index.html` in browser
2. Connect to a graph containing a property like `ProjectStatus`
3. Add a Property filter
4. Type "Proj" and select "ProjectStatus" from autocomplete
5. **Expected**: Dropdown appears with values (Active, Inactive, etc.)
6. **Actual**: Text input remains, console shows `schema: undefined`

## Success Criteria

- [ ] Console shows `schema: {valueType: ':db.type/ref', ...}`
- [ ] Property value input changes from text to dropdown
- [ ] Dropdown populated with actual values from graph
- [ ] Generated query uses entity lookup pattern

---

## Hypotheses (Ordered by Investigation Priority)

### 1. Async Query Not Running (Check First)
**Condition** `if (propertyIdent && window.app.state.graph)` at line 260 is false.

**How to verify:**
```javascript
console.log('[DEBUG] propertyIdent:', propertyIdent);
console.log('[DEBUG] graph:', window.app.state.graph);
```

**If this fails:** Fix autocomplete to set `data-property-ident` attribute correctly.

---

### 2. Query Returns Empty Results
**Condition** `sampleResult.data.length === 0` at line 266.

**How to verify:**
```javascript
console.log('[DEBUG] sampleResult:', sampleResult);
console.log('[DEBUG] data length:', sampleResult.data?.length);
```

**If this fails:** Property may have no values, or query syntax is wrong.

---

### 3. Data Format Mismatch
**Condition** `sampleResult.data[0][0][propertyIdent]` doesn't exist.

**How to verify:**
```javascript
console.log('[DEBUG] data[0]:', sampleResult.data[0]);
console.log('[DEBUG] data[0][0]:', sampleResult.data[0]?.[0]);
console.log('[DEBUG] value:', sampleResult.data[0]?.[0]?.[propertyIdent]);
```

**If this fails:** The property key format may not match (e.g., with/without namespace).

---

### 4. Query Failing Silently
**Condition** Error caught by try-catch at line 299.

**How to verify:**
```javascript
catch (error) {
    console.error('[DEBUG] QUERY FAILED:', error);
    console.error('[DEBUG] Query was:', sampleQuery);
}
```

**If this fails:** Query syntax is wrong or API is returning an error.

---

### 5. Multiple Handlers Interfering
**Condition** Another handler clears schema or re-renders without it.

**How to verify:**
```javascript
// At start of renderPropertyValueInput:
console.log('[DEBUG] renderPropertyValueInput called from:', new Error().stack);
```

**If this fails:** Identify the competing handler and fix the race condition.

---

## Decision Tree

```
Start with Approach 1 (Diagnostic Logging)
         │
         ▼
    Run diagnostics
         │
         ├─► propertyIdent is null/undefined
         │   └─► Fix: autocomplete data-property-ident attribute
         │
         ├─► graph is null/undefined
         │   └─► Fix: ensure graph state is set before filter use
         │
         ├─► Query returns empty data
         │   └─► Fix: check query syntax, verify property has values
         │
         ├─► Query returns data but wrong format
         │   └─► Fix: update data extraction logic
         │
         ├─► Query throws error
         │   └─► Fix: correct query syntax
         │
         └─► All above pass but schema still undefined
             └─► Move to Approach 2 or 3
```

---

## Approach 1: Diagnostic Logging (RECOMMENDED FIRST)

**Goal:** Find out exactly where the code path fails.

**Implementation:** Add logging to `js/filters.js` lines 250-306:

```javascript
propNameInput.addEventListener('input', async (e) => {
    console.log('[PROP-INPUT] === Handler Start ===');
    console.log('[PROP-INPUT] value:', e.target.value);

    filter.propertyName = e.target.value;

    const propertyIdent = e.target.getAttribute('data-property-ident');
    console.log('[PROP-INPUT] propertyIdent:', propertyIdent);
    console.log('[PROP-INPUT] graph:', window.app.state.graph);

    if (propertyIdent) {
        filter.propertyIdent = propertyIdent;
    }

    if (propertyIdent && window.app.state.graph) {
        console.log('[PROP-INPUT] Entering async block...');
        try {
            const sampleQuery = `[:find (pull ?b [${propertyIdent}]) :where [?b ${propertyIdent}] :limit 1]`;
            console.log('[PROP-INPUT] Query:', sampleQuery);

            const sampleResult = await window.app.api.executeQuery(
                window.app.state.graph,
                sampleQuery
            );
            console.log('[PROP-INPUT] Result:', JSON.stringify(sampleResult, null, 2));

            if (sampleResult.data && sampleResult.data.length > 0) {
                console.log('[PROP-INPUT] Data[0]:', sampleResult.data[0]);
                console.log('[PROP-INPUT] Data[0][0]:', sampleResult.data[0][0]);

                const sampleValue = sampleResult.data[0][0][propertyIdent];
                console.log('[PROP-INPUT] Sample value:', sampleValue);
                console.log('[PROP-INPUT] Value type:', typeof sampleValue);

                // ... existing type inference logic ...

                filter.propertySchema = { /* ... */ };
                console.log('[PROP-INPUT] Schema SET:', filter.propertySchema);

                this.renderPropertyValueInput(filter, container);
                this.notifyChange();
            } else {
                console.log('[PROP-INPUT] NO DATA - query returned empty');
            }
        } catch (error) {
            console.error('[PROP-INPUT] ERROR:', error);
            console.error('[PROP-INPUT] Error stack:', error.stack);
        }
    } else {
        console.log('[PROP-INPUT] SKIPPED - missing ident or graph');
        this.notifyChange();
    }

    console.log('[PROP-INPUT] === Handler End ===');
});
```

**Pros:**
- Reveals exact failure point
- Minimal code change
- Easy to remove after diagnosis

**Cons:**
- Verbose output
- Doesn't fix the problem, only diagnoses

**Next step:** Based on console output, implement targeted fix or move to Approach 2/3.

---

## Approach 2: Use getPropertyValues() API

**Goal:** Simplify by using existing API instead of sample value inference.

**Rationale:** `getPropertyValues()` already exists and returns reference property values. Simpler than parsing sample query results.

**Implementation:**

```javascript
propNameInput.addEventListener('input', async (e) => {
    filter.propertyName = e.target.value;

    const propertyIdent = e.target.getAttribute('data-property-ident');
    if (propertyIdent) {
        filter.propertyIdent = propertyIdent;
    }

    if (propertyIdent && window.app.state.graph) {
        try {
            const values = await window.app.api.getPropertyValues(
                window.app.state.graph,
                propertyIdent
            );

            if (values && values.length > 0) {
                // Has values = confirmed reference property
                filter.propertySchema = {
                    name: filter.propertyName,
                    ident: propertyIdent,
                    valueType: ':db.type/ref',
                    cardinality: ':db.cardinality/one'
                };
            } else {
                // No values - could be ref with no values OR string type
                // Fall back to text input (safest default)
                filter.propertySchema = {
                    name: filter.propertyName,
                    ident: propertyIdent,
                    valueType: ':db.type/string',
                    cardinality: ':db.cardinality/one'
                };
            }

            this.renderPropertyValueInput(filter, container);
            this.notifyChange();
        } catch (error) {
            console.error('Failed to get property values:', error);
            this.notifyChange();
        }
    } else {
        this.notifyChange();
    }
});
```

**Pros:**
- Simpler logic
- Uses existing API method
- One query instead of sample + inference

**Cons:**
- Only detects ref vs text (not boolean/number/date)
- Empty result doesn't distinguish "ref with no values" from "not a ref"

**When to use:** If Approach 1 shows the sample query logic is fundamentally broken.

---

## Approach 3: Static Configuration

**Goal:** Bypass async entirely with synchronous config lookup.

**Rationale:** If async is fundamentally unreliable, use a static config file.

**Implementation:**

Create `js/propertyConfig.js`:
```javascript
const PROPERTY_SCHEMAS = {
    ':user.property/ProjectStatus-IUJoj7Hs': {
        name: 'ProjectStatus',
        valueType: ':db.type/ref',
        cardinality: ':db.cardinality/one',
        values: ['Active', 'Inactive', 'On Hold', 'Completed']
    },
    ':logseq.property/status': {
        name: 'status',
        valueType: ':db.type/ref',
        cardinality: ':db.cardinality/one',
        values: ['TODO', 'DOING', 'DONE', 'WAITING', 'CANCELED']
    }
};

window.PropertyConfig = {
    get: (ident) => PROPERTY_SCHEMAS[ident] || null
};
```

Update input handler in `js/filters.js`:
```javascript
propNameInput.addEventListener('input', (e) => {  // NOT async
    filter.propertyName = e.target.value;

    const propertyIdent = e.target.getAttribute('data-property-ident');
    if (propertyIdent) {
        filter.propertyIdent = propertyIdent;

        // Synchronous lookup
        const schema = window.PropertyConfig.get(propertyIdent);
        filter.propertySchema = schema || {
            name: filter.propertyName,
            ident: propertyIdent,
            valueType: ':db.type/string',
            cardinality: ':db.cardinality/one'
        };

        this.renderPropertyValueInput(filter, container);
    }

    this.notifyChange();
});
```

**Pros:**
- Zero async issues
- Instant UI updates
- 100% reliable
- User controls property definitions

**Cons:**
- Requires manual configuration
- Values can get out of sync
- Doesn't auto-discover properties

**When to use:** If async approaches (1, 2) keep failing.

---

## Approach 4: Event-Based Separation (Alternative)

**Goal:** Separate autocomplete selection from type inference.

**Rationale:** The input handler is doing too much. Split into discrete events.

**Implementation:**

```javascript
// In autocomplete.js - emit custom event on selection
item.addEventListener('click', () => {
    input.value = suggestion.name;
    input.setAttribute('data-property-ident', suggestion.ident);

    // Emit custom event instead of relying on 'input' event
    input.dispatchEvent(new CustomEvent('property-selected', {
        detail: { name: suggestion.name, ident: suggestion.ident }
    }));
});

// In filters.js - dedicated handler for property selection
propNameInput.addEventListener('property-selected', async (e) => {
    const { name, ident } = e.detail;
    filter.propertyName = name;
    filter.propertyIdent = ident;

    // Now handle type inference separately
    await this.inferPropertyType(filter, container);
});
```

**Pros:**
- Clean separation of concerns
- Avoids input event timing issues
- Explicit event for selection vs typing

**Cons:**
- More code changes required
- Need to update autocomplete.js too

---

## Files to Modify

| File | Lines | Purpose |
|------|-------|---------|
| `js/filters.js` | 250-306 | Property input handler |
| `js/api.js` | - | `getPropertyValues()` (Approach 2) |
| `js/propertyConfig.js` | NEW | Static config (Approach 3) |
| `js/autocomplete.js` | - | Custom event (Approach 4) |
| `index.html` | - | Script tag for propertyConfig.js |

---

## Implementation Plan

1. **Implement Approach 1** - Add diagnostic logging
2. **Test and collect console output**
3. **Analyze results** using decision tree above
4. **Implement targeted fix** OR proceed to Approach 2/3/4
5. **Verify success criteria**
6. **Remove diagnostic logging**
7. **Increment version and commit**

---

## Testing Checklist

After fix is implemented:

- [ ] Select property from autocomplete
- [ ] Console shows schema with correct valueType
- [ ] Property value input changes to dropdown
- [ ] Dropdown contains actual values from graph
- [ ] Generated query is syntactically correct
- [ ] Search returns expected results
- [ ] No console errors
- [ ] Works with multiple property types (ref, string)
