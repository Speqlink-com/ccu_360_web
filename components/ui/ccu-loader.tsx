import styles from "./ccu-loader.module.css";

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
