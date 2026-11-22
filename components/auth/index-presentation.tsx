import { Brand } from "@/components/ui/brand";

export const indexLayoutClasses = "index-auth min-h-dvh bg-background";

export const indexFormSideClasses =
  "auth-form-side relative z-10 grid min-h-dvh grid-rows-[auto_1fr_auto] px-6 py-7 text-ink sm:px-12 sm:py-10 xl:px-16";

export const indexCardClasses =
  "auth-form relative z-10 mt-6 w-full max-w-[460px] self-center justify-self-center overflow-hidden rounded-[18px] border px-5 py-8 sm:mt-0 sm:px-10 sm:py-10";

const indexFooterClasses =
  "auth-footer relative z-10 mx-auto mt-8 w-full max-w-[380px] text-center text-[11px] text-white";

export function IndexCopyright() {
  return (
    <p className={indexFooterClasses}>
      © {new Date().getUTCFullYear()} Ayot Health Solutions. All rights reserved.
    </p>
  );
}

export const indexAuthSubmitClasses =
  "auth-submit mt-6 inline-flex h-[49px] w-full items-center justify-center rounded-[3px] border border-teal-dark bg-teal-dark px-4 text-[14px] font-semibold text-white transition-colors hover:bg-button-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-dark disabled:cursor-not-allowed disabled:opacity-65";

export function IndexEntryHeader() {
  return (
    <div className="index-entry-header relative z-10 flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <Brand large />
      <div className="index-intro max-w-[365px] sm:pt-2">
        <p className="flex items-center gap-3 text-[11px] font-bold tracking-[0.16em] text-teal-dark uppercase">
          <span className="h-px w-8 bg-teal" aria-hidden="true" />
          About CCU360
        </p>
        <h1 className="mt-3 text-[25px] leading-tight font-semibold tracking-[-0.035em] text-navy">
          Critical care, connected.
        </h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-muted">
          Patient context, clinical work and care teams in one secure workspace.
        </p>
      </div>
    </div>
  );
}

export function IndexTechLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full sm:block"
      viewBox="0 0 1440 900"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="#008f87" strokeOpacity=".26" strokeWidth="1.25">
        <path d="M0 207h209l47 47h109M0 386h91l55-55h184M0 535h171l47 47h141" />
        <path d="M1440 192h-201l-49 49h-111M1440 374h-119l-54 54h-167M1440 551h-194l-45-45h-115" />
        <path d="M90 331v-79m121 330v65m110-393v-55M1322 374v-84m-124 216v72m-106-265v-62" />
      </g>
      <g fill="#008f87" fillOpacity=".46">
        <circle cx="365" cy="254" r="3" /><circle cx="330" cy="331" r="3" />
        <circle cx="359" cy="582" r="3" /><circle cx="1079" cy="241" r="3" />
        <circle cx="1100" cy="428" r="3" /><circle cx="1086" cy="506" r="3" />
      </g>
    </svg>
  );
}
