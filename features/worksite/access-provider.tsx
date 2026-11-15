"use client";
import { buttonClasses } from "@/lib/presentation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useIdentity } from "@/features/identity/queries";
import { apiRequest } from "@/lib/api/client";
import {
  challenge,
  grant,
  hasLocationAccess,
  worksiteStatus,
  type WorksiteStatus,
} from "./contract";
import { Notice, stamp } from "@/features/live/shared";
import { FacilityPicker } from "@/components/auth/facility-picker";
import { Icon } from "@/components/ui/icon";

type Access = {
  allowed: boolean;
  foreground: boolean;
  required: boolean;
  status?: WorksiteStatus;
  checking: boolean;
  error: Error | null;
  verify: () => void;
  refresh: () => void;
};
const AccessContext = createContext<Access>({
  allowed: true,
  foreground: true,
  required: false,
  checking: false,
  error: null,
  verify: () => {},
  refresh: () => {},
});
export const useFacilityAccess = () => useContext(AccessContext);
function sample() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      reject(
        new Error(
          "Location requires a secure browser with location services enabled.",
        ),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Location permission is blocked. Allow precise location for this site in your browser settings, then try again."
              : error.code === 3
                ? "Location took too long. Check your device location settings and try again."
                : "Your device could not determine its location. Enable precise location and try again.",
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}
export function WorksiteAccessProvider({ children }: { children: ReactNode }) {
  const user = useIdentity().data;
  const client = useQueryClient();
  const [now, setNow] = useState(0);
  const [foreground, setForeground] = useState(true);
  const [denied, setDenied] = useState(false);
  const automatic = useRef(false);
  const renewing = useRef(false);
  const renewAt = useRef(0);
  const alive = useRef(true);
  const member = user?.memberships.find(
    (item) => item.organization_id === user.organization_id,
  );
  const bypass =
    !user?.organization_id ||
    user.platform_role === "ahs_admin" ||
    member?.role === "provider_admin";
  const key = ["worksite", user?.organization_id, user?.id, user?.session_id];
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiRequest("/api/v1/worksite/status", worksiteStatus, { signal }),
    enabled: !!user?.organization_id && user.platform_role !== "ahs_admin",
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const verification = useMutation({
    mutationFn: async () => {
      if (renewing.current) return;
      renewing.current = true;
      try {
        const nonce = await apiRequest(
          "/api/v1/worksite/location/challenges",
          challenge,
          { method: "POST", body: {} },
        );
        const position = await sample();
        if (!alive.current || document.visibilityState !== "visible") return;
        const result = await apiRequest(
          "/api/v1/worksite/location/attestations",
          grant,
          {
            method: "POST",
            body: {
              challenge_token: nonce.challenge_token,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy_meters: position.coords.accuracy,
              observed_at: new Date(position.timestamp).toISOString(),
            },
          },
        );
        renewAt.current =
          Date.now() + (Date.parse(result.expires_at) - Date.now()) * 0.65;
        return result;
      } finally {
        renewing.current = false;
      }
    },
    onSuccess: async (result) => {
      if (!result || !alive.current) return;
      automatic.current = true;
      setDenied(false);
      await client.invalidateQueries({ queryKey: ["worksite"] });
    },
    onError: () => {
      automatic.current = false;
      setDenied(true);
      void client.invalidateQueries({ queryKey: ["worksite"] });
    },
  });
  const verify = verification.mutate;
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["worksite"] });
  }, [client]);
  useEffect(() => {
    alive.current = true;
    const tick = () => setNow(Date.now());
    const visibility = () => {
      setNow(Date.now());
      setForeground(document.visibilityState === "visible");
      refresh();
    };
    const invalidate = () => {
      setDenied(true);
      automatic.current = false;
      refresh();
    };
    const rotated = () => {
      setDenied(true);
      automatic.current = false;
      refresh();
    };
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("ccu360-location-required", invalidate);
    window.addEventListener("ccu360-session-rotated", rotated);
    return () => {
      alive.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("ccu360-location-required", invalidate);
      window.removeEventListener("ccu360-session-rotated", rotated);
    };
  }, [refresh]);
  // A fresh server status can recover a grant after refresh; never trust a failed refetch.
  const fresh =
    !status.isError &&
    hasLocationAccess(status.data, now || Number.MAX_SAFE_INTEGER);
  const allowed = bypass || (!denied && fresh);
  useEffect(() => {
    if (
      status.data?.required &&
      automatic.current &&
      foreground &&
      now >= renewAt.current &&
      !renewing.current
    )
      verify();
  }, [now, status.data?.required, foreground, verify]);
  useEffect(() => {
    if (!allowed && !bypass) {
      const filter = {
        predicate: (query: { queryKey: readonly unknown[] }) =>
          query.queryKey[0] === "communication" ||
          (query.queryKey[0] === "live" &&
            !String(query.queryKey[3]).startsWith("auth/")),
      };
      void client
        .cancelQueries(filter)
        .then(() => client.removeQueries(filter));
    }
  }, [allowed, bypass, client]);
  // A disabled policy or a newly refreshed valid status ends a server denial.
  useEffect(() => {
    if (
      status.data &&
      !status.isError &&
      (!status.data.required ||
        (status.data.allowed && hasLocationAccess(status.data, Date.now())))
    ) {
      // Defer to the next event turn so an explicit denial immediately hides data.
      const task = setTimeout(() => setDenied(false), 0);
      return () => clearTimeout(task);
    }
  }, [status.data, status.dataUpdatedAt, status.isError]);
  return (
    <AccessContext.Provider
      value={{
        allowed,
        foreground,
        required: !!status.data?.required && !bypass,
        status: status.data,
        checking: status.isPending || verification.isPending,
        error: verification.error ?? status.error,
        verify: () => verify(),
        refresh,
      }}
    >
      {children}
    </AccessContext.Provider>
  );
}
export function WorksiteBoundary({ children }: { children: ReactNode }) {
  const access = useFacilityAccess();
  const pathname = usePathname();
  const user = useIdentity().data;
  if (pathname === "/dashboard/security") return children;
  if (!access.allowed)
    return (
      <section className="location-gate mx-auto my-8 max-w-[780px] rounded-[18px] border border-border bg-surface p-10 text-center max-[760px]:mx-0 max-[760px]:my-3 max-[760px]:px-5 max-[760px]:py-[26px]">
        <div className="location-illustration mx-auto mt-0 mb-[22px] flex h-[140px] w-[170px] flex-col items-center justify-center gap-[17px] rounded-[50%_50%_20px_20px] border border-[#cce5de] bg-mint text-teal-dark">
          <Icon name="shield" size={40} />
          <span className="text-[10px] font-bold tracking-[.13em]">FACILITY ACCESS</span>
        </div>
        <p className="eyebrow">YOUR LOCATION · YOUR FACILITY</p>
        <h1 className="text-[32px] tracking-[-.04em] text-navy max-[760px]:text-[28px]">
          {access.checking
            ? "Checking facility access…"
            : "Be present. Stay connected."}
        </h1>
        <p className="text-base leading-[1.8] text-muted">
          To open your facility workspace, verify that you’re inside an approved
          site. You can use mobile data, home internet or any other connection.
        </p>
        {!!access.status?.sites?.length && (
          <div className="location-sites my-5 flex flex-wrap justify-center gap-2">
            {access.status.sites.map((site) => (
              <span className="rounded-[30px] bg-background px-3.5 py-2 text-sm text-navy" key={site.id}>{site.name}</span>
            ))}
          </div>
        )}
        <Notice error={access.error} />
        <button
          className={buttonClasses.primary}
          disabled={access.checking || !access.foreground}
          onClick={access.status?.required ? access.verify : access.refresh}
        >
          {access.checking
            ? "Please wait…"
            : access.status?.required
              ? "Verify my location"
              : "Check access again"}
        </button>
        <p className="location-note mt-6 mb-4 text-[13px]">
          Location permission is used for this access check. Employee
          coordinates are not stored. A trusted facility network does not
          replace location verification.
        </p>
        <Link className="font-semibold text-teal-dark" href="/dashboard/security">My account & security</Link>
        {user &&
          user.memberships.filter(
            (member) =>
              member.status === "active" && member.provider_status === "active",
          ).length > 1 && <FacilityPicker user={user} />}
      </section>
    );
  return (
    <>
      {access.required && (
        <aside className="location-banner mb-6 flex items-center justify-between gap-3 rounded-[10px] border border-[#cde6df] bg-mint px-4.5 py-3 text-[14px] text-teal-dark">
          <span>
            <i /> Location verified{" "}
            <small className="ml-3 text-[#536d71] max-[760px]:mt-1.5 max-[760px]:ml-0 max-[760px]:block">Valid until {stamp(access.status?.expires_at)}</small>
          </span>
          <button className="whitespace-nowrap border-0 bg-transparent font-semibold underline" disabled={access.checking} onClick={access.verify}>
            {access.checking ? "Updating…" : "Update location"}
          </button>
        </aside>
      )}
      {children}
    </>
  );
}
