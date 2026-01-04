# Specification: Data Quality, Product List & Pricing Rules Fix

## 1. Overview
This track addresses three critical issues in the Ruzgar Lastik Sync system:
1.  **Data Quality (Parsing):** The current parsing logic is fragile and fails to detect categories/hierarchies correctly across Tires, Rims, and Batteries.
2.  **Product Visibility:** The Admin Product List (`/dashboard/products`) does not reflect the full database state (`supplierProducts`) or allow for data quality inspection.
3.  **Pricing Rules Management:** Users cannot delete pricing rules because the UI is missing the delete action, and the logic for "automatic" vs "custom" rules needs clarification.

## 2. Functional Requirements

### 2.1 Enhanced Title Parsing & Categorization
*   **Refactor `TitleParserService`:**
    *   **Category Detection:** Implement a robust keyword-based detector (e.g., "Jant", "Akü", "Lastik", "Wheel", "Battery", "Tire") to assign categories before regex parsing.
    *   **Tire Regex:** Improve patterns to handle spaces vs slashes (e.g., `205 55 16` vs `205/55R16`) and varying speed index positions.
    *   **Rim Regex:** Capture `width`, `diameter`, `PCD`, `ET/Offset` reliably. Handle variations like `7J x 17`.
    *   **Battery Regex:** Distinctly capture `Ah` (Capacity) and `A` (CCA) values.
*   **Hierarchy/Attribute Extraction:** Extract Brand/Model where possible.

### 2.2 Admin Product List (Data Quality View)
*   **Source of Truth:** Fetch data directly from `supplierProducts` table.
*   **UI Columns:**
    *   Basic: SKU, Title, Brand, Category.
    *   **Quality Indicators:** "Parsing Status" (Valid/Invalid), "Metafield Coverage" (%).
    *   **Shopify Status:** "Synced" / "Not Synced" indicator.
*   **Filters:** Filter by Validation Status (Invalid, Valid), Category, and Brand.

### 2.3 Pricing Rules Fix
*   **UI Update:** Add a "Delete" (Trash icon) button to each row in the Pricing Rules table.
*   **Backend Logic:** Ensure the `deleteRule` mutation correctly removes the entry from the `pricingRules` table.
*   **Constraint:** Prevent deletion of "System Default" rules (if any), or allow resetting them to 0.

## 3. Non-Functional Requirements
*   **Performance:** Parsing logic must be efficient (regex) to handle 4000+ products in seconds during the `process` phase.
*   **UX:** The product list must support pagination (server-side) to avoid crashing the browser with large datasets.

## 4. Acceptance Criteria
*   [ ] `TitleParserService` correctly identifies category for a mixed list of test titles.
*   [ ] Tire parser handles "205 55 16" and "205/55R16" correctly.
*   [ ] Rim parser extracts PCD and Offset correctly.
*   [ ] Battery parser separates Ampere-hour and CCA.
*   [ ] `/dashboard/products` page lists all 4000+ products from DB with pagination.
*   [ ] Users can filter products by "Invalid" status to see what failed parsing.
*   [ ] Users can delete a custom pricing rule from the dashboard.

## 5. Out of Scope
*   Manual editing of parsed data in the UI (This track is for *displaying* and *auto-parsing* improvement only).
*   Image synchronization improvements.
