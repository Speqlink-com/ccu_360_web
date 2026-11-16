"use client";
export default function GlobalError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f2f6f8",
          color: "#092744",
          fontFamily: "system-ui,sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: 560,
            margin: "12vh auto",
            padding: 32,
            background: "white",
            borderRadius: 16,
          }}
        >
          <p style={{ color: "#008f89", fontWeight: 700 }}>CCU360</p>
          <h1>We couldn’t open your workspace.</h1>
          <p style={{ lineHeight: 1.7 }}>
            Reload the view to continue. If you were saving a change, check the
            record before submitting it again.
          </p>
          <button
            onClick={retry}
            style={{
              background: "#008f89",
              color: "white",
              padding: "12px 20px",
              border: 0,
              borderRadius: 8,
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Reload view
          </button>
        </main>
      </body>
    </html>
  );
}
