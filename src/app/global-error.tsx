"use client";

import { useEffect } from "react";
import Link from "next/link";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/**
 * Last-resort boundary: renders when the root layout itself fails, so it must
 * bring its own <html>/<body> and inline styles (no globals.css guarantee, no
 * next/font, no client router). Stack traces are never rendered.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(
      `[ui] global error${error?.digest ? ` (digest ${error.digest})` : ""}: the root layout failed`,
    );
  }, [error]);

  const shell: React.CSSProperties = {
    minHeight: "100vh",
    margin: 0,
    padding: "48px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#150a12",
    color: "#f7ede3",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  };

  const panel: React.CSSProperties = {
    width: "100%",
    maxWidth: 560,
    border: "1px solid #40283a",
    borderRadius: 20,
    background: "#1e1019",
    padding: "32px 28px",
    boxShadow: "0 40px 120px -60px rgba(0,0,0,0.95)",
  };

  const kicker: React.CSSProperties = {
    margin: 0,
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.26em",
    textTransform: "uppercase",
    color: "#b9a3ae",
  };

  const heading: React.CSSProperties = {
    margin: "16px 0 0",
    fontSize: 30,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    color: "#f7ede3",
  };

  const body: React.CSSProperties = {
    margin: "12px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#b9a3ae",
  };

  const primary: React.CSSProperties = {
    display: "inline-block",
    border: "1px solid rgba(255,82,54,0.5)",
    borderRadius: 10,
    background: "#ff5236",
    color: "#150a12",
    fontSize: 14,
    fontWeight: 600,
    padding: "12px 20px",
    cursor: "pointer",
  };

  const secondary: React.CSSProperties = {
    display: "inline-block",
    border: "1px solid #40283a",
    borderRadius: 10,
    background: "transparent",
    color: "#f7ede3",
    fontSize: 14,
    padding: "12px 20px",
    textDecoration: "none",
  };

  return (
    <html lang="en">
      <body style={shell}>
        <main style={panel}>
          <p style={kicker}>
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#f2417c",
                marginRight: 8,
              }}
            />
            Signal lost
          </p>
          <h1 style={heading}>Ultfave hit a bad frame.</h1>
          <p style={body}>
            The app could not finish loading this page. Reloading usually clears it — your account
            and scores are unaffected.
          </p>
          {error?.digest ? (
            <p
              style={{
                ...kicker,
                marginTop: 16,
                letterSpacing: "0.2em",
                color: "#5b6477",
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 26 }}>
            <button type="button" onClick={reset} style={primary}>
              Try again
            </button>
            <Link href="/" style={secondary}>
              Back to the board
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
