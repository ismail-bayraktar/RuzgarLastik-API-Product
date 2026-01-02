/**
 * Shopify GraphQL Admin API Rate Limiter
 *
 * Shopify's GraphQL API uses a cost-based rate limiting system:
 * - Maximum bucket size: 2000 points
 * - Restore rate: 100 points per second
 * - Each query has a "cost" based on complexity
 *
 * @see https://shopify.dev/docs/api/usage/rate-limits#graphql-admin-api-rate-limits
 */

export interface RateLimiterConfig {
  /** Maximum bucket size in points (default: 2000) */
  maxCost?: number;
  /** Points restored per second (default: 100) */
  restoreRate?: number;
  /** Safety margin - stop requests when bucket drops below this (default: 100) */
  safetyMargin?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export interface CostInfo {
  requestedQueryCost: number;
  actualQueryCost: number;
  throttleStatus: {
    maximumAvailable: number;
    currentlyAvailable: number;
    restoreRate: number;
  };
}

export class ShopifyRateLimiter {
  private currentCost: number = 0;
  private maxCost: number;
  private restoreRate: number;
  private safetyMargin: number;
  private lastRestoreTime: number;
  private debug: boolean;

  constructor(config: RateLimiterConfig = {}) {
    this.maxCost = config.maxCost ?? 2000;
    this.restoreRate = config.restoreRate ?? 100;
    this.safetyMargin = config.safetyMargin ?? 100;
    this.lastRestoreTime = Date.now();
    this.debug = config.debug ?? false;
  }

  /**
   * Wait until there's enough capacity for the requested cost
   * @param requestedCost - The estimated cost of the upcoming request
   */
  async waitForCapacity(requestedCost: number): Promise<void> {
    this.restorePoints();

    const availableCost = this.maxCost - this.currentCost - this.safetyMargin;

    if (requestedCost > availableCost) {
      const pointsNeeded = requestedCost - availableCost;
      const waitTimeMs = Math.ceil((pointsNeeded / this.restoreRate) * 1000);

      if (this.debug) {
        console.log(
          `[RateLimiter] Waiting ${waitTimeMs}ms for ${pointsNeeded} points to restore`
        );
      }

      await this.sleep(waitTimeMs);
      this.restorePoints();
    }

    // Reserve the cost
    this.currentCost += requestedCost;

    if (this.debug) {
      console.log(
        `[RateLimiter] Reserved ${requestedCost} points. Current usage: ${this.currentCost}/${this.maxCost}`
      );
    }
  }

  /**
   * Update the rate limiter with actual cost information from Shopify's response
   * This provides more accurate tracking than estimation alone
   * @param costInfo - Cost information from Shopify's response extensions
   */
  updateFromResponse(costInfo: CostInfo): void {
    // Use actual available from Shopify's response
    const available = costInfo.throttleStatus.currentlyAvailable;
    this.currentCost = this.maxCost - available;
    this.lastRestoreTime = Date.now();

    if (this.debug) {
      console.log(
        `[RateLimiter] Updated from response. Available: ${available}, Actual cost: ${costInfo.actualQueryCost}`
      );
    }
  }

  /**
   * Get the currently available points
   */
  getAvailablePoints(): number {
    this.restorePoints();
    return Math.max(0, this.maxCost - this.currentCost - this.safetyMargin);
  }

  /**
   * Get current rate limiter status
   */
  getStatus(): {
    currentCost: number;
    maxCost: number;
    availablePoints: number;
    utilizationPercent: number;
  } {
    this.restorePoints();
    const available = this.getAvailablePoints();
    return {
      currentCost: this.currentCost,
      maxCost: this.maxCost,
      availablePoints: available,
      utilizationPercent: Math.round((this.currentCost / this.maxCost) * 100),
    };
  }

  /**
   * Reset the rate limiter (useful for testing or after long pauses)
   */
  reset(): void {
    this.currentCost = 0;
    this.lastRestoreTime = Date.now();
  }

  /**
   * Restore points based on elapsed time
   */
  private restorePoints(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRestoreTime) / 1000;
    const restoredPoints = elapsedSeconds * this.restoreRate;

    this.currentCost = Math.max(0, this.currentCost - restoredPoints);
    this.lastRestoreTime = now;
  }

  /**
   * Sleep for the specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Estimated costs for common Shopify GraphQL operations
 * These are rough estimates - actual costs may vary based on query complexity
 */
export const ESTIMATED_COSTS = {
  // Query costs
  getProduct: 10,
  getProducts: 50,
  getProductBySku: 15,
  getInventoryLevel: 5,

  // Mutation costs
  createProduct: 20,
  updateProduct: 15,
  updateVariant: 10,
  updateInventory: 10,
  setMetafields: 15,

  // Bulk operations
  bulkOperationRunQuery: 100,
  bulkOperationRunMutation: 100,
} as const;

/**
 * Parse cost information from Shopify GraphQL response
 * @param response - The raw response from Shopify
 * @returns CostInfo if available, null otherwise
 */
export function parseCostFromResponse(response: any): CostInfo | null {
  try {
    const extensions = response?.extensions?.cost;
    if (!extensions) return null;

    return {
      requestedQueryCost: extensions.requestedQueryCost,
      actualQueryCost: extensions.actualQueryCost,
      throttleStatus: {
        maximumAvailable: extensions.throttleStatus.maximumAvailable,
        currentlyAvailable: extensions.throttleStatus.currentlyAvailable,
        restoreRate: extensions.throttleStatus.restoreRate,
      },
    };
  } catch {
    return null;
  }
}

// Singleton instance for shared rate limiting across services
let sharedRateLimiter: ShopifyRateLimiter | null = null;

/**
 * Get the shared rate limiter instance
 * @param config - Optional configuration (only used on first call)
 */
export function getSharedRateLimiter(
  config?: RateLimiterConfig
): ShopifyRateLimiter {
  if (!sharedRateLimiter) {
    sharedRateLimiter = new ShopifyRateLimiter(config);
  }
  return sharedRateLimiter;
}

/**
 * Reset the shared rate limiter instance (useful for testing)
 */
export function resetSharedRateLimiter(): void {
  sharedRateLimiter = null;
}
