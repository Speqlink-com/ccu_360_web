"use client";
import { useRouter } from "next/navigation";
import { sessionSchema } from "@/lib/domain/identity";
import { demoRequest } from "@/lib/api/demo-client";
import { useState, type FormEvent } from "react";
import {
  indexCardClasses,
  indexAuthSubmitClasses,
} from "@/components/auth/index-presentation";
import { Icon } from "@/components/ui/icon";
import { CCU360LoadingOverlay } from "@/components/ui/ccu-loader";
import { isDemo } from "@/lib/config";

export function SignIn() {
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!isDemo) {
      setError(
        "Institution authentication is not connected. Demo accounts are disabled in production.",
      );
      return;
    }
    const form = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await demoRequest("session", sessionSchema, {
        method: "POST",
        body: { email: form.get("email"), password: form.get("password") },
      });
      router.replace("/dashboard");
    } catch (error) {
      setError(
        error instanceof Error &&
          error.message === "The email or password is incorrect."
          ? "Invalid credentials"
          : error instanceof Error
            ? error.message
            : "We could not sign you in.",
      );
      setBusy(false);
    }
  }
  return (
    <>
    {busy && <CCU360LoadingOverlay />}
    <div className={indexCardClasses}>
      <p className="eyebrow">YOUR CLINICAL WORKSPACE</p>
      <h2>Welcome back.</h2>
      <p className="muted">
        One sign-in. The right workspace for your role.
      </p>
      <form onSubmit={submit}>
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@hospital.org"
        />
        <div className="label-row mt-[22px] flex justify-between">
          <label htmlFor="password">Password</label>
          <span className="muted small">Institution managed</span>
        </div>
        <div className="password-field relative">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setVisible(!visible)}
            aria-pressed={visible}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm font-medium text-red" role="alert">
            {error}
          </p>
        )}
        <button
          className={indexAuthSubmitClasses}
          type="submit"
          disabled={busy}
        >
          Sign in{" "}
          <Icon name="arrow" />
        </button>
      </form>
      {isDemo && (
        <div className="demo-signin-info mt-6 flex gap-[11px] rounded-[9px] border border-[#dfece5] bg-[#f2f8f5] p-[17px]">
          <span className="demo-signin-dot mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-[#50a887]" />
          <div>
            <strong>Explore your role in CCU360</strong>
            <p>
              Use a supplied AHS, facility administrator or clinical team
              account. Each opens its own workspace.
            </p>
            <small>Synthetic data · No real patient information</small>
          </div>
        </div>
      )}
      <div className="auth-trust mt-6 flex gap-3 text-xs leading-[1.8] text-muted">
        <Icon name="shield" />
        <span>
          Access is reserved for authorized care teams.
          <br />
          Need access? Contact your institution administrator.
        </span>
      </div>
    </div>
    </>
  );
}
