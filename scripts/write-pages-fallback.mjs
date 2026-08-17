import { writeFile } from "node:fs/promises";

function normalizeBase(value) {
  return `/${value.replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
}

const base = normalizeBase(process.env.VITE_BASE_PATH ?? "/dndplayer/");
const pathSegmentsToKeep = base.split("/").filter(Boolean).length;
const fallback = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wayfinder</title>
    <script>
      (function (location) {
        var keep = ${pathSegmentsToKeep};
        var basePath = location.pathname.split("/").slice(0, 1 + keep).join("/");
        var route = location.pathname.slice(1).split("/").slice(keep).join("/").replace(/&/g, "~and~");
        var query = location.search ? "&" + location.search.slice(1).replace(/&/g, "~and~") : "";
        location.replace(location.origin + basePath + "/?/" + route + query + location.hash);
      })(window.location);
    </script>
  </head>
  <body></body>
</html>
`;

await writeFile(new URL("../dist/404.html", import.meta.url), fallback);
