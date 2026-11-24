"use client";
import { useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  useIdentity,
  useLiveQuery,
  finishSignOut,
  identityKey,
} from "@/features/identity/queries";
import {
  Heading,
  Panel,
  Field,
  ActionForm,
  ActionButton,
  QueryState,
  Pager,
  stamp,
  value,
} from "./shared";
import { MfaSettings } from "./mfa-settings";
import { Icon } from "@/components/ui/icon";
import { useWorkspaceUI } from "@/providers/app-provider";
import {
  defaultWorkspaceAccent,
  readableWorkspaceAccent,
  workspaceAccentPresets,
} from "@/lib/workspace-appearance";
export function SecurityPage() {
  const user = useIdentity().data!;
  const client = useQueryClient();
  const accent = useWorkspaceUI((state) => state.accent);
  const fontScale = useWorkspaceUI((state) => state.fontScale);
  const setAccent = useWorkspaceUI((state) => state.setAccent);
  const setFontScale = useWorkspaceUI((state) => state.setFontScale);
  const [sessionOffset, setSessionOffset] = useState(0);
  const initials = user.display_name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const sessions = useLiveQuery(
    user.id,
    "auth/sessions",
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          device_name: z.string(),
          created_at: z.string(),
          expires_at: z.string(),
          current: z.boolean(),
        }),
      ),
    }),
  );
  const sessionPageSize = 3;
  const sessionCount = sessions.data?.items.length ?? 0;
  const visibleSessionOffset = Math.min(
    sessionOffset,
    Math.max(0, Math.ceil(sessionCount / sessionPageSize) - 1) * sessionPageSize,
  );
  const visibleSessions = sessions.data?.items.slice(
    visibleSessionOffset,
    visibleSessionOffset + sessionPageSize,
  );
  return (
    <div className="account-page">
      <Heading
        eyebrow=""
        title="Account settings"
        detail="Manage your identity, password, signed-in devices and workspace appearance. Times shown in East Africa Time."
      />
      <section className="account-identity" aria-label="Your account">
        <span className="account-avatar" aria-hidden="true">
          {initials || "A"}
        </span>
        <div className="account-identity-copy">
          <span className="account-kicker">YOUR CCU360 ACCOUNT</span>
          <h2>{user.display_name}</h2>
          <p>{user.email}</p>
        </div>
        <div className="account-identity-badges">
          <span>
            <Icon name="shield" size={15} outline />
            {user.platform_role === "ahs_admin"
              ? "AHS administrator"
              : "Facility team member"}
          </span>
          <span className={user.mfa_enabled ? "is-secure" : ""}>
            <Icon name={user.mfa_enabled ? "shield" : "help"} size={15} outline />
            {user.mfa_enabled ? "Verification on" : "Verification pending"}
          </span>
        </div>
      </section>
      <div className="account-settings-grid">
        <div className="account-settings-column">
          <section className="account-section" id="account-personal">
            <Panel
              title="Personal information"
              icon="profile"
              detail="Update the name shown to your care network. Your sign-in email is managed with your account."
            >
              <div className="account-readonly-field">
                <span>Sign-in email</span>
                <strong>{user.email}</strong>
              </div>
              <ActionForm
                scope={user.id}
                path="auth/profile"
                method="PATCH"
                body={(data) => ({ display_name: value(data, "display_name") })}
                label="Save changes"
                icon="check"
                reset={false}
                onSuccess={async () => {
                  await client.invalidateQueries({ queryKey: identityKey });
                }}
              >
                <Field
                  name="display_name"
                  label="Full name"
                  defaultValue={user.display_name}
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                />
              </ActionForm>
            </Panel>
          </section>
          <section
            className="account-section account-sessions"
            id="account-devices"
          >
            <Panel
              title="Signed-in devices"
              icon="device"
              detail="Revoking a session also ends its rotated refresh-token family."
            >
              <QueryState query={sessions} />
              <div className="account-session-list">
                {visibleSessions?.map((session) => (
                  <div className="account-session" key={session.id}>
                    <span className="account-session-icon" aria-hidden="true">
                      <Icon name="device" size={19} outline />
                    </span>
                    <div className="account-session-copy">
                      <strong>{session.device_name}</strong>
                      {session.current && (
                        <span className="account-current-device">This device</span>
                      )}
                      <small>Signed in {stamp(session.created_at)}</small>
                      <small>Expires {stamp(session.expires_at)}</small>
                    </div>
                    <ActionButton
                      scope={user.id}
                      path={`auth/sessions/${session.id}`}
                      method="DELETE"
                      confirm="End this session?"
                      onSuccess={() =>
                        session.current ? finishSignOut(client) : undefined
                      }
                    >
                      <Icon name="close" size={16} outline />
                      Revoke
                    </ActionButton>
                  </div>
                ))}
              </div>
              {sessions.data && !sessions.data.items.length && (
                <p className="account-empty">No active sessions found.</p>
              )}
              {sessionCount > sessionPageSize && (
                <Pager
                  offset={visibleSessionOffset}
                  count={visibleSessions?.length ?? 0}
                  size={sessionPageSize}
                  hasMore={visibleSessionOffset + sessionPageSize < sessionCount}
                  change={setSessionOffset}
                />
              )}
              <div className="account-signout-all">
                <ActionButton
                  scope={user.id}
                  path="auth/logout-all"
                  confirm="Sign out every device, including this one?"
                  onSuccess={() => finishSignOut(client)}
                >
                  <Icon name="logout" size={16} outline />
                  Sign out all devices
                </ActionButton>
              </div>
            </Panel>
          </section>
        </div>
        <div className="account-settings-column">
          <section
            className="account-section account-password"
            id="account-password"
          >
            <Panel
              title="Password"
              icon="shield"
              detail="Use a unique password of 12–128 characters. Changing it signs out all devices."
            >
              <p className="account-card-note">
                Choose a password you do not use for another account.
              </p>
              <ActionForm
                scope={user.id}
                path="auth/password/change"
                label="Change password"
                icon="shield"
                body={(data) => {
                  if (data.get("new_password") !== data.get("confirm"))
                    throw new Error("The new passwords do not match.");
                  return {
                    current_password: data.get("current_password"),
                    new_password: data.get("new_password"),
                  };
                }}
                onSuccess={() => finishSignOut(client)}
              >
                <Field
                  name="current_password"
                  label="Current password"
                  type="password"
                  maxLength={128}
                  autoComplete="current-password"
                />
                <Field
                  name="new_password"
                  label="New password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
                <Field
                  name="confirm"
                  label="Confirm new password"
                  type="password"
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </ActionForm>
            </Panel>
          </section>
          <section className="account-section account-mfa" id="account-verification">
            <MfaSettings />
          </section>
        </div>
      </div>
      <section className="account-appearance" id="account-appearance">
        <Panel
          title="Workspace appearance"
          icon="settings"
          detail="Color and text size are saved in this browser for your account. They do not change clinical records or other users’ workspaces."
        >
          <div className="account-appearance-grid">
            <div className="account-appearance-section">
              <h3>Primary color</h3>
              <p>Choose a workspace color. Teal is the CCU360 default.</p>
              <div className="account-accent-presets" role="group" aria-label="Primary color presets">
                {workspaceAccentPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    aria-pressed={accent.toLowerCase() === preset.color}
                    className={accent.toLowerCase() === preset.color ? "is-selected" : ""}
                    onClick={() => setAccent(preset.color)}
                  >
                    <span className="account-accent-swatch" style={{ "--swatch-color": preset.color } as CSSProperties} aria-hidden="true" />
                    {preset.name}
                    {accent.toLowerCase() === preset.color && <Icon name="check" size={16} outline />}
                  </button>
                ))}
              </div>
              <div className="account-custom-color">
                <label htmlFor="workspace-custom-color">Custom color</label>
                <input
                  id="workspace-custom-color"
                  type="color"
                  value={accent}
                  onChange={(event) => setAccent(readableWorkspaceAccent(event.target.value))}
                />
                <output htmlFor="workspace-custom-color">{accent.toUpperCase()}</output>
              </div>
              <button type="button" className="account-appearance-reset" disabled={accent === defaultWorkspaceAccent} onClick={() => setAccent(defaultWorkspaceAccent)}>
                <Icon name="refresh" size={15} outline /> Return to teal
              </button>
            </div>
            <div className="account-appearance-section">
              <h3>Dashboard text size</h3>
              <p>Make workspace content easier to read. The sidebar keeps its current size.</p>
              <div className="account-font-control">
                <button type="button" aria-label="Decrease dashboard text size" disabled={fontScale <= 100} onClick={() => setFontScale(Math.max(100, fontScale - 5))}>A−</button>
                <input
                  id="workspace-font-size"
                  type="range"
                  min="100"
                  max="130"
                  step="5"
                  value={fontScale}
                  aria-label="Dashboard text size"
                  onChange={(event) => setFontScale(Number(event.target.value))}
                />
                <button type="button" aria-label="Increase dashboard text size" disabled={fontScale >= 130} onClick={() => setFontScale(Math.min(130, fontScale + 5))}>A+</button>
                <output htmlFor="workspace-font-size">{fontScale}%</output>
              </div>
              <div className="account-type-preview" aria-hidden="true">
                <span>CONTENT PREVIEW</span>
                <strong>Care that stays connected.</strong>
                <p>Patient context, team responsibilities and clinical actions in one place.</p>
              </div>
              <button type="button" className="account-appearance-reset" disabled={fontScale === 100} onClick={() => setFontScale(100)}>
                <Icon name="refresh" size={15} outline /> Reset text size
              </button>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}
