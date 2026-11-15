// Presentation-only button recipes. Keep the marker classes for contextual CSS.
export const buttonClasses = {
  primary:
    "btn btn-primary inline-flex min-h-[46px] items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-transparent bg-teal-dark px-4.5 py-[11px] text-[14px] leading-[inherit] font-[550] text-white hover:bg-button-primary-hover",
  secondary:
    "btn btn-secondary inline-flex min-h-[46px] items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-button-secondary bg-surface px-4.5 py-[11px] text-[14px] leading-[inherit] font-[550] text-ink hover:border-button-secondary-hover-border hover:bg-button-secondary-hover",
  primarySmall:
    "btn btn-primary btn-sm inline-flex min-h-9 items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-transparent bg-teal-dark px-3 py-[7px] text-xs leading-[inherit] font-[550] text-white hover:bg-button-primary-hover",
  secondarySmall:
    "btn btn-secondary btn-sm inline-flex min-h-9 items-center justify-center gap-2.5 whitespace-nowrap rounded-lg border border-button-secondary bg-surface px-3 py-[7px] text-xs leading-[inherit] font-[550] text-ink hover:border-button-secondary-hover-border hover:bg-button-secondary-hover",
} as const;

// The synthetic clinical and administration dashboards share one metric scale.
export const metricClasses = {
  card: "metric rounded-[11px] border border-border bg-surface px-5.5 pt-[21px] pb-[19px] shadow-[0_2px_3px_#1b3b4d03] max-[1000px]:p-[19px] max-[760px]:min-h-[154px] max-[760px]:p-4",
  heading: "flex items-center justify-between gap-2 text-[13px] font-medium text-[#587083] max-[1000px]:text-xs max-[760px]:items-start max-[760px]:text-[11px]",
  value: "mt-[15px] mb-2 block text-[38px] leading-[1.1] font-semibold tracking-[-1px] text-navy tabular-nums min-[1800px]:text-[44px] max-[760px]:mt-3 max-[760px]:text-[33px]",
  detail: "text-xs max-[760px]:text-[11px]",
} as const;
