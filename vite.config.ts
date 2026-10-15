import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
// @ts-expect-error Local-only tooling is deliberately outside the app TS project.
import { chapterPreviewPlugin } from "./scripts/lornwatch/preview-server.mjs";

const githubPagesBase = "/dndplayer/";

function normalizeBase(value: string) {
  return `/${value.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
}

export default defineConfig(({ command, mode }) => ({
  base: normalizeBase(process.env.VITE_BASE_PATH ?? (command === "build" ? githubPagesBase : "/")),
  plugins: [react(), ...(command === "serve" && mode === "chapter-preview" ? [chapterPreviewPlugin()] : [])],
  define: command === "serve" && mode === "chapter-preview" ? {
    "import.meta.env.VITE_CHAPTER_PREVIEW": JSON.stringify("lornwatch"),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(""),
  } : {},
  server: { host: "127.0.0.1" },
  build: { target: "es2022" },
}));
