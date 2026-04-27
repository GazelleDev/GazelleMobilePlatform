import type { Order } from "@lattelink/contracts-orders";

export interface PosAdapter {
  submitOrder(order: Order): Promise<void>;
}
