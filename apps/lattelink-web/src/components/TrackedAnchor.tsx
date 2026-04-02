"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";

type TrackedAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  eventName: string;
  eventProperties?: Record<string, string | number | boolean | null | undefined>;
};

export function TrackedAnchor({
  eventName,
  eventProperties,
  onClick,
  ...props
}: TrackedAnchorProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    trackAnalyticsEvent(eventName, eventProperties);
  }

  return <a {...props} onClick={handleClick} />;
}
