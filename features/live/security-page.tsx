"use client";
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
  stamp,
  value,
} from "./shared";
import { MfaSettings } from "./mfa-settings";
export function SecurityPage() {
  const user = useIdentity().data!;
  const client = useQueryClient();
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
  return (
    <>
      <Heading
        title="My account & security"
        detail="Manage your identity, password and signed-in devices. Times shown in East Africa Time."
      />
      <div className="live-grid">
        <Panel title="Profile" detail={user.email}>
          <ActionForm
            scope={user.id}
            path="auth/profile"
            method="PATCH"
            body={(data) => ({ display_name: value(data, "display_name") })}
            label="Update profile"
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
            />
          </ActionForm>
          <p>
            Two-step verification:{" "}
            <strong>{user.mfa_enabled ? "Enabled" : "Not enrolled"}</strong>
          </p>
          <p>
            {user.platform_role === "ahs_admin"
              ? "AHS platform administrator"
              : "Facility team member"}
          </p>
        </Panel>
        <Panel
          title="Change password"
          detail="Use a unique password of 12–128 characters. This signs out all devices."
        >
          <ActionForm
            scope={user.id}
            path="auth/password/change"
            label="Change password"
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
            />
            <Field
              name="new_password"
              label="New password"
              type="password"
              minLength={12}
              maxLength={128}
            />
            <Field
              name="confirm"
              label="Confirm new password"
              type="password"
              minLength={12}
              maxLength={128}
            />
          </ActionForm>
        </Panel>
      </div>
      <MfaSettings />
      <Panel
        title="Active sessions"
        detail="Revoking a session also ends its rotated refresh-token family."
      >
        <QueryState query={sessions} />
        {sessions.data?.items.map((session) => (
          <div className="live-list-row" key={session.id}>
            <div>
              <strong>
                {session.device_name}
                {session.current ? " · This device" : ""}
              </strong>
              <p>
                Signed in {stamp(session.created_at)} · expires{" "}
                {stamp(session.expires_at)}
              </p>
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
              Revoke session
            </ActionButton>
          </div>
        ))}
        <ActionButton
          scope={user.id}
          path="auth/logout-all"
          confirm="Sign out every device, including this one?"
          onSuccess={() => finishSignOut(client)}
        >
          Sign out all devices
        </ActionButton>
      </Panel>
    </>
  );
}
