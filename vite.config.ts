import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const githubPagesBase = "/dndplayer/";

function normalizeBase(value: string) {
  return `/${value.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
}

export default defineConfig(({ command }) => ({
  base: normalizeBase(process.env.VITE_BASE_PATH ?? (command === "build" ? githubPagesBase : "/")),
  plugins: [react()],
  server: { host: "127.0.0.1" },
  build: { target: "es2022" },
}));
