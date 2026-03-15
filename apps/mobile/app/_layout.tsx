import "../global.css";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthSessionProvider } from "../src/auth/session";
import { CartProvider } from "../src/cart/store";
import { CheckoutFlowProvider } from "../src/orders/flow";
import { uiPalette } from "../src/ui/system";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false
    },
    mutations: {
      retry: false
    }
  }
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={uiPalette.background} />
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>
          <CartProvider>
            <CheckoutFlowProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: uiPalette.background }
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="cart"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                    contentStyle: { backgroundColor: "transparent" }
                  }}
                />
                <Stack.Screen
                  name="auth"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                    contentStyle: { backgroundColor: "transparent" }
                  }}
                />
                <Stack.Screen
                  name="menu-customize"
                  options={{
                    presentation: "modal",
                    animation: "slide_from_bottom",
                    contentStyle: { backgroundColor: "transparent" }
                  }}
                />
                <Stack.Screen name="checkout-success" />
                <Stack.Screen name="checkout-failure" />
                <Stack.Screen name="refunds/[orderId]" />
              </Stack>
            </CheckoutFlowProvider>
          </CartProvider>
        </AuthSessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
