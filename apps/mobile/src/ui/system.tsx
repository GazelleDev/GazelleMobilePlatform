import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import {
  Pressable,
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
  background: "#EEF3FA",
  backgroundAlt: "#F8FAFD",
  card: "rgba(255,255,255,0.92)",
  cardMuted: "rgba(255,255,255,0.78)",
  text: "#0F172A",
  textSecondary: "#566274",
  textMuted: "#748296",
  border: "rgba(15, 23, 42, 0.1)",
  primary: "#007AFF",
  primaryText: "#FFFFFF",
  accent: "#34C759",
  warning: "#FF9F0A",
  danger: "#FF3B30"
} as const;

export const uiShadow = {
  card: {
    shadowColor: "#0B1324",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6
  } as ViewStyle
} as const;

type ScreenProps = {
  children: ReactNode;
  bottomInset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function ScreenScroll({ children, bottomInset = 132, contentContainerStyle }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <ScreenBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
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
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.solidBackdrop]} />;
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
    backgroundColor: uiPalette.primary
  },
  secondary: {
    backgroundColor: uiPalette.card,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.2)"
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
  titleWrap: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  titleText: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: uiPalette.text
  },
  subtitleText: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  card: {
    borderRadius: 22,
    backgroundColor: uiPalette.card,
    borderWidth: 1,
    borderColor: uiPalette.border,
    padding: 16,
    ...uiShadow.card
  },
  cardMuted: {
    backgroundColor: uiPalette.cardMuted
  },
  cardShell: {
    borderRadius: 22,
    overflow: "hidden",
    ...uiShadow.card
  },
  cardBlur: {
    borderRadius: 22
  },
  cardBlurInner: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.58)",
    padding: 16
  },
  buttonBase: {
    minHeight: 50,
    borderRadius: 14,
    justifyContent: "center",
    paddingHorizontal: 16
  },
  buttonDisabled: {
    opacity: 0.48
  },
  buttonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }]
  },
  buttonInner: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.1)"
  },
  chipActive: {
    backgroundColor: uiPalette.text,
    borderColor: uiPalette.text
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
    color: "#EFF5FF"
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: uiPalette.textMuted,
    textTransform: "uppercase"
  }
});
