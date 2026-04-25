import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { mergeOrderIntoHistory, normalizeOrderHistory, orderHistoryQueryKey, type OrderHistoryEntry } from "../account/data";
import { apiClient } from "../api/client";

export function useOrdersRealtimeSync(isAuthenticated: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    return apiClient.subscribeToOrders(
      (event) => {
        if (event.type === "snapshot") {
          queryClient.setQueryData<OrderHistoryEntry[] | undefined>(
            orderHistoryQueryKey,
            normalizeOrderHistory(event.orders as OrderHistoryEntry[])
          );
          return;
        }

        queryClient.setQueryData<OrderHistoryEntry[] | undefined>(orderHistoryQueryKey, (currentOrders) =>
          mergeOrderIntoHistory(currentOrders, event.order as OrderHistoryEntry)
        );
      },
      (error) => {
        if (__DEV__) {
          console.warn("Orders realtime sync failed", error);
        }
      }
    );
  }, [isAuthenticated, queryClient]);
}
