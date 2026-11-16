"use client";
import { buttonClasses } from "@/lib/presentation";
import { useId, useRef, type ReactNode, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { Badge } from "@/components/ui/primitives";
import {
  FeedbackMessage,
  LoadingState,
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
    <header className="mt-1 mb-7 flex items-start justify-between gap-6 max-[760px]:flex-col">
      <div>
        <p className="text-[11px] font-bold tracking-[.13em] text-teal-dark">
          {eyebrow}
        </p>
        <h1 className="mt-2 mb-3 text-[clamp(26px,2.3vw,36px)] leading-[1.15] tracking-[-.035em] text-navy">
          {title}
        </h1>
        <p className="m-0 max-w-[860px] text-[15px] text-muted">{detail}</p>
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
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="live-panel mb-6 min-w-0 rounded-[14px] border border-border bg-surface p-6 max-[760px]:p-[18px] [&_p]:wrap-anywhere">
      <header className="mb-5">
        <h2 className="mb-2 text-xl leading-[inherit] tracking-[-.02em] text-navy">
          {title}
        </h2>
        {detail && <p className="m-0 max-w-[850px] text-muted">{detail}</p>}
      </header>
      {children}
    </section>
  );
}
export function Notice({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <FeedbackMessage tone="error">
      <p>{error.message}</p>
      {error instanceof ApiError && error.requestId && (
        <small>Support reference: {error.requestId}</small>
      )}
    </FeedbackMessage>
  );
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
  if (query.isPending) return <LoadingState />;
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
}) {
  const id = useId();
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
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          minLength={minLength}
          maxLength={maxLength}
          autoComplete={type === "password" ? "off" : undefined}
          {...rest}
        />
      )}
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
  onSuccess,
  successMessage = "Saved successfully.",
  reset = true,
  disabled = false,
}: {
  scope: string | null;
  path: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body: (data: FormData) => unknown;
  children: ReactNode;
  label: string;
  onSuccess?: (result: unknown) => void | Promise<void>;
  successMessage?: string;
  reset?: boolean;
  disabled?: boolean;
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
      if (error instanceof ApiError && error.status === 409)
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
        {children}
        <Notice error={mutation.error} />
        {mutation.isSuccess && (
          <FeedbackMessage tone="success">{successMessage}</FeedbackMessage>
        )}
        <button type="submit" className={buttonClasses.primary}>
          {mutation.isPending ? "Saving…" : label}
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
    <div className="live-action">
      <button
        className={buttonClasses.secondary}
        disabled={mutation.isPending}
        onClick={() => {
          if (!confirm || window.confirm(confirm)) mutation.mutate();
        }}
      >
        {mutation.isPending ? "Please wait…" : children}
      </button>
      <Notice error={mutation.error} />
    </div>
  );
}
export function Pager({
  offset,
  count,
  size = 20,
  change,
}: {
  offset: number;
  count: number;
  size?: number;
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
        disabled={count < size}
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
