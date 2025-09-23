/**
 * Centralized OpenAI Request Manager
 * Manages request limits across all AI services to prevent exceeding API quotas
 * Includes retry logic with exponential backoff for failed requests
 */

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

class OpenAIRequestManager {
  private static instance: OpenAIRequestManager;
  private requestCount = 0;
  private maxRequests = 2;
  private isBlocked = false;
  private retryConfig: RetryConfig = {
    maxAttempts: 2,
    baseDelay: 1000, // 1 second
    maxDelay: 5000,  // 5 seconds
    backoffFactor: 2
  };

  private constructor() {
    console.log(`🚫 OpenAI Request Manager initialized with limit: ${this.maxRequests} requests maximum, ${this.retryConfig.maxAttempts} retry attempts per request`);
  }

  static getInstance(): OpenAIRequestManager {
    if (!OpenAIRequestManager.instance) {
      OpenAIRequestManager.instance = new OpenAIRequestManager();
    }
    return OpenAIRequestManager.instance;
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(): { allowed: boolean; reason?: string } {
    if (this.isBlocked) {
      return { 
        allowed: false, 
        reason: `OpenAI requests blocked. Maximum limit of ${this.maxRequests} requests reached.` 
      };
    }
    
    if (this.requestCount >= this.maxRequests) {
      this.isBlocked = true;
      console.warn(`🚫 OpenAI request limit reached (${this.maxRequests}). Blocking further requests.`);
      return { 
        allowed: false, 
        reason: `Maximum limit of ${this.maxRequests} OpenAI requests reached. Please refresh the page to reset.` 
      };
    }
    
    return { allowed: true };
  }

  /**
   * Reserve a request slot (increment counter)
   */
  reserveRequest(): boolean {
    const check = this.canMakeRequest();
    if (!check.allowed) {
      return false;
    }
    
    this.requestCount++;
    console.log(`📊 OpenAI Request reserved: ${this.requestCount}/${this.maxRequests}`);
    return true;
  }

  /**
   * Execute a request with retry logic
   * Only retries if the request was successfully reserved (doesn't count against limit)
   */
  async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    context: string = 'OpenAI API call'
  ): Promise<T> {
    // First, check if we can make a request and reserve the slot
    const requestCheck = this.canMakeRequest();
    if (!requestCheck.allowed) {
      throw new Error(`Request blocked: ${requestCheck.reason}`);
    }
    
    // Reserve the request slot
    const reserved = this.reserveRequest();
    if (!reserved) {
      throw new Error('Failed to reserve request slot');
    }
    
    let lastError: Error | null = null;
    
    // Now execute with retries (but only for network/API errors, not quota errors)
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        console.log(`🔄 ${context} - Attempt ${attempt}/${this.retryConfig.maxAttempts}`);
        
        const result = await requestFn();
        
        if (attempt > 1) {
          console.log(`✅ ${context} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.warn(`❌ ${context} failed on attempt ${attempt}:`, lastError.message);
        
        // Check if this is a quota/rate limit error - don't retry these
        if (this.isQuotaError(lastError)) {
          console.log(`🚫 ${context} - Quota/rate limit error detected, not retrying`);
          break;
        }
        
        // Don't retry on the last attempt
        if (attempt === this.retryConfig.maxAttempts) {
          console.error(`💥 ${context} failed after ${this.retryConfig.maxAttempts} attempts`);
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        console.log(`⏳ ${context} - Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }
    
    // If we get here, all attempts failed
    throw lastError || new Error(`${context} failed after ${this.retryConfig.maxAttempts} attempts`);
  }

  /**
   * Check if an error is a quota/rate limit error that shouldn't be retried
   */
  private isQuotaError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes('quota') || 
           message.includes('rate limit') || 
           message.includes('too many requests') ||
           message.includes('429') ||
           message.includes('blocked');
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current request status
   */
  getRequestStatus(): { count: number; maxRequests: number; isBlocked: boolean; remaining: number } {
    return {
      count: this.requestCount,
      maxRequests: this.maxRequests,
      isBlocked: this.isBlocked,
      remaining: Math.max(0, this.maxRequests - this.requestCount)
    };
  }

  /**
   * Reset the request counter (for testing or page refresh)
   */
  reset(): void {
    this.requestCount = 0;
    this.isBlocked = false;
    console.log('🔄 OpenAI Request Manager reset');
  }
}

export const openaiRequestManager = OpenAIRequestManager.getInstance();
