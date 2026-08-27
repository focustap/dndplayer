import { supabase } from "../lib/supabase";

export interface CampaignAudioTrack {
  id: string;
  campaignId: string;
  name: string;
  storagePath: string;
  url: string;
  createdAt: string;
}

interface CampaignChannelPlayback {
  campaignId: string;
  trackId: string | null;
  playing: boolean;
  loop: boolean;
  positionMs: number;
  startedAt: string | null;
  revision: number;
  updatedAt: string;
}

export interface CampaignAudioPlayback extends CampaignChannelPlayback {
  nextTrackId: string | null;
  nextLoop: boolean;
}

export type CampaignAmbiencePlayback = CampaignChannelPlayback;

type Row = Record<string, unknown>;

const asTrack = (row: Row, url = ""): CampaignAudioTrack => ({
  id: String(row.id),
  campaignId: String(row.campaign_id),
  name: String(row.name),
  storagePath: String(row.storage_path),
  url,
  createdAt: String(row.created_at),
});

const asBasePlayback = (row: Row): CampaignChannelPlayback => ({
  campaignId: String(row.campaign_id),
  trackId: row.track_id ? String(row.track_id) : null,
  playing: Boolean(row.playing),
  loop: Boolean(row.loop),
  positionMs: Number(row.position_ms ?? 0),
  startedAt: row.started_at ? String(row.started_at) : null,
  revision: Number(row.revision ?? 0),
  updatedAt: String(row.updated_at ?? ""),
});

const asPlayback = (row: Row): CampaignAudioPlayback => ({
  ...asBasePlayback(row),
  nextTrackId: row.next_track_id ? String(row.next_track_id) : null,
  nextLoop: Boolean(row.next_loop ?? true),
});

const asAmbience = (row: Row): CampaignAmbiencePlayback => asBasePlayback(row);

const fail = (error: { message?: string } | null, fallback: string) => {
  if (error) throw new Error(error.message || fallback);
};

const signTrack = async (row: Row) => {
  const path = String(row.storage_path);
  const { data, error } = await supabase.storage
    .from("campaign-audio")
    .createSignedUrl(path, 60 * 60 * 24);
  fail(error, "Could not open campaign audio.");
  return asTrack(row, data?.signedUrl ?? "");
};

export const campaignAudioService = {
  async load(campaignId: string) {
    const [
      { data: rows, error: trackError },
      { data: state, error: stateError },
      { data: ambience, error: ambienceError },
    ] = await Promise.all([
      supabase
        .from("campaign_audio_tracks")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("name"),
      supabase
        .from("campaign_audio_state")
        .select("*")
        .eq("campaign_id", campaignId)
        .maybeSingle(),
      supabase
        .from("campaign_ambience_state")
        .select("*")
        .eq("campaign_id", campaignId)
        .maybeSingle(),
    ]);

    fail(trackError, "Could not load campaign audio.");
    fail(stateError, "Could not load current music state.");
    fail(ambienceError, "Could not load current ambience state.");

    const tracks = await Promise.all(((rows ?? []) as Row[]).map(signTrack));
    return {
      tracks,
      playback: state ? asPlayback(state as Row) : null,
      ambience: ambience ? asAmbience(ambience as Row) : null,
    };
  },

  async uploadTrack(campaignId: string, file: File) {
    if (!file.name.toLowerCase().endsWith(".mp3")) {
      throw new Error("Wayfinder audio uploads must be MP3 files.");
    }
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("MP3 files must be 50 MB or smaller.");
    }

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-");
    const path = `${campaignId}/${id}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("campaign-audio")
      .upload(path, file, { contentType: "audio/mpeg" });
    fail(uploadError, "Audio upload failed.");

    const name = file.name.replace(/\.[^.]+$/, "").trim() || "Untitled track";
    const { data, error } = await supabase
      .from("campaign_audio_tracks")
      .insert({ id, campaign_id: campaignId, name, storage_path: path })
      .select("*")
      .single();

    if (error || !data) {
      void supabase.storage.from("campaign-audio").remove([path]);
      fail(error, "Could not save uploaded audio.");
      throw new Error("Could not save uploaded audio.");
    }

    return signTrack(data as Row);
  },

  async deleteTrack(track: CampaignAudioTrack) {
    const { error } = await supabase
      .from("campaign_audio_tracks")
      .delete()
      .eq("id", track.id);
    fail(error, "Could not delete audio track.");

    const { error: assetError } = await supabase.storage
      .from("campaign-audio")
      .remove([track.storagePath]);
    fail(assetError, "Track was removed, but its uploaded MP3 could not be deleted.");
  },

  async control(
    campaignId: string,
    action: "PLAY" | "PAUSE" | "STOP" | "LOOP",
    trackId?: string | null,
    loop?: boolean,
  ) {
    const { data, error } = await supabase.rpc("control_campaign_audio", {
      p_campaign_id: campaignId,
      p_action: action,
      p_track_id: trackId ?? null,
      p_loop: loop ?? null,
    });
    fail(error, "Could not update campaign music.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Music control returned no state.");
    return asPlayback(row as Row);
  },

  async queueMusic(
    campaignId: string,
    nextTrackId: string | null,
    nextLoop = true,
  ) {
    const { data, error } = await supabase.rpc("queue_campaign_audio", {
      p_campaign_id: campaignId,
      p_next_track_id: nextTrackId,
      p_next_loop: nextLoop,
    });
    fail(error, "Could not update the music queue.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Music queue returned no state.");
    return asPlayback(row as Row);
  },

  async advanceMusic(campaignId: string) {
    const { data, error } = await supabase.rpc("advance_campaign_audio", {
      p_campaign_id: campaignId,
    });
    fail(error, "Could not advance queued music.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Music advance returned no state.");
    return asPlayback(row as Row);
  },

  async controlAmbience(
    campaignId: string,
    action: "PLAY" | "PAUSE" | "STOP" | "LOOP",
    trackId?: string | null,
    loop?: boolean,
  ) {
    const { data, error } = await supabase.rpc("control_campaign_ambience", {
      p_campaign_id: campaignId,
      p_action: action,
      p_track_id: trackId ?? null,
      p_loop: loop ?? null,
    });
    fail(error, "Could not update campaign ambience.");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("Ambience control returned no state.");
    return asAmbience(row as Row);
  },
};
