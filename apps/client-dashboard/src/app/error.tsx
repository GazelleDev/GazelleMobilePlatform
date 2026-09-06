"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-card__header">
          <p className="eyebrow">Operator dashboard</p>
          <h1>Something went wrong.</h1>
          <p className="muted-copy">Reload this workspace and try again.</p>
        </div>
        <button className="button button--primary" type="button" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
