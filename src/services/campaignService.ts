import type { Campaign, CampaignRole } from "../domain/types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { demoCampaign } from "../domain/demoData";

type MembershipRow = { role: CampaignRole; campaigns: { id: string; name: string; join_code: string; owner_id: string; updated_at: string } | { id: string; name: string; join_code: string; owner_id: string; updated_at: string }[] };
const campaignFrom = (row: MembershipRow): Campaign => { const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns; return { id: campaign.id, name: campaign.name, joinCode: campaign.join_code, ownerId: campaign.owner_id, role: row.role, memberCount: 0, updatedAt: campaign.updated_at }; };
const rethrowSupabaseError = (error: { message?: string }, fallback: string): never => {
  throw new Error(error.message || fallback);
};

export const campaignService = {
  async list(): Promise<Campaign[]> {
    if (!isSupabaseConfigured) return [demoCampaign];
    const { data, error } = await supabase.from("campaign_members").select("role,campaigns!inner(id,name,join_code,owner_id,updated_at)").order("joined_at", { ascending: false });
    if (error) rethrowSupabaseError(error, "Unable to load campaigns.");
    return (data as unknown as MembershipRow[]).map(campaignFrom);
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
