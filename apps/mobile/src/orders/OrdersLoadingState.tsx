import { useEffect } from "react";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackdrop, SectionLabel, TabBarDepthBackdrop, uiPalette } from "../ui/system";

function LoadingBlock({
  width = "100%",
  height,
  radius = 12,
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

function LoadingHistoryRow() {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyTopRow}>
        <LoadingBlock width={74} height={28} radius={999} />
        <LoadingBlock width={56} height={18} radius={9} />
      </View>

      <View style={styles.orderItemsRow}>
        <View style={styles.orderThumbStack}>
          <View style={styles.orderThumb} />
          <View style={[styles.orderThumb, styles.orderThumbStacked]} />
          <View style={[styles.orderThumb, styles.orderThumbStacked]} />
        </View>

        <View style={styles.orderItemsCopy}>
          <LoadingBlock width="72%" height={18} radius={9} />
          <LoadingBlock width="26%" height={12} radius={6} />
        </View>
      </View>

      <LoadingBlock width="34%" height={12} radius={6} style={styles.historyMetaBlock} />
      <LoadingBlock width="58%" height={14} radius={7} style={styles.historyBodyBlock} />
    </View>
  );
}

export function OrdersLoadingState({
  headerHeight,
  contentBottomInset
}: {
  headerHeight: number;
  contentBottomInset: number;
}) {
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 820, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.56, 1])
  }));

  return (
    <View style={styles.screen}>
      <ScreenBackdrop />

      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + headerHeight,
            paddingBottom: contentBottomInset
          }
        ]}
      >
        <Animated.View style={pulseStyle}>
          <View style={styles.sectionBlock}>
            <View style={styles.activePanelShell}>
              <View style={styles.activePanel}>
                <View style={styles.activeTopRow}>
                  <LoadingBlock width={70} height={28} radius={999} />
                  <LoadingBlock width={54} height={18} radius={9} />
                </View>

                <View style={styles.activeTitleGroup}>
                  <LoadingBlock width="42%" height={30} radius={10} />
                  <LoadingBlock width="76%" height={16} radius={8} />
                  <LoadingBlock width="58%" height={16} radius={8} />
                </View>

                <View style={styles.pickupCodeBlock}>
                  <LoadingBlock width={86} height={12} radius={6} />
                  <LoadingBlock width={154} height={42} radius={10} />
                </View>

                <View style={styles.progressWrap}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} style={styles.progressStep}>
                      <View style={styles.progressTrack}>
                        {index > 0 ? <View style={[styles.progressLine, styles.progressLineLeft]} /> : null}
                        {index < 3 ? <View style={[styles.progressLine, styles.progressLineRight]} /> : null}
                        <View style={styles.progressDot} />
                      </View>
                      <LoadingBlock width="70%" height={12} radius={6} />
                    </View>
                  ))}
                </View>

                <LoadingBlock width={168} height={48} radius={18} />
              </View>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <SectionLabel label="Recent orders" />
              <LoadingBlock width={42} height={14} radius={7} />
            </View>

            <View style={styles.historyList}>
              <LoadingHistoryRow />
              <View style={styles.historyDivider} />
              <LoadingHistoryRow />
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <View pointerEvents="none" style={[styles.pageHeaderFloating, { paddingTop: insets.top, height: insets.top + headerHeight }]}>
        <View style={styles.pageHeader}>
          <View style={styles.pageCopy}>
            <View style={styles.pageMetaSpacer} />
            <LoadingBlock width={146} height={18} radius={9} style={styles.pageTitleBlock} />
          </View>
        </View>
        <View style={styles.pageTabsSpacer} />
      </View>

      <TabBarDepthBackdrop />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: uiPalette.background
  },
  scrollContent: {
    paddingHorizontal: 20
  },
  loadingBlock: {
    backgroundColor: "rgba(219, 216, 207, 0.9)"
  },
  pageHeaderFloating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: uiPalette.background,
    overflow: "hidden",
    justifyContent: "flex-end",
    zIndex: 10
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingBottom: 11
  },
  pageCopy: {
    flex: 1
  },
  pageTitleBlock: {
    marginTop: 3
  },
  pageMetaSpacer: {
    height: 0,
    marginBottom: 0,
    overflow: "hidden"
  },
  pageTabsSpacer: {
    height: 0,
    marginTop: 0
  },
  sectionBlock: {
    marginTop: 28
  },
  activePanelShell: {
    borderRadius: 36,
    overflow: "hidden"
  },
  activePanel: {
    padding: 22,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: uiPalette.borderStrong,
    backgroundColor: "rgba(255, 253, 248, 0.82)"
  },
  activeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  activeTitleGroup: {
    marginTop: 18,
    gap: 10
  },
  pickupCodeBlock: {
    marginTop: 22,
    paddingTop: 18,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border
  },
  progressWrap: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border,
    flexDirection: "row",
    alignItems: "flex-start"
  },
  progressStep: {
    flex: 1,
    alignItems: "center"
  },
  progressTrack: {
    width: "100%",
    height: 22,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#DDD8CE"
  },
  progressLine: {
    position: "absolute",
    top: 10.5,
    height: 1,
    backgroundColor: "#DDD8CE"
  },
  progressLineLeft: {
    left: 0,
    right: "50%",
    marginRight: 19
  },
  progressLineRight: {
    left: "50%",
    right: 0,
    marginLeft: 19
  },
  sectionHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: uiPalette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  historyList: {
    marginTop: 8
  },
  historyRow: {
    paddingVertical: 18
  },
  historyTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  orderItemsRow: {
    marginTop: 12,
    alignItems: "flex-start"
  },
  orderThumbStack: {
    flexDirection: "row",
    alignItems: "center"
  },
  orderThumb: {
    width: 42,
    height: 52,
    borderRadius: 0,
    backgroundColor: "#D5D4CE"
  },
  orderThumbStacked: {
    marginLeft: -8
  },
  orderItemsCopy: {
    marginTop: 10,
    gap: 8,
    width: "100%",
    maxWidth: 320
  },
  historyMetaBlock: {
    marginTop: 6
  },
  historyBodyBlock: {
    marginTop: 8
  },
  historyDivider: {
    height: 1,
    backgroundColor: uiPalette.border
  }
});
