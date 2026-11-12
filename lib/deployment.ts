/** Public routing configuration only. Never put backend credentials in web env. */
export function apiProxyOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const origin = value.trim().replace(/\/$/, "");
  if (origin !== "https://api.ccu360.health")
    throw new Error("API_PROXY_TARGET must be https://api.ccu360.health");
  return origin;
}

export function verifyProductionMode(
  vercelEnvironment: string | undefined,
  demoMode: string | undefined,
): void {
  if (vercelEnvironment === "production" && demoMode === "true")
    throw new Error("CCU360 production deployments must disable demo mode");
}
