/**
 * Centralized OpenAI Request Manager
 * Manages request limits across all AI services to prevent exceeding API quotas
 */

class OpenAIRequestManager {
  private static instance: OpenAIRequestManager;
  private requestCount = 0;
  private maxRequests = 2;
  private isBlocked = false;

  private constructor() {
    console.log(`🚫 OpenAI Request Manager initialized with limit: ${this.maxRequests} requests maximum`);
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
