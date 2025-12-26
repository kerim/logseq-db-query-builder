# Project-Specific Instructions for Logseq DB Query Builder

## Version Management Protocol

**CRITICAL: ALWAYS increment version numbers with EVERY code change**

### Current Version Tracking
- **Current Version**: Check `index.html` line 6 for the authoritative version number
- **Never reuse version numbers** - each build must have a unique version
- **Use semantic versioning**: `MAJOR.MINOR.PATCH`
  - `MAJOR`: Breaking changes or major feature releases (e.g., 1.0.0, 2.0.0)
  - `MINOR`: New features, non-breaking changes (e.g., 0.1.0, 0.2.0)
  - `PATCH`: Bug fixes, small improvements (e.g., 0.0.2, 0.0.3)

### Version Update Locations
When incrementing version, update in these files:
1. **`index.html`** - Line 6: `<title>Logseq DB Query Builder v0.0.X</title>`
2. **`README.md`** - Near top: version badge or header
3. **`docs/PROJECT_STATUS.md`** - Current version section at top

### Pre-Change Checklist

**Before making ANY code changes, complete this checklist:**

- [ ] Check current version number in `index.html` line 6
- [ ] Determine new version number (increment PATCH for small changes, MINOR for features)
- [ ] Verify git status is clean or has only intended changes
- [ ] Create feature branch if needed (optional for small patches)
- [ ] **TEST QUERY SYNTAX FIRST**: Before implementing, test the query pattern using `logseq query` CLI to verify it works
  - Never assume query syntax - always verify with actual Logseq CLI first
  - Example: `logseq query -g "GRAPH NAME" -- '[:find (pull ?b [*]) :where ...]'`
  - Use `logseq list` to get available graph names
  - Prevents shipping broken implementations based on incorrect assumptions

### CRITICAL: Fix Workflow Tool Issues Directly

**NEVER work around broken tools - fix them first:**

- **CLI not working?** Debug and fix the CLI command syntax, don't skip testing
- **GitHub access issues?** Fix authentication, don't avoid using git
- **Database connection failing?** Fix the connection, don't make assumptions
- **Query syntax unclear?** Test until you understand it, don't guess

**Examples of WRONG behavior:**
- ❌ "The CLI is broken, so I'll just assume the query works"
- ❌ "I can't test this, so let me commit and see what happens"
- ❌ "The tool isn't working, so I'll use a workaround"

**Examples of CORRECT behavior:**
- ✅ "The CLI command failed, let me read the help and fix the syntax"
- ✅ "I'm getting an error, let me debug it before proceeding"
- ✅ "The test isn't working, let me fix the test setup first"

**Philosophy: Tools exist to prevent mistakes. If a tool is broken, fix the tool. Don't bypass it.**

### Post-Change Checklist

**After completing ANY code changes, complete this checklist IN ORDER:**

1. **Update version files**:
   - [ ] Update version in `index.html` (line 6 and line 15)
   - [ ] Update version in `README.md` (if version shown)
   - [ ] Update version in `docs/PROJECT_STATUS.md`
   - [ ] Update `CHANGELOG.md` with changes

2. **Commit immediately** (BEFORE testing):
   - [ ] Run git status to verify changed files
   - [ ] Stage changes: `git add .`
   - [ ] Commit changes with descriptive message
   - [ ] Tag commit with version number
   - [ ] Verify commit and tag were created

3. **Test AFTER committing**:
   - [ ] Test the generated query using the query builder UI or manual CLI test
   - [ ] Confirm the query syntax is correct
   - [ ] Verify results are as expected
   - [ ] If tests fail, fix and increment version again for next commit

**Why commit before testing:**
- Ensures every change has a unique version number
- Creates rollback points for every iteration
- User can always test specific versions
- Git history shows progression of fixes

### Git Workflow

#### 1. Before Starting Work
```bash
# Check current status
git status

# Ensure on main branch
git branch

# Pull latest changes if working with others
git pull origin main
```

#### 2. After Completing Changes
```bash
# Check what changed
git status
git diff

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Add feature X - v0.0.X

- Specific change 1
- Specific change 2
- Updated version to 0.0.X"

# Tag the version
git tag v0.0.X

# Verify commit and tag
git log --oneline -3
git tag -l
```

#### 3. Pushing to Remote (when ready)
```bash
# Push commits
git push origin main

# Push tags
git push origin --tags
```

### Rollback Procedure

If changes need to be reverted:

```bash
# View recent commits
git log --oneline -5

# Revert to specific version tag
git checkout v0.0.X

# Or create new branch from old version
git checkout -b rollback-to-v0.0.X v0.0.X

# Or reset to previous commit (use with caution)
git reset --hard v0.0.X
```

### Example Version Progression

- v0.0.1 - Initial release (completed)
- v0.0.2 - Add text search operators (contains/equals)
- v0.0.3 - Fix bug in autocomplete
- v0.1.0 - Add property type awareness (new feature)
- v0.1.1 - Fix date range query bug
- v0.2.0 - Add boolean logic (AND/OR/NOT)

### Commit Message Format

Use clear, descriptive commit messages:

```
[Short summary] - v0.0.X

- Detailed change 1
- Detailed change 2
- Why the change was made (if not obvious)
- Updated version to 0.0.X
```

Examples:
```
Add text search operators - v0.0.2

- Add contains/equals dropdown to full-text filter
- Update query generator for case-insensitive matching
- Both operators use lower-case comparison
- Updated version to 0.0.2
```

## Development Workflow

### CRITICAL: Test Query Syntax Before Implementation

**ALWAYS test Datalog query patterns with the Logseq CLI BEFORE writing code:**

```bash
# Use logseq list to see available graphs
logseq list

# Test query directly
logseq query -g "GRAPH NAME" -- '[:find (pull ?b [*]) :where [?b :block/title ?title] [(clojure.string/lower-case ?title) ?lower]]'

# Verify results are correct before implementing in code
```

**Why this is critical:**
- Query syntax may not work as assumed
- Clojure/Datalog has specific semantics that differ from other languages
- Testing first prevents shipping broken implementations (like v0.0.2)
- Saves time by catching issues before writing code

**Important Notes:**
- The Logseq CLI can access graphs whether or not the Logseq desktop app is running
- Database lock issues are NOT caused by the app being open
- If you get "unable to open database file" errors, debug the actual issue - don't assume it's because the app is running

### Testing Before Commit

1. **Manual Testing Checklist**:
   - [ ] **Test query with CLI first** - Verify syntax works with real Logseq CLI
   - [ ] Open `index.html` in browser
   - [ ] Test new feature with real graph data
   - [ ] Verify query generation is correct
   - [ ] Check browser console for errors
   - [ ] Test edge cases (empty input, special characters)
   - [ ] Verify theme toggle still works
   - [ ] Check existing features still work
   - [ ] Compare generated query against working CLI version

2. **Only commit after verification**:
   - Do NOT mark changes as complete until implementation is verified
   - Wait for user confirmation that feature works if they are testing
   - Fix any issues found during testing
   - Only then proceed with version increment and commit
   - Never commit broken code based on assumptions

### File Organization

This project follows clean separation of concerns:
```
logseq-db-query-builder/
├── .claude/           # Project-specific Claude instructions (this file)
├── docs/              # Documentation, planning docs (git-ignored)
├── tests/             # Test scripts (git-ignored)
├── js/                # Source code
├── styles/            # CSS files
├── index.html         # Main HTML file
├── README.md
└── CHANGELOG.md
```

**Rules**:
- Source code only in `js/` and `styles/`
- Documentation only in `docs/`
- Test files only in `tests/`
- Never mix these concerns

## Project Context

### Technology Stack
- Vanilla JavaScript (ES6+, no frameworks)
- No build process or dependencies
- Direct browser execution
- Logseq HTTP Server API integration

### Key Files
- **`js/app.js`** - Main application logic, initialization
- **`js/filters.js`** - Filter UI management, FILTER_TYPES config
- **`js/queryGenerator.js`** - Datalog query generation
- **`js/api.js`** - HTTP API client for Logseq server
- **`js/autocomplete.js`** - Autocomplete functionality
- **`styles/main.css`** - All styles

### API Integration
- Connects to local Logseq HTTP server (default: http://localhost:12345)
- Uses Logseq CLI datalog query endpoint
- Requires `logseq-http-server` running separately

## Common Tasks

### Adding a New Filter Type

1. Add to `FILTER_TYPES` in `js/filters.js`
2. Create `build[TypeName]Clause()` method in `js/queryGenerator.js`
3. Add to `buildWhereClause()` switch statement
4. Update `isValidFilter()` if needed
5. Test with real data
6. Update version, changelog, commit

### Modifying Query Generation

1. Edit relevant `build*Clause()` method in `js/queryGenerator.js`
2. Test generated query syntax
3. Verify results from API
4. Update version, changelog, commit

### UI Changes

1. Edit `js/filters.js` for filter UI
2. Edit `styles/main.css` for styling
3. Test in both light and dark themes
4. Update version, changelog, commit

## Notes

- Always test against a real Logseq graph
- Check browser console for errors
- Queries are case-insensitive by default (use `clojure.string/lower-case`)
- Property namespaces: try both `:user.property/` and `:logseq.property/`
- Entity refs in results need manual resolution (future enhancement)
