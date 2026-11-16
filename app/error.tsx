"use client";
import { buttonClasses } from "@/lib/presentation";
export default function ErrorPage({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <main className="error-page">
      <p className="eyebrow">CCU360</p>
      <h1>This view could not be opened.</h1>
      <p>
        Reload this view to continue. If you were saving a change, review the
        record before submitting it again.
      </p>
      <button className={buttonClasses.primary} onClick={retry}>
        Reload view
      </button>
    </main>
  );
}
