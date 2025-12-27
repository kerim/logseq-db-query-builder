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
        inputs: ['date-range', 'date-property-select']
    }
};

class FilterManager {
    constructor(containerId, onChange) {
        this.container = document.getElementById(containerId);
        this.onChange = onChange; // Callback when filters change
        this.filters = [];
        this.filterIdCounter = 0;
    }

    /**
     * Add a new filter
     */
    addFilter(filterType = '') {
        const filterId = `filter-${this.filterIdCounter++}`;
        
        const filter = {
            id: filterId,
            type: filterType,
            operator: null,
            value: '',
            propertyName: '',
            startDate: '',
            endDate: '',
            dateProperty: 'created-at'
        };

        this.filters.push(filter);
        this.renderFilter(filter);
        this.notifyChange();
        
        return filter;
    }

    /**
     * Remove a filter
     */
    removeFilter(filterId) {
        this.filters = this.filters.filter(f => f.id !== filterId);
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
            filterElement.remove();
        }
        this.notifyChange();
    }

    /**
     * Clear all filters
     */
    clearAll() {
        this.filters = [];
        this.container.innerHTML = '';
        this.notifyChange();
    }

    /**
     * Get all filters
     */
    getFilters() {
        return this.filters;
    }

    /**
     * Render a filter row
     */
    renderFilter(filter) {
        const filterRow = document.createElement('div');
        filterRow.className = 'filter-row';
        filterRow.id = filter.id;

        // Filter type dropdown
        const typeSelect = document.createElement('select');
        typeSelect.className = 'filter-type-select';
        typeSelect.innerHTML = `
            <option value="">Add filter/operator</option>
            ${Object.entries(FILTER_TYPES).map(([value, config]) => 
                `<option value="${value}" ${filter.type === value ? 'selected' : ''}>${config.label}</option>`
            ).join('')}
        `;

        typeSelect.addEventListener('change', (e) => {
            filter.type = e.target.value;
            // Re-render the filter inputs
            const inputsContainer = filterRow.querySelector('.filter-inputs');
            inputsContainer.innerHTML = '';
            this.renderFilterInputs(filter, inputsContainer);
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
            this.removeFilter(filter.id);
        });

        filterRow.appendChild(typeSelect);
        filterRow.appendChild(inputsContainer);
        filterRow.appendChild(removeBtn);

        this.container.appendChild(filterRow);
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
                    break;

                case 'property-name':
                    const propNameInput = document.createElement('input');
                    propNameInput.type = 'text';
                    propNameInput.className = 'filter-input';
                    propNameInput.placeholder = 'Select property...';
                    propNameInput.value = filter.propertyName || '';
                    propNameInput.setAttribute('data-autocomplete', 'property');  // Enable autocomplete

                    propNameInput.addEventListener('input', async (e) => {
                        filter.propertyName = e.target.value;

                        // Get full property identifier from autocomplete
                        const propertyIdent = e.target.getAttribute('data-property-ident');
                        if (propertyIdent) {
                            filter.propertyIdent = propertyIdent;
                        }

                        // Fetch schema when property selected
                        if (propertyIdent && window.app.state.graph) {
                            // Fetch schema using the full identifier
                            const query = `[:find (pull ?p [*]) :where [?p :db/ident ${propertyIdent}]]`;
                            const result = await window.app.api.executeQuery(window.app.state.graph, query);

                            if (result.data.length > 0) {
                                const schema = result.data[0][0];
                                filter.propertySchema = {
                                    name: schema[':block/title'],
                                    ident: propertyIdent,
                                    valueType: schema[':db/valueType'],
                                    cardinality: schema[':db/cardinality']
                                };

                                // Re-render value input based on schema type
                                this.renderPropertyValueInput(filter, container);
                            }
                        }

                        this.notifyChange();
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

                case 'date-range':
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
                    break;

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

        container.appendChild(wrapper);
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
        container.appendChild(wrapper);
    }

    /**
     * Render date property input (date picker + operator)
     */
    renderDateInput(filter, container) {
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

        // Date input
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
        container.appendChild(wrapper);
    }

    /**
     * Notify onChange callback
     */
    notifyChange() {
        if (this.onChange) {
            this.onChange(this.filters);
        }
    }
}

// Export as global
window.FilterManager = FilterManager;
