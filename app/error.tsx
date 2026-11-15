"use client";
import { buttonClasses } from "@/lib/presentation";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">CCU360</p>
      <h1>This view could not be opened.</h1>
      <p>Your clinical record has not been changed.</p>
      <button className={buttonClasses.primary} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
