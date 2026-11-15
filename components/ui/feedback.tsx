"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/ui/icon";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };
const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: ++nextId.current, message, tone });
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div
          key={toast.id}
          className={`fixed right-4 bottom-4 z-[100] flex w-[min(390px,calc(100vw-32px))] items-start gap-3 border-l-[3px] bg-surface p-4 text-sm text-ink shadow-[0_8px_30px_rgb(8_43_77_/_0.14)] ${toast.tone === "error" ? "border-red" : toast.tone === "success" ? "border-teal-dark" : "border-blue"}`}
          role={toast.tone === "error" ? "alert" : "status"}
          aria-live={toast.tone === "error" ? "assertive" : "polite"}
        >
          <span className="min-w-0 flex-1 leading-6">{toast.message}</span>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center text-muted hover:text-navy focus-visible:outline-2 focus-visible:outline-teal-dark"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export function FeedbackMessage({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={`my-3 border-l-[3px] px-4 py-3 text-sm leading-6 ${tone === "error" ? "border-red bg-badge-red-bg text-red" : "border-teal-dark bg-mint text-success-text"}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export function LoadingState({ label = "Loading verified records…" }: { label?: string }) {
  return (
    <div className="border-l-[3px] border-teal bg-mint/45 px-4 py-4 text-sm text-ink" role="status" aria-live="polite">
      <span className="block font-medium">{label}</span>
      <span className="mt-3 block h-1 w-28 bg-teal/25 motion-safe:animate-pulse" aria-hidden="true" />
    </div>
  );
}
