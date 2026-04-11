"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConsoleError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  // InternalApiError prefixes messages with the status code (e.g. "401: ...").
  // This survives serialization to the client error boundary.
  const isAuthError = /^40[13]:/.test(error.message);

  useEffect(() => {
    if (isAuthError) {
      router.push("/sign-in?error=" + encodeURIComponent("Your session expired. Please sign in again."));
    }
  }, [isAuthError, router]);

  if (isAuthError) {
    return null;
  }

  return (
    <div className="error-state">
      <h3>Something went wrong</h3>
      <p>{error.message || "An unexpected error occurred."}</p>
      <div className="error-actions">
        <button onClick={reset} className="secondary-button">
          Try again
        </button>
        <Link href="/sign-in" className="ghost-button">
          Sign in again
        </Link>
      </div>
    </div>
  );
}
