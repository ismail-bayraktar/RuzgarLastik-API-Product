# Plan: Data Integrity & Enrichment

## Phase 1: Taxonomy ID Fix
- [ ] Task: Create `scripts/diagnose-taxonomy.ts`
    - **Goal:** Fetch and list valid Product Taxonomy Node IDs from Shopify API to find the correct GIDs for Tire, Rim, and Battery.
- [ ] Task: Update `TAXONOMY_MAP` in `packages/api/src/routers/sync.ts`
    - **Goal:** Replace invalid/guessed GIDs with the verified ones from the diagnosis script.
- [ ] Task: Verify Sync (Small Batch)
    - **Goal:** Run sync for 1 product and confirm `INVALID_PRODUCT_TAXONOMY_NODE_ID` error is gone.

## Phase 2: Description Generation
- [ ] Task: Create `apps/web/src/services/descriptionGenerator.ts`
    - **Goal:** A service that takes product data and metafields, returns an HTML string (Table + Summary).
    - **Features:**
        - Technical Specs Table (Width, Ratio, Fuel Efficiency, etc.)
        - Auto-generated summary sentence ("{Brand} {Title} {Season} lastiği...")
- [ ] Task: Integrate into `sync.ts`
    - **Goal:** Use `descriptionGenerator` to populate `descriptionHtml` during create/update.

## Phase 3: Final Polish
- [ ] Task: Full Sync Test
    - **Goal:** Sync 50 products. Check logs. Check Shopify Admin.
