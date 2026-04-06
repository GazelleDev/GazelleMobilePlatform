import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SectionLabel } from "../ui/system";

type SectionHeaderProps = {
  label: string;
  action?: ReactNode;
};

export function SectionHeader({ label, action }: SectionHeaderProps) {
  return (
    <View style={styles.root}>
      <SectionLabel label={label} />
      {action ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  }
});
