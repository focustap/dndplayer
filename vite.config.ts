import { sites } from "@openai/sites-vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const sitesSpaWorker = (): Plugin => ({
  name: "wayfinder-sites-spa-worker",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "server/index.js",
      source: `export default { async fetch(request, env) {
  const response = await env.ASSETS.fetch(request);
  if (response.status !== 404 || request.method !== "GET") return response;
  const url = new URL(request.url);
  url.pathname = "/index.html";
  return env.ASSETS.fetch(new Request(url, request));
} };\n`,
    });
  },
});

export default defineConfig({
  plugins: [react(), sites(), sitesSpaWorker()],
  server: { host: "127.0.0.1" },
  build: { target: "es2022" },
});
