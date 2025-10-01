import { createComponentDebugger } from './debug-utils';
import { supabase } from '@/integrations/supabase/client';

const debug = createComponentDebugger('StripeIdentityService');

/**
 * Stripe Identity Integration for Real ID Verification
 * 
 * This service integrates with Stripe Identity to verify:
 * - Document authenticity (detects fakes, photoshops)
 * - Liveness check (video selfie)
 * - Data extraction and matching
 * - Government database validation
 */

export interface IdentityVerificationResult {
  verified: boolean;
  sessionId: string;
  status: 'verified' | 'requires_input' | 'processing' | 'failed';
  document: {
    type: string; // 'driving_license', 'passport', 'id_card'
    number: string;
    expirationDate: string;
    issuingCountry: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    address?: {
      line1: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
  checks: {
    documentAuthenticity: 'pass' | 'fail';
    documentExpiry: 'pass' | 'fail';
    selfieMatch: 'pass' | 'fail';
  };
  verifiedAt: string;
}

class StripeIdentityService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_STRIPE_SECRET_KEY || '';
    this.baseUrl = '/api/stripe-identity'; // Backend API endpoint
    
    if (!this.apiKey) {
      debug.warn('Stripe API key not configured for identity verification');
    }
  }

  /**
   * Create a new identity verification session
   * This should be called from your backend to protect the API key
   */
  async createVerificationSession(userId: string): Promise<{ 
    clientSecret: string; 
    sessionId: string;
    url: string;
  }> {
    try {
      debug.info('Creating Stripe Identity verification session', { userId });

      // Call your backend API
      const response = await fetch(`${this.baseUrl}/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          returnUrl: `${window.location.origin}/verification-complete`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create verification session');
      }

      const data = await response.json();
      
      debug.info('Verification session created', { sessionId: data.sessionId });
      
      return data;
    } catch (error) {
      debug.error('Failed to create verification session', error);
      throw error;
    }
  }

  /**
   * Check the status of a verification session
   */
  async checkVerificationStatus(sessionId: string): Promise<IdentityVerificationResult | null> {
    try {
      debug.info('Checking verification status', { sessionId });

      const response = await fetch(`${this.baseUrl}/check-status/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check verification status');
      }

      const result = await response.json();
      
      debug.info('Verification status retrieved', { 
        status: result.status,
        verified: result.verified 
      });
      
      return result;
    } catch (error) {
      debug.error('Failed to check verification status', error);
      return null;
    }
  }

  /**
   * Store verification result in Supabase
   */
  async storeVerificationResult(
    userId: string, 
    result: IdentityVerificationResult
  ): Promise<void> {
    try {
      debug.info('Storing verification result', { userId, verified: result.verified });

      const { error } = await supabase
        .from('profiles')
        .update({
          driver_license_verified: result.verified,
          driver_license_verification_notes: JSON.stringify({
            method: 'stripe_identity',
            sessionId: result.sessionId,
            status: result.status,
            checks: result.checks,
            verifiedAt: result.verifiedAt,
          }),
          driver_license_extracted_address: result.document.address 
            ? `${result.document.address.line1}, ${result.document.address.city}, ${result.document.address.state} ${result.document.address.postalCode}`
            : null,
          driver_license_extracted_name: `${result.document.firstName} ${result.document.lastName}`,
          driver_license_expiration_date: result.document.expirationDate,
          driver_license_verification_confidence: result.verified ? 100 : 0,
        })
        .eq('user_id', userId);

      if (error) throw error;

      debug.info('Verification result stored successfully');
    } catch (error) {
      debug.error('Failed to store verification result', error);
      throw error;
    }
  }

  /**
   * Complete workflow: Create session, verify, store results
   */
  async verifyUserIdentity(userId: string): Promise<{
    verificationUrl: string;
    sessionId: string;
  }> {
    try {
      const session = await this.createVerificationSession(userId);
      
      return {
        verificationUrl: session.url,
        sessionId: session.sessionId,
      };
    } catch (error) {
      debug.error('Identity verification workflow failed', error);
      throw error;
    }
  }
}

export const stripeIdentityService = new StripeIdentityService();

/**
 * BACKEND API ENDPOINTS NEEDED (Node.js/Express example)
 * 
 * File: /api/stripe-identity/create-session
 * 
 * ```javascript
 * const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
 * 
 * app.post('/api/stripe-identity/create-session', async (req, res) => {
 *   const { userId, returnUrl } = req.body;
 * 
 *   const session = await stripe.identity.verificationSessions.create({
 *     type: 'document',
 *     metadata: { userId },
 *     options: {
 *       document: {
 *         allowed_types: ['driving_license', 'passport', 'id_card'],
 *         require_live_capture: true,
 *         require_matching_selfie: true,
 *       },
 *     },
 *     return_url: returnUrl,
 *   });
 * 
 *   res.json({
 *     clientSecret: session.client_secret,
 *     sessionId: session.id,
 *     url: session.url,
 *   });
 * });
 * ```
 * 
 * File: /api/stripe-identity/check-status/:sessionId
 * 
 * ```javascript
 * app.get('/api/stripe-identity/check-status/:sessionId', async (req, res) => {
 *   const session = await stripe.identity.verificationSessions.retrieve(
 *     req.params.sessionId
 *   );
 * 
 *   const verified = session.status === 'verified';
 *   const document = session.verified_outputs || {};
 * 
 *   res.json({
 *     verified,
 *     sessionId: session.id,
 *     status: session.status,
 *     document: {
 *       type: document.id_number?.type,
 *       number: document.id_number?.number,
 *       expirationDate: document.expiration_date,
 *       issuingCountry: document.issuing_country,
 *       firstName: document.first_name,
 *       lastName: document.last_name,
 *       dateOfBirth: document.dob?.day + '/' + document.dob?.month + '/' + document.dob?.year,
 *       address: document.address,
 *     },
 *     checks: {
 *       documentAuthenticity: session.last_verification_report?.document?.status,
 *       documentExpiry: session.last_verification_report?.document?.expiration_check,
 *       selfieMatch: session.last_verification_report?.selfie?.status,
 *     },
 *     verifiedAt: new Date().toISOString(),
 *   });
 * });
 * ```
 */

