"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="auth-page">
          <section className="auth-card">
            <div className="auth-card__header">
              <p className="eyebrow">Operator dashboard</p>
              <h1>Something went wrong.</h1>
              <p className="muted-copy">Reload the dashboard to start a fresh session.</p>
            </div>
            <button className="button button--primary" type="button" onClick={() => window.location.reload()}>
              Reload dashboard
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
