import { Redis } from "ioredis";
import { z } from "zod";

export const orderEventSchema = z.object({
  orderId: z.string(),
  locationId: z.string(),
  status: z.string(),
  userId: z.string(),
  occurredAt: z.string(),
  pickupCode: z.string(),
  note: z.string().optional()
});

export type OrderEvent = z.infer<typeof orderEventSchema>;

export function orderStatusChannel(orderId: string) {
  return `order_status:${orderId}`;
}

export function orderEventsChannel(locationId: string) {
  return `order_events:${locationId}`;
}

export async function publishOrderEvent(publisher: Redis, event: OrderEvent): Promise<void> {
  const payload = JSON.stringify(event);
  await Promise.all([
    publisher.publish(orderStatusChannel(event.orderId), payload),
    publisher.publish(orderEventsChannel(event.locationId), payload)
  ]);
}

type Handler = (event: OrderEvent) => void;

export class EventBusSubscriber {
  private readonly subscriber: Redis;
  private readonly handlers = new Map<string, Set<Handler>>();
  private started = false;

  constructor(redisUrl: string) {
    this.subscriber = new Redis(redisUrl, { lazyConnect: true });
    this.subscriber.on("pmessage", (pattern: string, _channel: string, message: string) => {
      this.dispatch(pattern, message);
    });
    this.subscriber.on("message", (channel: string, message: string) => {
      this.dispatch(channel, message);
    });
  }

  private dispatch(channel: string, message: string) {
    const handlers = this.handlers.get(channel);
    if (!handlers || handlers.size === 0) {
      return;
    }
    let event: unknown;
    try {
      event = JSON.parse(message);
    } catch {
      return;
    }
    const parsed = orderEventSchema.safeParse(event);
    if (!parsed.success) {
      return;
    }
    for (const handler of handlers) {
      try {
        handler(parsed.data);
      } catch {
        // individual handler errors must not affect other handlers
      }
    }
  }

  async subscribeToOrderStatus(orderId: string, handler: Handler): Promise<() => void> {
    const channel = orderStatusChannel(orderId);
    return this.addHandler(channel, handler);
  }

  async subscribeToOrderEvents(locationId: string, handler: Handler): Promise<() => void> {
    const channel = orderEventsChannel(locationId);
    return this.addHandler(channel, handler);
  }

  async subscribeToAllOrderEvents(handler: Handler): Promise<() => void> {
    const pattern = "order_events:*";
    if (!this.started) {
      await this.subscriber.connect();
      this.started = true;
    }
    let set = this.handlers.get(pattern);
    if (!set) {
      set = new Set();
      this.handlers.set(pattern, set);
      await this.subscriber.psubscribe(pattern);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) {
        this.handlers.delete(pattern);
        void this.subscriber.punsubscribe(pattern);
      }
    };
  }

  private async addHandler(channel: string, handler: Handler): Promise<() => void> {
    if (!this.started) {
      await this.subscriber.connect();
      this.started = true;
    }
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      await this.subscriber.subscribe(channel);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) {
        this.handlers.delete(channel);
        void this.subscriber.unsubscribe(channel);
      }
    };
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
  }
}

export function createEventBusPublisher(redisUrl: string): Redis {
  return new Redis(redisUrl);
}
