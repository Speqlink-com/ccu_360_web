"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";

export function SideDrawer({
  title,
  subtitle,
  eyebrow = "CCU360 / FACILITIES",
  closeLabel = "Close onboarding form",
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (dialog?.open) dialog.close();
    };
  }, []);

  const dismiss = () => {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(onClose, 240);
  };

  return (
    <dialog
      ref={ref}
      className="side-drawer"
      data-closing={closing || undefined}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subtitleId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div className="side-drawer-content">
        <header className="side-drawer-header">
          <div>
            <span className="side-drawer-eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p id={subtitleId}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className="side-drawer-close"
            aria-label={closeLabel}
            onClick={dismiss}
          >
            <Icon name="close" size={19} outline />
          </button>
        </header>
        <div className="side-drawer-body">{children}</div>
      </div>
    </dialog>
  );
}
