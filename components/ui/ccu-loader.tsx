import styles from "./ccu-loader.module.css";
import type { ReactNode } from "react";

type LoaderVariant = "page" | "section" | "dashboard" | "inline";

export function CCU360Loader({
  variant = "section",
  label = "Loading",
}: {
  variant?: LoaderVariant;
  label?: string;
}) {
  return (
    <div
      className={`${styles.loader} ${styles[variant]}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className={styles.signal} aria-hidden="true">
        <svg viewBox="0 0 320 90" fill="none">
          <path
            className={styles.track}
            d="M8 46H88L102 46L116 31L132 61L151 12L172 76L188 46H312"
          />
          <path
            className={styles.beat}
            pathLength="100"
            d="M8 46H88L102 46L116 31L132 61L151 12L172 76L188 46H312"
          />
        </svg>
      </div>
      <div className={styles.wordmark} aria-hidden="true">
        CCU<span>360</span>
      </div>
      {/* <p className={styles.label}>{label}</p> */}
    </div>
  );
}

export function CCU360LoadingOverlay() {
  return (
    <div className={`${styles.overlay} ${styles.blockingOverlay}`}>
      <CCU360Loader variant="inline" />
    </div>
  );
}

export function ButtonHeartbeat({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <span className={styles.buttonContent}>
      <span
        className={styles.buttonLabel}
        aria-hidden={loading}
        data-loading={loading || undefined}
      >
        {children}
      </span>
      {loading && (
        <span
          className={styles.buttonSignal}
          role="status"
          aria-label="Working"
        >
          <svg viewBox="0 0 88 24" fill="none" aria-hidden="true">
            <path
              className={styles.buttonTrack}
              d="M2 12H24L31 12L36 5L42 19L49 2L56 22L63 12H86"
            />
            <path
              className={styles.buttonBeat}
              pathLength="100"
              d="M2 12H24L31 12L36 5L42 19L49 2L56 22L63 12H86"
            />
          </svg>
        </span>
      )}
    </span>
  );
}
