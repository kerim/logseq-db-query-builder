/**
 * API Layer - Communication with Logseq HTTP Server
 * Server: http://localhost:8765
 */

const API_BASE_URL = 'http://localhost:8765';

class LogseqAPI {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Check if server is running
     */
    async checkHealth() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json();
            return data.status === 'healthy';
        } catch (error) {
            console.error('Health check failed:', error);
            return false;
        }
    }

    /**
     * Get list of available graphs
     */
    async listGraphs() {
        try {
            const response = await fetch(`${this.baseUrl}/list`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to list graphs');
            }

            // Parse graph names from stdout
            // Format: "DB Graphs:\n  graph1\n  graph2\n"
            const stdout = data.stdout || '';
            const lines = stdout.split('\n');
            const graphs = [];
            
            let inDBSection = false;
            for (const line of lines) {
                if (line.includes('DB Graphs:')) {
                    inDBSection = true;
                    continue;
                }
                if (line.includes('File Graphs:')) {
                    break; // Only get DB graphs
                }
                if (inDBSection && line.trim()) {
                    graphs.push(line.trim());
                }
            }
            
            return graphs;
        } catch (error) {
            console.error('Failed to list graphs:', error);
            throw error;
        }
    }

    /**
     * Execute a Datalog query on a graph
     * @param {string} graphName - Name of the graph
     * @param {string} query - Datalog query string
     */
    async executeQuery(graphName, query) {
        try {
            const response = await fetch(`${this.baseUrl}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    graph: graphName,
                    query: query
                })
            });

            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || data.stderr || 'Query execution failed');
            }

            return {
                success: true,
                data: data.data || [],
                raw: data
            };
        } catch (error) {
            console.error('Query execution failed:', error);
            throw error;
        }
    }

    /**
     * Search for pages by name/title (uses the /search endpoint)
     * @param {string} graphName - Name of the graph
     * @param {string} searchTerm - Search term
     */
    async searchPages(graphName, searchTerm) {
        try {
            const response = await fetch(
                `${this.baseUrl}/search?q=${encodeURIComponent(searchTerm)}&graph=${encodeURIComponent(graphName)}`
            );
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Search failed');
            }

            // Extract page names from results
            const results = data.data || [];
            return results.map(item => {
                // Return both name and title for display
                return {
                    name: item['block/name'],
                    title: item['block/title'],
                    uuid: item['block/uuid']
                };
            });
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        }
    }

    /**
     * Get all tags from a graph
     * @param {string} graphName - Name of the graph
     * @param {string} searchTerm - Optional search filter
     */
    async getTags(graphName, searchTerm = '') {
        try {
            // Query to find all tags (no filtering in query - do it in JavaScript)
            const query = `[:find (pull ?t [:block/title :block/uuid])
                            :where
                            [?b :block/tags ?t]
                            [?t :block/title]]`;

            const result = await this.executeQuery(graphName, query);

            // Deduplicate and filter tags
            const tagMap = new Map();
            result.data.forEach(item => {
                const tag = item[0]; // Pull returns nested array
                if (tag && tag['block/title']) {
                    // Filter in JavaScript (case-insensitive)
                    if (!searchTerm || tag['block/title'].toLowerCase().includes(searchTerm.toLowerCase())) {
                        tagMap.set(tag['block/title'], {
                            title: tag['block/title'],
                            uuid: tag['block/uuid']
                        });
                    }
                }
            });

            return Array.from(tagMap.values());
        } catch (error) {
            console.error('Failed to get tags:', error);
            throw error;
        }
    }

    /**
     * Get property names and metadata from graph
     * @param {string} graphName - Name of the graph
     * @param {string} searchTerm - Optional search filter
     * @returns {Promise<Array>} Array of {title, ident, namespace} objects
     */
    async getProperties(graphName, searchTerm = '') {
        try {
            // This query gets all property namespaces
            // We'll extract unique property names from the namespaces
            const query = `[:find ?prop
                            :where
                            [?b ?prop ?v]
                            [(namespace ?prop)]]`;

            const result = await this.executeQuery(graphName, query);

            // Extract property names and filter
            const propsMap = new Map();
            result.data.forEach(item => {
                const prop = item;  // item is already a string, not an array
                if (prop) {
                    // Extract property name from namespace
                    // e.g., ":logseq.property/name" -> "name"
                    // e.g., ":user.property/email-Abc123" -> "email"
                    const parts = prop.split('/');
                    if (parts.length === 2) {
                        const namespace = parts[0].replace(':', '');
                        let propName = parts[1];
                        // Remove UUID suffix from user properties
                        // e.g., "email-Abc123" -> "email"
                        const cleanName = propName.replace(/-[A-Za-z0-9_]+$/, '');

                        if (!searchTerm || cleanName.toLowerCase().includes(searchTerm.toLowerCase())) {
                            // Use cleanName as key to deduplicate
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
     * @param {string} graphName - Name of the graph
     * @param {string} propertyName - Property name (without namespace)
     * @returns {Promise<Object|null>} Property schema or null if not found
     */
    async getPropertySchema(graphName, propertyName) {
        try {
            const query = `[:find (pull ?p [*])
                            :where
                            (or
                              [?p :db/ident :user.property/${propertyName}]
                              [?p :db/ident :logseq.property/${propertyName}])]`;

            const result = await this.executeQuery(graphName, query);
            if (result.data.length > 0) {
                const schema = result.data[0][0];
                return {
                    name: schema[':block/title'],
                    ident: schema[':db/ident'],
                    valueType: schema[':db/valueType'],
                    cardinality: schema[':db/cardinality']
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
     * @param {string} graphName - Name of the graph
     * @param {string} propertyIdent - Full property identifier (e.g., ":logseq.property/status")
     * @returns {Promise<Array>} Array of {title, id} objects
     */
    async getPropertyValues(graphName, propertyIdent) {
        try {
            // Ensure property ident has : prefix for query
            const queryIdent = propertyIdent.startsWith(':') ? propertyIdent : `:${propertyIdent}`;
            const query = `[:find (pull ?val [:block/title :db/id])
                            :where
                            [_ ${queryIdent} ?val]]`;

            const result = await this.executeQuery(graphName, query);
            // Result structure: [{block/title: "...", db/id: 123}, ...]
            // Note: Keys don't have ':' prefix
            return result.data.map(item => ({
                title: item['block/title'] || item[':block/title'],
                id: item['db/id'] || item[':db/id']
            }));
        } catch (error) {
            console.error('Failed to get property values:', error);
            return [];
        }
    }

    /**
     * Get properties associated with a tag
     * @param {string} graphName - Name of the graph
     * @param {string} tagName - Tag name
     * @returns {Promise<Array>} Array of property identifiers
     */
    async getTagProperties(graphName, tagName) {
        try {
            const query = `[:find (pull ?tag [:logseq.property.class/properties])
                            :where
                            [?tag :block/title "${tagName}"]]`;

            const result = await this.executeQuery(graphName, query);
            if (result.data.length > 0) {
                const props = result.data[0][0][':logseq.property.class/properties'];
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
     * Converts [[uuid]] to [[title]] by querying each UUID
     * @param {Array} blocks - Array of block objects
     * @param {string} graphName - Name of the graph
     * @returns {Promise<Array>} Blocks with resolved UUIDs
     */
    async resolveUUIDs(blocks, graphName) {
        const uuidPattern = /\[\[([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\]\]/g;
        const uuidsToResolve = new Set();

        // Extract all UUIDs from block titles
        blocks.forEach(block => {
            const title = block['block/title'];
            if (title) {
                const matches = title.matchAll(uuidPattern);
                for (const match of matches) {
                    uuidsToResolve.add(match[1]);
                }
            }
        });

        // If no UUIDs to resolve, return blocks as-is
        if (uuidsToResolve.size === 0) {
            return blocks;
        }

        console.log(`Resolving ${uuidsToResolve.size} UUID references...`);

        // Build UUID to title mapping by querying each UUID
        const uuidMap = {};
        for (const uuid of uuidsToResolve) {
            try {
                const query = `[:find (pull ?b [:block/title]) :where [?b :block/uuid #uuid "${uuid}"]]`;
                const result = await this.executeQuery(graphName, query);

                if (result.data && result.data.length > 0) {
                    const block = result.data[0];
                    if (block && block['block/title']) {
                        uuidMap[uuid] = block['block/title'];
                    }
                }
            } catch (error) {
                console.warn(`Failed to resolve UUID ${uuid}:`, error);
                // Continue with other UUIDs even if one fails
            }
        }

        console.log(`Resolved ${Object.keys(uuidMap).length} UUIDs`);

        // Replace UUIDs with titles in all block titles
        return blocks.map(block => {
            const title = block['block/title'];
            if (title) {
                let resolvedTitle = title;
                for (const [uuid, resolvedName] of Object.entries(uuidMap)) {
                    const pattern = `[[${uuid}]]`;
                    const replacement = `[[${resolvedName}]]`;
                    resolvedTitle = resolvedTitle.replace(pattern, replacement);
                }

                // Return new block object with resolved title
                return {
                    ...block,
                    'block/title': resolvedTitle
                };
            }
            return block;
        });
    }
}

// Export as global for use in other scripts
window.LogseqAPI = LogseqAPI;
