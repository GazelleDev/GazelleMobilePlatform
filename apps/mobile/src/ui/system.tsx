import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const uiPalette = {
  background: "#F6EFE6",
  backgroundAlt: "#EDE1D1",
  card: "rgba(255, 249, 241, 0.88)",
  cardMuted: "rgba(243, 233, 221, 0.76)",
  surfaceStrong: "#FFF8F0",
  text: "#42210B",
  textSecondary: "#736357",
  textMuted: "#998675",
  border: "rgba(115, 99, 87, 0.18)",
  primary: "#603813",
  primaryText: "#FFF8F0",
  accent: "#A67C52",
  accentSoft: "rgba(198, 156, 109, 0.18)",
  brass: "#C69C6D",
  walnut: "#754C24",
  glow: "rgba(198, 156, 109, 0.24)",
  warning: "#C88938",
  danger: "#B75A46"
} as const;

export const uiShadow = {
  card: {
    shadowColor: "#603813",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8
  } as ViewStyle
} as const;

type ScreenProps = {
  children: ReactNode;
  bottomInset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function ScreenScroll({
  children,
  bottomInset = 132,
  contentContainerStyle,
  refreshing = false,
  onRefresh
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScreenBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={uiPalette.primary}
              colors={[uiPalette.primary]}
              progressBackgroundColor={uiPalette.surfaceStrong}
              progressViewOffset={insets.top + 12}
            />
          ) : undefined
        }
        contentContainerStyle={[
          styles.screenContent,
          {
            paddingTop: insets.top + 14,
            paddingBottom: insets.bottom + bottomInset
          },
          contentContainerStyle
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

type ScreenStaticProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenStatic({ children, style }: ScreenStaticProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScreenBackdrop />
      <View style={[styles.screenContent, { paddingTop: insets.top + 14 }, style]}>{children}</View>
    </View>
  );
}

export function ScreenBackdrop() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, styles.solidBackdrop]} />
      <View style={styles.backdropGlowLarge} />
      <View style={styles.backdropGlowSmall} />
      <View style={styles.backdropCurve} />
      <View style={styles.backdropLineOne} />
      <View style={styles.backdropLineTwo} />
      <View style={styles.backdropLineThree} />
    </View>
  );
}

type TitleBlockProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function TitleBlock({ title, subtitle, action }: TitleBlockProps) {
  return (
    <View style={styles.titleWrap}>
      <View style={{ flex: 1 }}>
        <Text style={styles.titleText}>{title}</Text>
        {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

type CardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  muted?: boolean;
};

export function Card({ children, style, muted = false }: CardProps) {
  return <View style={[styles.card, muted ? styles.cardMuted : null, style]}>{children}</View>;
}

type GlassCardProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View style={[styles.cardShell, style]}>
      <BlurView tint="light" intensity={70} style={styles.cardBlur}>
        <View style={styles.cardBlurInner}>{children}</View>
      </BlurView>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  left?: ReactNode;
  right?: ReactNode;
};

export function Button({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  style,
  labelStyle,
  left,
  right
}: ButtonProps) {
  const variantStyle = buttonVariantStyles[variant];
  const variantText = buttonTextStyles[variant];

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonBase,
        variantStyle,
        disabled ? styles.buttonDisabled : null,
        pressed && !disabled ? styles.buttonPressed : null,
        style
      ]}
    >
      <View style={styles.buttonInner}>
        {left}
        <Text style={[styles.buttonText, variantText, labelStyle]}>{label}</Text>
        {right}
      </View>
    </Pressable>
  );
}

type ChipProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, active = false, onPress, style }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active ? styles.chipActive : null,
        pressed ? styles.chipPressed : null,
        style
      ]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

const buttonVariantStyles = StyleSheet.create({
  primary: {
    backgroundColor: uiPalette.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 248, 240, 0.18)",
    shadowColor: uiPalette.primary,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7
  },
  secondary: {
    backgroundColor: uiPalette.surfaceStrong,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  ghost: {
    backgroundColor: "rgba(255, 248, 240, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(115, 99, 87, 0.22)"
  }
});

const buttonTextStyles = StyleSheet.create({
  primary: {
    color: uiPalette.primaryText
  },
  secondary: {
    color: uiPalette.text
  },
  ghost: {
    color: uiPalette.text
  }
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: uiPalette.background
  },
  screenContent: {
    paddingHorizontal: 20
  },
  solidBackdrop: {
    backgroundColor: uiPalette.backgroundAlt
  },
  backdropGlowLarge: {
    position: "absolute",
    top: -70,
    right: -110,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: uiPalette.glow,
    opacity: 0.9
  },
  backdropGlowSmall: {
    position: "absolute",
    bottom: 120,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "rgba(255, 241, 220, 0.76)"
  },
  backdropCurve: {
    position: "absolute",
    top: 118,
    right: -8,
    width: 192,
    height: 268,
    borderTopLeftRadius: 128,
    borderBottomLeftRadius: 128,
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.22)",
    backgroundColor: "rgba(255, 248, 240, 0.24)"
  },
  backdropLineOne: {
    position: "absolute",
    top: 86,
    left: 24,
    right: 42,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 240, 0.9)"
  },
  backdropLineTwo: {
    position: "absolute",
    top: 114,
    left: 120,
    right: 24,
    height: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 240, 0.7)"
  },
  backdropLineThree: {
    position: "absolute",
    top: 142,
    left: 48,
    right: 88,
    height: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 240, 0.55)"
  },
  titleWrap: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  titleText: {
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1.2,
    color: uiPalette.text
  },
  subtitleText: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  card: {
    borderRadius: 26,
    backgroundColor: uiPalette.card,
    borderWidth: 1,
    borderColor: uiPalette.border,
    padding: 18,
    ...uiShadow.card
  },
  cardMuted: {
    backgroundColor: uiPalette.cardMuted
  },
  cardShell: {
    borderRadius: 30,
    overflow: "hidden",
    ...uiShadow.card
  },
  cardBlur: {
    borderRadius: 30
  },
  cardBlurInner: {
    borderRadius: 30,
    backgroundColor: "rgba(255, 248, 240, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 248, 240, 0.56)",
    padding: 18
  },
  buttonBase: {
    minHeight: 54,
    borderRadius: 18,
    justifyContent: "center",
    paddingHorizontal: 18
  },
  buttonDisabled: {
    opacity: 0.48
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }]
  },
  buttonInner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 240, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(115, 99, 87, 0.18)"
  },
  chipActive: {
    backgroundColor: uiPalette.walnut,
    borderColor: uiPalette.walnut
  },
  chipPressed: {
    opacity: 0.8
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: uiPalette.textSecondary
  },
  chipTextActive: {
    color: uiPalette.primaryText
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: uiPalette.accent,
    textTransform: "uppercase"
  }
});
