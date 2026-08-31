interface Env {
  ASSETS: R2Bucket;
  ASSET_SIGNING_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  ALLOWED_ORIGINS?: string;
}

type CampaignRole = "OWNER" | "DM" | "PLAYER" | "SPECTATOR";

const SIGNED_URL_TTL_SECONDS = 12 * 60 * 60;
const textEncoder = new TextEncoder();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const allowedOrigins = (env: Env) =>
  (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const corsHeaders = (request: Request, env: Env) => {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins(env);
  const headers = new Headers({
    "access-control-allow-headers": "authorization,content-type,x-file-name",
    "access-control-allow-methods": "GET,HEAD,POST,DELETE,OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin",
  });
  if (origin && allowed.includes(origin)) headers.set("access-control-allow-origin", origin);
  return headers;
};

const withCors = (request: Request, env: Env, response: Response) => {
  const headers = new Headers(response.headers);
  corsHeaders(request, env).forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const safePath = (path: unknown): path is string => {
  if (typeof path !== "string" || !path || path.length > 1024) return false;
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  return path.split("/").every(Boolean);
};

const isDm = (role: CampaignRole) => role === "OWNER" || role === "DM";

const authHeaders = (env: Env, accessToken: string) => ({
  apikey: env.SUPABASE_PUBLISHABLE_KEY,
  authorization: `Bearer ${accessToken}`,
});

const bearerToken = (request: Request) => {
  const raw = request.headers.get("authorization") ?? "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : "";
};

async function requireMembership(
  request: Request,
  env: Env,
  campaignId: string,
): Promise<{ userId: string; role: CampaignRole; accessToken: string } | Response> {
  const accessToken = bearerToken(request);
  if (!accessToken) return json({ error: "Authentication required." }, 401);

  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: authHeaders(env, accessToken),
  });
  if (!userResponse.ok) return json({ error: "Invalid or expired login." }, 401);
  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) return json({ error: "Invalid login." }, 401);

  const params = new URLSearchParams({
    select: "role",
    campaign_id: `eq.${campaignId}`,
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  const membershipResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/campaign_members?${params}`,
    { headers: authHeaders(env, accessToken) },
  );
  if (!membershipResponse.ok) return json({ error: "Could not verify campaign access." }, 403);
  const rows = (await membershipResponse.json()) as Array<{ role?: CampaignRole }>;
  const role = rows[0]?.role;
  if (!role) return json({ error: "You are not a member of this campaign." }, 403);
  return { userId: user.id, role, accessToken };
}

async function discoveredAssetAllowed(
  env: Env,
  accessToken: string,
  campaignId: string,
  path: string,
) {
  const params = new URLSearchParams({
    select: "id",
    campaign_id: `eq.${campaignId}`,
    storage_path: `eq.${path}`,
    discovered_at: "not.is.null",
    limit: "1",
  });
  const response = await fetch(
    `${env.SUPABASE_URL}/rest/v1/scene_discoverables?${params}`,
    { headers: authHeaders(env, accessToken) },
  );
  if (!response.ok) return false;
  const rows = (await response.json()) as unknown[];
  return rows.length > 0;
}

async function foreignMonsterAssetAllowed(
  env: Env,
  accessToken: string,
  campaignId: string,
  path: string,
) {
  const templateParams = new URLSearchParams({
    select: "id",
    image_path: `eq.${path}`,
    limit: "1",
  });
  const templateResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/monster_templates?${templateParams}`,
    { headers: authHeaders(env, accessToken) },
  );
  if (!templateResponse.ok) return false;
  const templates = (await templateResponse.json()) as Array<{ id?: string }>;
  const templateId = templates[0]?.id;
  if (!templateId) return false;

  const instanceParams = new URLSearchParams({
    select: "id",
    campaign_id: `eq.${campaignId}`,
    template_id: `eq.${templateId}`,
    visible: "eq.true",
    limit: "1",
  });
  const instanceResponse = await fetch(
    `${env.SUPABASE_URL}/rest/v1/monster_instances?${instanceParams}`,
    { headers: authHeaders(env, accessToken) },
  );
  if (!instanceResponse.ok) return false;
  const instances = (await instanceResponse.json()) as unknown[];
  return instances.length > 0;
}

async function canReadPath(
  env: Env,
  member: { role: CampaignRole; accessToken: string },
  campaignId: string,
  path: string,
) {
  if (isDm(member.role)) return true;

  const ownPrefix = `${campaignId}/`;
  if (path.startsWith(ownPrefix)) {
    const category = path.slice(ownPrefix.length).split("/")[0];
    if (category === "discoverables") {
      return discoveredAssetAllowed(env, member.accessToken, campaignId, path);
    }
    return true;
  }

  // Monster templates are a shared global library and can legitimately have
  // a storage prefix from the campaign where they were first imported.
  return foreignMonsterAssetAllowed(env, member.accessToken, campaignId, path);
}

const canWriteCategory = (role: CampaignRole, category: string) =>
  isDm(role) || (role === "PLAYER" && category === "characters");

const safeCategory = (value: unknown) =>
  typeof value === "string" && /^[a-z0-9_-]{1,40}$/i.test(value);

const safeFilename = (value: string) => {
  const cleaned = value.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-");
  return cleaned.slice(-160) || "asset";
};

const base64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

async function signingKey(env: Env) {
  if (!env.ASSET_SIGNING_SECRET) throw new Error("ASSET_SIGNING_SECRET is not configured.");
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(env.ASSET_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const signedPayload = (campaignId: string, path: string, expires: number) =>
  `${campaignId}\n${path}\n${expires}`;

async function signature(env: Env, campaignId: string, path: string, expires: number) {
  const key = await signingKey(env);
  return base64Url(
    await crypto.subtle.sign("HMAC", key, textEncoder.encode(signedPayload(campaignId, path, expires))),
  );
}

async function verifySignature(
  env: Env,
  campaignId: string,
  path: string,
  expires: number,
  candidate: string,
) {
  if (!candidate || expires <= Math.floor(Date.now() / 1000)) return false;
  const normalized = candidate.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await signingKey(env);
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    textEncoder.encode(signedPayload(campaignId, path, expires)),
  );
}

async function makeSignedUrl(
  request: Request,
  env: Env,
  campaignId: string,
  path: string,
) {
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  const sig = await signature(env, campaignId, path, expires);
  const url = new URL(request.url);
  url.pathname = "/v1/object";
  url.search = new URLSearchParams({
    campaignId,
    path,
    expires: String(expires),
    sig,
  }).toString();
  return { url: url.toString(), expiresAt: expires * 1000 };
}

async function handleSign(request: Request, env: Env) {
  const body = (await request.json().catch(() => null)) as
    | { campaignId?: string; path?: string }
    | null;
  const campaignId = body?.campaignId?.trim() ?? "";
  const path = body?.path;
  if (!campaignId || !safePath(path)) return json({ error: "Invalid asset request." }, 400);

  const member = await requireMembership(request, env, campaignId);
  if (member instanceof Response) return member;
  if (!(await canReadPath(env, member, campaignId, path))) {
    return json({ error: "Asset access denied." }, 403);
  }

  const object = await env.ASSETS.head(path);
  if (!object) return json({ error: "Asset is not in R2 yet." }, 404);
  return json(await makeSignedUrl(request, env, campaignId, path));
}

async function handleUpload(request: Request, env: Env) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId")?.trim() ?? "";
  const category = url.searchParams.get("category")?.trim() ?? "";
  if (!campaignId || !safeCategory(category)) return json({ error: "Invalid upload target." }, 400);

  const member = await requireMembership(request, env, campaignId);
  if (member instanceof Response) return member;
  if (!canWriteCategory(member.role, category)) return json({ error: "Upload denied." }, 403);

  const filename = safeFilename(request.headers.get("x-file-name") ?? "asset");
  const path = `${campaignId}/${category}/${crypto.randomUUID()}-${filename}`;
  const contentType = request.headers.get("content-type") || "application/octet-stream";

  await env.ASSETS.put(path, request.body, {
    httpMetadata: {
      contentType,
      cacheControl: "private, max-age=43200",
    },
  });

  return json({ path, ...(await makeSignedUrl(request, env, campaignId, path)) }, 201);
}

async function handleDelete(request: Request, env: Env) {
  const body = (await request.json().catch(() => null)) as
    | { campaignId?: string; path?: string }
    | null;
  const campaignId = body?.campaignId?.trim() ?? "";
  const path = body?.path;
  if (!campaignId || !safePath(path)) return json({ error: "Invalid delete request." }, 400);

  const member = await requireMembership(request, env, campaignId);
  if (member instanceof Response) return member;
  const category = path.startsWith(`${campaignId}/`)
    ? path.slice(campaignId.length + 1).split("/")[0]
    : "";
  if (!canWriteCategory(member.role, category)) return json({ error: "Delete denied." }, 403);

  await env.ASSETS.delete(path);
  return new Response(null, { status: 204 });
}

async function handleImport(request: Request, env: Env) {
  const body = (await request.json().catch(() => null)) as
    | { campaignId?: string; path?: string; sourceUrl?: string }
    | null;
  const campaignId = body?.campaignId?.trim() ?? "";
  const path = body?.path;
  const sourceUrl = body?.sourceUrl;
  if (!campaignId || !safePath(path) || !sourceUrl) return json({ error: "Invalid import request." }, 400);

  const member = await requireMembership(request, env, campaignId);
  if (member instanceof Response) return member;
  if (!isDm(member.role)) return json({ error: "Only a DM can migrate assets." }, 403);

  const source = new URL(sourceUrl);
  const supabase = new URL(env.SUPABASE_URL);
  if (
    source.protocol !== "https:" ||
    source.hostname !== supabase.hostname ||
    !source.pathname.startsWith("/storage/v1/object/")
  ) {
    return json({ error: "Import source must be this Wayfinder Supabase project." }, 400);
  }

  const existing = await env.ASSETS.head(path);
  if (!existing) {
    const response = await fetch(source);
    if (!response.ok || !response.body) {
      return json({ error: `Could not read legacy asset (${response.status}).` }, 502);
    }
    await env.ASSETS.put(path, response.body, {
      httpMetadata: {
        contentType: response.headers.get("content-type") || "application/octet-stream",
        cacheControl: "private, max-age=43200",
      },
    });
  }

  return json({ path, ...(await makeSignedUrl(request, env, campaignId, path)) }, 201);
}

async function handleObject(request: Request, env: Env) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId") ?? "";
  const path = url.searchParams.get("path") ?? "";
  const expires = Number(url.searchParams.get("expires"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!campaignId || !safePath(path) || !Number.isFinite(expires)) {
    return json({ error: "Invalid signed URL." }, 400);
  }
  if (!(await verifySignature(env, campaignId, path, expires, sig))) {
    return json({ error: "Signed URL expired or invalid." }, 403);
  }

  const options = request.headers.has("range") ? { range: request.headers } : undefined;
  const object = await env.ASSETS.get(path, options);
  if (!object) return json({ error: "Asset not found." }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  const maxAge = Math.max(0, Math.min(SIGNED_URL_TTL_SECONDS, expires - Math.floor(Date.now() / 1000)));
  headers.set("cache-control", `private, max-age=${maxAge}`);

  let status = 200;
  if (object.range && "offset" in object.range && "length" in object.range) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    headers.set("content-length", String(object.range.length));
    status = 206;
  } else {
    headers.set("content-length", String(object.size));
  }

  if (request.method === "HEAD") return new Response(null, { status, headers });
  return new Response(object.body, { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return withCors(request, env, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    let response: Response;
    try {
      if (url.pathname === "/health" && request.method === "GET") {
        response = json({ ok: true, service: "wayfinder-assets" });
      } else if (url.pathname === "/v1/sign" && request.method === "POST") {
        response = await handleSign(request, env);
      } else if (url.pathname === "/v1/upload" && request.method === "POST") {
        response = await handleUpload(request, env);
      } else if (url.pathname === "/v1/delete" && request.method === "DELETE") {
        response = await handleDelete(request, env);
      } else if (url.pathname === "/v1/import" && request.method === "POST") {
        response = await handleImport(request, env);
      } else if (url.pathname === "/v1/object" && (request.method === "GET" || request.method === "HEAD")) {
        response = await handleObject(request, env);
      } else {
        response = json({ error: "Not found." }, 404);
      }
    } catch (error) {
      console.error(error);
      response = json({ error: "Asset service error." }, 500);
    }
    return withCors(request, env, response);
  },
};
