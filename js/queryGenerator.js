/**
 * Query Generator - Convert filter state to Datalog queries
 */

class QueryGenerator {
    /**
     * Generate Datalog query from filters
     * @param {Array} filters - Array of filter objects
     * @param {string} matchMode - 'all' (AND) or 'any' (OR)
     * @param {boolean} wrapForLogseq - Whether to wrap in {:query ...} for Logseq
     * @returns {string|object} Query string or object with raw and wrapped versions
     */
    static generate(filters, matchMode = 'all', wrapForLogseq = false) {
        if (!filters || filters.length === 0) {
            return null;
        }

        // Filter out empty/invalid filters
        const validFilters = filters.filter(f => this.isValidFilter(f));
        
        if (validFilters.length === 0) {
            return null;
        }

        // Determine entity type (pages vs blocks)
        const entityType = this.determineEntityType(validFilters);
        const entityVar = entityType === 'page' ? '?p' : '?b';

        // Build :find clause
        const findClause = this.buildFindClause(entityVar);

        // Build :where clauses
        const whereClauses = validFilters.map(filter => 
            this.buildWhereClause(filter, entityVar)
        ).filter(clause => clause !== null);

        if (whereClauses.length === 0) {
            return null;
        }

        // Combine clauses based on match mode
        const whereSection = matchMode === 'all' 
            ? this.combineWithAND(whereClauses)
            : this.combineWithOR(whereClauses, entityVar);

        // Build raw datalog query (for API)
        const rawQuery = `[:find ${findClause}
 :where
 ${whereSection}]`;

        // Build wrapped query (for Logseq)
        const wrappedQuery = `{:query
 [:find ${findClause}
  :where
  ${whereSection}]}`;

        // Return both versions
        return {
            raw: rawQuery,
            wrapped: wrappedQuery
        };
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
                return filter.propertyName && 
                       filter.propertyName.trim().length > 0 && 
                       filter.value && 
                       filter.value.trim().length > 0;
            
            case 'task':
            case 'priority':
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
        return `[${entityVar} :block/tags ?t]
 [?t :block/title "${escapedValue}"]`;
    }

    /**
     * Build full text search clause
     */
    static buildFullTextClause(filter, entityVar) {
        const escapedValue = this.escapeString(filter.value);
        return `[${entityVar} :block/title ?title]
 [(clojure.string/includes? ?title "${escapedValue}")]`;
    }

    /**
     * Build property clause
     */
    static buildPropertyClause(filter, entityVar) {
        const { propertyName, operator = 'is', value } = filter;
        
        // Try both user.property and logseq.property namespaces
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
     * Build page reference clause
     */
    static buildPageReferenceClause(filter, entityVar) {
        const escapedValue = this.escapeString(filter.value);
        return `[${entityVar} :block/refs ?ref]
 [?ref :block/name "${escapedValue}"]`;
    }

    /**
     * Build task clause (tags-based in DB graphs)
     */
    static buildTaskClause(filter, entityVar) {
        const escapedValue = this.escapeString(filter.value);
        return `[${entityVar} :block/tags ?task]
 [?task :block/title "${escapedValue}"]`;
    }

    /**
     * Build priority clause
     */
    static buildPriorityClause(filter, entityVar) {
        const escapedValue = this.escapeString(filter.value);
        return `[${entityVar} :block/priority "${escapedValue}"]`;
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
}

// Export as global
window.QueryGenerator = QueryGenerator;
