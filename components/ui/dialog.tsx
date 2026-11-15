"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icon";
export function Dialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="app-dialog m-auto max-h-[calc(100dvh-40px)] w-[min(720px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-[#dbe7eb] bg-surface p-0 text-ink shadow-[0_25px_100px_#0a284944]"
      aria-labelledby="dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div>
        <header className="flex items-start justify-between gap-5 border-b border-border px-7 py-[25px] max-[760px]:p-[22px]">
          <div>
            <h2 id="dialog-title" className="text-[22px] tracking-[-.5px] max-[760px]:text-[21px]">{title}</h2>
            {subtitle && <p className="mt-1.5 text-[13px] leading-[1.7] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="icon-button shrink-0"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
