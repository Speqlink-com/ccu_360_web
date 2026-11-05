"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Brand } from "@/components/ui/brand";
import { Icon, type IconName } from "@/components/ui/icon";
import { useWorkspaceUI } from "@/providers/app-provider";
import { isDemo } from "@/lib/config";
import { navigationFor } from "@/lib/navigation";
import { useSession } from "@/providers/session-provider";
import { roleLabels } from "@/lib/domain/identity";
import { useState } from "react";
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const links = navigationFor(session?.user.role);
  const clinical =
    session?.user.role !== "ahs_admin" &&
    session?.user.role !== "facility_admin";
  const platform = session?.user.role === "ahs_admin";
  const [leaving, setLeaving] = useState(false);
  async function signOut() {
    setLeaving(true);
    try {
      const response = await fetch("/api/demo/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Sign out failed");
      window.location.assign("/");
    } catch {
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
    <div className={`workspace ${collapsed ? "is-collapsed" : ""}`}>
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
        className={`sidebar ${mobile ? "sidebar-open" : ""}`}
      >
        <Link
          href="/dashboard"
          aria-label="CCU360 unit overview"
          className="sidebar-brand"
        >
          <Brand />
          <span className="collapsed-brand">360</span>
        </Link>
        <div className="institution">
          <span className="institution-mark">
            <Icon name={platform ? "facilities" : "bed"} size={22} />
          </span>
          <span className="nav-label">
            <strong>
              {platform
                ? "Ayot Health Solutions"
                : (session?.facility?.name ?? "Your institution")}
            </strong>
            <small>
              {platform
                ? "Platform administration"
                : (session?.facility?.city ?? "Critical care workspace")}
            </small>
          </span>
        </div>
        <nav aria-label="Main navigation">
          {links.map((link) => (
            <div key={link.href}>
              {link.group && (
                <p className="nav-group nav-label">{link.group}</p>
              )}
              <Link
                aria-label={link.title}
                title={collapsed ? link.title : undefined}
                href={link.href}
                onClick={() => setMobile(false)}
                className={`nav-link ${(link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href)) ? "active" : ""}`}
                aria-current={
                  (
                    link.href === "/dashboard"
                      ? pathname === link.href
                      : pathname.startsWith(link.href)
                  )
                    ? "page"
                    : undefined
                }
              >
                <Icon name={link.icon} />
                <span className="nav-label">{link.title}</span>
                {link.icon === "connect" && (
                  <span className="nav-pilot nav-label">PILOT</span>
                )}
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="continuity-note nav-label">
            <span className="mini-line" />
            <strong>
              {platform ? "One connected network." : "One facility. One team."}
            </strong>
            <p>
              {platform
                ? "Independent facilities. Accountable care teams."
                : "The right people. The right responsibility."}
            </p>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="collapse" />
            <span className="nav-label">Collapse sidebar</span>
          </button>
          {isDemo ? (
            <button
              type="button"
              className="nav-link exit-link"
              disabled={leaving}
              onClick={signOut}
              aria-label="Sign out"
            >
              <Icon name="logout" />
              <span className="nav-label">
                {leaving ? "Signing out…" : "Sign out"}
              </span>
            </button>
          ) : (
            <Link
              href="/"
              className="nav-link exit-link"
              aria-label="Back to sign in"
            >
              <Icon name="logout" />
              <span className="nav-label">Back to sign in</span>
            </Link>
          )}
        </div>
      </aside>
      <div className="workspace-body" inert={mobile}>
        <header className="topbar">
          <div className="topbar-left">
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
              {platform
                ? "Platform workspace"
                : clinical
                  ? "Clinical workspace"
                  : "Facility workspace"}
            </span>
            <span className="topbar-separator">/</span>
            {clinical ? (
              <label className="unit-switcher">
                <Icon name="bed" size={16} />
                <span className="sr-only">Filter by unit</span>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as typeof unit)}
                >
                  <option>All units</option>
                  <option>ICU</option>
                  <option>HDU</option>
                </select>
              </label>
            ) : (
              <span className="workspace-context-name">
                {platform ? "Facility network" : session?.facility?.name}
              </span>
            )}
          </div>
          <div className="topbar-right">
            <span className="session-label">
              <i />
              {isDemo ? "Demo environment" : "Setup required"}
            </span>
            <div className="profile">
              <span className="avatar">
                <Icon name="profile" size={40} />
              </span>
              <span className="profile-copy">
                <strong>{session?.user.name ?? "No active session"}</strong>
                <small>
                  {session
                    ? roleLabels[session.user.role]
                    : "Institution access"}
                </small>
              </span>
            </div>
          </div>
        </header>
        {isDemo && (
          <div className="demo-ribbon">
            DEMO ENVIRONMENT{" "}
            <span>
              Synthetic records only · Facility-scoped access · Demo changes
              reset when the server restarts
            </span>
          </div>
        )}
        <main id="workspace-main" className="workspace-main" tabIndex={-1}>
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            CCU360™ <span>by Ayot Health Solutions</span>
          </span>
          <span>
            {session?.facility
              ? `${session.facility.name} · ${session.facility.code}`
              : "AHS · Platform administration"}
          </span>
        </footer>
      </div>
    </div>
  );
}
