"use client";
import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { CCU360LoadingOverlay } from "@/components/ui/ccu-loader";
import QRCode from "qrcode";
import { z } from "zod";
import {
  indexCardClasses,
  indexAuthSubmitClasses,
} from "@/components/auth/index-presentation";
import {
  ApiError,
  apiRequest,
  notifyIdentityChange,
  replaceIdentityLocation,
} from "@/lib/api/client";
import {
  loginResult,
  type LoginStep,
  message,
} from "@/lib/api/identity-contract";

function authErrorMessage(error: Error) {
  if (error instanceof ApiError) {
    if (error.code === "invalid_credentials") return "Invalid credentials";
    if (error.code === "invalid_mfa_code") return "Invalid code. Try again.";
    if (error.code === "invalid_or_expired_token") return "This link expired. Request a new one.";
    if (error.status === 429) return "Too many attempts. Try again later.";
    if (error.status >= 500) return "Service unavailable. Try again.";
  }
  return error.message;
}

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
  const [verificationDigits, setVerificationDigits] = useState<string[]>(Array(6).fill(""));
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const codeFields = useRef<(HTMLInputElement | null)[]>([]);
  const codeSubmitted = useRef(false);
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
    onError: () => {
      if (step === "verify" && !useRecoveryCode) {
        codeSubmitted.current = false;
        setVerificationDigits(Array(6).fill(""));
        requestAnimationFrame(() => codeFields.current[0]?.focus());
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
    if (mutation.isPending) return;
    if (step === "verify" && !useRecoveryCode) {
      if (verificationDigits.some((digit) => !digit) || codeSubmitted.current) return;
      codeSubmitted.current = true;
    }
    mutation.mutate(new FormData(event.currentTarget));
  }
  function submitVerificationCode(code: string) {
    if (mutation.isPending || codeSubmitted.current) return;
    codeSubmitted.current = true;
    const data = new FormData();
    data.set("code", code);
    mutation.mutate(data);
  }
  function fillVerificationDigits(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    const start = digits.length === 6 ? 0 : index;
    const next = [...verificationDigits];
    for (let offset = 0; offset < digits.length && start + offset < 6; offset++)
      next[start + offset] = digits[offset];
    setVerificationDigits(next);
    const firstEmpty = next.findIndex((digit) => !digit);
    if (firstEmpty === -1) submitVerificationCode(next.join(""));
    else codeFields.current[firstEmpty]?.focus();
  }
  function pasteVerificationCode(event: ClipboardEvent<HTMLInputElement>, index: number) {
    event.preventDefault();
    fillVerificationDigits(index, event.clipboardData.getData("text"));
  }
  function handleVerificationKey(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const target = verificationDigits[index] ? index : Math.max(0, index - 1);
      const next = [...verificationDigits];
      next[target] = "";
      setVerificationDigits(next);
      codeFields.current[target]?.focus();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      codeFields.current[Math.max(0, index - 1)]?.focus();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      codeFields.current[Math.min(5, index + 1)]?.focus();
    }
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
    <>
    {step === "verify" && mutation.isPending && <CCU360LoadingOverlay />}
    <div className={indexCardClasses}>
      <p className="eyebrow">YOUR SECURE WORKSPACE</p>
      <h2>{title}</h2>
      {complete ? (
        <>
          <p className="mt-4 text-sm leading-6 text-muted" role="status">
            {complete}
          </p>
          <Link className={indexAuthSubmitClasses} href="/auth/signin">
            Return to sign in
          </Link>
        </>
      ) : step === "codes" ? (
        <>
          <p>
            Save these codes in your password manager. Each code works once
            if you lose access to your authenticator.
          </p>
          <div className="recovery-codes grid grid-cols-1 gap-2 wrap-anywhere rounded-[3px] border border-border bg-[#f4f8f9] p-3.5 text-xs">
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
            className={indexAuthSubmitClasses}
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
              className={indexAuthSubmitClasses}
              disabled={enrollment.isPending}
              onClick={() => enrollment.mutate()}
            >
              {enrollment.isPending ? "Preparing…" : "Set up authenticator"}
            </button>
          )}
          {factor && (
            <div className="factor-setup my-5 text-center">
              <Image
                unoptimized
                src={factor.image}
                alt="Scan this QR code in your authenticator app"
                width={224}
                height={224}
              />
              <p>Or enter this setup key manually:</p>
              <code className="setup-key block select-all wrap-anywhere rounded-[3px] bg-[#f1f6f7] p-3 text-base tracking-[.08em]">
                {factor.secret}
              </code>
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
                      <div className="label-row mt-[22px] flex justify-between">
                        <label htmlFor="password">
                          {purpose === "login"
                            ? "Password"
                            : "Password (12–128 characters)"}
                        </label>
                        <button
                          className="text-button border-0 bg-transparent px-0 py-2 text-left font-semibold text-teal-dark"
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
              {step === "verify" && (
                <>
                  <label htmlFor={useRecoveryCode ? "code" : "verification-digit-0"}>
                    {useRecoveryCode ? "Recovery code" : "Six-digit authenticator code"}
                  </label>
                  {useRecoveryCode ? (
                    <input
                      id="code"
                      name="code"
                      autoComplete="off"
                      maxLength={32}
                      required
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-6 gap-2" role="group" aria-label="Six-digit authenticator code">
                        {verificationDigits.map((digit, index) => (
                          <input
                            key={index}
                            ref={(element) => { codeFields.current[index] = element; }}
                            id={`verification-digit-${index}`}
                            className="verification-digit"
                            type="text"
                            inputMode="numeric"
                            autoComplete={index === 0 ? "one-time-code" : "off"}
                            aria-label={`Digit ${index + 1} of 6`}
                            maxLength={index === 0 ? 6 : 1}
                            value={digit}
                            disabled={mutation.isPending}
                            onChange={(event) => {
                              if (!event.target.value) {
                                const next = [...verificationDigits];
                                next[index] = "";
                                setVerificationDigits(next);
                              } else fillVerificationDigits(index, event.target.value);
                            }}
                            onPaste={(event) => pasteVerificationCode(event, index)}
                            onKeyDown={(event) => handleVerificationKey(event, index)}
                            onFocus={(event) => event.target.select()}
                            autoFocus={index === 0}
                          />
                        ))}
                      </div>
                      <input type="hidden" name="code" value={verificationDigits.join("")} />
                    </>
                  )}
                  <button
                    type="button"
                    className="mt-4 text-sm font-semibold text-teal-dark underline underline-offset-2 disabled:opacity-50"
                    disabled={mutation.isPending}
                    onClick={() => {
                      codeSubmitted.current = false;
                      setVerificationDigits(Array(6).fill(""));
                      setUseRecoveryCode(!useRecoveryCode);
                    }}
                  >
                    {useRecoveryCode ? "Use authenticator code" : "Use a recovery code"}
                  </button>
                </>
              )}
              {step === "enroll" && (
                <>
                  <label htmlFor="code">Six-digit authenticator code</label>
                  <input
                    id="code"
                    name="code"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={32}
                    minLength={6}
                    required
                    autoFocus
                  />
                </>
              )}
              {error && (
                <p className="mt-4 text-sm font-medium text-red" role="alert">
                  {authErrorMessage(error)}
                </p>
              )}
              <button
                className={indexAuthSubmitClasses}
                disabled={mutation.isPending || (step === "verify" && !useRecoveryCode && verificationDigits.some((digit) => !digit))}
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
            <p className="mt-4 text-sm font-medium text-red" role="alert">
              {authErrorMessage(error)}
            </p>
          )}
          <div className="auth-links my-5 font-semibold text-teal-dark">
            {purpose === "login" && step === "authenticated" ? (
              <Link href="/auth/forgot-password">
                Forgot your password?
              </Link>
            ) : (
              <Link href="/auth/signin">Back to sign in</Link>
            )}
          </div>
          <p className="auth-trust mt-6 flex gap-3 text-xs leading-[1.8] text-muted">
            Access is invitation only. Contact your facility administrator
            if you need an account.
          </p>
        </>
      )}
    </div>
    </>
  );
}
