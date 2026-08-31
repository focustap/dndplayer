import { supabase } from "../lib/supabase";

const rawBaseUrl = String(import.meta.env.VITE_ASSET_API_URL ?? "https://wayfinder-assets.wayfinder-assets.workers.dev").trim();
export const isR2AssetServiceConfigured = rawBaseUrl.length > 0;
const assetApiBaseUrl = rawBaseUrl.replace(/\/+$/, "");

const authHeaders = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in is required to access Wayfinder assets.");
  return { authorization: `Bearer ${token}` };
};

const workerError = async (response: Response, fallback: string) => {
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string };
    if (body?.error) message = body.error;
  } catch {
    // Keep fallback.
  }
  return new Error(message);
};

export interface R2AssetReference {
  path: string;
  url: string;
  expiresAt: number;
}

export const r2AssetService = {
  async sign(campaignId: string, path: string): Promise<R2AssetReference | null> {
    if (!isR2AssetServiceConfigured) return null;
    const response = await fetch(`${assetApiBaseUrl}/v1/sign`, {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "content-type": "application/json",
      },
      body: JSON.stringify({ campaignId, path }),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw await workerError(response, "Could not open R2 asset.");
    const data = (await response.json()) as { url: string; expiresAt: number };
    return { path, url: data.url, expiresAt: data.expiresAt };
  },

  async upload(campaignId: string, category: string, file: File): Promise<R2AssetReference> {
    if (!isR2AssetServiceConfigured) throw new Error("R2 asset service is not configured.");
    const params = new URLSearchParams({ campaignId, category });
    const response = await fetch(`${assetApiBaseUrl}/v1/upload?${params}`, {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "content-type": file.type || "application/octet-stream",
        "x-file-name": file.name,
      },
      body: file,
    });
    if (!response.ok) throw await workerError(response, "R2 upload failed.");
    return (await response.json()) as R2AssetReference;
  },

  async importLegacy(
    campaignId: string,
    path: string,
    sourceUrl: string,
  ): Promise<R2AssetReference> {
    if (!isR2AssetServiceConfigured) throw new Error("R2 asset service is not configured.");
    const response = await fetch(`${assetApiBaseUrl}/v1/import`, {
      method: "POST",
      headers: {
        ...(await authHeaders()),
        "content-type": "application/json",
      },
      body: JSON.stringify({ campaignId, path, sourceUrl }),
    });
    if (!response.ok) throw await workerError(response, "Could not migrate asset to R2.");
    return (await response.json()) as R2AssetReference;
  },

  async remove(campaignId: string, path: string): Promise<void> {
    if (!isR2AssetServiceConfigured) return;
    const response = await fetch(`${assetApiBaseUrl}/v1/delete`, {
      method: "DELETE",
      headers: {
        ...(await authHeaders()),
        "content-type": "application/json",
      },
      body: JSON.stringify({ campaignId, path }),
    });
    if (!response.ok && response.status !== 404) {
      throw await workerError(response, "Could not delete R2 asset.");
    }
  },
};
