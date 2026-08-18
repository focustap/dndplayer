import type { Campaign, CampaignRole } from "../domain/types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { demoCampaign } from "../domain/demoData";

type MembershipRow = { role: CampaignRole; campaigns: { id: string; name: string; join_code: string; owner_id: string; updated_at: string } | { id: string; name: string; join_code: string; owner_id: string; updated_at: string }[] };
type MembershipCountRow = { campaign_id: string };
const campaignFrom = (row: MembershipRow, memberCount: number): Campaign => { const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns; return { id: campaign.id, name: campaign.name, joinCode: campaign.join_code, ownerId: campaign.owner_id, role: row.role, memberCount, updatedAt: campaign.updated_at }; };
const rethrowSupabaseError = (error: { message?: string }, fallback: string): never => {
  throw new Error(error.message || fallback);
};

export const campaignService = {
  async list(): Promise<Campaign[]> {
    if (!isSupabaseConfigured) return [demoCampaign];
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) rethrowSupabaseError(userError, "Unable to verify your session.");
    if (!user) throw new Error("Sign in is required to load campaigns.");
    const { data, error } = await supabase.from("campaign_members").select("role,campaigns!inner(id,name,join_code,owner_id,updated_at)").eq("user_id", user.id).order("joined_at", { ascending: false });
    if (error) rethrowSupabaseError(error, "Unable to load campaigns.");
    const memberships = (data ?? []) as unknown as MembershipRow[];
    const campaignIds = memberships.map((row) => (Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns).id);
    if (!campaignIds.length) return [];
    const { data: countRows, error: countError } = await supabase.from("campaign_members").select("campaign_id").in("campaign_id", campaignIds);
    if (countError) rethrowSupabaseError(countError, "Unable to load campaign member counts.");
    const counts = new Map<string, number>();
    for (const row of (countRows ?? []) as MembershipCountRow[]) counts.set(row.campaign_id, (counts.get(row.campaign_id) ?? 0) + 1);
    return memberships.map((row) => { const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns; return campaignFrom(row, counts.get(campaign.id) ?? 0); });
  },
  async create(name: string): Promise<Campaign> {
    if (!isSupabaseConfigured) return { ...demoCampaign, name };
    const { data, error } = await supabase.from("campaigns").insert({ name }).select("id,name,join_code,owner_id,updated_at").single();
    if (error) rethrowSupabaseError(error, "Unable to create the campaign.");
    if (!data) throw new Error("Campaign creation returned no campaign.");
    return { id: data.id, name: data.name, joinCode: data.join_code, ownerId: data.owner_id, role: "OWNER", memberCount: 1, updatedAt: data.updated_at };
  },
  async join(code: string): Promise<string> {
    if (!isSupabaseConfigured) return demoCampaign.id;
    const { data, error } = await supabase.rpc("join_campaign", { p_join_code: code.trim().toUpperCase() });
    if (error) rethrowSupabaseError(error, "Unable to join the campaign.");
    return data as string;
  },
};
