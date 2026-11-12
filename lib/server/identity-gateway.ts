import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authCookieNames } from "./auth-cookies";
import { sessionTokens } from "../api/identity-contract";

const uuid = "[0-9a-fA-F-]{36}";
const readRoutes = [
  /^auth\/(me|sessions|tenant-context)$/,
  /^identity\/(providers|users|audit|email-deliveries)$/,
  new RegExp(`^identity/providers/${uuid}/members$`),
  /^workforce\/(departments|roles|assignments|coverage|audit|staff)$/,
  new RegExp(`^workforce/cases/${uuid}/coverage$`),
  /^journey\/(inbox|published-templates|team-options|access-audit)$/,
  /^journey\/config\/(baseline|brands|templates)$/,
  new RegExp(`^journey/config/logos/${uuid}$`),
  new RegExp(
    `^journey/encounters/${uuid}(/records/(entries|observations|verifications|tasks|handovers|timeline)|/evidence/(verify|bundle)|/outputs/${uuid}(/manifest)?)?$`,
  ),
];
const writeRoutes = [
  /^auth\/(login|refresh|logout|logout-all|profile|switch-organization|password\/(forgot|reset|change)|invitations\/accept|mfa\/(verify|totp\/start|totp\/confirm|recovery-codes|disable))$/,
  new RegExp(`^auth/sessions/${uuid}$`),
  /^identity\/(ahs\/invitations|providers)$/,
  new RegExp(
    `^identity/(users/${uuid}|ahs/invitations/${uuid}|providers/${uuid}(/invitations(/${uuid})?|/members/${uuid})?)$`,
  ),
  /^workforce\/(departments|roles|assignments)$/,
  new RegExp(`^workforce/(departments|roles|assignments)/${uuid}$`),
  new RegExp(`^workforce/staff/${uuid}/availability$`),
  /^journey\/(patients(\/search)?|encounters)$/,
  /^journey\/config\/(logos|brands|templates)$/,
  new RegExp(`^journey/config/templates/${uuid}/publish$`),
  new RegExp(
    `^journey/encounters/${uuid}/(entries|comments|care-team|observations(/verify)?|tasks|close|outputs|handover-acknowledgements|entries/${uuid}/attest|tasks/${uuid}/(transitions|reassign))$`,
  ),
];
export function allowedGatewayPath(path: string, method: string) {
  return (
    !path.includes("..") &&
    !path.includes("%") &&
    (method === "GET"
      ? readRoutes
      : ["POST", "PATCH", "DELETE", "PUT"].includes(method)
        ? writeRoutes
        : []
    ).some((pattern) => pattern.test(path))
  );
}
export function mutationOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    ["cross-site", "same-site"].includes(
      request.headers.get("sec-fetch-site") ?? "",
    )
  )
    return false;
  try {
    const target = new URL(request.url);
    // Next may normalize a loopback request URL to localhost. Host remains the
    // browser's actual target authority. Never trust a forwarded-host supplied by a client.
    const authority = request.headers.get("host") ?? target.host;
    const expected = new URL(`${target.protocol}//${authority}`);
    return origin === expected.origin;
  } catch {
    return false;
  }
}
export function upstreamOrigin(
  value = process.env.API_PROXY_TARGET,
  production = process.env.NODE_ENV === "production",
) {
  const url = new URL(value || "https://api.ccu360.health");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Invalid API origin");
  if (
    url.origin !== "https://api.ccu360.health" &&
    (production ||
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("Unapproved API origin");
  return url.origin;
}
const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
function error(status: number, code: string, requestId?: string | null) {
  return NextResponse.json(
    {
      error: code,
      ...(requestId && /^[a-zA-Z0-9-]{1,64}$/.test(requestId)
        ? { requestId }
        : {}),
    },
    { status, headers: privateHeaders },
  );
}
async function boundedBody(request: Request, maximum = 600_000) {
  if (Number(request.headers.get("content-length")) > maximum)
    throw new Error("body_too_large");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > maximum) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(part.value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function identityGateway(
  request: NextRequest,
  path: string,
  fetcher: typeof fetch = fetch,
) {
  if (!allowedGatewayPath(path, request.method)) return error(404, "not_found");
  if (request.method !== "GET" && !mutationOriginAllowed(request))
    return error(403, "same_origin_required");
  const names = authCookieNames();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    priority: "high" as const,
  };
  const clear = (response: NextResponse, keys = Object.values(names)) => {
    for (const key of keys)
      response.cookies.set(key, "", { ...cookieOptions, maxAge: 0 });
  };
  let access = request.cookies.get(names.access)?.value;
  let body: Uint8Array | string | undefined;
  try {
    if (request.method !== "GET") {
      const raw = await boundedBody(request);
      if (path === "journey/config/logos") body = raw;
      else {
        if (
          raw.length &&
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          return error(415, "json_required");
        let data: Record<string, unknown> = raw.length
          ? JSON.parse(new TextDecoder().decode(raw))
          : {};
        if (!data || Array.isArray(data) || typeof data !== "object")
          return error(400, "invalid_request");
        if (path === "auth/refresh") {
          const refresh = request.cookies.get(names.refresh)?.value;
          if (!refresh) return error(401, "authentication_required");
          data = { refresh_token: refresh };
        }
        if (path === "auth/mfa/verify")
          data = {
            code: data.code,
            challenge_token: request.cookies.get(names.challenge)?.value ?? "",
          };
        if (path.startsWith("auth/mfa/totp/"))
          access = request.cookies.get(names.enrollment)?.value ?? access;
        body = JSON.stringify(data);
      }
    }
  } catch (e) {
    return error(
      e instanceof Error && e.message === "body_too_large" ? 413 : 400,
      "invalid_request",
    );
  }
  const publicPath = [
    "auth/login",
    "auth/refresh",
    "auth/mfa/verify",
    "auth/password/forgot",
    "auth/password/reset",
    "auth/invitations/accept",
  ].includes(path);
  if (!publicPath && !access) return error(401, "authentication_required");
  const query = new URL(request.url).searchParams;
  if (
    [...query.keys()].some((key) => !["offset", "limit"].includes(key)) ||
    [...query.values()].some((value) => !/^\d{1,8}$/.test(value))
  )
    return error(400, "invalid_pagination");
  let upstream: Response;
  try {
    upstream = await fetcher(
      `${upstreamOrigin()}/api/v1/${path}${query.size ? "?" + query.toString() : ""}`,
      {
        method: request.method,
        body: body as BodyInit | undefined,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: "application/json",
          ...(body !== undefined
            ? {
                "Content-Type":
                  path === "journey/config/logos"
                    ? "application/octet-stream"
                    : "application/json",
              }
            : {}),
          ...(access && !publicPath
            ? { Authorization: `Bearer ${access}` }
            : {}),
        },
      },
    );
  } catch {
    return error(503, "service_unavailable");
  }
  if (!upstream.ok) {
    let code = "request_failed";
    try {
      const data = await upstream.json();
      if (
        typeof data.detail === "string" &&
        /^[a-z][a-z0-9_]{0,100}$/.test(data.detail)
      )
        code = data.detail;
    } catch {
      /* No upstream body is logged. */
    }
    const response = error(
      upstream.status,
      code,
      upstream.headers.get("x-request-id"),
    );
    const retry = upstream.headers.get("retry-after");
    if (retry && /^\d{1,6}$/.test(retry))
      response.headers.set("Retry-After", retry);
    if (path === "auth/refresh" && upstream.status === 401) clear(response);
    return response;
  }
  if (upstream.status === 204) {
    const response = new NextResponse(null, {
      status: 204,
      headers: privateHeaders,
    });
    if (path === "auth/logout" || path === "auth/logout-all") clear(response);
    return response;
  }
  if (!upstream.headers.get("content-type")?.includes("application/json")) {
    const response = new NextResponse(upstream.body, {
      headers: {
        ...privateHeaders,
        "Content-Type":
          upstream.headers.get("content-type") ?? "application/octet-stream",
        "Content-Security-Policy":
          "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
    for (const header of ["content-disposition", "x-content-sha256"]) {
      const value = upstream.headers.get(header);
      if (value) response.headers.set(header, value);
    }
    return response;
  }
  let data: Record<string, unknown>;
  try {
    data = await upstream.json();
  } catch {
    return error(502, "invalid_response");
  }
  if (
    [
      "auth/login",
      "auth/mfa/verify",
      "auth/mfa/totp/confirm",
      "auth/refresh",
    ].includes(path)
  ) {
    const token = sessionTokens.safeParse(data);
    if (token.success) {
      const codes =
        path === "auth/mfa/totp/confirm"
          ? z.array(z.string()).safeParse(data.recovery_codes)
          : null;
      const response = NextResponse.json(
        {
          step: "authenticated",
          ...(codes?.success ? { recovery_codes: codes.data } : {}),
        },
        { headers: privateHeaders },
      );
      clear(response);
      response.cookies.set(names.access, token.data.access_token, {
        ...cookieOptions,
        maxAge: token.data.expires_in,
      });
      response.cookies.set(names.refresh, token.data.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 86400,
      });
      return response;
    }
    for (const [flag, key, step] of [
      ["mfa_required", "challenge_token", "verify"],
      ["mfa_enrollment_required", "enrollment_token", "enroll"],
    ] as const) {
      if (
        path === "auth/login" &&
        data[flag] === true &&
        typeof data[key] === "string" &&
        data[key].length >= 32 &&
        data[key].length <= 256
      ) {
        const response = NextResponse.json(
          { step },
          { headers: privateHeaders },
        );
        clear(response);
        response.cookies.set(
          step === "verify" ? names.challenge : names.enrollment,
          data[key],
          { ...cookieOptions, maxAge: step === "verify" ? 300 : 600 },
        );
        return response;
      }
    }
    return error(502, "invalid_response");
  }
  if (path === "auth/switch-organization") {
    const parsed = z
      .object({
        access_token: z.string().min(20).max(4096),
        organization_id: z.string().uuid(),
      })
      .safeParse(data);
    if (!parsed.success) return error(502, "invalid_response");
    const response = NextResponse.json(
      { organization_id: parsed.data.organization_id },
      { headers: privateHeaders },
    );
    response.cookies.set(names.access, parsed.data.access_token, {
      ...cookieOptions,
      maxAge: 900,
    });
    return response;
  }
  const response = NextResponse.json(data, {
    status: upstream.status,
    headers: privateHeaders,
  });
  if (
    [
      "auth/password/change",
      "auth/password/reset",
      "auth/mfa/disable",
    ].includes(path)
  )
    clear(response);
  return response;
}
