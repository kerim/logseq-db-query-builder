/**
 * Query Generator - Convert filter state to Datalog queries
 * Supports recursive group structures with AND/OR/NOT logic
 */

class QueryGenerator {
    /**
     * Generate Datalog query from root group (tree structure)
     * @param {Object} rootGroup - Root group containing nested groups and filters
     * @returns {Object|null} Object with raw and wrapped query versions, or null if invalid
     */
    static varCounter = 0;

    static generate(rootGroup) {
        if (!rootGroup || rootGroup.type !== 'group') {
            return null;
        }

        // Reset variable counter for unique journal-date variable names
        this.varCounter = 0;

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

        // Build recursive where section from group tree (raw, with computed literals)
        const whereSection = this.buildGroupClause(rootGroup, entityVar);

        if (!whereSection) {
            return null;
        }

        // Build raw datalog query (for API)
        const rawQuery = `[:find ${findClause}
 :where
 ${whereSection}]`;

        // Re-indent where section for wrapped query: normalize all lines to 3-space indent
        const wrappedWhereLines = whereSection.split('\n').map(line => {
            const trimmed = line.trimStart();
            return trimmed.length > 0 ? '   ' + trimmed : '';
        }).join('\n');

        // Build wrapped query (for Logseq)
        // If relative date filters exist, replace today's literal with ?today variable
        // and add :in $ ?today / :inputs [:today]
        let wrappedQuery;
        if (this.hasRelativeDateFilter(rootGroup)) {
            const todayLiteral = String(this.computeYYYYMMDD(0));
            const wrappedWhere = wrappedWhereLines.replaceAll(todayLiteral, '?today');
            // Only add :inputs [:today] if the replacement actually occurred
            if (wrappedWhere !== wrappedWhereLines) {
                wrappedQuery = `{:query
 [:find ${findClause}
  :in $ ?today
  :where
${wrappedWhere}]
 :inputs [:today]}`;
            } else {
                wrappedQuery = `{:query
 [:find ${findClause}
  :where
${wrappedWhereLines}]}`;
            }
        } else {
            wrappedQuery = `{:query
 [:find ${findClause}
  :where
${wrappedWhereLines}]}`;
        }

        // Return both versions
        return {
            raw: rawQuery,
            wrapped: wrappedQuery
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
                return filter.value && filter.value.trim().length > 0;
            
            case 'property':
                // Journal-date relative mode: no value needed for some presets
                if (filter.dateMode === 'relative' && filter.propertySchema?.isJournalDate) {
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
        const blockOnlyTypes = ['full-text', 'task', 'priority'];
        
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
        const escapedValue = this.escapeString(value);  // Escape quotes, etc.
        const regexEscaped = this.escapeRegex(escapedValue);  // Escape regex chars

        switch (operator) {
            case 'equals':
                // Case-insensitive exact match using anchored regex
                return `[${entityVar} :block/title ?title]
 [(re-pattern "(?i)^${regexEscaped}$") ?pattern]
 [(re-matches ?pattern ?title)]`;

            case 'contains':
            default:
                // Case-insensitive substring match using regex
                return `[${entityVar} :block/title ?title]
 [(re-pattern "(?i)${regexEscaped}") ?pattern]
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
     * Build page reference clause
     */
    static buildPageReferenceClause(filter, entityVar) {
        const escapedValue = this.escapeString(filter.value);
        return `[${entityVar} :block/refs ?ref]
 [?ref :block/name "${escapedValue}"]`;
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

        // Add status filter
        if (escapedValues.length === 1) {
            // Single status
            clauses.push(`[${entityVar} :logseq.property/status ?status]
 [?status :block/title "${escapedValues[0]}"]`);
        } else {
            // Multiple statuses - use OR
            const orClauses = escapedValues.map(v => `[?status :block/title "${v}"]`).join('\n ');
            clauses.push(`[${entityVar} :logseq.property/status ?status]
 (or ${orClauses})`);
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
     * Build date range clause
     */
    static buildBetweenClause(filter, entityVar) {
        const { startDate, endDate, dateProperty = 'created-at' } = filter;
        
        // Convert dates to Unix timestamps (milliseconds)
        const startTimestamp = new Date(startDate).getTime();
        const endTimestamp = new Date(endDate).getTime();
        
        const property = `:block/${dateProperty}`;
        
        return `[${entityVar} ${property} ?date]
 [(>= ?date ${startTimestamp})]
 [(<= ?date ${endTimestamp})]`;
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
     * Build journal-date clause for relative date filtering
     * Uses :block/journal-day on the referenced journal page
     */
    static buildJournalDateClause(entityVar, propIdent, filter) {
        const idx = this.varCounter++;
        const refVar = `?jdref${idx}`;
        const dayVar = `?jd${idx}`;

        // Base pattern: entity has property referencing a journal page
        const basePattern = `[${entityVar} ${propIdent} ${refVar}]\n [${refVar} :block/journal-day ${dayVar}]`;

        const today = this.computeYYYYMMDD(0);
        let comparisons;

        switch (filter.relativeDatePreset) {
            case 'after-today':
                comparisons = `[(> ${dayVar} ${today})]`;
                break;
            case 'before-today':
                comparisons = `[(< ${dayVar} ${today})]`;
                break;
            case 'today':
                comparisons = `[(= ${dayVar} ${today})]`;
                break;
            case 'last-n-days': {
                const start = this.computeYYYYMMDD(-filter.relativeDateDays);
                comparisons = `[(>= ${dayVar} ${start})]\n [(<= ${dayVar} ${today})]`;
                break;
            }
            case 'next-n-days': {
                const end = this.computeYYYYMMDD(filter.relativeDateDays);
                comparisons = `[(>= ${dayVar} ${today})]\n [(<= ${dayVar} ${end})]`;
                break;
            }
            case 'range': {
                const rangeStart = this.computeYYYYMMDD(-filter.relativeDateStart);
                const rangeEnd = this.computeYYYYMMDD(filter.relativeDateEnd);
                comparisons = `[(>= ${dayVar} ${rangeStart})]\n [(<= ${dayVar} ${rangeEnd})]`;
                break;
            }
            default:
                return null;
        }

        return `${basePattern}\n ${comparisons}`;
    }

    /**
     * Check if any filter in the tree uses relative journal-date mode
     */
    static hasRelativeDateFilter(node) {
        if (!node) return false;
        if (node.type === 'group' && node.children) {
            return node.children.some(child => this.hasRelativeDateFilter(child));
        }
        return node.dateMode === 'relative' && node.propertySchema?.isJournalDate;
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
