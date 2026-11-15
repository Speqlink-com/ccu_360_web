import Image from "next/image";
import { Brand } from "@/components/ui/brand";

export const indexLayoutClasses =
  "index-auth mx-auto grid min-h-dvh max-w-[1800px] grid-cols-1 bg-background lg:grid-cols-[minmax(0,1.06fr)_minmax(440px,.94fr)]";

export const indexFormSideClasses =
  "auth-form-side order-1 grid min-h-dvh grid-rows-[auto_1fr_auto] bg-background px-6 py-7 text-ink sm:px-12 sm:py-10 lg:order-2 lg:px-12 xl:px-16";

export const indexFooterClasses =
  "mx-auto mt-8 w-full max-w-[380px] border-t border-border pt-5 text-[11px] text-muted";

export const indexAuthSubmitClasses =
  "auth-submit mt-6 inline-flex h-[49px] w-full items-center justify-center rounded-[3px] border border-navy bg-navy px-4 text-[14px] font-semibold text-white transition-colors hover:bg-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-dark disabled:cursor-not-allowed disabled:opacity-65";

export function IndexEntryHeader() {
  return (
    <div className="mx-auto flex w-full max-w-[380px] items-center border-b border-border pb-4">
      <div className="lg:hidden"><Brand /></div>
    </div>
  );
}

export function IndexEditorial() {
  return (
    <section className="relative isolate order-2 hidden flex-col overflow-hidden bg-teal-dark px-10 py-9 text-white lg:order-1 lg:flex lg:min-h-dvh lg:px-12 lg:py-10 xl:px-16">
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-[150px] w-full text-white"
        viewBox="0 0 760 150"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 0H760V44C600 98 337 151 0 122Z"
          fill="currentColor"
        />
      </svg>
      <div className="relative z-10 w-fit"><Brand large /></div>
      <div className="relative z-10 mx-auto flex w-full max-w-[710px] flex-1 flex-col justify-center py-10 lg:py-6">
        <div className="max-w-[650px]">
          <h1 className="text-[clamp(2.35rem,3.5vw,3.9rem)] leading-[1.08] font-semibold tracking-[-0.045em] text-white">
            One patient story.
            <br />
            <span className="text-white/85">One connected team.</span>
          </h1>
          <p className="mt-5 max-w-[570px] text-[16px] leading-[1.7] text-white/85">
            Bring patient context, clinical work, and care teams into one
            coordinated view.
          </p>
        </div>
        <div className="mt-9 grid h-[300px] grid-cols-[1.22fr_.78fr] grid-rows-2 gap-3 xl:h-[340px]">
          <div className="relative row-span-2 overflow-hidden border border-border bg-border">
            <Image
              src="/auth/kenyan-clinical-handover.webp"
              alt="Two Kenyan critical-care clinicians reviewing a tablet at a hospital workstation"
              fill
              sizes="(min-width: 1280px) 410px, (min-width: 1024px) 34vw, 55vw"
              className="object-cover object-[center_40%]"
            />
            <div className="absolute right-0 bottom-0 w-[58%] bg-navy p-4 text-white xl:p-5">
              <span className="mb-3 block h-[3px] w-7 bg-teal" aria-hidden="true" />
              <p className="text-[15px] leading-[1.3] font-medium tracking-[-0.02em]">
                Care moves together.
              </p>
              <p className="mt-1 text-[10px] leading-[1.5] text-white/70">
                Patient · team · facility
              </p>
            </div>
          </div>
          <div className="relative overflow-hidden border border-border bg-border">
            <Image
              src="/auth/care-handover.webp"
              alt="A clinician preparing a care handover at a hospital workstation"
              fill
              sizes="(min-width: 1280px) 250px, (min-width: 1024px) 22vw, 35vw"
              className="object-cover object-center"
            />
          </div>
          <div className="relative overflow-hidden border border-border bg-border">
            <Image
              src="/auth/kenyan-patient-consultation.webp"
              alt="A Kenyan doctor entering information on a laptop while a patient sits nearby"
              fill
              sizes="(min-width: 1280px) 250px, (min-width: 1024px) 22vw, 35vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[710px] items-center justify-between gap-4 border-t border-white/25 pt-5 text-[11px] text-white/75">
        <span>Developed by Ayot Health Solutions</span>
        <span>CCU360™</span>
      </div>
    </section>
  );
}
