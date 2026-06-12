/**
 * Query Generator - Convert filter state to Datalog queries
 * Supports recursive group structures with AND/OR/NOT logic
 */

const PARENT_RULE_VECTOR = '[[(parent ?p ?c) [?c :block/parent ?p]] [(parent ?p ?c) [?t :block/parent ?p] (parent ?t ?c)]]';

class QueryGenerator {
    /**
     * Generate Datalog query from root group (tree structure)
     * @param {Object} rootGroup - Root group containing nested groups and filters
     * @returns {Object|null} Object with raw and wrapped query versions, or null if invalid
     */
    static varCounter = 0;

    // Substitutions collected during this generate() pass.
    // Each entry: { literal, keyword, symbol }
    //   literal — the computed number used in the raw (API-direct) query
    //   keyword — Logseq input keyword (e.g. 'today', '-7d', '-7d-start')
    //   symbol  — Datalog symbol for the wrapped query (e.g. '?today', '?-7d')
    static relativeSubstitutions = [];

    /**
     * Tag a relative-date literal so it can be substituted later. Returns a
     * placeholder token that survives string concatenation but gets rewritten
     * into either the literal (for raw) or a symbol (for wrapped) at finalize.
     */
    static tagLiteral(literal, keyword) {
        const idx = this.relativeSubstitutions.length;
        this.relativeSubstitutions.push({ literal, keyword, symbol: '?' + keyword });
        return `__LSQ_REL_${idx}__`;
    }

    /**
     * Replace all tagged-literal placeholders with their literal values
     * (used for the raw query sent directly via the HTTP API).
     */
    static materializeRaw(taggedStr) {
        return taggedStr.replace(/__LSQ_REL_(\d+)__/g, (_, idx) =>
            String(this.relativeSubstitutions[parseInt(idx, 10)].literal)
        );
    }

    /**
     * Replace tagged-literal placeholders with their symbol forms and return
     * the deduplicated list of inputs needed for :in $ ... / :inputs [...].
     */
    static materializeWrapped(taggedStr) {
        const wrapped = taggedStr.replace(/__LSQ_REL_(\d+)__/g, (_, idx) =>
            this.relativeSubstitutions[parseInt(idx, 10)].symbol
        );
        const byKeyword = new Map();
        for (const sub of this.relativeSubstitutions) {
            if (!byKeyword.has(sub.keyword)) byKeyword.set(sub.keyword, sub);
        }
        return { wrapped, inputs: [...byKeyword.values()] };
    }

    static generate(rootGroup) {
        if (!rootGroup || rootGroup.type !== 'group') {
            return null;
        }

        // Reset per-generation state
        this.varCounter = 0;
        this.relativeSubstitutions = [];
        this.usesParentRule = false;

        // Get all filters flattened for validation and entity detection
        const allFilters = this.flattenFilters(rootGroup);

        if (allFilters.length === 0) {
            return null;
        }

        // Filter out empty/invalid filters
        const validFilters = allFilters.filter(f => this.isValidFilter(f));

        if (validFilters.length === 0) {
            return null;
        }

        // Determine entity type (pages vs blocks)
        const entityType = this.determineEntityType(validFilters);
        const entityVar = entityType === 'page' ? '?p' : '?b';

        // Build :find clause
        const findClause = this.buildFindClause(entityVar);

        // Build recursive where section from group tree.
        // Relative-date literals are emitted as __LSQ_REL_N__ placeholders
        // that get materialized differently for raw vs. wrapped output.
        const taggedWhere = this.buildGroupClause(rootGroup, entityVar);

        if (!taggedWhere) {
            return null;
        }

        // Materialize raw (literal values) for direct HTTP API execution.
        // Raw never carries date symbols (dates are baked in as numbers by
        // materializeRaw), so the only :in clause raw ever needs is :in $ %
        // — and only when the parent rule is referenced.
        const rawWhere = this.materializeRaw(taggedWhere);
        const rawIn = this.usesParentRule ? '\n :in $ %' : '';
        const rawQuery = `[:find ${findClause}${rawIn}
 :where
 ${rawWhere}]`;

        // Re-indent for wrapped query
        const indentedTagged = taggedWhere.split('\n').map(line => {
            const trimmed = line.trimStart();
            return trimmed.length > 0 ? '   ' + trimmed : '';
        }).join('\n');

        // Materialize wrapped (symbols + inputs) for portable Logseq /query blocks.
        // When usesParentRule is true we append '%' to :in; Logseq's
        // add-rules-to-query auto-injects the rule definitions because
        // (parent ...) appears in :where, so we do NOT add the rule vector
        // to :inputs.
        const { wrapped: wrappedWhere, inputs } = this.materializeWrapped(indentedTagged);
        const ruleMark = this.usesParentRule ? ' %' : '';

        let wrappedQuery;
        if (inputs.length > 0) {
            const inSymbols = inputs.map(i => i.symbol).join(' ');
            const inputKeywords = inputs.map(i => `:${i.keyword}`).join(' ');
            wrappedQuery = `{:query
 [:find ${findClause}
  :in $ ${inSymbols}${ruleMark}
  :where
${wrappedWhere}]
 :inputs [${inputKeywords}]}`;
        } else if (this.usesParentRule) {
            wrappedQuery = `{:query
 [:find ${findClause}
  :in $ %
  :where
${wrappedWhere}]}`;
        } else {
            wrappedQuery = `{:query
 [:find ${findClause}
  :where
${wrappedWhere}]}`;
        }

        return {
            raw: rawQuery,
            wrapped: wrappedQuery,
            rules: this.usesParentRule ? PARENT_RULE_VECTOR : null
        };
    }

    /**
     * Flatten all filters from a group tree (recursive)
     */
    static flattenFilters(node) {
        const filters = [];
        if (!node) return filters;

        if (node.type === 'group' && node.children) {
            for (const child of node.children) {
                filters.push(...this.flattenFilters(child));
            }
        } else if (node.type !== 'group') {
            filters.push(node);
        }
        return filters;
    }

    /**
     * Build where clause for a group (recursive)
     */
    static buildGroupClause(group, entityVar) {
        if (!group || !group.children || group.children.length === 0) {
            return null;
        }

        // Build clauses for all children
        const childClauses = [];
        for (const child of group.children) {
            let clause;
            if (child.type === 'group') {
                clause = this.buildGroupClause(child, entityVar);
            } else {
                if (this.isValidFilter(child)) {
                    clause = this.buildWhereClause(child, entityVar);
                }
            }
            if (clause) {
                childClauses.push(clause);
            }
        }

        if (childClauses.length === 0) {
            return null;
        }

        // Combine based on group's match mode
        switch (group.matchMode) {
            case 'all':
                return this.combineWithAND(childClauses);
            case 'any':
                return this.combineWithOR(childClauses, entityVar);
            case 'none':
                return this.combineWithNOT(childClauses, entityVar);
            default:
                return this.combineWithAND(childClauses);
        }
    }

    /**
     * Check if filter has required fields
     */
    static isValidFilter(filter) {
        if (!filter || !filter.type) return false;

        switch (filter.type) {
            case 'page':
            case 'full-text':
                return filter.value && filter.value.trim().length > 0;
            
            case 'tags':
            case 'page-reference':
            case 'parent-page-reference':
            case 'block-on-page':
                return filter.value && filter.value.trim().length > 0;
            
            case 'property':
                // Relative mode for any date-typed property (journal-date refs or instant)
                if (filter.dateMode === 'relative' &&
                    (filter.propertySchema?.isJournalDate ||
                     filter.propertySchema?.valueType === ':db.type/instant')) {
                    const hasName = filter.propertyName && filter.propertyName.trim().length > 0;
                    if (!hasName) return false;
                    const preset = filter.relativeDatePreset;
                    if (preset === 'after-today' || preset === 'before-today' || preset === 'today') {
                        return true;
                    }
                    if (preset === 'last-n-days' || preset === 'next-n-days') {
                        return filter.relativeDateDays > 0;
                    }
                    if (preset === 'range') {
                        return filter.relativeDateStart != null && filter.relativeDateEnd != null;
                    }
                    return false;
                }
                // Property value can be string or array (checkbox selection)
                const hasPropertyName = filter.propertyName &&
                                        filter.propertyName.trim().length > 0;
                let hasPropertyValue = false;
                if (Array.isArray(filter.value)) {
                    hasPropertyValue = filter.value.length > 0;
                } else if (filter.value) {
                    hasPropertyValue = filter.value.trim().length > 0;
                }
                return hasPropertyName && hasPropertyValue;
            
            case 'task':
            case 'priority':
                // Both can be array (multi-select) or string
                if (Array.isArray(filter.value)) {
                    return filter.value.length > 0;
                }
                return filter.value && filter.value.trim().length > 0;
            
            case 'between':
                if (filter.betweenDateMode === 'relative') {
                    const preset = filter.relativeDatePreset;
                    if (!preset) return false;
                    if (preset === 'after-today' || preset === 'before-today' || preset === 'today') {
                        return true;
                    }
                    if (preset === 'last-n-days' || preset === 'next-n-days') {
                        return filter.relativeDateDays > 0;
                    }
                    if (preset === 'range') {
                        return filter.relativeDateStart != null && filter.relativeDateEnd != null;
                    }
                    return false;
                }
                return filter.startDate && filter.endDate;
            
            default:
                return false;
        }
    }

    /**
     * Determine if we're querying pages or blocks
     */
    static determineEntityType(filters) {
        const pageOnlyTypes = ['page'];
        const blockOnlyTypes = ['full-text', 'task', 'priority', 'parent-page-reference', 'block-on-page'];
        
        const hasPageOnly = filters.some(f => pageOnlyTypes.includes(f.type));
        const hasBlockOnly = filters.some(f => blockOnlyTypes.includes(f.type));

        // If mixed or only both-compatible filters, default to blocks
        if (hasBlockOnly || (!hasPageOnly && !hasBlockOnly)) {
            return 'block';
        }
        
        return 'page';
    }

    /**
     * Build :find clause
     */
    static buildFindClause(entityVar) {
        return `(pull ${entityVar} [*])`;
    }

    /**
     * Build :where clause for a single filter
     */
    static buildWhereClause(filter, entityVar) {
        switch (filter.type) {
            case 'page':
                return this.buildPageClause(filter, entityVar);
            
            case 'tags':
                return this.buildTagsClause(filter, entityVar);
            
            case 'full-text':
                return this.buildFullTextClause(filter, entityVar);
            
            case 'property':
                return this.buildPropertyClause(filter, entityVar);
            
            case 'page-reference':
                return this.buildPageReferenceClause(filter, entityVar);

            case 'parent-page-reference':
                return this.buildParentPageReferenceClause(filter, entityVar);

            case 'block-on-page':
                return this.buildBlockOnPageClause(filter, entityVar);

            case 'task':
                return this.buildTaskClause(filter, entityVar);
            
            case 'priority':
                return this.buildPriorityClause(filter, entityVar);
            
            case 'between':
                return this.buildBetweenClause(filter, entityVar);
            
            default:
                return null;
        }
    }

    /**
     * Build page name matching clause
     */
    static buildPageClause(filter, entityVar) {
        const { operator = 'contains', value } = filter;
        const escapedValue = this.escapeString(value);

        switch (operator) {
            case 'is':
                return `[${entityVar} :block/name "${escapedValue}"]`;
            
            case 'contains':
                return `[${entityVar} :block/name ?name]
 [(clojure.string/includes? ?name "${escapedValue}")]`;
            
            case 'starts-with':
                return `[${entityVar} :block/name ?name]
 [(clojure.string/starts-with? ?name "${escapedValue}")]`;
            
            case 'ends-with':
                return `[${entityVar} :block/name ?name]
 [(clojure.string/ends-with? ?name "${escapedValue}")]`;
            
            default:
                return null;
        }
    }

    /**
     * Build tags clause
     */
    static buildTagsClause(filter, entityVar) {
        const escapedValue = this.escapeString(filter.value);

        if (filter.includeExtensions) {
            // Use or-join to match both direct tags and tags that extend the target tag
            return `(or-join [${entityVar}]
  (and [${entityVar} :block/tags ?t]
       [?t :block/title "${escapedValue}"])
  (and [${entityVar} :block/tags ?child]
       [?child :logseq.property.class/extends ?parent]
       [?parent :block/title "${escapedValue}"]))`;
        } else {
            // Simple tag match
            return `[${entityVar} :block/tags ?t]
 [?t :block/title "${escapedValue}"]`;
        }
    }

    /**
     * Build full text search clause
     */
    static buildFullTextClause(filter, entityVar) {
        const { operator = 'contains', value } = filter;
        // Escape order matters: regex-escape the RAW value first (so metacharacters
        // like "." match literally), THEN string-escape the result so the backslashes
        // are valid inside the EDN string literal. Doing it the other way around emits
        // invalid EDN (e.g. "(?i)gmail\.com") and Logseq rejects the whole query — so
        // any search term containing . ( ) ? + $ etc. silently returns nothing.
        const regexEscaped = this.escapeRegex(value);  // Escape regex chars first
        const escapedValue = this.escapeString(regexEscaped);  // Then escape for EDN string

        switch (operator) {
            case 'equals':
                // Case-insensitive exact match using anchored regex
                return `[${entityVar} :block/title ?title]
 [(re-pattern "(?i)^${escapedValue}$") ?pattern]
 [(re-matches ?pattern ?title)]`;

            case 'contains':
            default:
                // Case-insensitive substring match using regex
                return `[${entityVar} :block/title ?title]
 [(re-pattern "(?i)${escapedValue}") ?pattern]
 [(re-find ?pattern ?title)]`;
        }
    }

    /**
     * Build property clause
     */
    static buildPropertyClause(filter, entityVar) {
        const { propertyName, propertySchema, operator = 'is', value } = filter;

        // If we have schema info, use type-specific query generation
        if (propertySchema && propertySchema.ident) {
            // Ensure property ident has : prefix for query
            const propIdent = propertySchema.ident.startsWith(':') ? propertySchema.ident : `:${propertySchema.ident}`;

            // Journal-date relative mode: special clause builder
            if (propertySchema.isJournalDate && filter.dateMode === 'relative') {
                return this.buildJournalDateClause(entityVar, propIdent, filter);
            }

            // Instant property in relative mode: literal-ms window
            if (propertySchema.valueType === ':db.type/instant' && filter.dateMode === 'relative') {
                const idx = this.varCounter++;
                return this.buildInstantPropertyRelativeClause(entityVar, propIdent, filter, idx);
            }

            switch (propertySchema.valueType) {
                case ':db.type/boolean':
                    return this.buildBooleanPropertyClause(entityVar, propIdent, value);

                case ':db.type/ref':
                    return this.buildRefPropertyClause(entityVar, propIdent, value, propertySchema.cardinality);

                case ':db.type/number':
                    return this.buildNumberPropertyClause(entityVar, propIdent, value, operator);

                case ':db.type/instant':
                    return this.buildDatePropertyClause(entityVar, propIdent, value, operator);
            }
        }

        // Fallback: Try both user.property and logseq.property namespaces
        const userProp = `:user.property/${propertyName}`;
        const logseqProp = `:logseq.property/${propertyName}`;

        const escapedValue = this.escapeString(value);

        switch (operator) {
            case 'is':
                // Check both namespaces with or-join
                return `(or-join [${entityVar}]
  [${entityVar} ${userProp} "${escapedValue}"]
  [${entityVar} ${logseqProp} "${escapedValue}"])`;

            case 'contains':
                return `(or-join [${entityVar}]
  (and [${entityVar} ${userProp} ?v1]
       [(clojure.string/includes? ?v1 "${escapedValue}")])
  (and [${entityVar} ${logseqProp} ?v2]
       [(clojure.string/includes? ?v2 "${escapedValue}")]))`;

            default:
                return null;
        }
    }

    /**
     * Build boolean property clause
     */
    static buildBooleanPropertyClause(entityVar, propIdent, value) {
        const boolVal = value === 'checked';
        return `[${entityVar} ${propIdent} ${boolVal}]`;
    }

    /**
     * Build reference property clause (entity lookup pattern)
     */
    static buildRefPropertyClause(entityVar, propIdent, value, cardinality) {
        if (!value) return null;

        if (Array.isArray(value) && value.length > 0) {
            // Multiple values - OR query
            const clauses = value.map(v => {
                const escaped = this.escapeString(v);
                return `(and [${entityVar} ${propIdent} ?ref] [?ref :block/title "${escaped}"])`;
            }).join('\n  ');
            return `(or-join [${entityVar}]
  ${clauses})`;
        } else {
            // Single value - entity lookup
            const escaped = this.escapeString(value);
            return `[${entityVar} ${propIdent} ?val]
 [?val :block/title "${escaped}"]`;
        }
    }

    /**
     * Build number property clause
     */
    static buildNumberPropertyClause(entityVar, propIdent, value, operator) {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) return null;

        const op = operator === 'is' ? '=' : operator;
        return `[${entityVar} ${propIdent} ?num]
 [(${op} ?num ${numVal})]`;
    }

    /**
     * Build date property clause
     */
    static buildDatePropertyClause(entityVar, propIdent, value, operator) {
        const timestamp = new Date(value).getTime();
        if (isNaN(timestamp)) return null;

        const op = operator === 'is' ? '=' : operator;
        return `[${entityVar} ${propIdent} ?date]
 [(${op} ?date ${timestamp})]`;
    }

    /**
     * Compute Unix ms timestamp for a date offset from now.
     * Returns the start-of-day in local time (midnight) for stable day-aligned windows.
     */
    static computeOffsetMs(offsetDays) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + offsetDays);
        return d.getTime();
    }

    /**
     * Build the ms comparison clauses for a relative-date preset.
     * Pure: does not touch this.varCounter. Caller supplies the timestamp-var name.
     * Returns the comparison clauses only (not the base pattern).
     * Comparison values are tagged ONLY when used (so unused inputs don't leak
     * into :in / :inputs).
     */
    static buildRelativeMsComparisons(filter, tsVar) {
        const todayStart = () => this.tagLiteral(this.computeOffsetMs(0), 'start-of-today-ms');
        const tomorrowStart = () => this.tagLiteral(this.computeOffsetMs(1), '+1d-start');

        switch (filter.relativeDatePreset) {
            case 'after-today':
                return `[(>= ${tsVar} ${tomorrowStart()})]`;
            case 'before-today':
                return `[(< ${tsVar} ${todayStart()})]`;
            case 'today':
                return `[(>= ${tsVar} ${todayStart()})]\n [(< ${tsVar} ${tomorrowStart()})]`;
            case 'last-n-days': {
                const start = this.tagLiteral(
                    this.computeOffsetMs(-filter.relativeDateDays),
                    `-${filter.relativeDateDays}d-start`
                );
                return `[(>= ${tsVar} ${start})]\n [(< ${tsVar} ${tomorrowStart()})]`;
            }
            case 'next-n-days': {
                const end = this.tagLiteral(
                    this.computeOffsetMs(filter.relativeDateDays + 1),
                    `+${filter.relativeDateDays + 1}d-start`
                );
                return `[(>= ${tsVar} ${todayStart()})]\n [(< ${tsVar} ${end})]`;
            }
            case 'range': {
                const rangeStart = this.tagLiteral(
                    this.computeOffsetMs(-filter.relativeDateStart),
                    `-${filter.relativeDateStart}d-start`
                );
                const rangeEnd = this.tagLiteral(
                    this.computeOffsetMs(filter.relativeDateEnd + 1),
                    `+${filter.relativeDateEnd + 1}d-start`
                );
                return `[(>= ${tsVar} ${rangeStart})]\n [(< ${tsVar} ${rangeEnd})]`;
            }
            default:
                return null;
        }
    }

    /**
     * Build relative-mode clause for a :db.type/instant property.
     * Wraps buildRelativeMsComparisons with the base pattern.
     */
    static buildInstantPropertyRelativeClause(entityVar, propIdent, filter, idx) {
        const tsVar = `?ts${idx}`;
        const comparisons = this.buildRelativeMsComparisons(filter, tsVar);
        if (comparisons === null) return null;
        return `[${entityVar} ${propIdent} ${tsVar}]\n ${comparisons}`;
    }

    /**
     * Build page reference clause. Three scope modes:
     *   'parent' — match the named page only (default, existing behavior)
     *   'parent+ext' — match the named page OR any descendant via :block/parent
     *   'ext-only' — match only descendants, excluding the named page itself
     * The two extension modes use Logseq's built-in recursive `parent` rule.
     */
    static buildPageReferenceClause(filter, entityVar) {
        const escapedValue = this.escapeString(filter.value);
        const scope = filter.scope || 'parent';
        const idx = this.varCounter++;
        const refVar = `?ref${idx}`;

        if (scope === 'parent') {
            return `[${entityVar} :block/refs ${refVar}]
 [${refVar} :block/name "${escapedValue}"]`;
        }

        this.usesParentRule = true;
        const targetVar = `?target${idx}`;

        if (scope === 'ext-only') {
            return `[${entityVar} :block/refs ${refVar}]
 [${targetVar} :block/name "${escapedValue}"]
 (parent ${targetVar} ${refVar})`;
        }

        // 'parent+ext'
        return `[${entityVar} :block/refs ${refVar}]
 [${targetVar} :block/name "${escapedValue}"]
 (or-join [${refVar} ${targetVar}]
   [(= ${refVar} ${targetVar})]
   (parent ${targetVar} ${refVar}))`;
    }

    /**
     * Build parent-page-reference clause.
     * Matches a block whose immediate parent block references the chosen page.
     */
    static buildParentPageReferenceClause(filter, entityVar) {
        const escapedValue = this.escapeString((filter.value || '').toLowerCase());
        const idx = this.varCounter++;
        const parentVar = `?pp${idx}`;
        const refVar = `?ppref${idx}`;
        return `[${entityVar} :block/parent ${parentVar}]
 [${parentVar} :block/refs ${refVar}]
 [${refVar} :block/name "${escapedValue}"]`;
    }

    /**
     * Build block-on-page clause.
     * Matches a block that lives on the chosen page.
     */
    static buildBlockOnPageClause(filter, entityVar) {
        const escapedValue = this.escapeString((filter.value || '').toLowerCase());
        const idx = this.varCounter++;
        const pageVar = `?bop${idx}`;
        return `[${entityVar} :block/page ${pageVar}]
 [${pageVar} :block/name "${escapedValue}"]`;
    }

    /**
     * Build task clause (status property in DB graphs)
     */
    static buildTaskClause(filter, entityVar) {
        // Handle both single value and array of values (multi-select)
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        const escapedValues = values.map(v => this.escapeString(v));

        const clauses = [];

        // Build tag filter based on checkbox states
        const hasExtensions = filter.includeExtensions || false;
        const hasAllStatus = filter.includeAllStatusProperties || false;

        if (!hasExtensions && !hasAllStatus) {
            // Neither checked: Only direct Task tag
            clauses.push(`[${entityVar} :block/tags ?t]
 [?t :block/title "Task"]`);
        } else {
            // Build or-join with appropriate branches
            const branches = [];

            // Always include direct Task tag
            branches.push(`(and [${entityVar} :block/tags ?t]
       [?t :block/title "Task"])`);

            // Add extends branch if checked
            if (hasExtensions) {
                branches.push(`(and [${entityVar} :block/tags ?child]
       [?child :logseq.property.class/extends ?parent]
       [?parent :block/title "Task"])`);
            }

            // Add class properties branch if checked
            if (hasAllStatus) {
                branches.push(`(and [${entityVar} :block/tags ?tag]
       [?tag :logseq.property.class/properties :logseq.property/status])`);
            }

            clauses.push(`(or-join [${entityVar}]
  ${branches.join('\n  ')})`);
        }

        // Add status filter.
        // Logseq treats Task-tagged blocks with no explicit :logseq.property/status
        // as having the default status "Todo" (see :logseq.property/default-value
        // on :logseq.property/status). When "Todo" is in the selection, OR-in the
        // no-status branch so the results match what Logseq's task views show.
        const includesTodo = escapedValues.includes('Todo');
        const noStatusBranch = `(not-join [${entityVar}] [${entityVar} :logseq.property/status _])`;

        let explicitStatusClause;
        if (escapedValues.length === 1) {
            explicitStatusClause = `(and [${entityVar} :logseq.property/status ?status]
       [?status :block/title "${escapedValues[0]}"])`;
        } else {
            const orClauses = escapedValues.map(v => `[?status :block/title "${v}"]`).join('\n           ');
            explicitStatusClause = `(and [${entityVar} :logseq.property/status ?status]
       (or ${orClauses}))`;
        }

        if (includesTodo) {
            clauses.push(`(or-join [${entityVar}]
  ${explicitStatusClause}
  ${noStatusBranch})`);
        } else {
            // Strip the (and ...) wrapper for the no-Todo case (preserves prior output shape)
            if (escapedValues.length === 1) {
                clauses.push(`[${entityVar} :logseq.property/status ?status]
 [?status :block/title "${escapedValues[0]}"]`);
            } else {
                const orClauses = escapedValues.map(v => `[?status :block/title "${v}"]`).join('\n ');
                clauses.push(`[${entityVar} :logseq.property/status ?status]
 (or ${orClauses})`);
            }
        }

        return clauses.join('\n ');
    }

    /**
     * Build priority clause
     */
    static buildPriorityClause(filter, entityVar) {
        // Handle both single value and array of values (multi-select)
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        const escapedValues = values.map(v => this.escapeString(v));

        if (escapedValues.length === 1) {
            // Single priority
            return `[${entityVar} :logseq.property/priority ?priority]
 [?priority :block/title "${escapedValues[0]}"]`;
        } else {
            // Multiple priorities - use OR
            const orClauses = escapedValues.map(v => `[?priority :block/title "${v}"]`).join('\n ');
            return `[${entityVar} :logseq.property/priority ?priority]
 (or ${orClauses})`;
        }
    }

    /**
     * Convert "YYYY-MM-DD" (from <input type="date">) to YYYYMMDD integer
     * using local-time parsing. new Date("YYYY-MM-DD") parses as UTC midnight,
     * which yields the previous day's date in negative-UTC-offset timezones.
     */
    static dateStringToYYYYMMDD(dateStr) {
        const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
        return y * 10000 + m * 100 + d;
    }

    /**
     * Build date range clause. Supports both absolute (mm/dd/yyyy pickers)
     * and relative (preset like "last 7 days") modes, across three date
     * properties: created-at, updated-at, journal-day.
     */
    static buildBetweenClause(filter, entityVar) {
        const { startDate, endDate, dateProperty = 'created-at', betweenDateMode = 'absolute' } = filter;
        const property = `:block/${dateProperty}`;
        const idx = this.varCounter++;

        if (betweenDateMode === 'relative') {
            if (dateProperty === 'journal-day') {
                const dayVar = `?jd${idx}`;
                const comparisons = this.buildRelativeDayComparisons(filter, dayVar);
                if (comparisons === null) return null;
                return `[${entityVar} ${property} ${dayVar}]\n ${comparisons}`;
            }
            // created-at / updated-at: ms values are tagged so the wrapped query
            // can substitute them with Logseq input keywords (:start-of-today-ms,
            // :-7d-start, :+1d-start, etc.). The window slides on every regen.
            const tsVar = `?ts${idx}`;
            const comparisons = this.buildRelativeMsComparisons(filter, tsVar);
            if (comparisons === null) return null;
            return `[${entityVar} ${property} ${tsVar}]\n ${comparisons}`;
        }

        // Absolute mode
        if (dateProperty === 'journal-day') {
            // :block/journal-day stores YYYYMMDD integers, not ms timestamps
            const start = this.dateStringToYYYYMMDD(startDate);
            const end = this.dateStringToYYYYMMDD(endDate);
            return `[${entityVar} ${property} ?date${idx}]
 [(>= ?date${idx} ${start})]
 [(<= ?date${idx} ${end})]`;
        }

        // created-at / updated-at are stored as Unix milliseconds
        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();
        return `[${entityVar} ${property} ?date${idx}]
 [(>= ?date${idx} ${startTimestamp})]
 [(<= ?date${idx} ${endTimestamp})]`;
    }

    /**
     * Combine clauses with AND logic
     */
    static combineWithAND(clauses) {
        return clauses.join('\n ');
    }

    /**
     * Combine clauses with OR logic using or-join
     */
    static combineWithOR(clauses, entityVar) {
        if (clauses.length === 1) {
            return clauses[0];
        }

        const branches = clauses.map(clause => {
            // Wrap each clause in (and ...) for or-join
            const lines = clause.split('\n').map(line => '  ' + line).join('\n');
            return `(and\n${lines})`;
        }).join('\n ');

        return `(or-join [${entityVar}]
 ${branches})`;
    }

    /**
     * Combine clauses with NOT logic using not-join
     * NOT matches entities that do NOT match ANY of the contained clauses
     */
    static combineWithNOT(clauses, entityVar) {
        // First, we need to bind the entity variable so not-join can reference it
        // Then exclude entities matching the clauses
        const combined = this.combineWithAND(clauses);
        return `[${entityVar} :block/uuid]
 (not-join [${entityVar}]
  ${combined})`;
    }

    /**
     * Compute YYYYMMDD integer for a date offset from today
     */
    static computeYYYYMMDD(offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return parseInt(
            `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`,
            10
        );
    }

    /**
     * Build the YYYYMMDD comparison clauses for a relative-date preset.
     * Pure: does not touch this.varCounter. Caller supplies the day-var name.
     * Returns the comparison clauses only (not the base pattern).
     * Comparison values are tagged so the wrapped query can substitute them
     * with Logseq input keywords (:today, :-7d, :+30d, etc.).
     */
    static buildRelativeDayComparisons(filter, dayVar) {
        const today = () => this.tagLiteral(this.computeYYYYMMDD(0), 'today');

        switch (filter.relativeDatePreset) {
            case 'after-today':
                return `[(> ${dayVar} ${today()})]`;
            case 'before-today':
                return `[(< ${dayVar} ${today()})]`;
            case 'today':
                return `[(= ${dayVar} ${today()})]`;
            case 'last-n-days': {
                const start = this.tagLiteral(
                    this.computeYYYYMMDD(-filter.relativeDateDays),
                    `-${filter.relativeDateDays}d`
                );
                return `[(>= ${dayVar} ${start})]\n [(<= ${dayVar} ${today()})]`;
            }
            case 'next-n-days': {
                const end = this.tagLiteral(
                    this.computeYYYYMMDD(filter.relativeDateDays),
                    `+${filter.relativeDateDays}d`
                );
                return `[(>= ${dayVar} ${today()})]\n [(<= ${dayVar} ${end})]`;
            }
            case 'range': {
                const rangeStart = this.tagLiteral(
                    this.computeYYYYMMDD(-filter.relativeDateStart),
                    `-${filter.relativeDateStart}d`
                );
                const rangeEnd = this.tagLiteral(
                    this.computeYYYYMMDD(filter.relativeDateEnd),
                    `+${filter.relativeDateEnd}d`
                );
                return `[(>= ${dayVar} ${rangeStart})]\n [(<= ${dayVar} ${rangeEnd})]`;
            }
            default:
                return null;
        }
    }

    /**
     * Build journal-date clause for relative date filtering on a property.
     * Pattern: entity → property → journal page → :block/journal-day → comparisons.
     */
    static buildJournalDateClause(entityVar, propIdent, filter) {
        const idx = this.varCounter++;
        const refVar = `?jdref${idx}`;
        const dayVar = `?jd${idx}`;

        const basePattern = `[${entityVar} ${propIdent} ${refVar}]\n [${refVar} :block/journal-day ${dayVar}]`;
        const comparisons = this.buildRelativeDayComparisons(filter, dayVar);
        if (comparisons === null) return null;

        return `${basePattern}\n ${comparisons}`;
    }

    /**
     * Escape special characters in strings for Datalog
     */
    static escapeString(str) {
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Escape regex special characters for literal matching
     */
    static escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Export as global
window.QueryGenerator = QueryGenerator;
