import { spawn } from "node:child_process";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // En CI/Render las variables ya vienen del entorno.
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [];

function run(label, args) {
  const child = spawn(npm, args, { stdio: "inherit", shell: true });
  children.push(child);
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${label}] terminó con código ${code}`);
    }
  });
}

process.on("SIGINT", () => {
  for (const child of children) child.kill();
  process.exit(0);
});

run("server", ["run", "dev", "-w", "@lolgames/server"]);
run("web", ["run", "dev", "-w", "@lolgames/web"]);
