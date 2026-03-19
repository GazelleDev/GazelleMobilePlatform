import { useEffect } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT, getTabBarBottomOffset } from "../navigation/tabBarMetrics";
import { uiPalette } from "../ui/system";

function LoadingBlock({
  width = "100%",
  height,
  radius = 14,
  style
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.loadingBlock,
        {
          width,
          height,
          borderRadius: radius
        },
        style
      ]}
    />
  );
}

export function CustomizeModalLoadingSheet() {
  const insets = useSafeAreaInsets();
  const footerBottom = getTabBarBottomOffset(insets.bottom > 0);
  const footerClearance = footerBottom + TAB_BAR_HEIGHT + 16;
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 820, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.52, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.985, 1]) }]
  }));

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: footerClearance }]}
        >
          <Animated.View style={[styles.heroWrap, pulseStyle]}>
            <LoadingBlock height={420} radius={0} style={styles.heroImageBlock} />
          </Animated.View>

          <Animated.View style={[styles.content, pulseStyle]}>
            <View style={styles.titleRow}>
              <LoadingBlock width="62%" height={30} radius={10} />
              <LoadingBlock width={68} height={24} radius={8} style={styles.priceBlock} />
            </View>
            <LoadingBlock width="42%" height={24} radius={9} style={styles.metaBlock} />

            <View style={styles.descriptionGroup}>
              <LoadingBlock width="92%" height={16} radius={8} />
              <LoadingBlock width="76%" height={16} radius={8} />
            </View>

            <View style={styles.section}>
              <LoadingBlock width={116} height={24} radius={10} />
              <LoadingBlock width="56%" height={14} radius={7} style={styles.sectionBodyBlock} />
              <View style={styles.chipRow}>
                <LoadingBlock width={118} height={42} radius={21} />
                <LoadingBlock width={104} height={42} radius={21} />
                <LoadingBlock width={92} height={42} radius={21} />
              </View>
            </View>

            <View style={styles.section}>
              <LoadingBlock width={94} height={24} radius={10} />
              <LoadingBlock width="62%" height={14} radius={7} style={styles.sectionBodyBlock} />
              <View style={styles.chipRow}>
                <LoadingBlock width={92} height={42} radius={21} />
                <LoadingBlock width={84} height={42} radius={21} />
                <LoadingBlock width={110} height={42} radius={21} />
              </View>
            </View>

            <View style={styles.section}>
              <LoadingBlock width={78} height={24} radius={10} />
              <LoadingBlock width="58%" height={14} radius={7} style={styles.sectionBodyBlock} />
              <LoadingBlock width="100%" height={112} radius={0} style={styles.notesBlock} />
            </View>

            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <LoadingBlock width={116} height={18} radius={9} />
                <LoadingBlock width={54} height={18} radius={9} />
              </View>
              <View style={styles.summaryRow}>
                <LoadingBlock width={68} height={18} radius={9} />
                <LoadingBlock width={76} height={24} radius={10} />
              </View>
            </View>
          </Animated.View>
        </ScrollView>

        <Animated.View pointerEvents="none" style={[styles.footerRow, { bottom: footerBottom }, pulseStyle]}>
          <View style={styles.footerPrimary}>
            <LoadingBlock width="100%" height={60} radius={999} style={styles.footerPillBlock} />
          </View>
          <View style={styles.footerQuantity}>
            <LoadingBlock width="100%" height={60} radius={999} style={styles.footerPillBlock} />
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent"
  },
  sheet: {
    flex: 1,
    backgroundColor: "rgba(246, 247, 244, 0.98)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: uiPalette.border,
    overflow: "hidden"
  },
  handleWrap: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(151, 160, 154, 0.52)"
  },
  scrollContent: {
    paddingBottom: 0
  },
  heroWrap: {
    paddingHorizontal: 20,
    paddingTop: 36
  },
  heroImageBlock: {
    backgroundColor: "#D5D4CE"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  loadingBlock: {
    backgroundColor: "rgba(219, 216, 207, 0.9)"
  },
  priceBlock: {
    marginTop: 4
  },
  metaBlock: {
    marginTop: 10
  },
  descriptionGroup: {
    marginTop: 22,
    gap: 10
  },
  section: {
    paddingTop: 24,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border
  },
  sectionBodyBlock: {
    marginTop: 10
  },
  chipRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  notesBlock: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: uiPalette.borderStrong,
    backgroundColor: "rgba(255,255,255,0.72)"
  },
  summarySection: {
    marginBottom: 24
  },
  summaryRow: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  footerRow: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    gap: 8
  },
  footerPrimary: {
    flex: 1.9,
    minHeight: 60
  },
  footerQuantity: {
    flex: 0.34,
    minWidth: 118,
    minHeight: 60
  },
  footerPillBlock: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: uiPalette.borderStrong,
    backgroundColor: "rgba(255,255,255,0.72)"
  }
});
