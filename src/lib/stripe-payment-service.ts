import { createComponentDebugger } from './debug-utils';
import { supabase } from '@/integrations/supabase/client';

const debug = createComponentDebugger('StripePaymentService');

/**
 * Stripe Payment Service for Customer Setup and Payment Processing
 * 
 * This service handles:
 * - Creating Stripe customers
 * - Setting up payment methods
 * - Processing payments for bookings
 * - Managing customer payment preferences
 */

export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  created: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details: {
    name?: string;
    email?: string;
    phone?: string;
    address?: any;
  };
}

export interface PaymentSetupResult {
  success: boolean;
  customerId?: string;
  paymentMethodId?: string;
  clientSecret?: string;
  error?: string;
}

class StripePaymentService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
    this.baseUrl = '/api/stripe-payments'; // Backend API endpoint
    
    if (!this.apiKey) {
      debug.warn('Stripe API key not configured');
    }
  }

  /**
   * Create or retrieve Stripe customer for user
   */
  async createOrGetCustomer(userId: string, email: string, name?: string): Promise<StripeCustomer> {
    try {
      debug.info('Creating/getting Stripe customer', { userId, email });

      // Check if customer already exists in our database
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .single();

      if (profile?.stripe_customer_id) {
        // Customer exists, verify with Stripe
        const response = await fetch(`${this.baseUrl}/get-customer/${profile.stripe_customer_id}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const customer = await response.json();
          debug.info('Retrieved existing customer', { customerId: customer.id });
          return customer;
        }
      }

      // Create new customer
      const response = await fetch(`${this.baseUrl}/create-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email, name }),
      });

      if (!response.ok) {
        throw new Error('Failed to create customer');
      }

      const customer = await response.json();
      
      // Store customer ID in our database
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customer.id })
        .eq('user_id', userId);

      debug.info('Created new customer', { customerId: customer.id });
      return customer;
    } catch (error) {
      debug.error('Failed to create/get customer', error);
      throw error;
    }
  }

  /**
   * Set up payment method for customer
   */
  async setupPaymentMethod(customerId: string, userId: string): Promise<{
    clientSecret: string;
    paymentMethodId?: string;
  }> {
    try {
      debug.info('Setting up payment method', { customerId, userId });

      const response = await fetch(`${this.baseUrl}/setup-payment-method`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to setup payment method');
      }

      const result = await response.json();
      
      debug.info('Payment method setup initiated', { 
        clientSecret: result.clientSecret?.substring(0, 20) + '...',
        paymentMethodId: result.paymentMethodId 
      });
      
      return result;
    } catch (error) {
      debug.error('Failed to setup payment method', error);
      throw error;
    }
  }

  /**
   * Confirm payment method setup
   */
  async confirmPaymentMethodSetup(
    setupIntentId: string, 
    userId: string
  ): Promise<PaymentSetupResult> {
    try {
      debug.info('Confirming payment method setup', { setupIntentId, userId });

      const response = await fetch(`${this.baseUrl}/confirm-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupIntentId, userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to confirm payment method');
      }

      const result = await response.json();
      
      // Update profile with payment method setup status
      await supabase
        .from('profiles')
        .update({ 
          payment_method_setup: true,
          payment_method_setup_at: new Date().toISOString(),
          stripe_payment_method_id: result.paymentMethodId
        })
        .eq('user_id', userId);

      debug.info('Payment method confirmed', { 
        paymentMethodId: result.paymentMethodId,
        customerId: result.customerId 
      });
      
      return {
        success: true,
        customerId: result.customerId,
        paymentMethodId: result.paymentMethodId
      };
    } catch (error: any) {
      debug.error('Failed to confirm payment method', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create payment intent for booking
   */
  async createPaymentIntent(
    customerId: string,
    amount: number,
    bookingId: string,
    metadata?: Record<string, string>
  ): Promise<{ clientSecret: string; paymentIntentId: string }> {
    try {
      debug.info('Creating payment intent', { customerId, amount, bookingId });

      const response = await fetch(`${this.baseUrl}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId, 
          amount: Math.round(amount * 100), // Convert to cents
          bookingId,
          metadata: {
            bookingId,
            ...metadata
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const result = await response.json();
      
      debug.info('Payment intent created', { 
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret?.substring(0, 20) + '...'
      });
      
      return result;
    } catch (error) {
      debug.error('Failed to create payment intent', error);
      throw error;
    }
  }

  /**
   * Confirm payment for booking
   */
  async confirmPayment(
    paymentIntentId: string,
    bookingId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      debug.info('Confirming payment', { paymentIntentId, bookingId });

      const response = await fetch(`${this.baseUrl}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, bookingId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Payment confirmation failed');
      }

      const result = await response.json();
      
      debug.info('Payment confirmed', { 
        paymentIntentId,
        status: result.status 
      });
      
      return { success: true };
    } catch (error: any) {
      debug.error('Payment confirmation failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get customer's payment methods
   */
  async getPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      debug.info('Getting payment methods', { customerId });

      const response = await fetch(`${this.baseUrl}/get-payment-methods/${customerId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to get payment methods');
      }

      const result = await response.json();
      
      debug.info('Retrieved payment methods', { 
        count: result.paymentMethods?.length || 0 
      });
      
      return result.paymentMethods || [];
    } catch (error) {
      debug.error('Failed to get payment methods', error);
      return [];
    }
  }

  /**
   * Create Stripe Connect account for user
   */
  async createConnectAccount(userId: string, accountData: {
    email: string;
    name?: string;
    address?: {
      line1: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  }): Promise<{ id: string }> {
    try {
      debug.info('Creating Stripe Connect account', { userId, email: accountData.email });

      const response = await fetch(`${this.baseUrl}/create-connect-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          ...accountData,
          type: 'express', // Express accounts for easier onboarding
          capabilities: ['card_payments', 'transfers'],
          business_type: 'individual'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create Connect account');
      }

      const result = await response.json();
      
      // Store Connect account ID in our database
      await supabase
        .from('profiles')
        .update({ stripe_connect_account_id: result.id })
        .eq('user_id', userId);

      debug.info('Connect account created', { accountId: result.id });
      return result;
    } catch (error) {
      debug.error('Failed to create Connect account', error);
      throw error;
    }
  }

  /**
   * Create onboarding link for Stripe Connect account
   */
  async createOnboardingLink(accountId: string, userId: string): Promise<string> {
    try {
      debug.info('Creating onboarding link', { accountId, userId });

      const response = await fetch(`${this.baseUrl}/create-onboarding-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountId, 
          userId,
          refresh_url: `${window.location.origin}/payment-setup?refresh=true`,
          return_url: `${window.location.origin}/payment-setup?success=true`
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create onboarding link');
      }

      const result = await response.json();
      
      debug.info('Onboarding link created', { url: result.url });
      return result.url;
    } catch (error) {
      debug.error('Failed to create onboarding link', error);
      throw error;
    }
  }

  /**
   * Check Connect account status
   */
  async checkConnectAccountStatus(accountId: string): Promise<{
    charges_enabled: boolean;
    details_submitted: boolean;
    payouts_enabled: boolean;
  }> {
    try {
      debug.info('Checking Connect account status', { accountId });

      const response = await fetch(`${this.baseUrl}/check-connect-status/${accountId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to check account status');
      }

      const result = await response.json();
      
      debug.info('Account status retrieved', result);
      return result;
    } catch (error) {
      debug.error('Failed to check account status', error);
      throw error;
    }
  }

  /**
   * Check if user has completed payment setup
   */
  async hasPaymentSetup(userId: string): Promise<boolean> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_method_setup, stripe_connect_account_id')
        .eq('user_id', userId)
        .single();

      return profile?.payment_method_setup === true && !!profile?.stripe_connect_account_id;
    } catch (error) {
      debug.error('Failed to check payment setup status', error);
      return false;
    }
  }
}

export const stripePaymentService = new StripePaymentService();

/**
 * BACKEND API ENDPOINTS NEEDED (Node.js/Express example)
 * 
 * These endpoints should be implemented in your backend to handle Stripe operations:
 * 
 * 1. POST /api/stripe-payments/create-customer
 * 2. GET /api/stripe-payments/get-customer/:customerId
 * 3. POST /api/stripe-payments/setup-payment-method
 * 4. POST /api/stripe-payments/confirm-setup
 * 5. POST /api/stripe-payments/create-payment-intent
 * 6. POST /api/stripe-payments/confirm-payment
 * 7. GET /api/stripe-payments/get-payment-methods/:customerId
 * 
 * STRIPE CONNECT ENDPOINTS:
 * 8. POST /api/stripe-payments/create-connect-account
 * 9. POST /api/stripe-payments/create-onboarding-link
 * 10. GET /api/stripe-payments/check-connect-status/:accountId
 * 
 * See the implementation guide in the documentation for detailed examples.
 */
