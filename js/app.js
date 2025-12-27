/**
 * Main Application Logic
 * Coordinates all components and manages application state
 */

class App {
    constructor() {
        this.api = new LogseqAPI();
        this.filterManager = null;
        this.autocomplete = null;
        
        this.state = {
            graph: localStorage.getItem('lastGraph') || '',
            connected: false,
            filters: [],
            matchMode: 'all', // 'all' (AND) or 'any' (OR)
            results: [],
            resultCount: 0,
            resultLimit: 50,
            generatedQuery: '',
            isSearching: false,
            error: null
        };

        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        // Initialize filter manager
        this.filterManager = new FilterManager('filters-container', (filters) => {
            this.onFiltersChange(filters);
        });

        // Initialize autocomplete
        this.autocomplete = new Autocomplete(this.api);

        // Set up event listeners
        this.setupEventListeners();

        // Check server health
        await this.checkConnection();

        // Load graphs
        await this.loadGraphs();

        // Restore last selected graph
        if (this.state.graph) {
            const graphSelect = document.getElementById('graph-select');
            graphSelect.value = this.state.graph;
            this.onGraphSelect(this.state.graph);
        }

        // Add initial empty filter
        this.filterManager.addFilter();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Graph selection
        document.getElementById('graph-select').addEventListener('change', (e) => {
            this.onGraphSelect(e.target.value);
        });

        // Add filter button
        document.getElementById('add-filter-btn').addEventListener('click', () => {
            this.filterManager.addFilter();
        });

        // Search button
        document.getElementById('search-btn').addEventListener('click', () => {
            this.executeSearch();
        });

        // Clear all button
        document.getElementById('clear-all-btn').addEventListener('click', () => {
            this.filterManager.clearAll();
            this.clearResults();
            this.clearQuery();
        });

        // Copy query button
        document.getElementById('copy-query-btn').addEventListener('click', () => {
            this.copyQuery();
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Result limit
        document.getElementById('result-limit').addEventListener('change', (e) => {
            this.state.resultLimit = parseInt(e.target.value);
        });

        // Set up autocomplete on filter inputs (delegated event)
        document.getElementById('filters-container').addEventListener('focus', (e) => {
            if (e.target.classList.contains('filter-input') && 
                e.target.hasAttribute('data-autocomplete')) {
                const type = e.target.getAttribute('data-autocomplete');
                if (this.state.graph) {
                    this.autocomplete.attach(e.target, this.state.graph, type);
                }
            }
        }, true);
    }

    /**
     * Check server connection
     */
    async checkConnection() {
        try {
            const healthy = await this.api.checkHealth();
            this.updateConnectionStatus(healthy);
        } catch (error) {
            console.error('Connection check failed:', error);
            this.updateConnectionStatus(false);
        }
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatus(connected) {
        this.state.connected = connected;
        const statusEl = document.getElementById('connection-status');
        
        if (connected) {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'Connected';
        } else {
            statusEl.classList.remove('connected');
            statusEl.querySelector('.status-text').textContent = 'Disconnected';
        }
    }

    /**
     * Load available graphs
     */
    async loadGraphs() {
        try {
            const graphs = await this.api.listGraphs();
            const select = document.getElementById('graph-select');
            
            // Clear existing options except first
            select.innerHTML = '<option value="">Select a graph...</option>';
            
            // Add graph options
            graphs.forEach(graph => {
                const option = document.createElement('option');
                option.value = graph;
                option.textContent = graph;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load graphs:', error);
            this.showError('Failed to load graphs. Is the server running?');
        }
    }

    /**
     * Handle graph selection
     */
    onGraphSelect(graphName) {
        this.state.graph = graphName;
        localStorage.setItem('lastGraph', graphName);
        
        // Clear results when switching graphs
        this.clearResults();
    }

    /**
     * Handle filters change
     */
    onFiltersChange(filters) {
        this.state.filters = filters;
        this.generateQuery();

        // Clear results when filters change to avoid showing stale results
        if (this.state.results.length > 0) {
            const container = document.getElementById('results-container');
            container.innerHTML = '<div class="empty-state"><p>Filters changed - click Search to update results.</p></div>';
            document.getElementById('result-count').textContent = '0 items found';
            this.state.results = [];
            this.state.resultCount = 0;
        }
    }

    /**
     * Generate Datalog query from current filters
     */
    generateQuery() {
        const queryObj = QueryGenerator.generate(this.state.filters, this.state.matchMode);
        
        if (queryObj) {
            this.state.generatedQuery = queryObj.raw;  // Use raw for API
            this.state.wrappedQuery = queryObj.wrapped; // Use wrapped for display/copy
            
            const queryOutput = document.getElementById('query-output');
            queryOutput.textContent = queryObj.wrapped;  // Display wrapped version
        } else {
            this.state.generatedQuery = null;
            this.state.wrappedQuery = null;
            const queryOutput = document.getElementById('query-output');
            queryOutput.textContent = 'No valid filters. Add filters to generate a query.';
        }
    }

    /**
     * Execute search with current filters
     */
    async executeSearch() {
        if (!this.state.graph) {
            this.showError('Please select a graph first.');
            return;
        }

        if (!this.state.generatedQuery || this.state.generatedQuery.includes('No valid filters')) {
            this.showError('Please add valid filters before searching.');
            return;
        }

        // Show loading state
        this.state.isSearching = true;
        this.showLoading(true);
        this.hideError();

        try {
            const result = await this.api.executeQuery(this.state.graph, this.state.generatedQuery);

            console.log('API result:', result);

            // The API returns data as a flat array of objects
            let results = result.data || [];

            console.log('Extracted results:', results.length, 'items');

            // Resolve UUID references in block titles
            console.log('Resolving UUID references...');
            results = await this.api.resolveUUIDs(results, this.state.graph);
            console.log('UUID resolution complete');

            // Apply result limit
            const limitedResults = results.slice(0, this.state.resultLimit);

            this.state.results = limitedResults;
            this.state.resultCount = results.length;

            this.displayResults(limitedResults, results.length);
        } catch (error) {
            console.error('Search failed:', error);
            this.showError(`Search failed: ${error.message}`);
        } finally {
            this.state.isSearching = false;
            this.showLoading(false);
        }
    }

    /**
     * Display search results
     */
    displayResults(results, totalCount) {
        const container = document.getElementById('results-container');
        const countEl = document.getElementById('result-count');
        
        // Update count
        const limitedText = results.length < totalCount ? ` (showing ${results.length})` : '';
        countEl.textContent = `${totalCount} items found${limitedText}`;
        
        if (results.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No results found.</p></div>';
            return;
        }

        // Render results
        container.innerHTML = results.map(item => this.renderResultItem(item)).join('');
    }

    /**
     * Render a single result item
     */
    renderResultItem(item) {
        // Handle null/undefined items
        if (!item) {
            console.warn('Null item in results:', item);
            return '';
        }
        
        console.log('Rendering item:', item);
        
        const title = item['block/title'] || item['block/name'] || 'Untitled';
        const uuid = item['block/uuid'];
        const tags = item['block/tags'] || [];
        
        // Format tags
        const tagsHtml = tags.length > 0 
            ? tags.map(tag => {
                // Tags are entity references, we need to show something meaningful
                return `<span class="result-tag">#tag</span>`;
              }).join(' ')
            : '';

        return `
            <div class="result-item">
                <div class="result-title">${this.escapeHtml(title)}</div>
                <div class="result-meta">
                    ${tagsHtml}
                    ${uuid ? `<span style="color: var(--text-tertiary); font-size: 11px;">${uuid.substring(0, 8)}...</span>` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Clear results
     */
    clearResults() {
        this.state.results = [];
        this.state.resultCount = 0;
        const container = document.getElementById('results-container');
        container.innerHTML = '<div class="empty-state"><p>No results yet. Add filters and click Search.</p></div>';
        document.getElementById('result-count').textContent = '0 items found';
    }

    /**
     * Clear query
     */
    clearQuery() {
        this.state.generatedQuery = '';
        document.getElementById('query-output').textContent = 'No query generated yet.';
    }

    /**
     * Copy query to clipboard
     */
    async copyQuery() {
        const query = this.state.wrappedQuery || this.state.generatedQuery;
        
        if (!query) {
            this.showError('No query to copy. Generate a query first.');
            return;
        }

        try {
            await navigator.clipboard.writeText(query);
            
            // Visual feedback
            const btn = document.getElementById('copy-query-btn');
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.style.background = 'var(--status-connected)';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        } catch (error) {
            console.error('Copy failed:', error);
            this.showError('Failed to copy query to clipboard.');
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const body = document.body;
        const icon = document.querySelector('.theme-icon');
        
        if (body.classList.contains('light-theme')) {
            body.classList.remove('light-theme');
            icon.textContent = '🌙';
            localStorage.setItem('theme', 'dark');
        } else {
            body.classList.add('light-theme');
            icon.textContent = '☀️';
            localStorage.setItem('theme', 'light');
        }
    }

    /**
     * Show loading state
     */
    showLoading(show) {
        const loadingEl = document.getElementById('loading-state');
        const resultsEl = document.getElementById('results-container');
        
        if (show) {
            loadingEl.style.display = 'block';
            resultsEl.style.opacity = '0.5';
            document.getElementById('search-btn').disabled = true;
        } else {
            loadingEl.style.display = 'none';
            resultsEl.style.opacity = '1';
            document.getElementById('search-btn').disabled = false;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = document.getElementById('error-state');
        errorEl.querySelector('.error-message').textContent = message;
        errorEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.hideError(), 5000);
    }

    /**
     * Hide error message
     */
    hideError() {
        document.getElementById('error-state').style.display = 'none';
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
