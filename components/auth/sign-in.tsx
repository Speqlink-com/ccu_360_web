"use client";
import { useRouter } from "next/navigation";
import { sessionSchema } from "@/lib/domain/identity";
import { demoRequest } from "@/lib/api/demo-client";
import { useState, type FormEvent } from "react";
import { Brand } from "@/components/ui/brand";
import { Icon } from "@/components/ui/icon";
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
        error instanceof Error ? error.message : "We could not sign you in.",
      );
      setBusy(false);
    }
  }
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
            From admission to handover, bring the patient’s story and the work
            around it together.
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
            <div className="label-row">
              <label htmlFor="password">Password</label>
              <span className="muted small">Institution managed</span>
            </div>
            <div className="password-field">
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
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary auth-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? "Opening your workspace…" : "Sign in"}{" "}
              <Icon name="arrow" />
            </button>
          </form>
          {isDemo && (
            <div className="demo-signin-info">
              <span className="demo-signin-dot" />
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
          <div className="auth-trust">
            <Icon name="shield" />
            <span>
              Access is reserved for authorized care teams.
              <br />
              Need access? Contact your institution administrator.
            </span>
          </div>
        </div>
        <p className="auth-bottom">
          One patient state. Every critical-care workflow.
        </p>
      </section>
    </main>
  );
}
