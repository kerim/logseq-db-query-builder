/**
 * Autocomplete Component
 * Provides dropdown suggestions as user types
 */

class Autocomplete {
    constructor(api) {
        this.api = api;
        this.activeInput = null;
        this.suggestions = [];
        this.debounceTimer = null;
        this.dropdownElement = null;
        this.justSelected = false;  // Prevent re-trigger after selection

        this.init();
    }

    /**
     * Initialize autocomplete listeners
     */
    init() {
        // Create dropdown element
        this.dropdownElement = document.createElement('div');
        this.dropdownElement.className = 'autocomplete-dropdown';
        this.dropdownElement.style.cssText = `
            position: absolute;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-sm);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        document.body.appendChild(this.dropdownElement);

        // Listen for clicks outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-input') && !e.target.closest('.autocomplete-dropdown')) {
                this.hide();
            }
        });
    }

    /**
     * Attach autocomplete to an input element
     * @param {HTMLInputElement} input - Input element
     * @param {string} graphName - Graph name for queries
     * @param {string} type - Type of autocomplete (tags, page-reference, property)
     */
    attach(input, graphName, type) {
        console.log('[ATTACH] Called with type:', type, 'graph:', graphName);
        // Prevent duplicate attachment
        if (input.hasAttribute('data-autocomplete-attached')) {
            console.log('[ATTACH] Already attached, skipping');
            return;
        }
        console.log('[ATTACH] Attaching new listener...');
        input.setAttribute('data-autocomplete-attached', 'true');

        input.addEventListener('input', async (e) => {
            const value = e.target.value;
            console.log('[INPUT] Value:', value, 'Length:', value.length);

            // Skip if we just selected (prevents re-trigger)
            if (this.justSelected) {
                console.log('[INPUT] justSelected flag, skipping');
                this.justSelected = false;
                return;
            }

            // Debounce the search
            clearTimeout(this.debounceTimer);

            if (value.length < 2) {
                console.log('[INPUT] Too short (<2), hiding');
                this.hide();
                return;
            }

            console.log('[INPUT] Starting 300ms debounce...');
            this.debounceTimer = setTimeout(async () => {
                console.log('[INPUT] Debounce complete, fetching suggestions...');
                try {
                    this.activeInput = input;
                    await this.fetchSuggestions(graphName, type, value);
                    this.show(input);
                } catch (error) {
                    console.error('[INPUT] Autocomplete fetch failed:', error);
                    this.hide();
                }
            }, 300);
        });

        input.addEventListener('focus', () => {
            if (this.suggestions.length > 0 && this.activeInput === input) {
                this.show(input);
            }
        });
    }

    /**
     * Fetch suggestions based on type
     */
    async fetchSuggestions(graphName, type, searchTerm) {
        console.log('[FETCH] type:', type, 'term:', searchTerm, 'graph:', graphName);
        this.suggestions = [];

        switch (type) {
            case 'tags':
                console.log('[FETCH] Calling getTags()...');
                const tags = await this.api.getTags(graphName, searchTerm);
                console.log('[FETCH] Got tags:', tags.length, tags);
                this.suggestions = tags.map(tag => ({
                    label: tag.title,
                    value: tag.title
                }));
                console.log('[FETCH] Mapped to suggestions:', this.suggestions.length);
                break;

            case 'page-reference':
                console.log('[FETCH] Calling searchPages()...');
                const pages = await this.api.searchPages(graphName, searchTerm);
                console.log('[FETCH] Got pages:', pages.length);
                this.suggestions = pages.map(page => ({
                    label: page.title || page.name,
                    value: page.name
                }));
                break;

            case 'property':
                console.log('[FETCH] Calling getProperties()...');
                const props = await this.api.getProperties(graphName, searchTerm);
                console.log('[FETCH] Got properties:', props.length);
                this.suggestions = props.map(p => ({
                    label: p.title,
                    value: p.title,
                    ident: p.ident  // Store full identifier for schema lookup
                }));
                break;

            default:
                console.warn('[FETCH] Unknown autocomplete type:', type);
        }
    }

    /**
     * Show dropdown with suggestions
     */
    show(input) {
        console.log('[SHOW] suggestions.length:', this.suggestions.length);
        if (this.suggestions.length === 0) {
            console.log('[SHOW] No suggestions, hiding');
            this.hide();
            return;
        }
        console.log('[SHOW] Positioning and rendering dropdown...');

        // Position dropdown below input
        const rect = input.getBoundingClientRect();
        this.dropdownElement.style.left = `${rect.left}px`;
        this.dropdownElement.style.top = `${rect.bottom + 4}px`;
        this.dropdownElement.style.width = `${rect.width}px`;
        this.dropdownElement.style.display = 'block';

        // Render suggestions
        this.dropdownElement.innerHTML = this.suggestions.map((suggestion, index) => `
            <div class="autocomplete-item" data-index="${index}" style="
                padding: 8px 12px;
                cursor: pointer;
                color: var(--text-primary);
                transition: background 0.15s ease;
            ">
                ${this.escapeHtml(suggestion.label)}
            </div>
        `).join('');

        // Add click listeners to items
        this.dropdownElement.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('mouseenter', (e) => {
                e.target.style.background = 'var(--bg-hover)';
            });
            item.addEventListener('mouseleave', (e) => {
                e.target.style.background = 'transparent';
            });
            item.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.selectSuggestion(index);
            });
        });
    }

    /**
     * Hide dropdown
     */
    hide() {
        this.dropdownElement.style.display = 'none';
    }

    /**
     * Select a suggestion
     */
    selectSuggestion(index) {
        if (index >= 0 && index < this.suggestions.length) {
            const suggestion = this.suggestions[index];
            if (this.activeInput) {
                // Set flag BEFORE dispatching event to prevent re-trigger
                this.justSelected = true;

                this.activeInput.value = suggestion.value;
                // Store ident as data attribute for property autocomplete
                if (suggestion.ident) {
                    this.activeInput.setAttribute('data-property-ident', suggestion.ident);
                }
                // Trigger input event to update filter state
                this.activeInput.dispatchEvent(new Event('input', { bubbles: true }));
                // Trigger custom event for autocomplete-selected (used by tag property suggestions)
                this.activeInput.dispatchEvent(new Event('autocomplete-selected', { bubbles: true }));
            }
        }
        this.hide();
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export as global
window.Autocomplete = Autocomplete;
