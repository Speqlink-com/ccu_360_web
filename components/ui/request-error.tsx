"use client";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import {
  ApiError,
  errorHeading,
  issueLabel,
  issueMessage,
  type ValidationIssue,
} from "@/lib/api/errors";

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
export function controlsForIssue(
  form: HTMLFormElement,
  issue: ValidationIssue,
): Control[] {
  const exact = issue.path.join(".");
  const names = [exact];
  if (issue.path.length === 2 && typeof issue.path[1] === "number")
    names.push(String(issue.path[0]));
  return Array.from(form.elements).filter(
    (element): element is Control =>
      element.matches("input,select,textarea") &&
      names.includes((element as Control).name) &&
      !element.matches(":disabled") &&
      element.getAttribute("type") !== "hidden",
  );
}
function focusControl(control: Control) {
  for (
    let parent = control.parentElement;
    parent;
    parent = parent.parentElement
  )
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  control.focus();
}
export function RequestError({
  error,
  formRef,
}: {
  error: Error | null;
  formRef?: RefObject<HTMLFormElement | null>;
}) {
  const id = useId();
  const summary = useRef<HTMLDivElement>(null);
  const [copiedReference, setCopiedReference] = useState<string | undefined>();
  useEffect(() => {
    const form = formRef?.current;
    if (!error || !form) return;
    const previous = new Map<
      Control,
      { invalid: string | null; description: string | null }
    >();
    const issues = error instanceof ApiError ? error.issues : [];
    let first: Control | undefined;
    issues.forEach((issue, index) => {
      for (const control of controlsForIssue(form, issue)) {
        if (!previous.has(control))
          previous.set(control, {
            invalid: control.getAttribute("aria-invalid"),
            description: control.getAttribute("aria-describedby"),
          });
        control.setAttribute("aria-invalid", "true");
        const describedBy = new Set(
          (control.getAttribute("aria-describedby") ?? "")
            .split(/\s+/)
            .filter(Boolean),
        );
        describedBy.add(`${id}-issue-${index}`);
        control.setAttribute("aria-describedby", [...describedBy].join(" "));
        first ??= control;
      }
    });
    if (first) focusControl(first);
    else summary.current?.focus();
    return () => {
      for (const [control, attributes] of previous) {
        for (const [name, value] of [
          ["aria-invalid", attributes.invalid],
          ["aria-describedby", attributes.description],
        ] as const)
          if (value === null) control.removeAttribute(name);
          else control.setAttribute(name, value);
      }
    };
  }, [error, formRef, id]);
  if (!error) return null;
  const problem = error instanceof ApiError ? error : null;
  return (
    <div
      ref={summary}
      tabIndex={-1}
      role="alert"
      aria-labelledby={`${id}-title`}
      className="request-error my-4 max-w-[640px] rounded-lg border border-[#e9c7cb] bg-[#fff4f4] p-4 text-[14px] leading-6 text-red outline-offset-4"
    >
      <p id={`${id}-title`} className="mb-1 font-semibold">
        {errorHeading(error)}
      </p>
      <p>{error.message}</p>
      {!!problem?.issues.length && (
        <ul className="mt-3 space-y-2">
          {problem.issues.map((issue, index) => (
            <li key={index} id={`${id}-issue-${index}`}>
              {formRef &&
              issue.path.length > 0 &&
              ![
                "token",
                "challenge_token",
                "refresh_token",
                "expected_version",
                "expected_revision",
              ].includes(String(issue.path.at(-1))) ? (
                <button
                  type="button"
                  className="text-left font-semibold underline decoration-red/40 underline-offset-2"
                  onClick={() => {
                    const form = formRef?.current;
                    const target = form
                      ? controlsForIssue(form, issue)[0]
                      : undefined;
                    if (target) focusControl(target);
                  }}
                >
                  {issueLabel(issue)}
                </button>
              ) : (
                <strong>{issueLabel(issue)}</strong>
              )}
              <span>: {issueMessage(issue, problem.path)}</span>
            </li>
          ))}
        </ul>
      )}
      {problem?.outcomeUnknown && (
        <p className="mt-3 font-medium">
          Your change may have been saved. Reload the record and check before
          submitting it again.
        </p>
      )}
      {problem?.requestId && (
        <details className="mt-3 border-t border-red/15 pt-2 text-xs text-muted">
          <summary className="cursor-pointer font-medium">
            Support details
          </summary>
          <p className="mt-2 break-all">
            Reference:{" "}
            <span className="select-all font-mono">{problem.requestId}</span>
          </p>
          <button
            type="button"
            className="mt-1 font-semibold text-teal-dark underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(problem.requestId!);
                setCopiedReference(problem.requestId);
              } catch {
                setCopiedReference(undefined);
              }
            }}
          >
            {copiedReference === problem.requestId
              ? "Reference copied"
              : "Copy reference"}
          </button>
        </details>
      )}
    </div>
  );
}
