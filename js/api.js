/**
 * API Layer - Communication with Logseq Built-in HTTP API
 * Endpoint: http://127.0.0.1:12315/api
 * Auth: Bearer token from Logseq settings
 */

const API_BASE_URL = 'http://127.0.0.1:12315/api';

class LogseqAPI {
    constructor(token = '') {
        this.baseUrl = API_BASE_URL;
        this.token = token;
    }

    /**
     * Set the API token
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * Get the current API token
     */
    getToken() {
        return this.token;
    }

    /**
     * Call the Logseq API
     * @param {string} method - API method (e.g., 'logseq.DB.datascriptQuery')
     * @param {Array} args - Method arguments
     * @returns {Promise<any>} API response data
     */
    async _callAPI(method, args = []) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ method, args })
            });

            if (response.status === 401) {
                throw new Error('Invalid API token. Check your token in Logseq settings.');
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `API error: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error.message.includes('Invalid API token')) {
                throw error;
            }
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to Logseq. Make sure the API server is enabled in Logseq settings.');
            }
            throw error;
        }
    }

    /**
     * Resolve entity-reference ident values to plain strings.
     * The built-in API may return {:db/valueType {:db/ident ":db.type/ref"}}
     * instead of plain string ":db.type/ref".
     */
    _resolveIdent(val) {
        if (typeof val === 'string') return val;
        if (val && typeof val === 'object') return val['db/ident'] || val[':db/ident'] || val['ident'] || val;
        return val;
    }

    /**
     * Normalize keys in result objects — strip leading ':' from keys
     */
    _normalizeKeys(obj) {
        if (obj === null || obj === undefined) return obj;
        if (Array.isArray(obj)) return obj.map(item => this._normalizeKeys(item));
        if (typeof obj !== 'object') return obj;

        const normalized = {};
        for (const [key, value] of Object.entries(obj)) {
            const cleanKey = key.startsWith(':') ? key.slice(1) : key;
            normalized[cleanKey] = this._normalizeKeys(value);
        }
        return normalized;
    }

    /**
     * Check if Logseq API is reachable and get current graph info
     * @returns {Object} {connected, graphName, error}
     */
    async checkHealth() {
        try {
            const result = await this._callAPI('logseq.App.getCurrentGraph');
            if (result && (result.name || result.url)) {
                const graphName = result.name || result.url.split('/').pop();
                return { connected: true, graphName, error: null };
            }
            return { connected: true, graphName: 'Unknown', error: null };
        } catch (error) {
            const msg = error.message || '';
            if (msg.includes('Invalid API token')) {
                return { connected: false, graphName: null, error: 'invalid_token' };
            }
            return { connected: false, graphName: null, error: 'connection_refused' };
        }
    }

    /**
     * Get current graph (replaces listGraphs)
     * @returns {Promise<Array>} Single-item array with {name} for compatibility
     */
    async listGraphs() {
        const health = await this.checkHealth();
        if (health.connected) {
            return [health.graphName];
        }
        throw new Error(health.error === 'invalid_token'
            ? 'Invalid API token'
            : 'Cannot connect to Logseq');
    }

    /**
     * Execute a Datalog query
     * @param {string} graphName - Ignored (built-in API uses current graph)
     * @param {string} query - Datalog query string
     * @returns {Object} {success, data} matching existing caller expectations
     */
    async executeQuery(graphName, query) {
        try {
            const apiQuery = query.trim();
            const results = await this._callAPI('logseq.DB.datascriptQuery', [apiQuery]);

            // Flatten single-element tuples: [[{entity}], ...] → [{entity}, ...]
            let data = [];
            if (Array.isArray(results)) {
                data = results.map(r => {
                    if (Array.isArray(r) && r.length === 1) {
                        const val = r[0];
                        return (typeof val === 'object' && val !== null) ? this._normalizeKeys(val) : val;
                    }
                    return this._normalizeKeys(r);
                });
            }

            return {
                success: true,
                data: data,
                raw: results
            };
        } catch (error) {
            console.error('Query execution failed:', error);
            throw error;
        }
    }

    /**
     * Search for pages by name/title (uses datascript query)
     * @param {string} graphName - Ignored
     * @param {string} searchTerm - Search term
     */
    async searchPages(graphName, searchTerm) {
        try {
            const term = searchTerm.toLowerCase().replace(/"/g, '\\"');
            const query = `[:find (pull ?p [:block/name :block/title :block/uuid])
                            :where
                            [?p :block/name ?n]
                            [(clojure.string/includes? ?n "${term}")]]`;

            const result = await this.executeQuery(graphName, query);

            return result.data.map(item => ({
                name: item['block/name'] || item[':block/name'] || item['name'],
                title: item['block/title'] || item[':block/title'] || item['title'],
                uuid: item['block/uuid'] || item[':block/uuid'] || item['uuid']
            }));
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        }
    }

    /**
     * Get all tags from a graph
     * @param {string} graphName - Ignored
     * @param {string} searchTerm - Optional search filter
     */
    async getTags(graphName, searchTerm = '') {
        try {
            const query = `[:find (pull ?t [:block/title :block/uuid])
                            :where
                            [?b :block/tags ?t]
                            [?t :block/title]]`;

            const result = await this.executeQuery(graphName, query);
            console.log('[getTags] Raw result.data:', result.data?.slice(0, 3));

            const tagMap = new Map();
            result.data.forEach(item => {
                const title = item['block/title'] || item[':block/title'] || item['title'];
                const uuid = item['block/uuid'] || item[':block/uuid'] || item['uuid'];

                if (title) {
                    if (!searchTerm || title.toLowerCase().includes(searchTerm.toLowerCase())) {
                        tagMap.set(title, { title, uuid });
                    }
                }
            });

            console.log('[getTags] Filtered tags:', tagMap.size);
            return Array.from(tagMap.values());
        } catch (error) {
            console.error('Failed to get tags:', error);
            throw error;
        }
    }

    /**
     * Get property names and metadata from graph
     * @param {string} graphName - Ignored
     * @param {string} searchTerm - Optional search filter
     * @returns {Promise<Array>} Array of {title, ident, namespace} objects
     */
    async getProperties(graphName, searchTerm = '') {
        try {
            const query = `[:find ?prop
                            :where
                            [?b ?prop ?v]
                            [(namespace ?prop)]]`;

            const result = await this.executeQuery(graphName, query);

            const propsMap = new Map();
            result.data.forEach(item => {
                const prop = item;
                if (prop) {
                    const parts = prop.split('/');
                    if (parts.length === 2) {
                        const namespace = parts[0].replace(':', '');
                        let propName = parts[1];
                        const cleanName = propName.replace(/-[A-Za-z0-9_]+$/, '');

                        if (!searchTerm || cleanName.toLowerCase().includes(searchTerm.toLowerCase())) {
                            if (!propsMap.has(cleanName)) {
                                propsMap.set(cleanName, {
                                    title: cleanName,
                                    ident: prop,
                                    namespace: namespace
                                });
                            }
                        }
                    }
                }
            });

            return Array.from(propsMap.values()).sort((a, b) => a.title.localeCompare(b.title));
        } catch (error) {
            console.error('Failed to get properties:', error);
            throw error;
        }
    }

    /**
     * Get property schema (type, cardinality, etc.)
     * @param {string} graphName - Ignored
     * @param {string} propertyName - Property name (without namespace)
     * @returns {Promise<Object|null>} Property schema or null if not found
     */
    async getPropertySchema(graphName, propertyName) {
        try {
            const safeName = propertyName.replace(/"/g, '\\"');
            const query = `[:find (pull ?p [*])
                            :where
                            (or
                              [?p :db/ident :user.property/${safeName}]
                              [?p :db/ident :logseq.property/${safeName}])]`;

            const result = await this.executeQuery(graphName, query);
            if (result.data.length > 0) {
                const schema = result.data[0];
                return {
                    name: schema['block/title'] || schema[':block/title'] || schema['title'],
                    ident: this._resolveIdent(schema['db/ident'] || schema[':db/ident'] || schema['ident']),
                    valueType: this._resolveIdent(schema['db/valueType'] || schema[':db/valueType'] || schema['valueType']),
                    cardinality: this._resolveIdent(schema['db/cardinality'] || schema[':db/cardinality'] || schema['cardinality'])
                };
            }
            return null;
        } catch (error) {
            console.error('Failed to get property schema:', error);
            return null;
        }
    }

    /**
     * Get all possible values for a reference property
     * @param {string} graphName - Ignored
     * @param {string} propertyIdent - Full property identifier
     * @returns {Promise<Array>} Array of {title, id} objects
     */
    async getPropertyValues(graphName, propertyIdent) {
        try {
            const queryIdent = propertyIdent.startsWith(':') ? propertyIdent : `:${propertyIdent}`;
            const query = `[:find (pull ?val [:block/title :db/id])
                            :where
                            [_ ${queryIdent} ?val]]`;

            const result = await this.executeQuery(graphName, query);
            return result.data.map(item => ({
                title: item['block/title'] || item[':block/title'] || item['title'],
                id: item['db/id'] || item[':db/id'] || item['id']
            }));
        } catch (error) {
            console.error('Failed to get property values:', error);
            return [];
        }
    }

    /**
     * Get properties associated with a tag
     * @param {string} graphName - Ignored
     * @param {string} tagName - Tag name
     * @returns {Promise<Array>} Array of property objects
     */
    async getTagProperties(graphName, tagName) {
        try {
            const safeTag = tagName.replace(/"/g, '\\"');
            const query = `[:find (pull ?tag [{:logseq.property.class/properties [:db/ident :block/title]}])
                            :where
                            [?tag :block/title "${safeTag}"]]`;

            const result = await this.executeQuery(graphName, query);
            console.log('[getTagProperties] Raw result:', result.data);

            if (result.data.length > 0) {
                const tagData = result.data[0];
                const props = tagData['logseq.property.class/properties'] ||
                              tagData[':logseq.property.class/properties'] ||
                              tagData['properties'];
                console.log('[getTagProperties] Extracted props:', props);
                return props || [];
            }
            return [];
        } catch (error) {
            console.error('Failed to get tag properties:', error);
            return [];
        }
    }

    /**
     * Resolve UUID references in block titles
     * @param {Array} blocks - Array of block objects
     * @param {string} graphName - Ignored
     * @returns {Promise<Array>} Blocks with resolved UUIDs
     */
    async resolveUUIDs(blocks, graphName) {
        const uuidPattern = /\[\[([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\]\]/g;
        const uuidsToResolve = new Set();

        blocks.forEach(block => {
            const title = block['block/title'] || block['title'];
            if (title) {
                const matches = title.matchAll(uuidPattern);
                for (const match of matches) {
                    uuidsToResolve.add(match[1]);
                }
            }
        });

        if (uuidsToResolve.size === 0) {
            return blocks;
        }

        console.log(`Resolving ${uuidsToResolve.size} UUID references...`);

        const uuidMap = {};
        for (const uuid of uuidsToResolve) {
            try {
                const query = `[:find (pull ?b [:block/title]) :where [?b :block/uuid #uuid "${uuid}"]]`;
                const result = await this.executeQuery(graphName, query);

                if (result.data && result.data.length > 0) {
                    const block = result.data[0];
                    const resolvedTitle = block && (block['block/title'] || block['title']);
                    if (resolvedTitle) {
                        uuidMap[uuid] = resolvedTitle;
                    }
                }
            } catch (error) {
                console.warn(`Failed to resolve UUID ${uuid}:`, error);
            }
        }

        console.log(`Resolved ${Object.keys(uuidMap).length} UUIDs`);

        return blocks.map(block => {
            const titleKey = block['block/title'] ? 'block/title' : (block['title'] ? 'title' : null);
            if (titleKey) {
                let resolvedTitle = block[titleKey];
                for (const [uuid, resolvedName] of Object.entries(uuidMap)) {
                    const pattern = `[[${uuid}]]`;
                    const replacement = `[[${resolvedName}]]`;
                    resolvedTitle = resolvedTitle.replace(pattern, replacement);
                }

                return {
                    ...block,
                    [titleKey]: resolvedTitle
                };
            }
            return block;
        });
    }
}

// Export as global for use in other scripts
window.LogseqAPI = LogseqAPI;
