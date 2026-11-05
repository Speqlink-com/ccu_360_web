import { cp, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const buildDir = process.env.CCU360_BUILD_DIR ?? ".next";
const standalone = resolve(root, buildDir, "standalone");
try {
  await access(join(standalone, "server.js"));
} catch {
  console.error("Production build missing. Run npm run build first.");
  process.exit(1);
}
// Next standalone omits public/static assets; copy the build-matched assets for local starts.
await cp(join(root, "public"), join(standalone, "public"), { recursive: true });
await cp(join(root, buildDir, "static"), join(standalone, buildDir, "static"), {
  recursive: true,
});
const child = spawn(process.execPath, [join(standalone, "server.js")], {
  cwd: standalone,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: process.env.HOSTNAME || "127.0.0.1",
    PORT: process.env.PORT || "3000",
  },
});
let stopping = false;
let forceStop;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    child.kill(signal);
    // Bound graceful shutdown so containers and CI cannot hang on lingering sockets.
    forceStop = setTimeout(() => child.kill("SIGKILL"), 5000);
    forceStop.unref();
  });
}
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  clearTimeout(forceStop);
  process.exitCode = stopping ? 0 : (code ?? 1);
});
