"use client";
import { buttonClasses } from "@/lib/presentation";
import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "@/features/identity/queries";
import { useIdentity } from "@/features/identity/queries";
import { pageOf } from "@/lib/api/identity-contract";
import {
  Heading,
  Panel,
  QueryState,
  ActionForm,
  Field,
  value,
  Notice,
  Pager,
} from "@/features/live/shared";
import { Badge } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { network, policy, site, type Network, type Site } from "./contract";
import { ConnectionNotice } from "./connection-notice";
import { useFacilityAccess } from "./access-provider";
import { SiteMapPicker, type SitePosition } from "./site-map-picker";

export function WorksiteSettingsPage() {
  const access = useFacilityAccess();
  const user = useIdentity().data!;
  const scope = user.organization_id;
  const settings = useLiveQuery(scope, "worksite/policy", policy);
  const [siteOffset, setSiteOffset] = useState(0);
  const sites = useLiveQuery(scope, `worksite/sites?limit=8&offset=${siteOffset}`, pageOf(site));
  const [networkOffset, setNetworkOffset] = useState(0);
  const networks = useLiveQuery(scope, `worksite/networks?limit=8&offset=${networkOffset}`, pageOf(network));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [networkDialog, setNetworkDialog] = useState<{ kind: "add" } | { kind: "change"; item: Network } | null>(null);
  const [policySaved, setPolicySaved] = useState(false);
  return (
    <div className="worksite-page">
      <ConnectionNotice network={access.status?.network} administrator/>
      <Heading
        title="Facility access"
        detail="Control where employees can verify access and how long their location grant lasts."
      />
      {settings.data && <p className="worksite-access-status"><span>Location checks <strong>{settings.data.enabled ? "enabled" : "disabled"}</strong></span><span>Verification {settings.data.grant_seconds} seconds</span><span>GPS uncertainty ≤ {settings.data.max_accuracy_meters} m</span></p>}
      <div className="worksite-top-grid live-grid grid grid-cols-2 gap-6 max-[900px]:grid-cols-1">
        <Panel
          title="Employee location policy"
          detail="Changes take effect immediately and require employees to verify again."
          icon="shield"
        >
          <QueryState query={settings} />
          {policySaved && (
            <p className="success-message rounded-lg border border-success-border bg-mint p-3 text-success-text" role="status">
              Facility access policy updated.
            </p>
          )}
          {settings.data && (
            <ActionForm
              key={settings.data.version}
              scope={scope}
              path="worksite/policy"
              method="PUT"
              label="Save access policy"
              compactError
              onSuccess={() => setPolicySaved(true)}
              body={(data) => ({
                enabled: value(data, "enabled") === "true",
                grant_seconds: Number(value(data, "grant_seconds")),
                max_accuracy_meters: Number(value(data, "accuracy")),
                expected_version: settings.data!.version,
                reason: value(data, "reason"),
              })}
            >
              <Field
                name="enabled"
                label="Employee location checks"
                defaultValue={String(settings.data.enabled)}
              >
                <option value="false">
                  Disabled — prepare sites before enabling
                </option>
                <option value="true">
                  Enabled — require location at the facility
                </option>
              </Field>
              <div className="live-form-grid grid grid-cols-2 gap-4 max-[760px]:grid-cols-1 max-[760px]:gap-0">
                <Field
                  name="grant_seconds"
                  label="Verification validity (seconds)"
                  type="number"
                  min={30}
                  max={300}
                  defaultValue={String(settings.data.grant_seconds)}
                />
                <Field
                  name="accuracy"
                  label="Maximum uncertainty (metres)"
                  type="number"
                  min={1}
                  max={250}
                  defaultValue={String(settings.data.max_accuracy_meters)}
                />
              </div>
              <Field
                name="reason"
                label="Reason for this change"
                minLength={3}
                maxLength={500}
              />
              <p className="form-help">
                An active site is required before enabling checks. Administrators are exempt. Device-reported coordinates are not device-attested.
              </p>
            </ActionForm>
          )}
        </Panel>
        <Panel
          title="Approved facility sites"
          detail="The complete reported uncertainty circle must fit inside the site boundary."
          icon="location"
        >
          <QueryState query={sites} />
          <div className="worksite-site-list">
            {sites.data?.items.slice(0, 7).map((item) => (
              <article className="worksite-site-row" key={item.id}>
                <span className="worksite-site-row-icon"><Icon name="location" size={20} outline /></span>
                <div className="worksite-site-row-content">
                  <strong>{item.name}</strong>
                  <span>{item.radius_meters.toLocaleString()} m access radius</span>
                </div>
                <Badge tone={item.active ? "teal" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
                <button type="button" className="worksite-site-edit" onClick={() => setEditing(item)} aria-label={`Edit ${item.name} site`}><Icon name="arrow" size={17} outline /></button>
              </article>
            ))}
          </div>
          {sites.data && !sites.data.items.length && (
            <p className="form-help">
              Add the first facility boundary before enabling employee checks.
            </p>
          )}
          {sites.data && (siteOffset > 0 || sites.data.items.length > 7) && <Pager offset={siteOffset} count={Math.min(7, sites.data.items.length)} size={7} hasMore={sites.data.items.length > 7} change={setSiteOffset} />}
          <button type="button" className={buttonClasses.primary} onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add facility site
          </button>
        </Panel>
      </div>
      <Panel
        title="Trusted facility connections"
        detail="Registered public WAN addresses add connection context. They do not replace location verification."
        icon="facilities"
      >
        <div className="worksite-network-intro"><p>Track recognized facility networks. Employees can still use personal mobile data when they are inside an approved site.</p><button type="button" className={buttonClasses.primary} onClick={() => setNetworkDialog({ kind: "add" })}><Icon name="plus" size={16} outline /> Add connection</button></div>
        <QueryState query={networks} />
        <div className="worksite-network-table-wrap">
          <table className="worksite-network-table"><thead><tr><th>Connection</th><th>Public address</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {networks.data?.items.slice(0, 7).map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td><code>{item.cidr}</code></td><td><Badge tone={item.active ? "teal" : "neutral"}>{item.active ? "Registered" : "Inactive"}</Badge></td><td><button type="button" onClick={() => setNetworkDialog({ kind: "change", item })}>{item.active ? "Deactivate" : "Reactivate"}</button></td></tr>)}
          </tbody></table>
        </div>
        {networks.data && !networks.data.items.length && <p className="worksite-empty">No facility connections registered yet.</p>}
        {networks.data && (networkOffset > 0 || networks.data.items.length > 7) && <Pager offset={networkOffset} count={Math.min(7, networks.data.items.length)} size={7} hasMore={networks.data.items.length > 7} change={setNetworkOffset} />}
      </Panel>
      {networkDialog && <NetworkDialog scope={scope} selection={networkDialog} close={() => setNetworkDialog(null)} />}
      {(adding || editing) && (
        <SiteDialog
          site={editing}
          scope={scope}
          close={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
function NetworkDialog({ scope, selection, close }: {
  scope: string | null;
  selection: { kind: "add" } | { kind: "change"; item: Network };
  close: () => void;
}) {
  const changing = selection.kind === "change";
  return <Dialog
    title={changing ? `${selection.item.active ? "Deactivate" : "Reactivate"} connection` : "Add facility connection"}
    subtitle={changing ? selection.item.name : "Register a public network address for connection records."}
    className="worksite-network-dialog"
    onClose={close}
  >
    <div className="worksite-network-dialog-body">
      <ActionForm
        scope={scope}
        path={changing ? `worksite/networks/${selection.item.id}` : "worksite/networks"}
        method={changing ? "PATCH" : "POST"}
        label={changing ? (selection.item.active ? "Deactivate connection" : "Reactivate connection") : "Register connection"}
        compactError
        icon={changing ? "shield" : "plus"}
        onSuccess={close}
        body={(data) => changing ? {
          active: !selection.item.active,
          expected_version: selection.item.version,
          reason: value(data, "reason"),
        } : {
          name: value(data, "name"),
          cidr: value(data, "cidr"),
        }}
      >
        {changing ? <>
          <div className="worksite-network-change-summary"><span>Public address</span><strong>{selection.item.cidr}</strong><span>New status</span><strong>{selection.item.active ? "Inactive" : "Registered"}</strong></div>
          <Field name="reason" label="Reason for change" minLength={3} maxLength={500} />
        </> : <>
          <Field name="name" label="Connection name" minLength={2} maxLength={120} placeholder="e.g. Hospital main internet" />
          <Field name="cidr" label="Public WAN address / CIDR" maxLength={64} placeholder="e.g. 203.0.113.10/32" />
          <p className="form-help">Use a public IP address with /32 or a specific public range. Private LAN addresses and broad ranges are not accepted.</p>
        </>}
      </ActionForm>
    </div>
  </Dialog>;
}
function SiteDialog({
  site: current,
  scope,
  close,
}: {
  site: Site | null;
  scope: string | null;
  close: () => void;
}) {
  const [position, setPosition] = useState<SitePosition | null>(current ? { latitude: current.latitude, longitude: current.longitude } : null);
  const [radius, setRadius] = useState(current?.radius_meters ?? 150);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setError(new Error("Location is unavailable. Search or select a point on the map."));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (sample) => {
        setPosition({ latitude: sample.coords.latitude, longitude: sample.coords.longitude });
        setLocating(false);
      },
      () => {
        setError(new Error("Current location is unavailable. Search or select a point on the map."));
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }, []);
  useEffect(() => {
    if (current) return;
    const timer = window.setTimeout(locate, 0);
    return () => window.clearTimeout(timer);
  }, [current, locate]);
  return (
    <Dialog
      title={current ? "Edit facility site" : "Add facility site"}
      subtitle="Place the pin at the facility centre, then set the allowed distance."
      className="worksite-site-dialog"
      onClose={close}
    >
      <div className="worksite-site-editor">
      <SiteMapPicker position={position} radius={radius} onPositionChange={setPosition} locating={locating} onLocate={locate} />
      <div className="worksite-site-form">
      <Notice error={error} compact />
      <ActionForm
        scope={scope}
        path={current ? `worksite/sites/${current.id}` : "worksite/sites"}
        method={current ? "PUT" : "POST"}
        label={current ? "Save site" : "Add site"}
        compactError
        icon="location"
        disabled={!position}
        onSuccess={close}
        body={(data) => ({
          name: value(data, "name"),
          latitude: position!.latitude,
          longitude: position!.longitude,
          radius_meters: radius,
          ...(current
            ? {
                active: value(data, "active") === "true",
                expected_version: current.version,
                reason: value(data, "reason"),
              }
            : {}),
        })}
      >
        <Field
          name="name"
          label="Site name"
          defaultValue={current?.name}
          minLength={2}
          maxLength={120}
        />
        <div className="worksite-radius-control">
          <div className="worksite-radius-heading"><label htmlFor="worksite-radius">Allowed distance</label><strong>{radius.toLocaleString()} m</strong></div>
          <input id="worksite-radius" type="range" min={25} max={5000} step={25} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
          <div className="worksite-radius-ends"><span>25 m</span><span>5 km</span></div>
          <label className="worksite-radius-exact">Exact distance <input type="number" min={25} max={5000} step={1} value={radius} onChange={(event) => { const next = Number(event.target.value); if (next >= 25 && next <= 5000) setRadius(next); }} /> m</label>
        </div>
        <div className="worksite-centre-readout" aria-live="polite"><Icon name="location" size={18} /><div><strong>{position ? "Facility centre selected" : "Choose a centre on the map"}</strong>{position && <span>{position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}</span>}</div></div>
        {current && (
          <>
            <Field
              name="active"
              label="Site status"
              defaultValue={String(current.active)}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Field>
            <Field
              name="reason"
              label="Reason for change"
              minLength={3}
              maxLength={500}
            />
          </>
        )}
        <p className="form-help">Saving a site requires employees to verify their location again.</p>
      </ActionForm>
      </div>
      </div>
    </Dialog>
  );
}
