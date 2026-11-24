"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icon";
import { useWorkspaceUI } from "@/providers/app-provider";
import { isDemo } from "@/lib/config";
import { navigationFor, productionNavigationFor } from "@/lib/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import { finishSignOut } from "@/features/identity/queries";
import { useSession } from "@/providers/session-provider";
import { roleLabels } from "@/lib/domain/identity";
import { FeedbackProvider } from "@/components/ui/feedback";
import { useState } from "react";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const links = isDemo
    ? navigationFor(session?.user.role)
    : productionNavigationFor(session?.user.role);
  const currentSection =
    links.find(
      (link) =>
        link.href !== "/dashboard" &&
        (pathname === link.href || pathname.startsWith(`${link.href}/`)),
    )?.title ?? links.find((link) => link.href === "/dashboard")?.title ?? "Overview";
  const client = useQueryClient();
  const [signOutError, setSignOutError] = useState("");
  const clinical =
    session?.user.role !== "ahs_admin" &&
    session?.user.role !== "facility_admin";
  const platform = session?.user.role === "ahs_admin";
  const facilityAdmin = session?.user.role === "facility_admin";
  const [leaving, setLeaving] = useState(false);
  async function signOut() {
    setLeaving(true);
    try {
      if (!isDemo) {
        await apiRequest("/api/v1/auth/logout", z.null(), {
          method: "POST",
          body: {},
        });
        await finishSignOut(client);
        return;
      }
      const response = await fetch("/api/demo/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Sign out failed");
      router.replace("/auth/signin");
      router.refresh();
    } catch {
      setSignOutError("Sign out could not complete. Please try again.");
      setLeaving(false);
    }
  }

  const collapsed = useWorkspaceUI((s) => s.collapsed);
  const mobile = useWorkspaceUI((s) => s.mobileOpen);
  const setCollapsed = useWorkspaceUI((s) => s.setCollapsed);
  const setMobile = useWorkspaceUI((s) => s.setMobileOpen);
  const unit = useWorkspaceUI((s) => s.unit);
  const setUnit = useWorkspaceUI((s) => s.setUnit);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const desktop = window.matchMedia("(min-width: 761px)");
    const onDesktop = () => {
      if (desktop.matches) setMobile(false);
    };
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onDesktop);
      previous?.focus();
    };
  }, [mobile, setMobile]);
  return (
    <FeedbackProvider>
      <div
        className={`workspace teal-workspace grid min-h-dvh w-full bg-background max-[760px]:block ${collapsed ? "is-collapsed [grid-template-columns:78px_minmax(0,1fr)] min-[1800px]:[grid-template-columns:82px_minmax(0,1fr)] max-[1250px]:[grid-template-columns:76px_minmax(0,1fr)]" : "[grid-template-columns:252px_minmax(0,1fr)] min-[1800px]:[grid-template-columns:272px_minmax(0,1fr)] max-[1250px]:[grid-template-columns:224px_minmax(0,1fr)]"}`}
      >
        <a className="skip-link" href="#workspace-main">
          Skip to workspace
        </a>
        {mobile && (
          <button
            className="sidebar-scrim"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          />
        )}
        <aside
          ref={sidebarRef}
          id="workspace-navigation"
          role={mobile ? "dialog" : undefined}
          aria-modal={mobile || undefined}
          aria-label="Workspace navigation"
          className={`sidebar sticky top-0 z-40 flex h-dvh flex-col overflow-hidden border-r border-border px-4 pt-[23px] pb-3.5 max-[1000px]:px-[9px] max-[760px]:fixed max-[760px]:invisible max-[760px]:left-0 max-[760px]:w-[260px] max-[760px]:translate-x-[-100%] max-[760px]:px-4 max-[760px]:pt-[23px] max-[760px]:pb-3.5 teal-sidebar ${mobile ? "sidebar-open max-[760px]:visible max-[760px]:translate-x-0" : ""}`}
        >
          <svg
            className="platform-logo-curve"
            viewBox="0 0 320 132"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0 0H320V128H302L274 110H46L18 128H0Z" fill="white" />
          </svg>
          <Link
            href="/dashboard"
            aria-label="CCU360 overview"
            className="sidebar-brand block pl-[21px] max-[1250px]:pl-3"
          >
            <Brand />
          </Link>
          <div
            className="institution mx-0.5 mt-[22px] mb-[18px] flex items-center gap-2.5 border border-border px-2.5 py-[13px] rounded-[4px] bg-surface"
          >
            <span className="institution-mark grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eaf6f3] text-teal-dark">
              <Icon
                name={platform || facilityAdmin ? "facilities" : "bed"}
                size={22}
                outline={platform || facilityAdmin}
              />
            </span>
            <span className="nav-label min-w-0">
              <strong className="block text-xs leading-[1.4] font-semibold max-[1250px]:text-[11px]">
                {platform
                  ? "Ayot Health Solutions"
                  : (session?.facility?.name ?? "Your institution")}
              </strong>
              <small className="mt-1 block text-[11px] text-muted">
                {platform
                  ? "Platform administration"
                  : (session?.facility?.city ?? "Critical care workspace")}
              </small>
            </span>
          </div>
          <nav aria-label="Main navigation" tabIndex={0}>
            {links.map((link) => {
              const active =
                link.href === "/dashboard"
                  ? pathname === link.href
                  : pathname.startsWith(link.href);
              return (
                <div key={link.href}>
                  {link.group && (
                    <p className="nav-group nav-label mx-3.5 mt-[26px] mb-2.5 text-[10px] font-semibold tracking-[1.5px] text-[#7b8e9c] [@media(max-height:850px)]:mt-[18px]">
                      {link.group}
                    </p>
                  )}
                  <Link
                    aria-label={link.title}
                    title={collapsed ? link.title : undefined}
                    href={link.href}
                    onClick={() => setMobile(false)}
                    className={`nav-link my-[3px] flex min-h-12 items-center gap-3 rounded-[4px] px-3.5 py-[13px] text-sm font-medium text-[#5d7384] focus-visible:outline-2 focus-visible:outline-teal-dark max-[1000px]:gap-2 max-[1000px]:px-2.5 max-[760px]:min-h-11 ${active ? "active bg-mint font-semibold text-teal-dark shadow-[inset_3px_0_#008f87]" : "hover:bg-[#f3f7f9] hover:text-teal-dark"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="nav-icon-tile">
                      {link.href === "/dashboard" ? (
                        <>
                          <span className="platform-nav-outline">
                            <Icon name="overview" size={23} outline />
                          </span>
                          <span className="platform-nav-artwork">
                            <Icon name="platformOverview" size={29} />
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="platform-nav-outline">
                            <Icon name={link.icon} size={23} outline />
                          </span>
                          <span className="platform-nav-artwork">
                            <Icon name={link.icon} size={29} />
                          </span>
                        </>
                      )}
                    </span>
                    <span className="nav-label">{link.title}</span>
                  </Link>
                </div>
              );
            })}
          </nav>
          <div className="sidebar-bottom mt-auto shrink-0 pt-[13px]">
            <button
              className="collapse-button flex w-full items-center gap-[11px] border-0 bg-white p-3 text-xs text-[#7a8792] max-[760px]:hidden"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Icon name="collapse" outline />
              <span className="nav-label">Collapse sidebar</span>
            </button>
            {
              <button
                type="button"
                className="nav-link exit-link mt-2 mb-[3px] flex min-h-12 w-full items-center gap-3 rounded-none border-0 border-t border-border bg-white px-3.5 py-[13px] text-left text-[13px] text-[#5d7384] hover:bg-[#f3f7f9] hover:text-teal-dark max-[1000px]:gap-2 max-[1000px]:px-2.5 max-[760px]:min-h-11"
                disabled={leaving}
                onClick={signOut}
                aria-label="Sign out"
              >
                <span className="platform-exit-icon">
                  <span className="platform-exit-outline">
                    <Icon name="logout" size={23} outline />
                  </span>
                  <span className="platform-exit-artwork">
                    <Icon name="logout" size={23} />
                  </span>
                </span>
                <span className="nav-label">
                  {leaving ? "Signing out…" : "Sign out"}
                </span>
              </button>
            }
            {signOutError && <p role="alert">{signOutError}</p>}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col" inert={mobile}>
          <header className="topbar flex h-[82px] items-center justify-between gap-4 bg-white px-9 max-[1250px]:px-7 max-[760px]:h-[73px] max-[760px]:px-4.5">
            <div className="topbar-left flex items-center gap-5 max-[760px]:gap-2">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                aria-controls="workspace-navigation"
                aria-expanded={mobile}
                onClick={() => setMobile(true)}
              >
                <Icon name="menu" />
              </button>
              <span className="topbar-context">
                CCU360 <span className="max-[480px]:hidden">WORKSPACE</span>
              </span>
              <span className="topbar-separator" aria-hidden="true">
                /
              </span>
              <span className="workspace-context-name min-w-0 truncate text-sm max-[760px]:text-xs">
                {currentSection}
              </span>
              {clinical && isDemo && (
                <label className="unit-switcher flex items-center gap-[7px] text-[#5c6e80]">
                  <Icon name="bed" size={16} />
                  <span className="sr-only">Filter by unit</span>
                  <select
                    className="max-w-[140px] border-0 bg-transparent py-1.5 pr-[34px] pl-0 text-sm text-navy"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as typeof unit)}
                  >
                    <option>All units</option>
                    <option>ICU</option>
                    <option>HDU</option>
                  </select>
                </label>
              )}
            </div>
            <div className="topbar-right flex items-center gap-5 max-[760px]:gap-0">
              <span className="session-label flex items-center gap-1.5 text-[11px] text-teal-dark max-[1000px]:hidden">
                <Icon name="shield" size={20} />
                {isDemo ? "Demo environment" : "Secure workspace"}
              </span>
              {!platform && (
                <Link
                  href="/dashboard/connect"
                  className="topbar-action topbar-connect"
                  aria-label="Open Connect 360 chat"
                  title="Connect 360"
                >
                  <Icon name="connect" size={25} />
                  <span className="topbar-connect-label">Connect 360</span>
                </Link>
              )}
              <Link
                href="/dashboard/security"
                aria-label={`Account & security for ${session?.user.name ?? "current user"}`}
                aria-current={pathname.startsWith("/dashboard/security") ? "page" : undefined}
                title="My account & security"
                className="profile flex items-center gap-[11px]"
              >
                <span className="avatar grid h-[42px] w-[42px] place-items-center rounded-full bg-[#eaf7f6] text-[10px] font-semibold text-navy max-[760px]:h-[37px] max-[760px]:w-[37px]">
                  <Icon name="profile" size={40} />
                </span>
                <span className="profile-copy">
                  <strong className="block text-[13px] font-[550]">
                    {session?.user.name ?? "No active session"}
                  </strong>
                  <small className="mt-0.5 block text-[11px] text-[#89959e]">
                    {session
                      ? platform || session.facility
                        ? roleLabels[session.user.role]
                        : "Choose a facility"
                      : "Institution access"}
                  </small>
                </span>
              </Link>
            </div>
          </header>
          {isDemo && (
            <div className="demo-ribbon bg-[#edf5f2] px-9 py-2 text-[10px] tracking-[1px] text-[#56756f] max-[760px]:px-5 max-[760px]:py-[9px] max-[760px]:text-[9px]">
              DEMO ENVIRONMENT{" "}
              <span className="ml-[9px] text-[11px] tracking-normal text-[#637f77] max-[760px]:mt-1 max-[760px]:ml-0 max-[760px]:block max-[760px]:text-[10px]">
                Synthetic records only · Facility-scoped access · Demo changes
                reset when the server restarts
              </span>
            </div>
          )}
          <main
            id="workspace-main"
            className="workspace-main px-9 pt-[34px] pb-[38px] text-[15px] outline-none min-[1800px]:px-11 min-[1800px]:py-[38px] max-[1250px]:p-7 max-[760px]:px-4.5 max-[760px]:pt-[25px] max-[760px]:pb-[30px]"
            tabIndex={-1}
          >
            {children}
          </main>
          <footer className="workspace-footer mt-auto flex items-center justify-center px-9 py-[21px] text-center text-[12px] font-semibold max-[1000px]:px-7 max-[760px]:p-5">
            © {new Date().getUTCFullYear()} Ayot Health Solutions. All rights reserved.
          </footer>
        </div>
      </div>
    </FeedbackProvider>
  );
}
