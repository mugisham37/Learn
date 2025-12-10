/**
 * Service Factory
 * 
 * Provides singleton instances of services for dependency injection
 * This ensures consistent service instances across the application
 */

import { RealtimeService } from './RealtimeService.js';
import { IRealtimeService } from './IRealtimeService.js';
import { IEmailService } from './IEmailService.js';
import { EmailServiceFactory } from './EmailServiceFactory.js';

/**
 * Service factory for creating and managing service instances
 */
export class ServiceFactory {
  private static realtimeServiceInstance: IRealtimeService | null = null;
  private static emailServiceInstance: IEmailService | null = null;

  /**
   * Gets the singleton RealtimeService instance
   */
  static getRealtimeService(): IRealtimeService {
    if (!this.realtimeServiceInstance) {
      this.realtimeServiceInstance = new RealtimeService();
    }
    return this.realtimeServiceInstance;
  }

  /**
   * Gets the singleton EmailService instance
   */
  static getEmailService(): IEmailService {
    if (!this.emailServiceInstance) {
      this.emailServiceInstance = EmailServiceFactory.getInstance();
    }
    return this.emailServiceInstance;
  }

  /**
   * Resets all service instances (useful for testing)
   */
  static reset(): void {
    this.realtimeServiceInstance = null;
    this.emailServiceInstance = null;
    EmailServiceFactory.resetInstance();
  }
}