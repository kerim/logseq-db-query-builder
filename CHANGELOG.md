# Changelog

All notable changes to the Logseq DB Query Builder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2024-12-26

### Added
- Full-text search operator dropdown with "contains" and "equals" options
- Case-insensitive exact match capability for text search
- Helps distinguish between exact matches (e.g., "Lim" surname) and partial matches (e.g., "limit")

### Changed
- Updated `buildFullTextClause()` in queryGenerator.js to support multiple operators
- Modified FILTER_TYPES config in filters.js to include operators for full-text search
- Both operators now use `clojure.string/lower-case` for case-insensitive matching

### Fixed
- Full-text search no longer limited to only "contains" functionality

## [0.0.1] - 2024-12-26

### Added
- Initial release of Logseq DB Query Builder
- Visual filter interface with 8 filter types:
  - Page name matching (contains, starts-with, ends-with, is)
  - Tag filtering with autocomplete
  - Full-text search across block titles
  - Property filtering (manual property name entry)
  - Page reference filtering with autocomplete
  - Task filtering (tag-based)
  - Priority filtering (A, B, C)
  - Date range filtering (between dates)
- Real-time Datalog query generation
- Live results preview from Logseq graph
- Query copy to clipboard with visual feedback
- Dark/light theme toggle
- Graph selection with connection status indicator
- Auto-complete functionality for tags and page names
- Result limiting (25, 50, 100, 500)
- Logseq-inspired UI design
- Comprehensive documentation in README.md
- Help section with usage instructions

### Technical Details
- Vanilla JavaScript (no framework dependencies)
- Communicates with logseq-http-server (localhost:8765)
- Uses `[*]` syntax to pull all block attributes
- Generates queries in `{:query ...}` format for Logseq compatibility
- API receives raw Datalog format
- localStorage for graph preference and theme

### Known Limitations
- AND logic only (OR logic not yet supported)
- No nested filter groups
- Property names must be typed manually (no autocomplete)
- Tag entity references not resolved in results display
- No tag inheritance queries
- No NOT operator support
- Limited text search operators (only "contains")

## [Unreleased]

### Planned for v0.1.0
- ~~Text search operators (equals, starts-with, ends-with, regex)~~ Partially done: contains/equals in v0.0.2
- More text search operators (starts-with, ends-with, regex)
- Boolean logic support (AND/OR/NOT)
- Nested filter groups
- Property type awareness
- Property name autocomplete
- Enhanced tag autocomplete with hierarchy

### Future Versions
- Reverse query parsing (paste query → populate UI)
- Query presets and templates
- Tag inheritance queries
- Result sorting and export
- Advanced aggregation queries
- Query validation and testing tools
