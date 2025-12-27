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
                    propNameInput.placeholder = 'Property name...';
                    propNameInput.value = filter.propertyName || '';
                    propNameInput.addEventListener('input', (e) => {
                        filter.propertyName = e.target.value;
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
