"use client";
import { useId, useRef, type ReactNode, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { Badge } from "@/components/ui/primitives";

export function Heading({
  title,
  detail,
  actions,
}: {
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <header className="live-heading">
      <div>
        <p className="eyebrow">CCU360 · CONNECTED CARE</p>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
      {actions && <div className="live-heading-actions">{actions}</div>}
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
    <section className="live-panel">
      <header>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </header>
      {children}
    </section>
  );
}
export function Notice({ error }: { error: Error | null }) {
  if (!error) return null;
  return (
    <div className="inline-error" role="alert">
      <p>{error.message}</p>
      {error instanceof ApiError && error.requestId && (
        <small>Support reference: {error.requestId}</small>
      )}
    </div>
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
  if (query.isPending)
    return (
      <p role="status" className="live-loading">
        Loading verified records…
      </p>
    );
  if (query.isError)
    return (
      <div>
        <Notice error={query.error} />
        <button className="btn btn-secondary" onClick={() => query.refetch()}>
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
      <fieldset disabled={mutation.isPending}>
        {children}
        <Notice error={mutation.error} />
        {mutation.isSuccess && (
          <p className="success-message" role="status">
            {successMessage}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
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
}: {
  scope: string | null;
  path: string;
  body?: unknown;
  method?: "POST" | "PATCH" | "DELETE" | "PUT";
  children: ReactNode;
  confirm?: string;
  onSuccess?: (result: unknown) => void | Promise<void>;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/v1/" + path, z.unknown(), { method, body }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["live", scope] });
      await onSuccess?.(result);
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409)
        await client.invalidateQueries({ queryKey: ["live", scope] });
    },
  });
  return (
    <div className="live-action">
      <button
        className="btn btn-secondary"
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
    <div className="live-pager">
      <span>
        {count
          ? `Showing ${offset + 1}–${offset + count}`
          : "No records on this page"}
      </span>
      <button
        className="btn btn-secondary"
        disabled={!offset}
        onClick={() => change(Math.max(0, offset - size))}
      >
        Previous
      </button>
      <button
        className="btn btn-secondary"
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
