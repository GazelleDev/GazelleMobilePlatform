"use client";

import { useEffect } from "react";

export function ClientDashboardRoot() {
  useEffect(() => {
    void import("../main");
  }, []);

  return <div id="app" />;
}
