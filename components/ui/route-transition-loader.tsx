"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CCU360Loader } from "./ccu-loader";
import styles from "./ccu-loader.module.css";

const minimumVisibleMs = 400;
const safetyTimeoutMs = 10_000;

export function RouteTransitionLoader() {
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  const originPath = useRef<string | null>(null);
  const startedAt = useRef(0);
  const safetyTimer = useRef<number | null>(null);
  const initialTimer = useRef<number | null>(null);
  const [visible, setVisible] = useState(true);
  const [dashboardTarget, setDashboardTarget] = useState<HTMLElement | null>(null);

  const finish = useCallback(() => {
    originPath.current = null;
    if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
    if (initialTimer.current !== null) window.clearTimeout(initialTimer.current);
    safetyTimer.current = null;
    initialTimer.current = null;
    setDashboardTarget(null);
    setVisible(false);
  }, []);

  useEffect(() => {
    initialTimer.current = window.setTimeout(finish, minimumVisibleMs);
    return () => {
      if (initialTimer.current !== null) window.clearTimeout(initialTimer.current);
    };
  }, [finish]);

  useEffect(() => {
    currentPath.current = pathname;
    if (originPath.current === null || originPath.current === pathname) return;
    const remaining = Math.max(
      0,
      minimumVisibleMs - (performance.now() - startedAt.current),
    );
    const timer = window.setTimeout(finish, remaining);
    return () => window.clearTimeout(timer);
  }, [pathname, finish]);

  useEffect(() => {
    const begin = (destinationPath: string) => {
      if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
      if (initialTimer.current !== null) window.clearTimeout(initialTimer.current);
      initialTimer.current = null;
      originPath.current = currentPath.current;
      startedAt.current = performance.now();
      setDashboardTarget(
        currentPath.current.startsWith("/dashboard") &&
          destinationPath.startsWith("/dashboard")
          ? document.getElementById("workspace-main")
          : null,
      );
      setVisible(true);
      safetyTimer.current = window.setTimeout(finish, safetyTimeoutMs);
    };
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("target") && anchor.getAttribute("target") !== "_self")
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname === currentPath.current
      )
        return;
      begin(destination.pathname);
    };
    const onPopState = () => {
      if (window.location.pathname !== currentPath.current)
        begin(window.location.pathname);
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
    };
  }, [finish]);

  if (!visible) return null;
  if (dashboardTarget)
    return createPortal(
      <div className={styles.dashboardOverlay}>
        <CCU360Loader variant="inline" />
      </div>,
      dashboardTarget,
    );
  return (
    <div className={styles.overlay}>
      <CCU360Loader variant="inline" />
    </div>
  );
}
