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
            // Query to find all tags (blocks that are tagged)
            const query = searchTerm 
                ? `[:find (pull ?t [:block/title :block/uuid]) 
                    :where 
                    [?b :block/tags ?t] 
                    [?t :block/title ?title]
                    [(clojure.string/includes? ?title "${searchTerm}")]]`
                : `[:find (pull ?t [:block/title :block/uuid]) 
                    :where 
                    [?b :block/tags ?t] 
                    [?t :block/title]]`;

            const result = await this.executeQuery(graphName, query);
            
            // Deduplicate tags by title
            const tagMap = new Map();
            result.data.forEach(item => {
                const tag = item[0]; // Pull returns nested array
                if (tag && tag['block/title']) {
                    tagMap.set(tag['block/title'], {
                        title: tag['block/title'],
                        uuid: tag['block/uuid']
                    });
                }
            });
            
            return Array.from(tagMap.values());
        } catch (error) {
            console.error('Failed to get tags:', error);
            throw error;
        }
    }

    /**
     * Get property names from graph
     * Note: This is a simplified version - in Phase 1 we'll use manual input
     * @param {string} graphName - Name of the graph
     * @param {string} searchTerm - Optional search filter
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
            const props = new Set();
            result.data.forEach(item => {
                const prop = item[0];
                if (prop) {
                    // Extract property name from namespace
                    // e.g., ":logseq.property/name" -> "name"
                    // e.g., ":user.property/email-Abc123" -> "email"
                    const parts = prop.split('/');
                    if (parts.length === 2) {
                        let propName = parts[1];
                        // Remove UUID suffix from user properties
                        // e.g., "email-Abc123" -> "email"
                        propName = propName.replace(/-[A-Za-z0-9_]+$/, '');
                        
                        if (!searchTerm || propName.includes(searchTerm)) {
                            props.add(propName);
                        }
                    }
                }
            });
            
            return Array.from(props).sort();
        } catch (error) {
            console.error('Failed to get properties:', error);
            throw error;
        }
    }
}

// Export as global for use in other scripts
window.LogseqAPI = LogseqAPI;
