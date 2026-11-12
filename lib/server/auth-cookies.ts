export function authCookieNames(
  production = process.env.NODE_ENV === "production",
) {
  const prefix = production ? "__Host-ccu-" : "ccu-";
  return {
    access: prefix + "access",
    refresh: prefix + "refresh",
    enrollment: prefix + "enrollment",
    challenge: prefix + "challenge",
  };
}
