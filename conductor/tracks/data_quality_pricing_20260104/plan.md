# Plan: Data Quality, Product List & Pricing Rules Fix

## Phase 1: Robust Parsing & Categorization
- [x] Task: Create Comprehensive Test Cases
    - **Goal:** Create a `tests/parser-cases.ts` file with real examples of failing titles (Tire, Rim, Battery).
- [x] Task: Refactor `TitleParserService` - Category Detection
    - **Goal:** Implement a pre-check function to determine category based on keywords before applying specific regexes.
- [x] Task: Enhance Regex Patterns
    - **Goal:** Update regex for Tire (spaces support), Rim (PCD/Offset), and Battery (Ah/CCA).
    - **Test:** Run `bun test` against the new test cases until all pass.
- [x] Task: Run `process.ts` Re-Evaluation
    - **Goal:** Run the process script on the full DB to update `validationStatus` for all products based on new logic.
- [x] Task: Conductor - User Manual Verification 'Parsing Logic' (Protocol in workflow.md)

## Phase 2: Pricing Rules Management Fix
- [x] Task: Update `priceRules.ts` Router
    - **Goal:** Ensure `delete` mutation exists and works.
- [x] Task: Update Pricing UI (`dashboard/pricing-rules/page.tsx`)
    - **Goal:** Add a "Delete" button to the rules table column. Wire it to the mutation.
    - **Constraint:** Add a confirmation dialog before deleting.
- [x] Task: Conductor - User Manual Verification 'Pricing Rules' (Protocol in workflow.md)

## Phase 3: Admin Product List & Data Quality UI
- [x] Task: Update `products.ts` Router (`getAll`)
    - **Goal:** Change source to `supplierProducts` table. Add logic to check `productMap` for sync status.
    - **Input:** Pagination params (limit, offset), Filters (status, category).
- [x] Task: Update Product List Page (`dashboard/products/page.tsx`)
    - **Goal:** Replace the current mock/cache view with a server-side paginated table using the new router.
    - **Columns:** Add "Quality" (Parsing Status) and "Sync Status" columns.
- [x] Task: Add Filtering UI
    - **Goal:** Allow filtering by "Invalid" to quickly find parsing errors.
- [x] Task: Conductor - User Manual Verification 'Product List UI' (Protocol in workflow.md)
