/**
 * Retry utilities for handling transient failures in API calls
 * Implements exponential backoff with jitter for optimal retry behavior
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Function to determine if an error should trigger a retry */
  retryOn?: (error: Error) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
  /** Enable jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
}

/**
 * Execute a function with automatic retry on failure
 * Uses exponential backoff with optional jitter
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    retryOn = () => true,
    onRetry,
    jitter = true,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (attempt === maxRetries || !retryOn(lastError)) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      // Add jitter (0-50% of the delay)
      if (jitter) {
        delay = delay + Math.random() * delay * 0.5;
      }

      // Call the retry callback if provided
      if (onRetry) {
        onRetry(lastError, attempt + 1, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Check if an error is a retryable Shopify API error
 * @param error - The error to check
 * @returns true if the error should trigger a retry
 */
export function isRetryableShopifyError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Rate limiting / throttling
  if (message.includes("throttled") || message.includes("rate limit")) {
    return true;
  }

  // Network errors
  if (
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("socket hang up") ||
    message.includes("network")
  ) {
    return true;
  }

  // Server errors (5xx)
  if (
    message.includes("500") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("internal server error") ||
    message.includes("bad gateway") ||
    message.includes("service unavailable") ||
    message.includes("gateway timeout")
  ) {
    return true;
  }

  // Shopify-specific transient errors
  if (
    message.includes("temporarily unavailable") ||
    message.includes("try again")
  ) {
    return true;
  }

  return false;
}

/**
 * Check if an error is a retryable network error
 * @param error - The error to check
 * @returns true if the error is network-related
 */
export function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("timeout") ||
    message.includes("socket")
  );
}

/**
 * Extract retry-after duration from error or response
 * @param error - The error or response to check
 * @returns Retry delay in milliseconds, or null if not specified
 */
export function extractRetryAfter(error: Error | Response): number | null {
  // Check if it's a Response object
  if (error instanceof Response) {
    const retryAfter = error.headers.get("Retry-After");
    if (retryAfter) {
      // Retry-After can be seconds or a date
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
      // Try parsing as date
      const date = new Date(retryAfter);
      if (!isNaN(date.getTime())) {
        return Math.max(0, date.getTime() - Date.now());
      }
    }
    return null;
  }

  // Check error message for retry hints
  const message = error.message;
  const match = message.match(/retry.+?(\d+)\s*(seconds?|s|ms|milliseconds?)/i);
  if (match && match[1] && match[2]) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("ms") || unit.startsWith("milli")) {
      return value;
    }
    return value * 1000;
  }

  return null;
}

/**
 * Create a retry-enabled version of a function
 * @param fn - The function to wrap
 * @param options - Retry configuration options
 * @returns A wrapped function with automatic retry
 */
export function withRetryWrapper<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}

/**
 * Execute multiple promises with retry, respecting a concurrency limit
 * @param items - Items to process
 * @param fn - Async function to apply to each item
 * @param options - Configuration including concurrency and retry options
 */
export async function withRetryPool<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    retryOptions?: RetryOptions;
    onItemComplete?: (item: T, result: R, index: number) => void;
    onItemError?: (item: T, error: Error, index: number) => void;
  } = {}
): Promise<Array<{ success: true; result: R } | { success: false; error: Error }>> {
  const { concurrency = 5, retryOptions, onItemComplete, onItemError } = options;

  const results: Array<{ success: true; result: R } | { success: false; error: Error }> = [];
  const queue = items.map((item, index) => ({ item, index }));

  async function processItem(queueItem: { item: T; index: number }) {
    try {
      const result = await withRetry(() => fn(queueItem.item), retryOptions);
      results[queueItem.index] = { success: true, result };
      if (onItemComplete) {
        onItemComplete(queueItem.item, result, queueItem.index);
      }
    } catch (error) {
      results[queueItem.index] = { success: false, error: error as Error };
      if (onItemError) {
        onItemError(queueItem.item, error as Error, queueItem.index);
      }
    }
  }

  // Process items with concurrency limit
  const workers: Promise<void>[] = [];
  let queueIndex = 0;

  async function worker() {
    while (queueIndex < queue.length) {
      const currentIndex = queueIndex++;
      const queueItem = queue[currentIndex];
      if (currentIndex < queue.length && queueItem) {
        await processItem(queueItem);
      }
    }
  }

  // Start workers
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}

/**
 * Sleep for the specified duration
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create default retry options for Shopify API calls
 * @param debug - Enable debug logging
 */
export function createShopifyRetryOptions(debug = false): RetryOptions {
  return {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    jitter: true,
    retryOn: isRetryableShopifyError,
    onRetry: debug
      ? (error, attempt, delay) => {
          console.warn(
            `[Retry] Attempt ${attempt} after ${Math.round(delay)}ms. Error: ${error.message}`
          );
        }
      : undefined,
  };
}
