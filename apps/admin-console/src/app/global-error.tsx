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
        <main style={{ padding: 32, fontFamily: "sans-serif" }}>
          <h1>Something went wrong.</h1>
          <p>The error has been reported. Refresh the page or try again shortly.</p>
        </main>
      </body>
    </html>
  );
}
