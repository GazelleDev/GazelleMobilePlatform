import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { API_BASE_URL, apiClient } from "../../src/api/client";
import { Button, Card, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

export default function HomeScreen() {
  const router = useRouter();
  const [gatewayStatus, setGatewayStatus] = useState<string>("");

  async function handleGatewayCheck() {
    setGatewayStatus("Checking gateway...");
    try {
      await apiClient.get("/meta/contracts");
      setGatewayStatus("Gateway is reachable.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setGatewayStatus(`Gateway failed (${API_BASE_URL}): ${message}`);
    }
  }

  return (
    <ScreenScroll>
      <TitleBlock
        title="Gazelle"
        subtitle="Fast ordering with secure auth, live menu sync, and Apple Pay checkout."
      />

      <GlassCard style={{ marginTop: 18 }}>
        <SectionLabel label="Today" />
        <Text style={styles.heroTitle}>Ready for your next order?</Text>
        <Text style={styles.heroCopy}>
          Browse the live menu, customize drinks, and check out in seconds with a clean native flow.
        </Text>
        <Button
          label="Start Order"
          onPress={() => router.push("/(tabs)/menu")}
          style={{ marginTop: 14 }}
          left={<Ionicons name="sparkles" size={16} color="#FFFFFF" />}
        />
      </GlassCard>

      <View style={styles.quickRow}>
        <Card style={styles.quickCard}>
          <Ionicons name="person-circle-outline" size={22} color={uiPalette.primary} />
          <Text style={styles.quickCardTitle}>Auth Center</Text>
          <Text style={styles.quickCardBody}>Sign in, refresh, and validate session state.</Text>
          <Button label="Open" variant="secondary" onPress={() => router.push("/auth")} style={{ marginTop: 10 }} />
        </Card>

        <Card style={styles.quickCard}>
          <Ionicons name="bag-handle-outline" size={22} color={uiPalette.primary} />
          <Text style={styles.quickCardTitle}>Cart + Checkout</Text>
          <Text style={styles.quickCardBody}>Review totals and test Apple Pay flows.</Text>
          <Button label="Go to Cart" variant="secondary" onPress={() => router.push("/(tabs)/cart")} style={{ marginTop: 10 }} />
        </Card>
      </View>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel label="System" />
        <Text style={styles.systemTitle}>Gateway Connectivity</Text>
        <Text style={styles.systemBody}>Use this health action to verify API reachability from the current build.</Text>
        <Button label="Run Gateway Check" variant="ghost" onPress={handleGatewayCheck} style={{ marginTop: 12 }} />
        {gatewayStatus ? (
          <Text style={[styles.gatewayStatus, gatewayStatus.includes("failed") ? styles.gatewayError : styles.gatewayOk]}>
            {gatewayStatus}
          </Text>
        ) : null}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  heroTitle: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.4,
    color: uiPalette.text
  },
  heroCopy: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  quickRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12
  },
  quickCard: {
    flex: 1
  },
  quickCardTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.text
  },
  quickCardBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  systemTitle: {
    marginTop: 7,
    fontSize: 18,
    fontWeight: "700",
    color: uiPalette.text
  },
  systemBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  gatewayStatus: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17
  },
  gatewayOk: {
    color: "#0E8F46"
  },
  gatewayError: {
    color: uiPalette.danger
  }
});
