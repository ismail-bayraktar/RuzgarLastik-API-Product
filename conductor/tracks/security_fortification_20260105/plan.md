# Plan: Security & Fortification

## Phase 1: XSS Protection (Input Sanitization)
- [x] Task: Implement `escapeHtml` utility
    - **Goal:** Create a helper function to escape special characters (<, >, &, ", ') in strings.
- [x] Task: Update `DescriptionGeneratorService`
    - **Goal:** Wrap all dynamic data insertions (title, brand, metafield values) with `escapeHtml` to prevent XSS attacks via supplier data.

## Phase 2: Resilience (Robustness)
- [ ] Task: Review `ShopifyService` image handling
    - **Goal:** Add a basic check (e.g., regex) to ensure image URLs are valid HTTP/HTTPS links before sending to Shopify, preventing API errors.
