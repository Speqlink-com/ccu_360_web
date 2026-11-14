"use client";
import { useState } from "react";
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
} from "@/features/live/shared";
import { Badge } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { network, policy, site, type Site } from "./contract";

export function WorksiteSettingsPage() {
  const user = useIdentity().data!;
  const scope = user.organization_id;
  const settings = useLiveQuery(scope, "worksite/policy", policy);
  const sites = useLiveQuery(scope, "worksite/sites?limit=50", pageOf(site));
  const networks = useLiveQuery(
    scope,
    "worksite/networks?limit=100",
    pageOf(network),
  );
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [policySaved, setPolicySaved] = useState(false);
  return (
    <>
      <Heading
        title="Facility access"
        detail="Keep employee work at the right place, with the freedom to use any internet connection."
        actions={<Badge tone="teal">Administrators have remote access</Badge>}
      />
      <div className="access-summary">
        <Icon name="shield" size={30} />
        <div>
          <h2>Location is the boundary. Internet is your choice.</h2>
          <p>
            Employees verify their presence inside an active site. Registered
            networks provide connection context and never replace location.
          </p>
        </div>
      </div>
      <div className="live-grid">
        <Panel
          title="Employee location policy"
          detail="Changes take effect immediately and require employees to verify again."
        >
          <QueryState query={settings} />
          {policySaved && (
            <p className="success-message" role="status">
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
              <div className="live-form-grid">
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
                At least one active site is required. Provider administrators
                and AHS administrators are exempt. Browser coordinates are
                reported by the device; they are not device-attested.
              </p>
            </ActionForm>
          )}
        </Panel>
        <Panel
          title="Approved facility sites"
          detail="The complete reported uncertainty circle must fit inside the site boundary."
        >
          <QueryState query={sites} />
          {sites.data?.items.map((item) => (
            <article className="worksite-item" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <p>
                  {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)} ·{" "}
                  {item.radius_meters} m radius
                </p>
                <Badge tone={item.active ? "teal" : "neutral"}>
                  {item.active ? "Active site" : "Inactive"}
                </Badge>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => setEditing(item)}
              >
                Edit site
              </button>
            </article>
          ))}
          {sites.data && !sites.data.items.length && (
            <p className="form-help">
              Add the first facility boundary before enabling employee checks.
            </p>
          )}
          <button className="btn btn-primary" onClick={() => setAdding(true)}>
            <Icon name="plus" /> Add facility site
          </button>
        </Panel>
      </div>
      <Panel
        title="Trusted facility connections"
        detail="Register public WAN addresses for connection records. Employees can still use personal mobile data."
      >
        <QueryState query={networks} />
        <div className="live-grid">
          <div>
            {networks.data?.items.map((item) => (
              <article className="worksite-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.cidr}</p>
                  <Badge tone={item.active ? "teal" : "neutral"}>
                    {item.active ? "Registered" : "Inactive"}
                  </Badge>
                </div>
                <ActionForm
                  scope={scope}
                  path={`worksite/networks/${item.id}`}
                  method="PATCH"
                  label={item.active ? "Deactivate" : "Reactivate"}
                  body={(data) => ({
                    active: !item.active,
                    expected_version: item.version,
                    reason: value(data, "reason"),
                  })}
                >
                  <Field
                    name="reason"
                    label="Change reason"
                    minLength={3}
                    maxLength={500}
                  />
                </ActionForm>
              </article>
            ))}
            {networks.data && !networks.data.items.length && (
              <p>No facility connections registered yet.</p>
            )}
          </div>
          <ActionForm
            scope={scope}
            path="worksite/networks"
            label="Register connection"
            body={(data) => ({
              name: value(data, "name"),
              cidr: value(data, "cidr"),
            })}
          >
            <Field
              name="name"
              label="Connection name"
              minLength={2}
              maxLength={120}
            />
            <Field
              name="cidr"
              label="Public WAN address / CIDR"
              maxLength={64}
            />
            <p className="form-help">
              Use a public IP with /32 or a specific public range. Private LAN
              addresses and broad ranges are not accepted. Recognition requires
              the server connection-verification setting.
            </p>
          </ActionForm>
        </div>
      </Panel>
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
    </>
  );
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
  const [position, setPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  return (
    <Dialog
      title={current ? "Edit facility site" : "Add facility site"}
      subtitle="Use the centre of the facility and a radius that represents its boundary."
      onClose={close}
    >
      {!current && (
        <>
          <button
            className="btn btn-secondary"
            disabled={locating}
            onClick={() => {
              setLocating(true);
              if (!navigator.geolocation) {
                setError(new Error("Location is unavailable in this browser."));
                setLocating(false);
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (sample) => {
                  setPosition({
                    latitude: sample.coords.latitude,
                    longitude: sample.coords.longitude,
                  });
                  setLocating(false);
                },
                () => {
                  setError(
                    new Error(
                      "Could not determine the site centre. Enter coordinates manually.",
                    ),
                  );
                  setLocating(false);
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
              );
            }}
          >
            {locating
              ? "Finding site centre…"
              : "Use my current location as the centre"}
          </button>
          <Notice error={error} />
        </>
      )}
      <ActionForm
        key={
          position
            ? `${position.latitude}:${position.longitude}`
            : (current?.version ?? "new")
        }
        scope={scope}
        path={current ? `worksite/sites/${current.id}` : "worksite/sites"}
        method={current ? "PUT" : "POST"}
        label={current ? "Save site" : "Add site"}
        onSuccess={close}
        body={(data) => ({
          name: value(data, "name"),
          latitude: Number(value(data, "latitude")),
          longitude: Number(value(data, "longitude")),
          radius_meters: Number(value(data, "radius")),
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
        <div className="live-form-grid">
          <Field
            name="latitude"
            label="Latitude"
            type="number"
            min={-90}
            max={90}
            step="any"
            defaultValue={String(position?.latitude ?? current?.latitude ?? "")}
          />
          <Field
            name="longitude"
            label="Longitude"
            type="number"
            min={-180}
            max={180}
            step="any"
            defaultValue={String(
              position?.longitude ?? current?.longitude ?? "",
            )}
          />
        </div>
        <Field
          name="radius"
          label="Boundary radius (metres)"
          type="number"
          min={25}
          max={5000}
          defaultValue={String(current?.radius_meters ?? 150)}
        />
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
        <p className="form-help">
          These coordinates are facility configuration. Saving a site
          invalidates existing employee location grants.
        </p>
      </ActionForm>
    </Dialog>
  );
}
