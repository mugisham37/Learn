/**
 * Domain Event Base Interface
 */

export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
}

export type DomainEventList = DomainEvent[];