/**
 * Filter UI Management
 * Handles creation, rendering, and management of filter rows
 */

const FILTER_TYPES = {
    'page': {
        label: 'page',
        operators: ['is', 'contains', 'starts-with', 'ends-with'],
        inputs: ['operator', 'value']
    },
    'tags': {
        label: 'tags',
        operators: null,
        inputs: ['value-autocomplete']
    },
    'full-text': {
        label: 'full text search',
        operators: ['contains', 'equals'],
        inputs: ['operator', 'value']
    },
    'property': {
        label: 'property',
        operators: ['is', 'contains'],
        inputs: ['property-name', 'operator', 'value']
    },
    'page-reference': {
        label: 'page reference',
        operators: null,
        inputs: ['value-autocomplete']
    },
    'task': {
        label: 'task',
        operators: null,
        inputs: ['task-status-select']
    },
    'priority': {
        label: 'priority',
        operators: null,
        inputs: ['priority-select']
    },
    'between': {
        label: 'between (dates)',
        operators: null,
        inputs: ['between-mode-toggle', 'between-value-area', 'date-property-select']
    }
};

class FilterManager {
    constructor(containerId, onChange) {
        this.container = document.getElementById(containerId);
        this.onChange = onChange; // Callback when filters change
        this.idCounter = 0;

        // Initialize with root group (always exists)
        this.rootGroup = this.createGroup('root', 'all');
    }

    // ========================================
    // Tree Structure Methods
    // ========================================

    /**
     * Create a new group object
     */
    createGroup(id = null, matchMode = 'all') {
        return {
            id: id || `group-${this.idCounter++}`,
            type: 'group',
            matchMode: matchMode,
            children: []
        };
    }

    /**
     * Create a new filter object
     */
    createFilter(filterType = '') {
        return {
            id: `filter-${this.idCounter++}`,
            type: filterType,
            operator: null,
            value: '',
            propertyName: '',
            startDate: '',
            endDate: '',
            dateProperty: 'created-at',
            betweenDateMode: 'absolute',
            relativeDatePreset: null,
            relativeDateDays: 7,
            relativeDateStart: 7,
            relativeDateEnd: 7
        };
    }

    /**
     * Find a group by ID (recursive)
     */
    findGroup(node, targetId) {
        if (node.id === targetId && node.type === 'group') {
            return node;
        }
        if (node.type === 'group' && node.children) {
            for (const child of node.children) {
                const found = this.findGroup(child, targetId);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Find any item (filter or group) by ID (recursive)
     */
    findItem(node, targetId) {
        if (node.id === targetId) {
            return node;
        }
        if (node.type === 'group' && node.children) {
            for (const child of node.children) {
                const found = this.findItem(child, targetId);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Remove an item from a group by ID (recursive)
     * Returns true if item was found and removed
     */
    removeFromGroup(group, targetId) {
        const index = group.children.findIndex(c => c.id === targetId);
        if (index !== -1) {
            group.children.splice(index, 1);
            return true;
        }
        for (const child of group.children) {
            if (child.type === 'group') {
                if (this.removeFromGroup(child, targetId)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Get all filters flattened (for validation/entity detection)
     */
    getAllFilters(node = this.rootGroup) {
        const filters = [];
        if (node.type === 'group' && node.children) {
            for (const child of node.children) {
                if (child.type === 'group') {
                    filters.push(...this.getAllFilters(child));
                } else {
                    filters.push(child);
                }
            }
        } else if (node.type !== 'group') {
            filters.push(node);
        }
        return filters;
    }

    // ========================================
    // Public API Methods
    // ========================================

    /**
     * Add a new filter to a group
     */
    addFilter(groupId = 'root', filterType = '') {
        const group = this.findGroup(this.rootGroup, groupId);
        if (!group) {
            console.error('Group not found:', groupId);
            return null;
        }

        const filter = this.createFilter(filterType);
        group.children.push(filter);
        this.render();
        this.notifyChange();

        return filter;
    }

    /**
     * Add a new nested group
     */
    addGroup(parentGroupId = 'root', matchMode = 'any') {
        const parentGroup = this.findGroup(this.rootGroup, parentGroupId);
        if (!parentGroup) {
            console.error('Parent group not found:', parentGroupId);
            return null;
        }

        const newGroup = this.createGroup(null, matchMode);
        parentGroup.children.push(newGroup);
        this.render();
        this.notifyChange();

        return newGroup;
    }

    /**
     * Remove a filter or group by ID
     */
    removeItem(itemId) {
        // Don't allow removing root group
        if (itemId === 'root') {
            console.warn('Cannot remove root group');
            return;
        }

        this.removeFromGroup(this.rootGroup, itemId);
        this.render();
        this.notifyChange();
    }

    /**
     * Change a group's match mode
     */
    setMatchMode(groupId, matchMode) {
        const group = this.findGroup(this.rootGroup, groupId);
        if (group) {
            group.matchMode = matchMode;
            this.render();
            this.notifyChange();
        }
    }

    /**
     * Clear all filters (reset to empty root group)
     */
    clearAll() {
        this.rootGroup = this.createGroup('root', 'all');
        this.render();
        this.notifyChange();
    }

    /**
     * Get the root group (for query generator)
     */
    getRootGroup() {
        return this.rootGroup;
    }

    /**
     * Get all filters (flattened, for backward compatibility)
     * @deprecated Use getRootGroup() for tree structure
     */
    getFilters() {
        return this.getAllFilters();
    }

    /**
     * Render filter-specific inputs
     */
    renderFilterInputs(filter, container) {
        const config = FILTER_TYPES[filter.type];
        if (!config) return;

        config.inputs.forEach(inputType => {
            switch (inputType) {
                case 'operator':
                    const operatorSelect = document.createElement('select');
                    operatorSelect.className = 'select-input-small';
                    operatorSelect.innerHTML = config.operators.map(op => 
                        `<option value="${op}" ${filter.operator === op ? 'selected' : ''}>${op}</option>`
                    ).join('');
                    operatorSelect.addEventListener('change', (e) => {
                        filter.operator = e.target.value;
                        this.notifyChange();
                    });
                    // Set default operator if not set
                    if (!filter.operator && config.operators.length > 0) {
                        filter.operator = config.operators[0];
                    }
                    container.appendChild(operatorSelect);
                    break;

                case 'value':
                    // For property filters, skip this - renderPropertyValueInput() will handle it
                    if (filter.type === 'property') {
                        // Render type-specific input based on property schema
                        this.renderPropertyValueInput(filter, container);
                    } else {
                        // Standard text input for other filter types
                        const valueInput = document.createElement('input');
                        valueInput.type = 'text';
                        valueInput.className = 'filter-input';
                        valueInput.placeholder = 'Enter value...';
                        valueInput.value = filter.value || '';
                        valueInput.addEventListener('input', (e) => {
                            filter.value = e.target.value;
                            this.notifyChange();
                        });
                        container.appendChild(valueInput);
                    }
                    break;

                case 'value-autocomplete':
                    const autocompleteInput = document.createElement('input');
                    autocompleteInput.type = 'text';
                    autocompleteInput.className = 'filter-input';
                    autocompleteInput.placeholder = 'Type to search...';
                    autocompleteInput.value = filter.value || '';
                    autocompleteInput.setAttribute('data-autocomplete', filter.type);
                    autocompleteInput.addEventListener('input', (e) => {
                        filter.value = e.target.value;
                        this.notifyChange();
                    });
                    container.appendChild(autocompleteInput);

                    // Add "Include extensions" checkbox for tags and page-reference filters
                    if (filter.type === 'tags' || filter.type === 'page-reference') {
                        const extensionsWrapper = document.createElement('div');
                        extensionsWrapper.className = 'extensions-checkbox-wrapper';

                        const extensionsLabel = document.createElement('label');
                        extensionsLabel.className = 'checkbox-label extensions-checkbox';

                        const extensionsCheckbox = document.createElement('input');
                        extensionsCheckbox.type = 'checkbox';
                        extensionsCheckbox.checked = filter.includeExtensions || false;
                        extensionsCheckbox.addEventListener('change', (e) => {
                            filter.includeExtensions = e.target.checked;
                            this.notifyChange();
                        });

                        extensionsLabel.appendChild(extensionsCheckbox);
                        extensionsLabel.appendChild(document.createTextNode(' Include extensions'));
                        extensionsWrapper.appendChild(extensionsLabel);
                        container.appendChild(extensionsWrapper);
                    }

                    // Add property suggestions hint for tags
                    if (filter.type === 'tags') {
                        const propertiesHintContainer = document.createElement('div');
                        propertiesHintContainer.className = 'property-suggestions-hint';
                        propertiesHintContainer.style.marginTop = '8px';
                        propertiesHintContainer.style.fontSize = '0.9em';
                        propertiesHintContainer.style.color = 'var(--text-muted)';
                        container.appendChild(propertiesHintContainer);

                        // Function to update property suggestions
                        const updatePropertySuggestions = async () => {
                            const tagValue = filter.value?.trim();
                            if (!tagValue || !window.app?.state?.graph) {
                                propertiesHintContainer.textContent = '';
                                return;
                            }

                            try {
                                const properties = await window.app.api.getTagProperties(
                                    window.app.state.graph,
                                    tagValue
                                );
                                console.log('[PROP-SUGGESTIONS] Raw properties:', properties);

                                if (properties && properties.length > 0) {
                                    // Format property names for display
                                    const propNames = properties.map(prop => {
                                        console.log('[PROP-SUGGESTIONS] Processing prop:', prop, typeof prop);
                                        // Handle different formats:
                                        // 1. String identifier directly
                                        if (typeof prop === 'string') {
                                            const parts = prop.split('/');
                                            if (parts.length === 2) {
                                                return parts[1].replace(/-[A-Za-z0-9_]+$/, '');
                                            }
                                            return prop;
                                        }
                                        // 2. Object with short keys (title/ident)
                                        if (prop.title) {
                                            return prop.title;
                                        }
                                        // 3. Object with db/ident
                                        const ident = prop[':db/ident'] || prop['db/ident'] || prop['ident'];
                                        if (ident) {
                                            const parts = ident.split('/');
                                            if (parts.length === 2) {
                                                return parts[1].replace(/-[A-Za-z0-9_]+$/, '');
                                            }
                                            return ident;
                                        }
                                        // 4. Object with block/title
                                        const title = prop[':block/title'] || prop['block/title'];
                                        if (title) {
                                            return title;
                                        }
                                        // 4. Fallback - stringify to see what it is
                                        console.warn('[PROP-SUGGESTIONS] Unknown prop format:', JSON.stringify(prop));
                                        return null;
                                    }).filter(name => name && typeof name === 'string'); // Remove nulls and non-strings

                                    if (propNames.length > 0) {
                                        propertiesHintContainer.innerHTML = `<span style="opacity: 0.7;">💡 Associated properties:</span> ${propNames.join(', ')}`;
                                    } else {
                                        propertiesHintContainer.textContent = '';
                                    }
                                } else {
                                    propertiesHintContainer.textContent = '';
                                }
                            } catch (error) {
                                console.warn('Failed to get tag properties:', error);
                                propertiesHintContainer.textContent = '';
                            }
                        };

                        // Listen for tag value changes
                        autocompleteInput.addEventListener('blur', updatePropertySuggestions);

                        // Also update when autocomplete selection happens (via custom event)
                        autocompleteInput.addEventListener('autocomplete-selected', updatePropertySuggestions);

                        // Initial update if value already exists
                        if (filter.value) {
                            updatePropertySuggestions();
                        }
                    }
                    break;

                case 'property-name':
                    const propNameInput = document.createElement('input');
                    propNameInput.type = 'text';
                    propNameInput.className = 'filter-input';
                    propNameInput.placeholder = 'Select property...';
                    propNameInput.value = filter.propertyName || '';
                    propNameInput.setAttribute('data-autocomplete', 'property');  // Enable autocomplete

                    propNameInput.addEventListener('input', async (e) => {
                        console.log('[PROP-INPUT] === Handler Start ===');
                        console.log('[PROP-INPUT] value:', e.target.value);

                        filter.propertyName = e.target.value;

                        // Get full property identifier from autocomplete
                        const propertyIdent = e.target.getAttribute('data-property-ident');
                        console.log('[PROP-INPUT] propertyIdent:', propertyIdent);
                        console.log('[PROP-INPUT] graph:', window.app.state.graph);

                        if (propertyIdent) {
                            filter.propertyIdent = propertyIdent;
                        }

                        // Discover property type. Try authoritative schema lookup first
                        // (works for zero-value properties and user properties with UUID
                        // suffixes); fall back to sample-value inference if the schema's
                        // :logseq.property/type is missing or unrecognized.
                        if (propertyIdent && window.app.state.graph) {
                            console.log('[PROP-INPUT] Entering async block...');
                            try {
                                const authoritative = await window.app.api.getPropertySchemaByIdent(
                                    window.app.state.graph, propertyIdent
                                );
                                console.log('[PROP-INPUT] Authoritative schema:', authoritative);

                                if (authoritative && authoritative.valueType) {
                                    filter.propertySchema = {
                                        name: filter.propertyName,
                                        ident: propertyIdent,
                                        valueType: authoritative.valueType,
                                        cardinality: authoritative.cardinality || ':db.cardinality/one',
                                        isJournalDate: authoritative.isJournalDate,
                                        logseqType: authoritative.logseqType
                                    };
                                    console.log('[PROP-INPUT] Schema SET (authoritative):', filter.propertySchema);
                                    this.renderPropertyValueInput(filter, container);
                                    this.notifyChange();
                                } else {
                                    // Fall back to sample-value inference
                                    const queryIdent = propertyIdent.startsWith(':') ? propertyIdent : `:${propertyIdent}`;
                                    const sampleQuery = `[:find (pull ?b [{${queryIdent} [:db/id :block/journal-day :block/title]}]) :where [?b ${queryIdent}] :limit 1]`;
                                    console.log('[PROP-INPUT] Fallback sample query:', sampleQuery);

                                    const sampleResult = await window.app.api.executeQuery(window.app.state.graph, sampleQuery);

                                    if (sampleResult.data && sampleResult.data.length > 0) {
                                        const strippedIdent = propertyIdent.startsWith(':') ? propertyIdent.slice(1) : propertyIdent;
                                        const sampleValue = sampleResult.data[0][propertyIdent] || sampleResult.data[0][strippedIdent];

                                        let valueType = ':db.type/string';
                                        let cardinality = ':db.cardinality/one';
                                        let isJournalDate = false;

                                        if (Array.isArray(sampleValue)) {
                                            cardinality = ':db.cardinality/many';
                                            if (sampleValue.length > 0 && typeof sampleValue[0] === 'object' &&
                                                (sampleValue[0][':db/id'] || sampleValue[0]['db/id'] || sampleValue[0]['id'])) {
                                                valueType = ':db.type/ref';
                                                if (sampleValue[0]['block/journal-day'] !== undefined ||
                                                    sampleValue[0][':block/journal-day'] !== undefined ||
                                                    sampleValue[0]['journal-day'] !== undefined) {
                                                    isJournalDate = true;
                                                }
                                            }
                                        } else if (typeof sampleValue === 'object' &&
                                                   (sampleValue[':db/id'] || sampleValue['db/id'] || sampleValue['id'])) {
                                            valueType = ':db.type/ref';
                                            if (sampleValue['block/journal-day'] !== undefined ||
                                                sampleValue[':block/journal-day'] !== undefined ||
                                                sampleValue['journal-day'] !== undefined) {
                                                isJournalDate = true;
                                            }
                                        } else if (typeof sampleValue === 'boolean') {
                                            valueType = ':db.type/boolean';
                                        } else if (typeof sampleValue === 'number') {
                                            valueType = ':db.type/number';
                                        }

                                        filter.propertySchema = {
                                            name: filter.propertyName,
                                            ident: propertyIdent,
                                            valueType: valueType,
                                            cardinality: cardinality,
                                            isJournalDate: isJournalDate
                                        };
                                        console.log('[PROP-INPUT] Schema SET (sample inference):', filter.propertySchema);
                                        this.renderPropertyValueInput(filter, container);
                                        this.notifyChange();
                                    } else {
                                        console.log('[PROP-INPUT] No authoritative schema and no sample data');
                                        this.notifyChange();
                                    }
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
                    container.appendChild(propNameInput);
                    break;

                case 'priority-select':
                    // Initialize as array if not already
                    if (!filter.value) filter.value = [];
                    if (!Array.isArray(filter.value)) filter.value = [filter.value];

                    const priorityWrapper = document.createElement('div');
                    priorityWrapper.className = 'checkbox-group';

                    const priorities = ['Urgent', 'High', 'Medium', 'Low'];
                    priorities.forEach(priority => {
                        const label = document.createElement('label');
                        label.className = 'checkbox-label';

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = priority;
                        checkbox.checked = filter.value.includes(priority);
                        checkbox.addEventListener('change', (e) => {
                            if (e.target.checked) {
                                if (!filter.value.includes(priority)) {
                                    filter.value.push(priority);
                                }
                            } else {
                                filter.value = filter.value.filter(v => v !== priority);
                            }
                            this.notifyChange();
                        });

                        label.appendChild(checkbox);
                        label.appendChild(document.createTextNode(' ' + priority));
                        priorityWrapper.appendChild(label);
                    });

                    container.appendChild(priorityWrapper);
                    break;

                case 'task-status-select':
                    // Initialize as array if not already
                    if (!filter.value) filter.value = [];
                    if (!Array.isArray(filter.value)) filter.value = [filter.value];

                    const taskStatusWrapper = document.createElement('div');
                    taskStatusWrapper.className = 'checkbox-group';

                    const statuses = ['Backlog', 'Todo', 'Doing', 'In Review', 'Done', 'Canceled'];
                    statuses.forEach(status => {
                        const label = document.createElement('label');
                        label.className = 'checkbox-label';

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.value = status;
                        checkbox.checked = filter.value.includes(status);
                        checkbox.addEventListener('change', (e) => {
                            if (e.target.checked) {
                                if (!filter.value.includes(status)) {
                                    filter.value.push(status);
                                }
                            } else {
                                filter.value = filter.value.filter(v => v !== status);
                            }
                            this.notifyChange();
                        });

                        label.appendChild(checkbox);
                        label.appendChild(document.createTextNode(' ' + status));
                        taskStatusWrapper.appendChild(label);
                    });

                    container.appendChild(taskStatusWrapper);

                    // Add "Include extensions" checkbox in separate column
                    const extensionsWrapper = document.createElement('div');
                    extensionsWrapper.className = 'extensions-checkbox-column';

                    const extensionsLabel = document.createElement('label');
                    extensionsLabel.className = 'checkbox-label extensions-checkbox';

                    const extensionsCheckbox = document.createElement('input');
                    extensionsCheckbox.type = 'checkbox';
                    extensionsCheckbox.checked = filter.includeExtensions || false;
                    extensionsCheckbox.addEventListener('change', (e) => {
                        filter.includeExtensions = e.target.checked;
                        this.notifyChange();
                    });

                    extensionsLabel.appendChild(extensionsCheckbox);
                    extensionsLabel.appendChild(document.createTextNode(' Include extensions (e.g., Task → shopping)'));
                    extensionsWrapper.appendChild(extensionsLabel);

                    // Add "Include all status properties" checkbox
                    const allStatusLabel = document.createElement('label');
                    allStatusLabel.className = 'checkbox-label extensions-checkbox';

                    const allStatusCheckbox = document.createElement('input');
                    allStatusCheckbox.type = 'checkbox';
                    allStatusCheckbox.checked = filter.includeAllStatusProperties || false;
                    allStatusCheckbox.addEventListener('change', (e) => {
                        filter.includeAllStatusProperties = e.target.checked;
                        this.notifyChange();
                    });

                    allStatusLabel.appendChild(allStatusCheckbox);
                    allStatusLabel.appendChild(document.createTextNode(' Include all status properties'));
                    extensionsWrapper.appendChild(allStatusLabel);

                    container.appendChild(extensionsWrapper);
                    break;

                case 'between-mode-toggle': {
                    if (!filter.betweenDateMode) filter.betweenDateMode = 'absolute';

                    const modeWrapper = document.createElement('div');
                    modeWrapper.className = 'between-mode-toggle';
                    modeWrapper.style.cssText = 'display: flex; align-items: center; gap: var(--spacing-sm);';

                    const modeLabel = document.createElement('span');
                    modeLabel.textContent = 'Mode:';
                    modeLabel.style.color = 'var(--text-muted, #888)';

                    const modeSelect = document.createElement('select');
                    modeSelect.className = 'select-input-small between-mode-select';

                    const absoluteOpt = document.createElement('option');
                    absoluteOpt.value = 'absolute';
                    absoluteOpt.textContent = 'Absolute';
                    absoluteOpt.selected = filter.betweenDateMode === 'absolute';

                    const relativeOpt = document.createElement('option');
                    relativeOpt.value = 'relative';
                    relativeOpt.textContent = 'Relative';
                    relativeOpt.selected = filter.betweenDateMode === 'relative';

                    modeSelect.appendChild(absoluteOpt);
                    modeSelect.appendChild(relativeOpt);

                    modeSelect.addEventListener('change', (e) => {
                        filter.betweenDateMode = e.target.value;
                        // Re-render the value area for this filter row
                        const valueArea = container.querySelector('.between-value-area');
                        if (valueArea) {
                            valueArea.textContent = '';
                            this.renderBetweenValueArea(filter, valueArea);
                        }
                        this.notifyChange();
                    });

                    modeWrapper.appendChild(modeLabel);
                    modeWrapper.appendChild(modeSelect);
                    container.appendChild(modeWrapper);
                    break;
                }

                case 'between-value-area': {
                    const valueArea = document.createElement('div');
                    valueArea.className = 'between-value-area';
                    valueArea.style.cssText = 'display: flex; align-items: center; gap: var(--spacing-sm);';
                    this.renderBetweenValueArea(filter, valueArea);
                    container.appendChild(valueArea);
                    break;
                }

                case 'date-property-select':
                    const datePropSelect = document.createElement('select');
                    datePropSelect.className = 'select-input-small';
                    datePropSelect.innerHTML = `
                        <option value="created-at" ${filter.dateProperty === 'created-at' ? 'selected' : ''}>created-at</option>
                        <option value="updated-at" ${filter.dateProperty === 'updated-at' ? 'selected' : ''}>updated-at</option>
                        <option value="journal-day" ${filter.dateProperty === 'journal-day' ? 'selected' : ''}>journal-day</option>
                    `;
                    datePropSelect.addEventListener('change', (e) => {
                        filter.dateProperty = e.target.value;
                        this.notifyChange();
                    });
                    container.appendChild(datePropSelect);
                    break;
            }
        });
    }

    /**
     * Render type-specific value input based on property schema
     */
    renderPropertyValueInput(filter, container) {
        console.log('renderPropertyValueInput called', {
            hasSchema: !!filter.propertySchema,
            schema: filter.propertySchema
        });

        // Remove existing value input
        const existing = container.querySelector('.property-value-input');
        if (existing) existing.remove();

        if (!filter.propertySchema) {
            console.log('No schema, rendering text input');
            this.renderTextInput(filter, container);
            return;
        }

        const schema = filter.propertySchema;
        console.log('Rendering type-specific input for', schema.valueType);

        switch (schema.valueType) {
            case ':db.type/boolean':
                this.renderCheckboxInput(filter, container);
                break;
            case ':db.type/ref':
                if (schema.isJournalDate) {
                    console.log('Rendering date-value input (ref-journal)');
                    this.renderDateValueInput(filter, container, schema);
                } else {
                    console.log('Rendering reference input');
                    this.renderReferenceInput(filter, container, schema);
                }
                break;
            case ':db.type/instant':
                console.log('Rendering date-value input (instant)');
                this.renderDateValueInput(filter, container, schema);
                break;
            case ':db.type/number':
                this.renderNumberInput(filter, container);
                break;
            default:
                this.renderTextInput(filter, container);
        }
    }

    /**
     * Render reference property input (dropdown for single, checkboxes for multi)
     */
    async renderReferenceInput(filter, container, schema) {
        const wrapper = document.createElement('div');
        wrapper.className = 'property-value-input';

        // Fetch possible values for this property
        const values = await window.app.api.getPropertyValues(
            window.app.state.graph,
            filter.propertySchema.ident
        );

        if (schema.cardinality === ':db.cardinality/one') {
            // Single value - dropdown
            const select = document.createElement('select');
            select.className = 'filter-input';

            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Select value...';
            select.appendChild(emptyOption);

            values.forEach(val => {
                const option = document.createElement('option');
                option.value = val.title;
                option.textContent = val.title;
                if (filter.value === val.title) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            select.addEventListener('change', (e) => {
                filter.value = e.target.value;
                this.notifyChange();
            });

            wrapper.appendChild(select);
        } else {
            // Multiple values - checkboxes
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'checkbox-group';

            if (!filter.value) filter.value = [];
            if (!Array.isArray(filter.value)) filter.value = [filter.value];

            values.forEach(val => {
                const label = document.createElement('label');
                label.className = 'checkbox-label';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = val.title;
                checkbox.checked = filter.value.includes(val.title);

                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        if (!filter.value.includes(val.title)) {
                            filter.value.push(val.title);
                        }
                    } else {
                        filter.value = filter.value.filter(v => v !== val.title);
                    }
                    this.notifyChange();
                });

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(' ' + val.title));
                checkboxGroup.appendChild(label);
            });

            wrapper.appendChild(checkboxGroup);
        }

        // Remove any existing value inputs before appending (handles async race conditions)
        const existingInputs = container.querySelectorAll('.property-value-input');
        existingInputs.forEach(el => el.remove());

        container.appendChild(wrapper);
    }

    /**
     * Render the value-area for a between filter, dispatching on betweenDateMode.
     * Absolute mode: two date pickers separated by "to".
     * Relative mode: reuses renderRelativeDateControls (same UI as journal-date property filter).
     */
    renderBetweenValueArea(filter, container) {
        if (filter.betweenDateMode === 'relative') {
            this.renderRelativeDateControls(filter, container);
            return;
        }

        const startInput = document.createElement('input');
        startInput.type = 'date';
        startInput.className = 'filter-input';
        startInput.value = filter.startDate || '';
        startInput.addEventListener('change', (e) => {
            filter.startDate = e.target.value;
            this.notifyChange();
        });

        const toLabel = document.createElement('span');
        toLabel.textContent = 'to';
        toLabel.style.padding = '0 8px';

        const endInput = document.createElement('input');
        endInput.type = 'date';
        endInput.className = 'filter-input';
        endInput.value = filter.endDate || '';
        endInput.addEventListener('change', (e) => {
            filter.endDate = e.target.value;
            this.notifyChange();
        });

        container.appendChild(startInput);
        container.appendChild(toLabel);
        container.appendChild(endInput);
    }

    /**
     * Render date-typed property input with Absolute/Relative mode toggle.
     * Handles both :db.type/instant (millisecond timestamps) and :db.type/ref
     * to journal pages (YYYYMMDD via the journal-day attribute).
     * The absolute branch dispatches on valueType for the right concrete UI.
     */
    renderDateValueInput(filter, container, schema) {
        const wrapper = document.createElement('div');
        wrapper.className = 'property-value-input date-value-input';

        // Default mode preserves current behavior per storage type:
        // - :db.type/instant (calendar picker today) → 'absolute'
        // - :db.type/ref + isJournalDate (relative today) → 'relative'
        if (!filter.dateMode) {
            filter.dateMode = (schema.valueType === ':db.type/instant') ? 'absolute' : 'relative';
        }

        // Mode toggle: Absolute | Relative
        const modeToggle = document.createElement('select');
        modeToggle.className = 'select-input-small date-mode-toggle';

        const absoluteOpt = document.createElement('option');
        absoluteOpt.value = 'absolute';
        absoluteOpt.textContent = 'Absolute';
        absoluteOpt.selected = filter.dateMode === 'absolute';

        const relativeOpt = document.createElement('option');
        relativeOpt.value = 'relative';
        relativeOpt.textContent = 'Relative';
        relativeOpt.selected = filter.dateMode === 'relative';

        modeToggle.appendChild(absoluteOpt);
        modeToggle.appendChild(relativeOpt);

        const updateOperatorVisibility = () => {
            const operatorSelect = container.querySelector('select.select-input-small:not(.date-mode-toggle)');
            if (operatorSelect) {
                operatorSelect.style.display = filter.dateMode === 'relative' ? 'none' : '';
            }
        };

        const contentArea = document.createElement('div');
        contentArea.className = 'date-mode-content';

        const renderModeContent = () => {
            contentArea.textContent = '';
            if (filter.dateMode === 'relative') {
                this.renderRelativeDateControls(filter, contentArea);
            } else if (schema.valueType === ':db.type/instant') {
                // Absolute mode for instant: simple date picker + operator
                this.renderInstantAbsoluteInto(filter, contentArea);
            } else {
                // Absolute mode for ref-to-journal: pick from existing journal pages
                this.renderReferenceInputInto(filter, contentArea, schema);
            }
            updateOperatorVisibility();
        };

        modeToggle.addEventListener('change', (e) => {
            filter.dateMode = e.target.value;
            if (filter.dateMode === 'relative') {
                filter.value = '';
            }
            renderModeContent();
            this.notifyChange();
        });

        wrapper.appendChild(modeToggle);
        wrapper.appendChild(contentArea);

        const existingInputs = container.querySelectorAll('.property-value-input');
        existingInputs.forEach(el => el.remove());

        container.appendChild(wrapper);

        renderModeContent();
    }

    /**
     * Render an absolute date-picker + operator pair into a target container.
     * Used by renderDateValueInput's absolute branch when valueType is :db.type/instant.
     */
    renderInstantAbsoluteInto(filter, targetContainer) {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; gap: var(--spacing-sm);';

        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'filter-input';
        operatorSelect.style.width = '80px';

        ['=', '<', '>', '<=', '>='].forEach(op => {
            const option = document.createElement('option');
            option.value = op;
            option.textContent = op === '=' ? 'is' : op;
            if (filter.operator === op || (op === '=' && !filter.operator)) {
                option.selected = true;
            }
            operatorSelect.appendChild(option);
        });

        operatorSelect.addEventListener('change', (e) => {
            filter.operator = e.target.value;
            this.notifyChange();
        });

        const dateInput = document.createElement('input');
        dateInput.type = 'date';
        dateInput.className = 'filter-input';
        dateInput.style.flex = '1';
        dateInput.value = filter.value || '';

        dateInput.addEventListener('change', (e) => {
            filter.value = e.target.value;
            this.notifyChange();
        });

        wrapper.appendChild(operatorSelect);
        wrapper.appendChild(dateInput);
        targetContainer.appendChild(wrapper);
    }

    /**
     * Render relative date controls (presets, number inputs)
     */
    renderRelativeDateControls(filter, container) {
        const controls = document.createElement('div');
        controls.className = 'relative-date-controls';

        // Initialize default preset
        if (!filter.relativeDatePreset) filter.relativeDatePreset = 'after-today';

        // Preset dropdown — built with DOM methods
        const presetSelect = document.createElement('select');
        presetSelect.className = 'filter-input';
        presetSelect.style.minWidth = '160px';
        presetSelect.style.flex = '0 0 auto';

        const presets = [
            { value: 'after-today', label: 'After today' },
            { value: 'before-today', label: 'Before today' },
            { value: 'today', label: 'Today (exact)' },
            { value: 'last-n-days', label: 'Last N days' },
            { value: 'next-n-days', label: 'Next N days' },
            { value: 'range', label: 'Custom range' }
        ];
        presets.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.value;
            opt.textContent = p.label;
            opt.selected = filter.relativeDatePreset === p.value;
            presetSelect.appendChild(opt);
        });

        // Container for dynamic inputs (N days or range)
        const dynamicInputs = document.createElement('div');
        dynamicInputs.className = 'relative-date-dynamic';

        const renderDynamicInputs = () => {
            dynamicInputs.textContent = '';
            const preset = filter.relativeDatePreset;

            if (preset === 'last-n-days' || preset === 'next-n-days') {
                const daysInput = document.createElement('input');
                daysInput.type = 'number';
                daysInput.className = 'filter-input';
                daysInput.style.width = '80px';
                daysInput.style.minWidth = '80px';
                daysInput.style.flex = '0 0 auto';
                daysInput.min = '1';
                daysInput.placeholder = 'N';
                daysInput.value = filter.relativeDateDays || '';
                daysInput.addEventListener('change', (e) => {
                    filter.relativeDateDays = parseInt(e.target.value, 10) || 0;
                    this.notifyChange();
                });

                const label = document.createElement('span');
                label.className = 'relative-date-label';
                label.textContent = 'days';

                dynamicInputs.appendChild(daysInput);
                dynamicInputs.appendChild(label);
            } else if (preset === 'range') {
                const startInput = document.createElement('input');
                startInput.type = 'number';
                startInput.className = 'filter-input';
                startInput.style.width = '80px';
                startInput.style.minWidth = '80px';
                startInput.style.flex = '0 0 auto';
                startInput.placeholder = '30';
                startInput.value = filter.relativeDateStart || '';
                startInput.addEventListener('change', (e) => {
                    filter.relativeDateStart = parseInt(e.target.value, 10) || 0;
                    this.notifyChange();
                });

                const startLabel = document.createElement('span');
                startLabel.className = 'relative-date-label';
                startLabel.textContent = 'days ago to';

                const endInput = document.createElement('input');
                endInput.type = 'number';
                endInput.className = 'filter-input';
                endInput.style.width = '80px';
                endInput.style.minWidth = '80px';
                endInput.style.flex = '0 0 auto';
                endInput.placeholder = '30';
                endInput.value = filter.relativeDateEnd || '';
                endInput.addEventListener('change', (e) => {
                    filter.relativeDateEnd = parseInt(e.target.value, 10) || 0;
                    this.notifyChange();
                });

                const endLabel = document.createElement('span');
                endLabel.className = 'relative-date-label';
                endLabel.textContent = 'days ahead';

                dynamicInputs.appendChild(startInput);
                dynamicInputs.appendChild(startLabel);
                dynamicInputs.appendChild(endInput);
                dynamicInputs.appendChild(endLabel);
            }
        };

        presetSelect.addEventListener('change', (e) => {
            filter.relativeDatePreset = e.target.value;
            renderDynamicInputs();
            this.notifyChange();
        });

        controls.appendChild(presetSelect);
        controls.appendChild(dynamicInputs);
        container.appendChild(controls);

        // Render initial dynamic inputs
        renderDynamicInputs();
    }

    /**
     * Render reference input into a target container (reusable helper)
     */
    async renderReferenceInputInto(filter, targetContainer, schema) {
        const values = await window.app.api.getPropertyValues(
            window.app.state.graph,
            filter.propertySchema.ident
        );

        if (schema.cardinality === ':db.cardinality/one') {
            const select = document.createElement('select');
            select.className = 'filter-input';

            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = 'Select value...';
            select.appendChild(emptyOption);

            values.forEach(val => {
                const option = document.createElement('option');
                option.value = val.title;
                option.textContent = val.title;
                if (filter.value === val.title) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            select.addEventListener('change', (e) => {
                filter.value = e.target.value;
                this.notifyChange();
            });

            targetContainer.appendChild(select);
        } else {
            const checkboxGroup = document.createElement('div');
            checkboxGroup.className = 'checkbox-group';

            if (!filter.value) filter.value = [];
            if (!Array.isArray(filter.value)) filter.value = [filter.value];

            values.forEach(val => {
                const label = document.createElement('label');
                label.className = 'checkbox-label';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = val.title;
                checkbox.checked = filter.value.includes(val.title);

                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        if (!filter.value.includes(val.title)) {
                            filter.value.push(val.title);
                        }
                    } else {
                        filter.value = filter.value.filter(v => v !== val.title);
                    }
                    this.notifyChange();
                });

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(' ' + val.title));
                checkboxGroup.appendChild(label);
            });

            targetContainer.appendChild(checkboxGroup);
        }
    }

    /**
     * Render checkbox/boolean property input (radio buttons)
     */
    renderCheckboxInput(filter, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'property-value-input';

        const radioGroup = document.createElement('div');
        radioGroup.className = 'radio-group';

        ['checked', 'unchecked'].forEach(state => {
            const label = document.createElement('label');
            label.className = 'radio-label';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `bool-${filter.id || Math.random()}`;
            radio.value = state;
            radio.checked = filter.value === state;

            radio.addEventListener('change', (e) => {
                filter.value = e.target.value;
                this.notifyChange();
            });

            label.appendChild(radio);
            label.appendChild(document.createTextNode(' ' + state.charAt(0).toUpperCase() + state.slice(1)));
            radioGroup.appendChild(label);
        });

        wrapper.appendChild(radioGroup);

        // Remove any existing value inputs before appending
        const existingInputs = container.querySelectorAll('.property-value-input');
        existingInputs.forEach(el => el.remove());

        container.appendChild(wrapper);
    }

    /**
     * Render number property input (number input + operator)
     */
    renderNumberInput(filter, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'property-value-input';
        wrapper.style.cssText = 'display: flex; gap: var(--spacing-sm);';

        // Operator dropdown
        const operatorSelect = document.createElement('select');
        operatorSelect.className = 'filter-input';
        operatorSelect.style.width = '80px';

        ['=', '<', '>', '<=', '>='].forEach(op => {
            const option = document.createElement('option');
            option.value = op;
            option.textContent = op === '=' ? 'is' : op;
            if (filter.operator === op || (op === '=' && !filter.operator)) {
                option.selected = true;
            }
            operatorSelect.appendChild(option);
        });

        operatorSelect.addEventListener('change', (e) => {
            filter.operator = e.target.value;
            this.notifyChange();
        });

        // Number input
        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.className = 'filter-input';
        numberInput.style.flex = '1';
        numberInput.placeholder = 'Enter number...';
        numberInput.value = filter.value || '';

        numberInput.addEventListener('change', (e) => {
            filter.value = e.target.value;
            this.notifyChange();
        });

        wrapper.appendChild(operatorSelect);
        wrapper.appendChild(numberInput);

        // Remove any existing value inputs before appending
        const existingInputs = container.querySelectorAll('.property-value-input');
        existingInputs.forEach(el => el.remove());

        container.appendChild(wrapper);
    }

    /**
     * Render text property input (fallback)
     */
    renderTextInput(filter, container) {
        const wrapper = document.createElement('div');
        wrapper.className = 'property-value-input';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'filter-input';
        input.placeholder = 'Property value...';
        input.value = filter.value || '';

        input.addEventListener('input', (e) => {
            filter.value = e.target.value;
            this.notifyChange();
        });

        wrapper.appendChild(input);

        // Remove any existing value inputs before appending
        const existingInputs = container.querySelectorAll('.property-value-input');
        existingInputs.forEach(el => el.remove());

        container.appendChild(wrapper);
    }

    /**
     * Notify onChange callback
     */
    notifyChange() {
        if (this.onChange) {
            this.onChange(this.rootGroup);
        }
    }

    // ========================================
    // Rendering Methods (Recursive)
    // ========================================

    /**
     * Main render method - clears container and renders from root
     */
    render() {
        this.container.innerHTML = '';
        this.renderGroup(this.rootGroup, this.container, 0);
    }

    /**
     * Render a group recursively
     */
    renderGroup(group, parentElement, depth) {
        const groupDiv = document.createElement('div');
        groupDiv.className = `filter-group depth-${depth}`;
        groupDiv.id = group.id;
        groupDiv.setAttribute('data-depth', depth);

        // Group header (match mode selector + label)
        this.renderGroupHeader(group, groupDiv, depth);

        // Group children container
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'group-children';

        // Render each child (filter or nested group)
        for (const child of group.children) {
            if (child.type === 'group') {
                this.renderGroup(child, childrenDiv, depth + 1);
            } else {
                this.renderFilterInGroup(child, childrenDiv, group.id);
            }
        }

        groupDiv.appendChild(childrenDiv);

        // Group footer (add buttons)
        this.renderGroupFooter(group, groupDiv);

        parentElement.appendChild(groupDiv);
    }

    /**
     * Render group header with match mode dropdown
     */
    renderGroupHeader(group, groupDiv, depth) {
        const header = document.createElement('div');
        header.className = 'group-header';

        // Match mode dropdown
        const modeSelect = document.createElement('select');
        modeSelect.className = 'match-mode-select';
        modeSelect.innerHTML = `
            <option value="all" ${group.matchMode === 'all' ? 'selected' : ''}>ALL</option>
            <option value="any" ${group.matchMode === 'any' ? 'selected' : ''}>ANY</option>
            <option value="none" ${group.matchMode === 'none' ? 'selected' : ''}>NONE</option>
        `;
        modeSelect.addEventListener('change', (e) => {
            this.setMatchMode(group.id, e.target.value);
        });

        // Label
        const label = document.createElement('span');
        label.className = 'match-mode-label';
        label.textContent = 'of the following:';

        header.appendChild(modeSelect);
        header.appendChild(label);

        // Remove button (not for root group)
        if (group.id !== 'root') {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn-remove-group';
            removeBtn.innerHTML = '×';
            removeBtn.title = 'Remove group';
            removeBtn.addEventListener('click', () => {
                this.removeItem(group.id);
            });
            header.appendChild(removeBtn);
        }

        groupDiv.appendChild(header);
    }

    /**
     * Render group footer with add buttons
     */
    renderGroupFooter(group, groupDiv) {
        const footer = document.createElement('div');
        footer.className = 'group-footer';

        // Add filter button
        const addFilterBtn = document.createElement('button');
        addFilterBtn.className = 'btn-add-filter';
        addFilterBtn.innerHTML = '+ Filter';
        addFilterBtn.addEventListener('click', () => {
            this.addFilter(group.id);
        });

        // Add group button
        const addGroupBtn = document.createElement('button');
        addGroupBtn.className = 'btn-add-group';
        addGroupBtn.innerHTML = '+ Group';
        addGroupBtn.addEventListener('click', () => {
            this.addGroup(group.id, 'any');
        });

        footer.appendChild(addFilterBtn);
        footer.appendChild(addGroupBtn);

        groupDiv.appendChild(footer);
    }

    /**
     * Render a filter within a group (modified from original renderFilter)
     */
    renderFilterInGroup(filter, container, groupId) {
        const filterRow = document.createElement('div');
        filterRow.className = 'filter-row';
        filterRow.id = filter.id;

        // Filter type dropdown
        const typeSelect = document.createElement('select');
        typeSelect.className = 'filter-type-select';
        typeSelect.innerHTML = `
            <option value="">Select filter type...</option>
            ${Object.entries(FILTER_TYPES).map(([value, config]) =>
                `<option value="${value}" ${filter.type === value ? 'selected' : ''}>${config.label}</option>`
            ).join('')}
        `;

        typeSelect.addEventListener('change', (e) => {
            filter.type = e.target.value;
            // Reset operator to default for new type
            const newConfig = FILTER_TYPES[filter.type];
            if (newConfig && newConfig.operators) {
                filter.operator = newConfig.operators[0];
            }
            // Re-render this filter
            this.render();
            this.notifyChange();
        });

        // Inputs container
        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'filter-inputs';

        if (filter.type) {
            this.renderFilterInputs(filter, inputsContainer);
        }

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-remove';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove filter';
        removeBtn.addEventListener('click', () => {
            this.removeItem(filter.id);
        });

        filterRow.appendChild(typeSelect);
        filterRow.appendChild(inputsContainer);
        filterRow.appendChild(removeBtn);

        container.appendChild(filterRow);
    }
}

// Export as global
window.FilterManager = FilterManager;
