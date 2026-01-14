# Coding Conventions

**Analysis Date:** 2026-01-14

## Naming Patterns

**Files:**
- camelCase for lib modules: `espnClient.ts`, `smartAlerts.ts`, `dataTransform.ts`
- PascalCase for React components: `Header.tsx`
- kebab-case for route directories: `weekly-plan/`, `debug-tx/`
- `route.ts` for all API endpoints (Next.js convention)
- `page.tsx` for all pages (Next.js convention)

**Functions:**
- camelCase for all functions: `getLeagueSnapshot()`, `calculateSnapshotDiff()`
- Verb prefixes: `get*`, `fetch*`, `build*`, `transform*`, `generate*`, `send*`
- Async functions: No special prefix (async keyword used directly)

**Variables:**
- camelCase for variables: `leagueId`, `seasonId`, `espnResponse`
- SCREAMING_SNAKE_CASE for constants: `STAR_THRESHOLD`, `ESPN_API_BASE`, `RATE_LIMIT`
- No underscore prefix for private members

**Types:**
- PascalCase for interfaces: `Player`, `Team`, `LeagueSnapshot`, `SmartAlert`
- PascalCase for type aliases: `PlayerStatus`, `SmartAlertType`
- No `I` prefix for interfaces

## Code Style

**Formatting:**
- 2 space indentation
- Single quotes for strings
- Semicolons required
- ~100-120 character line length (no strict limit)

**Linting:**
- ESLint with `eslint-config-next` defaults
- No custom rules configured
- Run: `npm run lint`

## Import Organization

**Order:**
1. External packages (next, react)
2. Internal modules (@/lib/*, @/types/*)
3. Relative imports (./*, ../*)
4. Type imports (import type {})

**Grouping:**
- No explicit blank lines between groups
- Types often imported separately with `import type`

**Path Aliases:**
- `@/*` maps to `src/*` (configured in `tsconfig.json`)

## Error Handling

**Patterns:**
- Try-catch at API route boundaries
- Services throw Error with descriptive messages
- Graceful degradation for optional features (voice briefing)

**Error Types:**
- Standard Error class (no custom error classes)
- Error messages include context: `'ESPN_LEAGUE_ID not configured'`

**Logging:**
- console.error for errors
- console.log for debugging (to be removed in production)

## Logging

**Framework:**
- Console only (console.log, console.error)
- No structured logging library

**Patterns:**
- Prefix with context: `[Refresh]`, `[Watchlist]`, `[ESPN]`
- Error objects logged directly

**When:**
- API route errors
- ESPN fetch retries
- Alert generation events

## Comments

**When to Comment:**
- File-level JSDoc for module purpose
- Inline comments for business logic thresholds
- Section separators for long files

**JSDoc/TSDoc:**
- Used for file headers and exported functions
- Format: `/** ... */` with description

**TODO Comments:**
- Format: `// TODO: description`
- No issue linking convention

**Examples from codebase:**
```typescript
/**
 * ESPN Fantasy Basketball API Client
 * Server-only module for authenticated ESPN API access
 */

// High-usage stars threshold - when they're out, usage shifts
const STAR_THRESHOLD = 25;

// ============ Public API Functions ============
```

## Function Design

**Size:**
- No strict limit (some functions 100+ lines)
- Complex logic grouped with section comments

**Parameters:**
- Positional parameters for simple functions
- Object destructuring for complex configs

**Return Values:**
- Explicit return types on exported functions
- Promise<T> for async functions
- null for "not found" cases

## Module Design

**Exports:**
- Named exports preferred: `export function getLeagueSnapshot()`
- Default exports for React components/pages
- Type exports: `export type { Player, Team }`

**Barrel Files:**
- `src/types/index.ts` re-exports all types
- No other barrel files

---

*Convention analysis: 2026-01-14*
*Update when patterns change*
