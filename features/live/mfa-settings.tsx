"use client";
import { buttonClasses } from "@/lib/presentation";
import { useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useIdentity, finishSignOut } from "@/features/identity/queries";
import {
  notifyIdentityChange,
  replaceIdentityLocation,
} from "@/lib/api/client";
import { Panel, ActionForm, Field } from "./shared";
export function MfaSettings() {
  const user = useIdentity().data!;
  const client = useQueryClient();
  const [factor, setFactor] = useState<{
    secret: string;
    image: string;
  } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const privileged =
    user.platform_role === "ahs_admin" ||
    user.memberships.some(
      (member) =>
        member.role === "provider_admin" && member.status === "active",
    );
  if (codes.length)
    return (
      <Panel
        title="Save your recovery codes"
        icon="shield"
        detail="These replace any previous recovery codes. Each works once. Store them in your password manager before continuing."
      >
        <div className="recovery-codes grid grid-cols-1 gap-2 wrap-anywhere rounded-lg border border-border bg-[#f4f8f9] p-3.5 text-xs">
          {codes.map((code) => (
            <code key={code}>{code}</code>
          ))}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={saved}
            onChange={(event) => setSaved(event.target.checked)}
          />
          I have saved these recovery codes.
        </label>
        <button
          className={buttonClasses.primary}
          disabled={!saved}
          onClick={async () => {
            setCodes([]);
            await client.cancelQueries();
            client.clear();
            notifyIdentityChange("login");
            replaceIdentityLocation("/dashboard");
          }}
        >
          Continue securely
        </button>
      </Panel>
    );
  return (
    <Panel
      title="Two-step verification"
      icon="shield"
      detail={
        privileged
          ? "Administrator accounts must retain MFA. Recovery codes let you sign in if your authenticator is unavailable."
          : "Add an authenticator to protect your account. Your password is required to change MFA settings."
      }
    >
      {!user.mfa_enabled && !factor && (
        <ActionForm
          scope={user.id}
          path="auth/mfa/totp/start"
          label="Prepare authenticator setup"
          icon="shield"
          body={(form) => ({ password: form.get("password") })}
          onSuccess={async (result) => {
            const parsed = z
              .object({ secret: z.string(), provisioning_uri: z.string() })
              .parse(result);
            setFactor({
              secret: parsed.secret,
              image: await QRCode.toDataURL(parsed.provisioning_uri, {
                width: 224,
                margin: 2,
              }),
            });
          }}
        >
          <Field
            name="password"
            label="Current password"
            type="password"
            maxLength={128}
          />
        </ActionForm>
      )}
      {factor && (
        <>
          <div className="factor-setup my-5 text-center">
            <Image
              unoptimized
              src={factor.image}
              width={224}
              height={224}
              alt="Scan in your authenticator app"
            />
            <code className="setup-key block select-all wrap-anywhere rounded-lg bg-[#f1f6f7] p-3 text-base tracking-[.08em]">{factor.secret}</code>
          </div>
          <ActionForm
            scope={user.id}
            path="auth/mfa/totp/confirm"
            label="Enable authenticator"
            icon="check"
            body={(form) => ({ code: String(form.get("code")).trim() })}
            onSuccess={(result) => {
              const parsed = z
                .object({ recovery_codes: z.array(z.string()) })
                .parse(result);
              setFactor(null);
              setCodes(parsed.recovery_codes);
            }}
          >
            <Field
              name="code"
              label="Six-digit authenticator code"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
            />
          </ActionForm>
        </>
      )}
      {user.mfa_enabled && (
        <>
          <p className="success-message rounded-lg border border-success-border bg-mint p-3 text-success-text">
            Authenticator verification is enabled.
          </p>
          <div className="account-recovery-section">
            <ActionForm
              scope={user.id}
              path="auth/mfa/recovery-codes"
              label="Generate new recovery codes"
              icon="refresh"
              body={(form) => ({
                password: form.get("password"),
                code: String(form.get("code")).trim(),
              })}
              onSuccess={(result) =>
                setCodes(
                  z
                    .object({ recovery_codes: z.array(z.string()) })
                    .parse(result).recovery_codes,
                )
              }
            >
              <Field
                name="password"
                label="Current password"
                type="password"
                maxLength={128}
              />
              <Field
                name="code"
                label="Current authenticator or unused recovery code"
                minLength={6}
                maxLength={32}
              />
            </ActionForm>
          </div>
          {!privileged && (
            <details>
              <summary>Disable authenticator verification</summary>
              <ActionForm
                scope={user.id}
                path="auth/mfa/disable"
                label="Disable MFA & sign out"
                icon="logout"
                body={(form) => ({
                  password: form.get("password"),
                  code: String(form.get("code")).trim(),
                })}
                onSuccess={() => finishSignOut(client)}
              >
                <Field
                  name="password"
                  label="Current password"
                  type="password"
                  maxLength={128}
                />
                <Field
                  name="code"
                  label="Current authenticator or unused recovery code"
                  minLength={6}
                  maxLength={32}
                />
              </ActionForm>
            </details>
          )}
        </>
      )}
    </Panel>
  );
}
