import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/auth/session";
import { useCart } from "../../src/cart/store";
import { formatUsd, resolveStoreConfigData, useStoreConfigQuery } from "../../src/menu/catalog";
import { Button, Card, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

function DetailPill({
  icon,
  label
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.detailPill}>
      <Ionicons name={icon} size={14} color={uiPalette.accent} />
      <Text style={styles.detailPillText}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthSession();
  const { itemCount, subtotalCents } = useCart();
  const storeConfigQuery = useStoreConfigQuery();
  const storeConfig = resolveStoreConfigData(storeConfigQuery.data);

  const primaryLabel =
    itemCount > 0 ? `Continue Checkout • ${formatUsd(subtotalCents)}` : "Browse Menu";
  const primaryRoute = itemCount > 0 ? "/cart" : "/(tabs)/menu";
  const secondaryLabel = isAuthenticated ? "View Account" : "Sign In";
  const secondaryRoute = isAuthenticated ? "/(tabs)/account" : "/auth";

  return (
    <ScreenScroll refreshing={storeConfigQuery.isRefetching} onRefresh={() => void storeConfigQuery.refetch()}>
      <TitleBlock
        title="Gazelle"
        subtitle="Warm interiors, crafted drinks, and an order flow built for an elegant pickup."
      />

      <GlassCard style={{ marginTop: 18 }}>
        <View style={styles.heroHeader}>
          <View style={{ flex: 1 }}>
            <SectionLabel label="Flagship Cafe" />
            <Text style={styles.heroTitle}>Order into the room before you arrive.</Text>
          </View>
          <View style={styles.heroMark}>
            <Ionicons name="cafe-outline" size={20} color={uiPalette.walnut} />
          </View>
        </View>
        <Text style={styles.heroCopy}>
          A quieter, warmer take on ordering ahead. Browse the live menu, tailor every drink, and
          step straight to pickup without losing the cafe atmosphere.
        </Text>

        <View style={styles.detailRow}>
          <DetailPill icon="time-outline" label={`${storeConfig.prepEtaMinutes} min prep`} />
          <DetailPill icon="walk-outline" label="Counter pickup" />
          <DetailPill icon="sunny-outline" label="Light-filled seating" />
        </View>

        <Button
          label={primaryLabel}
          onPress={() => router.push(primaryRoute)}
          style={{ marginTop: 16 }}
          left={<Ionicons name={itemCount > 0 ? "bag-check-outline" : "sparkles"} size={16} color={uiPalette.primaryText} />}
        />
        <Button
          label={secondaryLabel}
          variant="secondary"
          onPress={() => router.push(secondaryRoute)}
          style={{ marginTop: 10 }}
        />
      </GlassCard>

      <View style={styles.quickRow}>
        <Card style={styles.quickCard}>
          <View style={styles.quickIconWrap}>
            <Ionicons name="color-wand-outline" size={18} color={uiPalette.walnut} />
          </View>
          <Text style={styles.quickCardTitle}>Tailored Drinks</Text>
          <Text style={styles.quickCardBody}>
            Size, milk, extras, and notes stay simple instead of turning checkout into work.
          </Text>
        </Card>

        <Card style={styles.quickCard}>
          <View style={styles.quickIconWrap}>
            <Ionicons name="sparkles-outline" size={18} color={uiPalette.walnut} />
          </View>
          <Text style={styles.quickCardTitle}>Calm Pickup</Text>
          <Text style={styles.quickCardBody}>
            Review timing, confirm totals, and move through pickup with less friction.
          </Text>
        </Card>
      </View>

      <Card style={[styles.storyCard, { marginTop: 14 }]}>
        <SectionLabel label="Inside Gazelle" />
        <Text style={styles.sectionTitle}>Built like the space, not like a generic ordering app.</Text>
        <Text style={styles.sectionBody}>
          Stone, wood, soft light, and a clean counter rhythm shape the physical store. The app is
          moving toward that same feeling: quieter surfaces, clearer actions, and fewer distractions.
        </Text>
        <View style={styles.storyPoints}>
          <DetailPill icon="layers-outline" label="Layered neutral palette" />
          <DetailPill icon="flash-outline" label="Soft brass highlights" />
          <DetailPill icon="ellipse-outline" label="Curved architectural forms" />
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel label="Pickup" />
        <Text style={styles.sectionTitle}>Flagship store details</Text>
        <Text style={styles.sectionBody}>{storeConfig.pickupInstructions}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Estimated prep</Text>
          <Text style={styles.metaValue}>{storeConfig.prepEtaMinutes} minutes</Text>
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel label={isAuthenticated ? "Account" : "Why Sign In"} />
        <Text style={styles.sectionTitle}>
          {isAuthenticated ? "Your account keeps the order flow smoother." : "Signing in unlocks the full experience."}
        </Text>
        <Text style={styles.sectionBody}>
          {isAuthenticated
            ? "Track active orders, review recent pickups, and keep your rewards activity in one place."
            : "Save your session, check rewards, and move through checkout with less friction."}
        </Text>
        <Button
          label={secondaryLabel}
          variant="ghost"
          onPress={() => router.push(secondaryRoute)}
          style={{ marginTop: 12, alignSelf: "flex-start" }}
        />
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start"
  },
  heroMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.24)"
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.9,
    color: uiPalette.text
  },
  heroCopy: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  detailRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  detailPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255, 248, 240, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.18)"
  },
  detailPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: uiPalette.text
  },
  quickRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12
  },
  quickCard: {
    flex: 1,
    minHeight: 154
  },
  quickIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.22)"
  },
  quickCardTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: uiPalette.text
  },
  quickCardBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  storyCard: {
    overflow: "hidden"
  },
  storyPoints: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  sectionTitle: {
    marginTop: 7,
    fontSize: 20,
    fontWeight: "700",
    color: uiPalette.text
  },
  sectionBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metaLabel: {
    fontSize: 12,
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "700",
    color: uiPalette.walnut
  }
});
