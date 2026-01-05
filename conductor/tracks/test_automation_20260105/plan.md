# Plan: Test Automation & QA V1

## Phase 1: Unit Testing (Core Logic)
- [ ] Task: Create `apps/web/src/tests/descriptionGenerator.test.ts`
    - **Goal:** Test HTML generation for Tire, Rim, Battery. Verify XSS protection prevents script injection. Check data formatting.
- [ ] Task: Create `apps/web/src/tests/metafieldUtils.test.ts`
    - **Goal:** Test `PARSER_TO_METAFIELD_MAP` logic indirectly via helper functions. Verify `coerceMetafieldValue` handles numbers, strings, and booleans correctly.

## Phase 2: Integration Testing (Data Flow)
- [ ] Task: Create `apps/web/src/tests/sync-mapping.test.ts`
    - **Goal:** Simulate the `start` mutation logic (without DB) to verify that a "Rim" product with `width` maps to `jantGenislik` and NOT `lastikGenislik`.

## Phase 3: CI/CD Integration
- [ ] Task: Add `test` script to `package.json` and ensure it runs all tests.
- [ ] Task: Run full test suite and fix any regressions.
