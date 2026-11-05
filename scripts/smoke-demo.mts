import assert from "node:assert/strict";
import { demoAccounts } from "../lib/demo/accounts";
const base = process.env.CCU360_DEMO_URL ?? "http://127.0.0.1:3106";
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname),
  "Run synthetic mutation checks on a local preview only.",
);
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
) {
  return fetch(base + "/api/demo/" + path, {
    method,
    headers: {
      Origin: new URL(base).origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
}
async function login(id: string) {
  const u = demoAccounts.find((u) => u.id === id)!;
  const response = await request("session", "POST", {
    email: u.email,
    password: u.password,
  });
  assert.equal(response.status, 200);
  const header = response.headers.get("set-cookie")!;
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=strict/i);
  return { cookie: header.split(";")[0], session: await response.json() };
}
assert.equal((await request("directory")).status, 401);
const rejectedOrigin = await fetch(base + "/api/demo/session", {
  method: "POST",
  headers: {
    Origin: "https://untrusted.example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email: "test@example.test", password: "wrong" }),
});
assert.equal(rejectedOrigin.status, 403);
const ahs = await login("usr-ahs"),
  admin = await login("usr-evergreen-admin"),
  doctor = await login("usr-evergreen-doctor"),
  nurse = await login("usr-evergreen-nurse"),
  cedar = await login("usr-cedar-doctor");
assert.equal(
  (await request("workspace", "GET", undefined, ahs.cookie)).status,
  403,
);
assert.equal(
  (await request("workspace", "GET", undefined, admin.cookie)).status,
  403,
);
const directory = await (
  await request("directory", "GET", undefined, admin.cookie)
).json();
assert.equal(directory.facilities.length, 1);
assert.ok(
  directory.employees.every(
    (u: { facilityId: string }) => u.facilityId === "fac-evergreen",
  ),
);
assert.ok(!JSON.stringify(directory).includes("password"));
assert.ok(!JSON.stringify(directory).includes("digest"));
const a = await (
    await request("workspace", "GET", undefined, doctor.cookie)
  ).json(),
  b = await (await request("workspace", "GET", undefined, cedar.cookie)).json();
assert.notEqual(a.facilityId, b.facilityId);
assert.ok(
  !b.patients.some((p: { id: string }) =>
    a.patients.some((q: { id: string }) => p.id === q.id),
  ),
);
assert.equal(
  (
    await request(
      "transitions",
      "POST",
      { id: "act-1", next: "in_progress", version: 1 },
      cedar.cookie,
    )
  ).status,
  404,
);
assert.equal(
  (
    await request(
      "transitions",
      "POST",
      { id: "act-1", next: "in_progress", version: 1 },
      nurse.cookie,
    )
  ).status,
  403,
);
assert.equal(
  (
    await request(
      "employees",
      "PATCH",
      { id: "usr-cedar-doctor", status: "Suspended" },
      admin.cookie,
    )
  ).status,
  404,
);
const restrictedPage = await fetch(base + "/dashboard/facilities", {
  headers: { Cookie: doctor.cookie },
});
assert.ok(
  (await restrictedPage.text()).includes("This area belongs to another role."),
);
const platformPage = await fetch(base + "/dashboard", {
  headers: { Cookie: ahs.cookie },
});
assert.ok((await platformPage.text()).includes("Comphortine"));
assert.ok(
  (await platformPage.headers.get("cache-control"))?.includes("no-store") ||
    platformPage.headers.get("cache-control")?.includes("private"),
);
const suffix = Date.now().toString(36),
  facilityResponse = await request(
    "facilities",
    "POST",
    {
      name: `Smoke Facility ${suffix}`,
      city: "Demo City",
      type: "Hospital",
      contactEmail: `office-${suffix}@facility.ccu360.test`,
      adminName: "Smoke Facility Owner",
      adminEmail: `admin-${suffix}@facility.ccu360.test`,
      icuBeds: 2,
      hduBeds: 1,
    },
    ahs.cookie,
  );
assert.equal(facilityResponse.status, 200);
const provision = await facilityResponse.json();
const ownerResponse = await request("session", "POST", {
  email: provision.user.email,
  password: provision.temporaryPassword,
});
assert.equal(ownerResponse.status, 200);
const ownerCookie = ownerResponse.headers.get("set-cookie")!.split(";")[0];
const employeeResponse = await request(
  "employees",
  "POST",
  {
    name: "Smoke Nurse",
    email: `nurse-${suffix}@facility.ccu360.test`,
    role: "nurse",
    unit: "ICU",
    facilityId: "fac-cedar",
  },
  ownerCookie,
);
assert.equal(employeeResponse.status, 200);
const employee = await employeeResponse.json();
assert.equal(employee.user.facilityId, provision.facility.id);
assert.equal(
  (
    await request("session", "POST", {
      email: employee.user.email,
      password: employee.temporaryPassword,
    })
  ).status,
  403,
);
assert.equal(
  (
    await request(
      "facilities",
      "PATCH",
      { id: provision.facility.id, status: "Active" },
      ahs.cookie,
    )
  ).status,
  200,
);
const staffResponse = await request("session", "POST", {
  email: employee.user.email,
  password: employee.temporaryPassword,
});
assert.equal(staffResponse.status, 200);
const staffCookie = staffResponse.headers.get("set-cookie")!.split(";")[0];
assert.equal(
  (
    await request(
      "employees",
      "PATCH",
      { id: employee.user.id, status: "Suspended" },
      ownerCookie,
    )
  ).status,
  200,
);
assert.equal(
  (await request("workspace", "GET", undefined, staffCookie)).status,
  401,
);
assert.equal(
  (await request("session", "DELETE", undefined, doctor.cookie)).status,
  200,
);
assert.equal(
  (await request("workspace", "GET", undefined, doctor.cookie)).status,
  401,
);
console.log(
  "PASS demo HTTP: authenticated role pages, HttpOnly sessions, origin checks, tenant isolation, onboarding, employee provisioning, activation, suspension and logout.",
);
