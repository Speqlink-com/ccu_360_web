import type { ReactNode } from "react";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "teal" | "amber" | "neutral" | "blue" | "red";
}) {
  const toneClasses = {
    teal: "bg-mint text-badge-teal-text",
    amber: "bg-amber-bg text-amber",
    neutral: "bg-badge-neutral-bg text-badge-neutral-text",
    blue: "bg-badge-blue-bg text-badge-blue-text",
    red: "bg-badge-red-bg text-red",
  };
  return (
    <span
      className={`badge inline-flex items-center justify-center gap-[5px] rounded-[5px] px-[9px] py-[5px] text-xs leading-[inherit] font-[550] whitespace-nowrap capitalize ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="px-6 py-[50px] text-center text-muted [&_a]:text-teal-dark">
      <strong className="mb-2 block text-ink">{title}</strong>
      {children && <p className="mx-auto max-w-[520px]">{children}</p>}
    </div>
  );
}
