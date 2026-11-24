"use client";
import { buttonClasses } from "@/lib/presentation";
import { Icon, type IconName } from "@/components/ui/icon";
import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
  type RefObject,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { RequestError } from "@/components/ui/request-error";
import { ButtonHeartbeat, CCU360Loader } from "@/components/ui/ccu-loader";
import { Badge } from "@/components/ui/primitives";
import {
  FeedbackMessage,
  useToast,
} from "@/components/ui/feedback";

export function Heading({
  title,
  detail,
  actions,
  eyebrow = "CCU360 · CONNECTED CARE",
}: {
  title: string;
  detail: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="workspace-heading mt-1 mb-7 flex items-start justify-between gap-6 max-[760px]:flex-col">
      <div>
        {eyebrow && (
          <p className="text-[11px] font-bold tracking-[.13em] text-teal-dark">
            {eyebrow}
          </p>
        )}
        <div className="workspace-title-row">
          <h1 className="mt-2 mb-3 text-[clamp(26px,2.3vw,36px)] leading-[1.15] tracking-[-.035em] text-navy">
            {title}
          </h1>
          {detail && (
            <InfoTooltip
              className="workspace-guide"
              label="Page guide"
              content={detail}
              showLabel
            />
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-[10px]">{actions}</div>
      )}
    </header>
  );
}
export function Panel({
  title,
  detail,
  icon,
  children,
  scroll = false,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <section className="live-panel mb-6 min-w-0 rounded-[14px] border border-border bg-surface [&_p]:wrap-anywhere">
      <header className="live-panel-header">
        <div className="live-panel-title">
          {icon && <span className="live-panel-icon"><Icon name={icon} size={19} outline /></span>}
          <h2 className="text-xl leading-[inherit] tracking-[-.02em] text-navy">
            {title}
          </h2>
        </div>
        {detail && (
          <InfoTooltip
            className="panel-context"
            label={`About ${title}`}
            content={detail}
          />
        )}
      </header>
      <div
        className={`live-panel-body${scroll ? " live-panel-scroll" : ""}`}
        tabIndex={scroll ? 0 : undefined}
        role={scroll ? "region" : undefined}
        aria-label={scroll ? `${title} contents` : undefined}
      >
        {children}
      </div>
    </section>
  );
}
function InfoTooltip({
  className,
  label,
  content,
  showLabel = false,
}: {
  className: string;
  label: string;
  content: string;
  showLabel?: boolean;
}) {
  const id = useId();
  return (
    <span className={className}>
      <button
        type="button"
        className="info-tooltip-trigger"
        aria-label={label}
        aria-describedby={id}
      >
        <Icon name="help" size={showLabel ? 15 : 18} />
        {showLabel && label}
      </button>
      <span id={id} className="info-tooltip-content" role="tooltip">
        {content}
      </span>
    </span>
  );
}
export function Notice({
  error,
  formRef,
  compact = false,
}: {
  error: Error | null;
  formRef?: RefObject<HTMLFormElement | null>;
  compact?: boolean;
}) {
  return <RequestError error={error} formRef={formRef} compact={compact} />;
}
export function QueryState({
  query,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: Error | null;
    refetch: () => unknown;
  };
}) {
  if (query.isPending)
    return (
      <div className="live-query-loader">
        <CCU360Loader variant="inline" label="Loading records" />
      </div>
    );
  if (query.isError)
    return (
      <div>
        <Notice error={query.error} />
        <button
          className={buttonClasses.secondary}
          onClick={() => query.refetch()}
        >
          Retry
        </button>
      </div>
    );
  return null;
}
export function Status({ value }: { value: string }) {
  return (
    <Badge
      tone={
        [
          "active",
          "published",
          "completed",
          "verified",
          "attested",
          "sent",
          "available",
        ].includes(value)
          ? "teal"
          : ["suspended", "disabled", "failed", "retired", "disputed"].includes(
                value,
              )
            ? "red"
            : "neutral"
      }
    >
      {value.replaceAll("_", " ")}
    </Badge>
  );
}
export function Field({
  label,
  name,
  type = "text",
  required = true,
  defaultValue,
  minLength,
  maxLength = 160,
  children,
  ...rest
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  children?: ReactNode;
  min?: number;
  max?: number;
  step?: string;
  pattern?: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const input = (
    <input
      id={id}
      name={name}
      type={type === "password" && passwordVisible ? "text" : type}
      required={required}
      defaultValue={defaultValue}
      minLength={minLength}
      maxLength={maxLength}
      autoComplete={type === "password" ? "off" : undefined}
      spellCheck={type === "password" ? false : undefined}
      autoCapitalize={type === "password" ? "none" : undefined}
      {...rest}
    />
  );
  return (
    <div className="live-field">
      <label htmlFor={id}>
        {label}
        {required ? "" : " (optional)"}
      </label>
      {children ? (
        <select
          id={id}
          name={name}
          required={required}
          defaultValue={defaultValue}
        >
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea
          id={id}
          name={name}
          required={required}
          defaultValue={defaultValue}
          minLength={minLength}
          maxLength={maxLength}
          rows={4}
        />
      ) : type === "password" ? (
        <div className="live-password-control">
          {input}
          <button
            type="button"
            className="live-password-toggle"
            aria-label={`${passwordVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            <Icon name={passwordVisible ? "hide" : "show"} size={15} outline />
            {passwordVisible ? "Hide" : "Show"}
          </button>
        </div>
      ) : input}
    </div>
  );
}
export function ActionForm({
  scope,
  path,
  method = "POST",
  body,
  children,
  label,
  icon,
  onSuccess,
  successMessage = "Saved successfully.",
  reset = true,
  disabled = false,
  compactError = false,
}: {
  scope: string | null;
  path: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body: (data: FormData) => unknown;
  children: ReactNode;
  label: string;
  icon?: IconName;
  onSuccess?: (result: unknown) => void | Promise<void>;
  successMessage?: string;
  reset?: boolean;
  disabled?: boolean;
  compactError?: boolean;
}) {
  const client = useQueryClient();
  const form = useRef<HTMLFormElement>(null);
  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      apiRequest("/api/v1/" + path, z.unknown(), { method, body: body(data) }),
    onSuccess: async (result) => {
      if (reset) form.current?.reset();
      await client.invalidateQueries({ queryKey: ["live", scope] });
      await onSuccess?.(result);
    },
    onError: async (error) => {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.outcomeUnknown)
      )
        await client.invalidateQueries({ queryKey: ["live", scope] });
    },
  });
  return (
    <form
      ref={form}
      className="live-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        mutation.mutate(new FormData(event.currentTarget));
      }}
    >
      <fieldset disabled={mutation.isPending || disabled}>
        <Notice error={mutation.error} formRef={form} compact={compactError} />
        {children}
        {mutation.isSuccess && (
          <FeedbackMessage tone="success">{successMessage}</FeedbackMessage>
        )}
        <button type="submit" className={buttonClasses.primary} aria-busy={mutation.isPending}>
          <ButtonHeartbeat loading={mutation.isPending}>
            {icon && <Icon name={icon} size={16} outline />}
            {label}
          </ButtonHeartbeat>
        </button>
      </fieldset>
    </form>
  );
}
export function ActionButton({
  scope,
  path,
  body = {},
  method = "POST",
  children,
  confirm,
  onSuccess,
  successMessage = "Change saved.",
}: {
  scope: string | null;
  path: string;
  body?: unknown;
  method?: "POST" | "PATCH" | "DELETE" | "PUT";
  children: ReactNode;
  confirm?: string;
  onSuccess?: (result: unknown) => void | Promise<void>;
  successMessage?: string;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/v1/" + path, z.unknown(), { method, body }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["live", scope] });
      await onSuccess?.(result);
      toast?.(successMessage);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409)
        await client.invalidateQueries({ queryKey: ["live", scope] });
    },
  });
  return (
    <div className="live-action max-w-full self-start">
      <button
        type="button"
        className={buttonClasses.secondary}
        disabled={mutation.isPending}
        aria-busy={mutation.isPending}
        onClick={() => {
          if (!confirm || window.confirm(confirm)) mutation.mutate();
        }}
      >
        <ButtonHeartbeat loading={mutation.isPending}>{children}</ButtonHeartbeat>
      </button>
      <Notice error={mutation.error} />
    </div>
  );
}
export function Pager({
  offset,
  count,
  size = 20,
  hasMore,
  change,
}: {
  offset: number;
  count: number;
  size?: number;
  hasMore?: boolean;
  change: (offset: number) => void;
}) {
  return (
    <div className="live-pager mt-5 flex flex-wrap items-center justify-end gap-3">
      <span>
        {count
          ? `Showing ${offset + 1}–${offset + count}`
          : "No records on this page"}
      </span>
      <button
        className={buttonClasses.secondary}
        disabled={!offset}
        onClick={() => change(Math.max(0, offset - size))}
      >
        Previous
      </button>
      <button
        className={buttonClasses.secondary}
        disabled={hasMore === undefined ? count < size : !hasMore}
        onClick={() => change(offset + size)}
      >
        Next
      </button>
    </div>
  );
}
export const value = (data: FormData, name: string) =>
  String(data.get(name) ?? "").trim();
export const stamp = (date?: string | null) =>
  date
    ? new Intl.DateTimeFormat("en-KE", {
        timeZone: "Africa/Nairobi",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date))
    : "—";
