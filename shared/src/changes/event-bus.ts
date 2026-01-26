/**
 * Change Intelligence System - Client-Side Event Bus
 * Pub/sub pattern for real-time change event distribution
 */

import type { ChangeEventPayload, ChangeSeverity } from './types';
import { SEVERITY_ORDER } from './constants';

type ChangeHandler = (event: ChangeEventPayload) => void;

/**
 * Event bus for distributing change events to subscribers
 */
class ChangeEventBusClass {
  private handlers: Map<string, Set<ChangeHandler>> = new Map();
  private globalHandlers: Set<ChangeHandler> = new Set();
  private eventHistory: ChangeEventPayload[] = [];
  private maxHistorySize = 100;

  /**
   * Subscribe to specific event type(s)
   * @param eventType - Single event type or array of types
   * @param handler - Callback function for handling events
   * @returns Unsubscribe function
   */
  on(eventType: string | string[], handler: ChangeHandler): () => void {
    const types = Array.isArray(eventType) ? eventType : [eventType];

    types.forEach((type) => {
      if (!this.handlers.has(type)) {
        this.handlers.set(type, new Set());
      }
      this.handlers.get(type)!.add(handler);
    });

    // Return unsubscribe function
    return () => {
      types.forEach((type) => {
        this.handlers.get(type)?.delete(handler);
      });
    };
  }

  /**
   * Subscribe to all events
   * @param handler - Callback function for handling all events
   * @returns Unsubscribe function
   */
  onAll(handler: ChangeHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Emit a change event to all relevant subscribers
   * @param event - Event payload (id and timestamp will be added automatically)
   */
  emit(event: Omit<ChangeEventPayload, 'id' | 'timestamp'>): void {
    const fullEvent: ChangeEventPayload = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    // Add to history
    this.eventHistory.unshift(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
    }

    // Notify type-specific handlers
    const typeHandlers = this.handlers.get(fullEvent.type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => {
        try {
          handler(fullEvent);
        } catch (error) {
          console.error('[ChangeEventBus] Handler error:', error);
        }
      });
    }

    // Notify global handlers
    this.globalHandlers.forEach((handler) => {
      try {
        handler(fullEvent);
      } catch (error) {
        console.error('[ChangeEventBus] Global handler error:', error);
      }
    });
  }

  /**
   * Get recent event history
   * @param limit - Maximum number of events to return
   * @returns Array of recent events
   */
  getHistory(limit?: number): ChangeEventPayload[] {
    return limit ? this.eventHistory.slice(0, limit) : [...this.eventHistory];
  }

  /**
   * Get events filtered by criteria
   * @param options - Filter options
   * @returns Filtered events
   */
  getFilteredHistory(options: {
    orgId?: string;
    types?: string[];
    minSeverity?: ChangeSeverity;
    since?: Date;
    limit?: number;
  }): ChangeEventPayload[] {
    let events = [...this.eventHistory];

    if (options.orgId) {
      events = events.filter((e) => e.orgId === options.orgId);
    }

    if (options.types && options.types.length > 0) {
      events = events.filter((e) => options.types!.includes(e.type));
    }

    if (options.minSeverity) {
      const minPriority = SEVERITY_ORDER[options.minSeverity];
      events = events.filter((e) => SEVERITY_ORDER[e.severity] <= minPriority);
    }

    if (options.since) {
      events = events.filter((e) => e.timestamp >= options.since!);
    }

    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  }

  /**
   * Clear all event history
   */
  clear(): void {
    this.eventHistory = [];
  }

  /**
   * Clear all handlers (useful for testing or cleanup)
   */
  clearHandlers(): void {
    this.handlers.clear();
    this.globalHandlers.clear();
  }

  /**
   * Get count of current handlers
   */
  getHandlerCount(): { typed: number; global: number } {
    let typedCount = 0;
    this.handlers.forEach((handlers) => {
      typedCount += handlers.size;
    });
    return {
      typed: typedCount,
      global: this.globalHandlers.size,
    };
  }
}

// Singleton instance
export const ChangeEventBus = new ChangeEventBusClass();

// Export class for testing
export { ChangeEventBusClass };
