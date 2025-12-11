/**
 * Stripe Client Factory
 * 
 * Provides a singleton instance of the Stripe client.
 * This ensures consistent configuration across the application.
 */

import { StripeClient } from './StripeClient';
import { IStripeClient } from './IStripeClient';

export class StripeClientFactory {
  private static instance: IStripeClient | null = null;

  /**
   * Gets the singleton Stripe client instance
   */
  public static getInstance(): IStripeClient {
    if (!this.instance) {
      this.instance = new StripeClient();
    }
    return this.instance;
  }

  /**
   * Resets the singleton instance (useful for testing)
   */
  public static reset(): void {
    this.instance = null;
  }
}