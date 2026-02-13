/**
 * Main Application Logic
 * Coordinates all components and manages application state
 */

class App {
    constructor() {
        // Load token from localStorage
        const savedToken = localStorage.getItem('logseqApiToken') || '';
        this.api = new LogseqAPI(savedToken);
        this.filterManager = null;
        this.autocomplete = null;

        this.state = {
            graph: '',
            connected: false,
            rootGroup: null, // Tree structure with nested groups and filters
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

        // Populate token field if saved
        const tokenInput = document.getElementById('api-token');
        if (tokenInput && this.api.getToken()) {
            tokenInput.value = this.api.getToken();
        }

        // Check connection
        await this.checkConnection();

        // Add initial empty filter
        this.filterManager.addFilter();
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Token save button
        document.getElementById('save-token-btn').addEventListener('click', () => {
            this.saveToken();
        });

        // Token input — save on Enter key
        document.getElementById('api-token').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.saveToken();
            }
        });

        // Token visibility toggle
        document.getElementById('toggle-token-btn').addEventListener('click', () => {
            this.toggleTokenVisibility();
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
            console.log('[FOCUS] Event fired on:', e.target.tagName, e.target.className);
            if (e.target.classList.contains('filter-input') &&
                e.target.hasAttribute('data-autocomplete')) {
                const type = e.target.getAttribute('data-autocomplete');
                console.log('[FOCUS] Autocomplete type:', type, 'Graph:', this.state.graph);
                if (this.state.graph) {
                    console.log('[FOCUS] Calling attach()...');
                    this.autocomplete.attach(e.target, this.state.graph, type);
                } else {
                    console.log('[FOCUS] No graph selected, skipping attach');
                }
            }
        }, true);
    }

    /**
     * Save token and re-check connection
     */
    async saveToken() {
        const tokenInput = document.getElementById('api-token');
        const token = tokenInput.value.trim();

        localStorage.setItem('logseqApiToken', token);
        this.api.setToken(token);

        await this.checkConnection();
    }

    /**
     * Toggle token input visibility
     */
    toggleTokenVisibility() {
        const tokenInput = document.getElementById('api-token');
        const toggleBtn = document.getElementById('toggle-token-btn');

        if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            toggleBtn.textContent = 'Hide';
        } else {
            tokenInput.type = 'password';
            toggleBtn.textContent = 'Show';
        }
    }

    /**
     * Check connection to Logseq API
     */
    async checkConnection() {
        try {
            const health = await this.api.checkHealth();
            this.updateConnectionStatus(health);

            if (health.connected && health.graphName) {
                this.state.graph = health.graphName;
                this.updateGraphDisplay(health.graphName);
            } else {
                this.state.graph = '';
                this.updateGraphDisplay(null);
            }
        } catch (error) {
            console.error('Connection check failed:', error);
            this.updateConnectionStatus({ connected: false, graphName: null, error: 'connection_refused' });
            this.state.graph = '';
            this.updateGraphDisplay(null);
        }
    }

    /**
     * Update connection status UI
     */
    updateConnectionStatus(health) {
        this.state.connected = health.connected;
        const statusEl = document.getElementById('connection-status');
        const setupHelp = document.getElementById('setup-help');

        if (health.connected) {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'Connected';
            if (setupHelp) setupHelp.classList.add('hidden');
        } else {
            statusEl.classList.remove('connected');

            if (health.error === 'invalid_token') {
                statusEl.querySelector('.status-text').textContent = 'Invalid token';
            } else {
                statusEl.querySelector('.status-text').textContent = 'Disconnected';
            }

            if (setupHelp) setupHelp.classList.remove('hidden');
        }
    }

    /**
     * Update graph name display
     */
    updateGraphDisplay(graphName) {
        const graphDisplay = document.getElementById('current-graph');
        if (graphDisplay) {
            graphDisplay.textContent = graphName || 'Not connected';
        }
    }

    /**
     * Handle filters change (receives rootGroup tree structure)
     */
    onFiltersChange(rootGroup) {
        this.state.rootGroup = rootGroup;
        this.generateQuery();

        // Clear results when filters change to avoid showing stale results
        if (this.state.results.length > 0) {
            const container = document.getElementById('results-container');
            // Using textContent-based approach to update display
            while (container.firstChild) container.removeChild(container.firstChild);
            const div = document.createElement('div');
            div.className = 'empty-state';
            const p = document.createElement('p');
            p.textContent = 'Filters changed - click Search to update results.';
            div.appendChild(p);
            container.appendChild(div);
            document.getElementById('result-count').textContent = '0 items found';
            this.state.results = [];
            this.state.resultCount = 0;
        }
    }

    /**
     * Generate Datalog query from current filters (tree structure)
     */
    generateQuery() {
        const rootGroup = this.state.rootGroup || this.filterManager.getRootGroup();
        const queryObj = QueryGenerator.generate(rootGroup);

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
            this.showError('Not connected to a graph. Enter your API token and connect first.');
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
     * Display search results using safe DOM methods
     */
    displayResults(results, totalCount) {
        const container = document.getElementById('results-container');
        const countEl = document.getElementById('result-count');

        // Update count
        const limitedText = results.length < totalCount ? ` (showing ${results.length})` : '';
        countEl.textContent = `${totalCount} items found${limitedText}`;

        // Clear container safely
        while (container.firstChild) container.removeChild(container.firstChild);

        if (results.length === 0) {
            const div = document.createElement('div');
            div.className = 'empty-state';
            const p = document.createElement('p');
            p.textContent = 'No results found.';
            div.appendChild(p);
            container.appendChild(div);
            return;
        }

        // Render results using DOM methods
        results.forEach(item => {
            const el = this.createResultElement(item);
            if (el) container.appendChild(el);
        });
    }

    /**
     * Create a result item DOM element safely
     */
    createResultElement(item) {
        if (!item) {
            console.warn('Null item in results:', item);
            return null;
        }

        console.log('Rendering item:', item);

        const title = item['block/title'] || item['block/name'] || 'Untitled';
        const uuid = item['block/uuid'];
        const tags = item['block/tags'] || [];

        const div = document.createElement('div');
        div.className = 'result-item';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'result-title';
        titleDiv.textContent = title;
        div.appendChild(titleDiv);

        const metaDiv = document.createElement('div');
        metaDiv.className = 'result-meta';

        // Format tags
        tags.forEach(() => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'result-tag';
            tagSpan.textContent = '#tag';
            metaDiv.appendChild(tagSpan);
        });

        if (uuid) {
            const uuidSpan = document.createElement('span');
            uuidSpan.style.cssText = 'color: var(--text-tertiary); font-size: 11px;';
            uuidSpan.textContent = `${uuid.substring(0, 8)}...`;
            metaDiv.appendChild(uuidSpan);
        }

        div.appendChild(metaDiv);
        return div;
    }

    /**
     * Clear results
     */
    clearResults() {
        this.state.results = [];
        this.state.resultCount = 0;
        const container = document.getElementById('results-container');
        while (container.firstChild) container.removeChild(container.firstChild);
        const div = document.createElement('div');
        div.className = 'empty-state';
        const p = document.createElement('p');
        p.textContent = 'No results yet. Add filters and click Search.';
        div.appendChild(p);
        container.appendChild(div);
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
