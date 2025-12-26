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
        inputs: ['value']
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
                    const prioritySelect = document.createElement('select');
                    prioritySelect.className = 'select-input-small';
                    prioritySelect.innerHTML = `
                        <option value="">Select priority...</option>
                        <option value="A" ${filter.value === 'A' ? 'selected' : ''}>A</option>
                        <option value="B" ${filter.value === 'B' ? 'selected' : ''}>B</option>
                        <option value="C" ${filter.value === 'C' ? 'selected' : ''}>C</option>
                    `;
                    prioritySelect.addEventListener('change', (e) => {
                        filter.value = e.target.value;
                        this.notifyChange();
                    });
                    container.appendChild(prioritySelect);
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
