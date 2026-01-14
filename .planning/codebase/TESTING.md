# Testing Patterns

**Analysis Date:** 2026-01-14

## Test Framework

**Runner:**
- No formal test framework (Jest, Vitest, etc.)
- Custom script using `tsx` for TypeScript execution

**Assertion Library:**
- Manual console.log validation
- No assertion library configured

**Run Commands:**
```bash
npm run test:fixtures    # Run fixture validation script
npm run dev              # Manual testing via browser
```

## Test File Organization

**Location:**
- `scripts/test-fixtures.ts` - Single test script
- `fixtures/` - Sample JSON data

**Naming:**
- No `.test.ts` or `.spec.ts` files
- Manual testing only

**Structure:**
```
adam/
├── fixtures/
│   ├── sample-league.json
│   └── sample-free-agents.json
└── scripts/
    └── test-fixtures.ts
```

## Test Structure

**Current Approach:**
```typescript
// scripts/test-fixtures.ts
function testLeagueSnapshot() {
  const data = loadFixture('sample-league.json');
  // Manual validation via console output
  console.log('Loaded snapshot:', data);
}
```

**Patterns:**
- Load fixture from file
- Call transformation function
- Log output for manual inspection
- No automated assertions

## Mocking

**Framework:**
- None configured

**Patterns:**
- No mocking in place
- Integration tests against real APIs not implemented

**What Would Need Mocking:**
- ESPN API responses
- Telegram API calls
- Gemini API responses
- File system operations

## Fixtures and Factories

**Test Data:**
```typescript
// Load from fixtures directory
function loadFixture<T>(filename: string): T {
  const path = join(__dirname, '../fixtures', filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content) as T;
}
```

**Location:**
- `fixtures/` directory at project root
- JSON files with sample API responses

## Coverage

**Requirements:**
- None - no coverage tracking configured

**Configuration:**
- `.gitignore` includes `coverage/` but no setup

**View Coverage:**
- Not available

## Test Types

**Unit Tests:**
- Not implemented
- Would test: `dataTransform.ts`, `optimizer.ts` functions

**Integration Tests:**
- Not implemented
- Would test: API routes with mocked external services

**E2E Tests:**
- Not implemented
- Would test: Full refresh → alert flow

## Common Patterns

**Current Testing Approach:**
1. Manual testing via `npm run dev`
2. Hit `/api/refresh` endpoint in browser
3. Check Telegram for alerts
4. Verify dashboard UI renders correctly

**What Should Be Tested:**
- `src/lib/smartAlerts.ts` - Alert generation logic
- `src/lib/optimizer.ts` - Waiver scoring algorithms
- `src/lib/dataTransform.ts` - ESPN data normalization
- `src/lib/storage.ts` - Persistence operations

## Recommended Test Setup

If adding tests, consider:
- **Vitest** - Fast, Vite-compatible, ESM-native
- **@testing-library/react** - Component testing
- **msw** - API mocking for ESPN/Telegram

```bash
# Recommended setup
npm install -D vitest @testing-library/react msw
```

---

*Testing analysis: 2026-01-14*
*Update when test patterns change*
