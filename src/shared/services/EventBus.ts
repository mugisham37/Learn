/**
 * Simple Event Bus Implementation
 * 
 * Provides a simple in-memory event bus for domain event handling
 * within the modular monolith architecture.
 * 
 * Requirements: 8.7 - Event-driven communication for search indexing
 */

import { EventEmitter } from 'events';

import { logger } from '../utils/logger.js';

/**
 * Domain event interface
 */
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: Record<string, unknown>;
  occurredAt: Date;
  version: number;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => Promise<void>;

/**
 * Event subscription interface
 */
export interface EventSubscription {
  eventType: string;
  handler: EventHandler;
  handlerName?: string;
}

/**
 * Simple Event Bus Implementation
 * 
 * Provides event publishing and subscription capabilities for domain events.
 * Uses Node.js EventEmitter internally for reliable event handling.
 */
export class EventBus {
  private eventEmitter: EventEmitter;
  private subscriptions: Map<string, EventSubscription[]> = new Map();

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.eventEmitter.setMaxListeners(100); // Allow many listeners
    
    // Set up error handling
    this.eventEmitter.on('error', (error) => {
      logger.error('EventBus error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Publishes a domain event to all registered handlers
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    try {
      logger.debug('Publishing domain event', {
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
      });

      // Get all handlers for this event type
      const handlers = this.subscriptions.get(event.eventType) || [];
      
      if (handlers.length === 0) {
        logger.debug('No handlers registered for event type', {
          eventType: event.eventType,
          eventId: event.eventId,
        });
        return;
      }

      // Execute all handlers concurrently
      const handlerPromises = handlers.map(async (subscription) => {
        try {
          await subscription.handler(event);
          
          logger.debug('Event handler completed successfully', {
            eventType: event.eventType,
            eventId: event.eventId,
            handlerName: subscription.handlerName || 'anonymous',
          });
        } catch (error) {
          logger.error('Event handler failed', {
            eventType: event.eventType,
            eventId: event.eventId,
            handlerName: subscription.handlerName || 'anonymous',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          
          // Don't throw error to prevent one handler failure from affecting others
          // In a production system, you might want to implement dead letter queues
          // or retry mechanisms for failed event handlers
        }
      });

      await Promise.all(handlerPromises);

      logger.debug('All event handlers completed', {
        eventType: event.eventType,
        eventId: event.eventId,
        handlerCount: handlers.length,
      });
    } catch (error) {
      logger.error('Failed to publish domain event', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Re-throw to let the caller know about the failure
      throw error;
    }
  }

  /**
   * Subscribes a handler to a specific event type
   */
  subscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    handlerName?: string
  ): () => void {
    try {
      logger.debug('Subscribing event handler', {
        eventType,
        handlerName: handlerName || 'anonymous',
      });

      const subscription: EventSubscription = {
        eventType,
        handler: handler as EventHandler,
        handlerName,
      };

      // Add to subscriptions map
      if (!this.subscriptions.has(eventType)) {
        this.subscriptions.set(eventType, []);
      }
      
      this.subscriptions.get(eventType)!.push(subscription);

      logger.debug('Event handler subscribed successfully', {
        eventType,
        handlerName: handlerName || 'anonymous',
        totalHandlers: this.subscriptions.get(eventType)!.length,
      });

      // Return unsubscribe function
      return () => {
        this.unsubscribe(eventType, handler, handlerName);
      };
    } catch (error) {
      logger.error('Failed to subscribe event handler', {
        eventType,
        handlerName: handlerName || 'anonymous',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      throw error;
    }
  }

  /**
   * Unsubscribes a handler from a specific event type
   */
  unsubscribe<T extends DomainEvent>(
    eventType: string,
    handler: EventHandler<T>,
    handlerName?: string
  ): void {
    try {
      const handlers = this.subscriptions.get(eventType);
      if (!handlers) {
        logger.warn('No handlers found for event type during unsubscribe', {
          eventType,
          handlerName: handlerName || 'anonymous',
        });
        return;
      }

      // Find and remove the handler
      const index = handlers.findIndex(subscription => 
        subscription.handler === handler && 
        subscription.handlerName === handlerName
      );

      if (index === -1) {
        logger.warn('Handler not found during unsubscribe', {
          eventType,
          handlerName: handlerName || 'anonymous',
        });
        return;
      }

      handlers.splice(index, 1);

      // Clean up empty arrays
      if (handlers.length === 0) {
        this.subscriptions.delete(eventType);
      }

      logger.debug('Event handler unsubscribed successfully', {
        eventType,
        handlerName: handlerName || 'anonymous',
        remainingHandlers: handlers.length,
      });
    } catch (error) {
      logger.error('Failed to unsubscribe event handler', {
        eventType,
        handlerName: handlerName || 'anonymous',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Gets the number of handlers for a specific event type
   */
  getHandlerCount(eventType: string): number {
    return this.subscriptions.get(eventType)?.length || 0;
  }

  /**
   * Gets all registered event types
   */
  getRegisteredEventTypes(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Gets statistics about the event bus
   */
  getStats(): {
    totalEventTypes: number;
    totalHandlers: number;
    eventTypes: Array<{ eventType: string; handlerCount: number }>;
  } {
    const eventTypes = Array.from(this.subscriptions.entries()).map(([eventType, handlers]) => ({
      eventType,
      handlerCount: handlers.length,
    }));

    const totalHandlers = eventTypes.reduce((sum, { handlerCount }) => sum + handlerCount, 0);

    return {
      totalEventTypes: eventTypes.length,
      totalHandlers,
      eventTypes,
    };
  }

  /**
   * Clears all subscriptions (useful for testing)
   */
  clear(): void {
    logger.info('Clearing all event bus subscriptions');
    this.subscriptions.clear();
    this.eventEmitter.removeAllListeners();
  }

  /**
   * Gracefully shuts down the event bus
   */
  shutdown(): Promise<void> {
    try {
      logger.info('Shutting down event bus...');
      
      // Clear all subscriptions
      this.clear();
      
      logger.info('Event bus shut down successfully');
      return Promise.resolve();
    } catch (error) {
      logger.error('Error during event bus shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return Promise.reject(error);
    }
  }
}

// Create and export a singleton instance
export const eventBus = new EventBus();