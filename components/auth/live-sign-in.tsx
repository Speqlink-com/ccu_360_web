"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { z } from "zod";
import { Brand } from "@/components/ui/brand";
import {
  apiRequest,
  notifyIdentityChange,
  replaceIdentityLocation,
} from "@/lib/api/client";
import {
  loginResult,
  type LoginStep,
  message,
} from "@/lib/api/identity-contract";

export function LiveSignIn({
  purpose = "login",
}: {
  purpose?: "login" | "forgot" | "reset" | "invite";
}) {
  const client = useQueryClient();
  const [step, setStep] = useState<LoginStep | "codes">("authenticated");
  const [factor, setFactor] = useState<{
    secret: string;
    image: string;
  } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [token, setToken] = useState("");
  const fragmentToken = useRef<string | null>(null);
  const [codesSaved, setCodesSaved] = useState(false);
  const [complete, setComplete] = useState("");
  const [visible, setVisible] = useState(false);
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (purpose === "forgot")
        return apiRequest("/api/v1/auth/password/forgot", message, {
          method: "POST",
          body: { email: data.get("email") },
          authenticated: false,
        });
      if (purpose === "invite" || purpose === "reset") {
        if (!token)
          throw new Error(
            "Open the complete link from your email. If it has expired, request a new link.",
          );
        if (data.get("password") !== data.get("confirm"))
          throw new Error("The passwords do not match.");
        return apiRequest(
          `/api/v1/auth/${purpose === "invite" ? "invitations/accept" : "password/reset"}`,
          message,
          {
            method: "POST",
            body: { token, password: data.get("password") },
            authenticated: false,
          },
        );
      }
      if (step === "verify") {
        await apiRequest("/api/v1/auth/mfa/verify", loginResult, {
          method: "POST",
          body: { code: String(data.get("code")).trim() },
          authenticated: false,
        });
        return { next: "dashboard" };
      }
      if (step === "enroll") {
        const result = await apiRequest(
          "/api/v1/auth/mfa/totp/confirm",
          z.object({ recovery_codes: z.array(z.string()) }),
          {
            method: "POST",
            body: { code: String(data.get("code")).trim() },
            authenticated: false,
          },
        );
        setCodes(result.recovery_codes);
        setFactor(null);
        setStep("codes");
        return {};
      }
      const result = await apiRequest("/api/v1/auth/login", loginResult, {
        method: "POST",
        body: {
          email: String(data.get("email")).trim(),
          password: data.get("password"),
          device_name: "CCU360 Web",
        },
        authenticated: false,
      });
      if (result.step === "authenticated") return { next: "dashboard" };
      setStep(result.step);
      return {};
    },
    onSuccess: async (result) => {
      if ("message" in result) {
        setComplete(result.message);
        setToken("");
      }
      if ("next" in result) {
        await client.cancelQueries();
        client.clear();
        notifyIdentityChange("login");
        replaceIdentityLocation("/dashboard");
      }
    },
  });
  const enrollment = useMutation({
    mutationFn: async () => {
      const result = await apiRequest(
        "/api/v1/auth/mfa/totp/start",
        z.object({ secret: z.string(), provisioning_uri: z.string() }),
        { method: "POST", body: {}, authenticated: false },
      );
      setFactor({
        secret: result.secret,
        image: await QRCode.toDataURL(result.provisioning_uri, {
          width: 224,
          margin: 2,
          errorCorrectionLevel: "M",
        }),
      });
    },
  });
  useEffect(() => {
    if (purpose !== "invite" && purpose !== "reset") return;
    if (fragmentToken.current === null)
      fragmentToken.current =
        new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", window.location.pathname);
    // The capability stays in memory only and is removed from the address bar immediately.
    const timer = setTimeout(() => setToken(fragmentToken.current ?? ""), 0);
    return () => clearTimeout(timer);
  }, [purpose]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    mutation.mutate(new FormData(event.currentTarget));
  }
  const error = mutation.error ?? enrollment.error;
  const title = complete
    ? "You’re all set."
    : purpose === "forgot"
      ? "Recover your access."
      : purpose === "reset"
        ? "Set a new password."
        : purpose === "invite"
          ? "Join your care team."
          : step === "verify"
            ? "Verify it’s you."
            : step === "enroll"
              ? "Secure your account."
              : step === "codes"
                ? "Keep your recovery codes."
                : "Welcome back.";
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand large />
        <div className="auth-copy">
          <p className="eyebrow">CRITICAL CARE, CONNECTED</p>
          <h1>
            One patient.
            <br />
            One shared view.
            <br />
            <span>A connected team.</span>
          </h1>
          <p>
            Secure access for every facility, every department, and every team
            along the patient journey.
          </p>
          <div className="journey">
            <span>Know the patient</span>
            <i />
            <span>Coordinate the team</span>
            <i />
            <span>Close the loop</span>
          </div>
        </div>
        <div className="auth-footer">
          <span>Developed by Ayot Health Solutions</span>
          <span>CCU360™</span>
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-form">
          <p className="eyebrow">YOUR SECURE WORKSPACE</p>
          <h2>{title}</h2>
          {complete ? (
            <>
              <p role="status">{complete}</p>
              <Link className="btn btn-primary" href="/">
                Return to sign in
              </Link>
            </>
          ) : step === "codes" ? (
            <>
              <p>
                Save these codes in your password manager. Each code works once
                if you lose access to your authenticator.
              </p>
              <div className="recovery-codes">
                {codes.map((code) => (
                  <code key={code}>{code}</code>
                ))}
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={codesSaved}
                  onChange={(event) => setCodesSaved(event.target.checked)}
                />{" "}
                I have saved my recovery codes.
              </label>
              <button
                className="btn btn-primary"
                disabled={!codesSaved}
                onClick={() => {
                  setCodes([]);
                  client.clear();
                  notifyIdentityChange("login");
                  replaceIdentityLocation("/dashboard");
                }}
              >
                Continue to workspace
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                {step === "verify"
                  ? "Enter the current six-digit authenticator code, or an unused recovery code."
                  : step === "enroll"
                    ? "Administrators must enable two-step verification before entering CCU360."
                    : purpose === "invite"
                      ? "Set a password of 12–128 characters. If you already have a CCU360 account, enter your existing password to accept this invitation."
                      : purpose === "reset"
                        ? "Choose a unique password of 12–128 characters."
                        : purpose === "forgot"
                          ? "We’ll email a recovery link if your account is eligible."
                          : "Sign in with the account provided by your administrator."}
              </p>
              {step === "enroll" && !factor && (
                <button
                  className="btn btn-primary"
                  disabled={enrollment.isPending}
                  onClick={() => enrollment.mutate()}
                >
                  {enrollment.isPending ? "Preparing…" : "Set up authenticator"}
                </button>
              )}
              {factor && (
                <div className="factor-setup">
                  <Image
                    unoptimized
                    src={factor.image}
                    alt="Scan this QR code in your authenticator app"
                    width={224}
                    height={224}
                  />
                  <p>Or enter this setup key manually:</p>
                  <code className="setup-key">{factor.secret}</code>
                </div>
              )}
              {(step !== "enroll" || factor) && (
                <form onSubmit={submit}>
                  {step !== "verify" && step !== "enroll" && (
                    <>
                      {(purpose === "login" || purpose === "forgot") && (
                        <>
                          <label htmlFor="email">Work email</label>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            required
                            maxLength={320}
                            placeholder="you@hospital.org"
                          />
                        </>
                      )}
                      {purpose !== "forgot" && (
                        <>
                          <div className="label-row">
                            <label htmlFor="password">
                              {purpose === "login"
                                ? "Password"
                                : "Password (12–128 characters)"}
                            </label>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => setVisible(!visible)}
                            >
                              {visible ? "Hide" : "Show"}
                            </button>
                          </div>
                          <input
                            id="password"
                            name="password"
                            type={visible ? "text" : "password"}
                            autoComplete={
                              purpose === "login" || purpose === "invite"
                                ? "current-password"
                                : "new-password"
                            }
                            minLength={purpose === "reset" ? 12 : 1}
                            maxLength={128}
                            required
                          />
                          {(purpose === "reset" || purpose === "invite") && (
                            <>
                              <label htmlFor="confirm">Confirm password</label>
                              <input
                                id="confirm"
                                name="confirm"
                                type="password"
                                autoComplete="new-password"
                                required
                                maxLength={128}
                              />
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {(step === "verify" || step === "enroll") && (
                    <>
                      <label htmlFor="code">
                        {step === "enroll"
                          ? "Six-digit authenticator code"
                          : "Authenticator or recovery code"}
                      </label>
                      <input
                        id="code"
                        name="code"
                        autoComplete="one-time-code"
                        inputMode={step === "enroll" ? "numeric" : "text"}
                        maxLength={32}
                        minLength={6}
                        required
                        autoFocus
                      />
                    </>
                  )}
                  {error && (
                    <p className="inline-error" role="alert">
                      {error.message}
                    </p>
                  )}
                  <button
                    className="btn btn-primary auth-submit"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending
                      ? "Please wait…"
                      : step === "enroll"
                        ? "Enable two-step verification"
                        : step === "verify"
                          ? "Verify and continue"
                          : purpose === "forgot"
                            ? "Send recovery link"
                            : purpose === "invite"
                              ? "Accept invitation"
                              : purpose === "reset"
                                ? "Update password"
                                : "Sign in"}
                  </button>
                </form>
              )}
              {step === "enroll" && !factor && error && (
                <p className="inline-error" role="alert">
                  {error.message}
                </p>
              )}
              <div className="auth-links">
                {purpose === "login" && step === "authenticated" ? (
                  <Link href="/auth/forgot-password">
                    Forgot your password?
                  </Link>
                ) : (
                  <Link href="/">Back to sign in</Link>
                )}
              </div>
              <p className="auth-trust">
                Access is invitation only. Contact your facility administrator
                if you need an account.
              </p>
            </>
          )}
        </div>
        <p className="auth-bottom">
          One patient state. Every critical-care workflow.
        </p>
      </section>
    </main>
  );
}
