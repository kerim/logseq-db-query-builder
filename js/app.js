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

        // Disconnect button
        document.getElementById('disconnect-btn').addEventListener('click', () => {
            this.disconnect();
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
     * Disconnect: clear token and reset connection state
     */
    disconnect() {
        localStorage.removeItem('logseqApiToken');
        this.api.setToken('');

        const tokenInput = document.getElementById('api-token');
        tokenInput.value = '';
        tokenInput.type = 'password';
        document.getElementById('toggle-token-btn').textContent = 'Show';

        this.state.connected = false;
        this.state.graph = '';
        this.updateConnectionStatus({ connected: false, graphName: null, error: null });
        this.updateGraphDisplay(null);
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
        const connectBtn = document.getElementById('save-token-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');

        if (health.connected) {
            statusEl.classList.add('connected');
            statusEl.querySelector('.status-text').textContent = 'Connected';
            if (setupHelp) setupHelp.classList.add('hidden');
            connectBtn.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
        } else {
            statusEl.classList.remove('connected');

            if (health.error === 'invalid_token') {
                statusEl.querySelector('.status-text').textContent = 'Invalid token';
            } else {
                statusEl.querySelector('.status-text').textContent = 'Disconnected';
            }

            connectBtn.classList.remove('hidden');
            disconnectBtn.classList.add('hidden');

            if (setupHelp) {
                setupHelp.classList.remove('hidden');
                this.updateSetupHelp(setupHelp, health);
            }
        }
    }

    /**
     * Update setup help content based on protocol and browser
     */
    updateSetupHelp(setupHelp, health) {
        const isHTTPS = location.protocol === 'https:';

        if (!isHTTPS) {
            // Local/HTTP — show standard setup help
            this.renderStandardSetupHelp(setupHelp);
            return;
        }

        // HTTPS — check for browser-specific local network access issues
        const isSafari = /^Apple/.test(navigator.vendor) && !/Chrome|CriOS/.test(navigator.userAgent);
        const isChromium = /Chrome/.test(navigator.userAgent);

        if (isSafari) {
            this.renderSafariWarning(setupHelp);
        } else if (isChromium) {
            this.renderChromiumHelp(setupHelp);
        } else {
            // Firefox and others — standard help plus generic HTTPS note
            this.renderStandardSetupHelp(setupHelp, true);
        }
    }

    /**
     * Render standard setup help (local/HTTP or Firefox)
     */
    renderStandardSetupHelp(container, includeHTTPSNote) {
        // Clear and rebuild
        while (container.firstChild) container.removeChild(container.firstChild);

        const intro = document.createElement('p');
        const strong1 = document.createElement('strong');
        strong1.textContent = 'Not connected?';
        intro.appendChild(strong1);
        intro.appendChild(document.createTextNode(' Enable the Logseq HTTP API:'));
        container.appendChild(intro);

        const ol = document.createElement('ol');
        const steps = [
            'Open Logseq \u2192 Settings \u2192 Advanced \u2192 enable "Developer mode"',
            'Restart Logseq',
            'Go to Settings \u2192 API Server \u2192 enable "HTTP APIs server"',
            'Click "Authorization tokens" \u2192 create a token',
            'Paste the token above and click Connect'
        ];
        steps.forEach(text => {
            const li = document.createElement('li');
            li.textContent = text;
            ol.appendChild(li);
        });
        container.appendChild(ol);

        const note = document.createElement('p');
        const strong2 = document.createElement('strong');
        strong2.textContent = 'Note:';
        note.appendChild(strong2);
        note.appendChild(document.createTextNode(' Ad blockers may block requests to localhost. If connection fails, disable your ad blocker for this site.'));
        container.appendChild(note);

        if (includeHTTPSNote) {
            const httpsNote = document.createElement('p');
            const strong3 = document.createElement('strong');
            strong3.textContent = 'HTTPS note:';
            httpsNote.appendChild(strong3);
            httpsNote.appendChild(document.createTextNode(' Some browsers may block requests from HTTPS pages to local services. If you cannot connect, try running the app locally or check your browser\'s local network access settings.'));
            container.appendChild(httpsNote);
        }

        const link = document.createElement('p');
        const a = document.createElement('a');
        a.href = 'https://github.com/kerim/logseq-db-query-builder#troubleshooting';
        a.target = '_blank';
        a.textContent = 'Full setup instructions \u2192';
        link.appendChild(a);
        container.appendChild(link);
    }

    /**
     * Render Safari-specific warning (HTTPS \u2192 HTTP localhost blocked)
     */
    renderSafariWarning(container) {
        while (container.firstChild) container.removeChild(container.firstChild);

        const warning = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = 'Safari does not support the online version.';
        warning.appendChild(strong);
        warning.appendChild(document.createTextNode(' Safari blocks all requests from HTTPS pages to local HTTP services (like the Logseq API). This is a known WebKit limitation ('));
        const bugLink = document.createElement('a');
        bugLink.href = 'https://bugs.webkit.org/show_bug.cgi?id=171934';
        bugLink.target = '_blank';
        bugLink.textContent = 'bug #171934';
        warning.appendChild(bugLink);
        warning.appendChild(document.createTextNode(', open since 2017).'));
        container.appendChild(warning);

        const alternatives = document.createElement('p');
        alternatives.textContent = 'To use this tool, either:';
        container.appendChild(alternatives);

        const ol = document.createElement('ol');
        const opt1 = document.createElement('li');
        const strong1 = document.createElement('strong');
        strong1.textContent = 'Switch to Chrome or Firefox';
        opt1.appendChild(strong1);
        opt1.appendChild(document.createTextNode(' (recommended)'));
        ol.appendChild(opt1);

        const opt2 = document.createElement('li');
        const strong2 = document.createElement('strong');
        strong2.textContent = 'Run locally:';
        opt2.appendChild(strong2);
        opt2.appendChild(document.createTextNode(' Clone the repository and open index.html directly'));
        ol.appendChild(opt2);
        container.appendChild(ol);

        const link = document.createElement('p');
        const a = document.createElement('a');
        a.href = 'https://github.com/kerim/logseq-db-query-builder#4-browser-blocking-local-network-access';
        a.target = '_blank';
        a.textContent = 'See browser compatibility details \u2192';
        link.appendChild(a);
        container.appendChild(link);
    }

    /**
     * Render Chromium-specific help (Chrome/Edge/Brave local network access)
     */
    renderChromiumHelp(container) {
        while (container.firstChild) container.removeChild(container.firstChild);

        const intro = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = 'Connection blocked?';
        intro.appendChild(strong);
        intro.appendChild(document.createTextNode(' Chrome-based browsers (v142+) require permission for websites to access local network services.'));
        container.appendChild(intro);

        const ol = document.createElement('ol');
        const step1 = document.createElement('li');
        step1.textContent = 'Look for a permission prompt in the address bar and click "Allow"';
        ol.appendChild(step1);

        const step2 = document.createElement('li');
        step2.textContent = 'If you previously denied it: go to Settings \u2192 Privacy & Security \u2192 Site Settings \u2192 Local Network Access \u2192 allow for this site';
        ol.appendChild(step2);

        const step3 = document.createElement('li');
        const strong3 = document.createElement('strong');
        strong3.textContent = 'Brave users:';
        step3.appendChild(strong3);
        step3.appendChild(document.createTextNode(' also disable Shields for this site (click Shields icon \u2192 disable)'));
        ol.appendChild(step3);
        container.appendChild(ol);

        // Also check LNA permission if available
        this.checkLocalNetworkPermission(container);

        const also = document.createElement('p');
        also.textContent = 'Also make sure the Logseq HTTP API is enabled (Settings \u2192 Advanced \u2192 Developer mode \u2192 API Server).';
        container.appendChild(also);

        const link = document.createElement('p');
        const a = document.createElement('a');
        a.href = 'https://github.com/kerim/logseq-db-query-builder#4-browser-blocking-local-network-access';
        a.target = '_blank';
        a.textContent = 'Full browser compatibility details \u2192';
        link.appendChild(a);
        container.appendChild(link);
    }

    /**
     * Check Local Network Access permission (Chrome 142+)
     */
    async checkLocalNetworkPermission(container) {
        try {
            const status = await navigator.permissions.query({ name: 'local-network' });
            if (status.state === 'denied') {
                const denied = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = 'Local network access is currently denied.';
                denied.appendChild(strong);
                denied.appendChild(document.createTextNode(' Go to Settings \u2192 Privacy & Security \u2192 Site Settings \u2192 Local Network Access to re-enable it for this site.'));
                denied.style.color = 'var(--error-text)';
                // Insert before the last child (the link)
                container.insertBefore(denied, container.lastChild);
            } else if (status.state === 'prompt') {
                const prompt = document.createElement('p');
                prompt.textContent = 'You should see a permission prompt in the address bar — click "Allow" to connect to the Logseq API.';
                prompt.style.fontStyle = 'italic';
                container.insertBefore(prompt, container.lastChild);
            }
        } catch (e) {
            // Permission API doesn't support 'local-network' in this browser — that's fine
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
            this.state.queryRules = queryObj.rules;     // EDN string when parent rule is used; null otherwise

            const queryOutput = document.getElementById('query-output');
            queryOutput.textContent = queryObj.wrapped;  // Display wrapped version
        } else {
            this.state.generatedQuery = null;
            this.state.wrappedQuery = null;
            this.state.queryRules = null;
            const queryOutput = document.getElementById('query-output');
            queryOutput.textContent = 'No valid filters. Add filters to generate a query.';
        }

        this.updateDeadlineScheduledWarning(rootGroup);
    }

    /**
     * Show a non-blocking warning when the "deadline / scheduled" filter is
     * the *only* filter in the tree with dateSetState 'not-set'. Datascript
     * has no concept of "empty" — the absence check binds every entity that
     * merely exists (:block/uuid), so standing alone this filter matches
     * nearly the whole graph (pages, journals, tags, schema entities, not
     * just blocks). It composes fine alongside other filters, so the
     * warning only fires for the single-filter case and never blocks Search.
     */
    updateDeadlineScheduledWarning(rootGroup) {
        const warningEl = document.getElementById('deadline-scheduled-warning');
        if (!warningEl) return;

        const allFilters = QueryGenerator.flattenFilters(rootGroup);
        const validFilters = allFilters.filter(f => QueryGenerator.isValidFilter(f));

        const isLoneUnboundedFilter = validFilters.length === 1 &&
            validFilters[0].type === 'deadline-scheduled' &&
            (validFilters[0].dateSetState || 'not-set') === 'not-set';

        warningEl.style.display = isLoneUnboundedFilter ? 'block' : 'none';
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
            const result = await this.api.executeQuery(this.state.graph, this.state.generatedQuery, this.state.queryRules);

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

        const title = item['block/title'] || item['block/name'] || item['title'] || item['name'] || 'Untitled';
        const uuid = item['block/uuid'] || item['uuid'];
        const tags = item['block/tags'] || item['tags'] || [];

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
