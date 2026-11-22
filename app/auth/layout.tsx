import {
  IndexCopyright,
  IndexEntryHeader,
  IndexTechLines,
  indexFormSideClasses,
  indexLayoutClasses,
} from "@/components/auth/index-presentation";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className={indexLayoutClasses}>
      <section className={indexFormSideClasses}>
        <IndexTechLines />
        <IndexEntryHeader />
        {children}
        <IndexCopyright />
      </section>
    </main>
  );
}
