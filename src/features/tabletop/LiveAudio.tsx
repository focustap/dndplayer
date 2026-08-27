import {
  Music,
  Pause,
  Play,
  Square,
  Trash2,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTabletop } from "../../contexts/TabletopContext";
import { isDmRole } from "../../domain/types";
import { supabase } from "../../lib/supabase";
import {
  campaignAudioService,
  type CampaignAudioPlayback,
  type CampaignAudioTrack,
} from "../../services/audioService";
import { serverNowMs } from "../../services/tabletopService";
import "./liveAudio.css";

interface LocalVolumes {
  master: number;
  music: number;
  sfx: number;
}

const STORAGE_KEY = "wayfinder.audio.v1";
const DEFAULT_VOLUMES: LocalVolumes = { master: 0.8, music: 0.7, sfx: 0.8 };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

const loadVolumes = (): LocalVolumes => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<LocalVolumes>;
    return {
      master: clamp(Number(saved.master ?? DEFAULT_VOLUMES.master)),
      music: clamp(Number(saved.music ?? DEFAULT_VOLUMES.music)),
      sfx: clamp(Number(saved.sfx ?? DEFAULT_VOLUMES.sfx)),
    };
  } catch {
    return DEFAULT_VOLUMES;
  }
};

export function LiveAudio() {
  const { state } = useTabletop();
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<CampaignAudioTrack[]>([]);
  const [playback, setPlayback] = useState<CampaignAudioPlayback | null>(null);
  const [volumes, setVolumes] = useState<LocalVolumes>(loadVolumes);
  const [busy, setBusy] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const audio = useRef<HTMLAudioElement>(null);

  const campaignId = state?.campaign.id ?? "";
  const dm = Boolean(state && isDmRole(state.role));
  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === playback?.trackId) ?? null,
    [tracks, playback?.trackId],
  );

  const refresh = useCallback(async () => {
    if (!campaignId) return;
    try {
      const next = await campaignAudioService.load(campaignId);
      setTracks(next.tracks);
      setPlayback(next.playback);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load audio.");
    }
  }, [campaignId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!campaignId) return;
    const channel = supabase
      .channel(`campaign-audio-ui:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_audio_tracks",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_audio_state",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, refresh]);

  useEffect(() => {
    if (!audio.current) return;
    audio.current.volume = clamp(volumes.master * volumes.music);
  }, [volumes.master, volumes.music]);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;

    if (!playback?.trackId || !currentTrack?.url) {
      element.pause();
      element.removeAttribute("src");
      element.dataset.trackId = "";
      element.load();
      return;
    }

    if (element.dataset.trackId !== currentTrack.id) {
      element.src = currentTrack.url;
      element.dataset.trackId = currentTrack.id;
      element.load();
    }

    element.loop = playback.loop;

    const applyState = () => {
      let desiredSeconds = playback.positionMs / 1000;
      if (playback.playing && playback.startedAt) {
        desiredSeconds += Math.max(
          0,
          (serverNowMs() - Date.parse(playback.startedAt)) / 1000,
        );
      }

      if (Number.isFinite(element.duration) && element.duration > 0) {
        desiredSeconds = playback.loop
          ? desiredSeconds % element.duration
          : Math.min(desiredSeconds, Math.max(0, element.duration - 0.05));
      }

      if (
        Number.isFinite(desiredSeconds) &&
        Math.abs(element.currentTime - desiredSeconds) > 1
      ) {
        try {
          element.currentTime = Math.max(0, desiredSeconds);
        } catch {
          // Metadata may still be settling; loadedmetadata will retry.
        }
      }

      if (playback.playing) {
        void element
          .play()
          .then(() => setNeedsUnlock(false))
          .catch(() => setNeedsUnlock(true));
      } else {
        element.pause();
      }
    };

    if (element.readyState >= 1) applyState();
    else element.addEventListener("loadedmetadata", applyState, { once: true });

    return () => {
      element.removeEventListener("loadedmetadata", applyState);
    };
  }, [currentTrack, playback]);

  useEffect(() => {
    const element = audio.current;
    if (!element || !dm) return;
    const ended = () => {
      if (playback?.playing && !playback.loop && campaignId) {
        void campaignAudioService.control(campaignId, "STOP");
      }
    };
    element.addEventListener("ended", ended);
    return () => element.removeEventListener("ended", ended);
  }, [campaignId, dm, playback?.loop, playback?.playing]);

  const setVolume = (key: keyof LocalVolumes, value: number) => {
    setVolumes((current) => {
      const next = { ...current, [key]: clamp(value) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const run = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Audio action failed.");
    } finally {
      setBusy(false);
    }
  };

  const togglePanel = () => {
    setOpen((value) => !value);
    if (playback?.playing && audio.current?.paused) {
      void audio.current
        .play()
        .then(() => setNeedsUnlock(false))
        .catch(() => setNeedsUnlock(true));
    }
  };

  if (!state) return null;

  return (
    <div className="live-audio">
      <audio ref={audio} preload="auto" />
      <button
        className={`live-audio-toggle ${playback?.playing ? "playing" : ""}`}
        onClick={togglePanel}
        title="Music and volume"
        aria-label="Open music and volume"
      >
        <Music />
        <span>
          <small>{playback?.playing ? "NOW PLAYING" : "AUDIO"}</small>
          <b>{currentTrack?.name ?? "Music & volume"}</b>
        </span>
      </button>

      {open && (
        <section className="live-audio-panel">
          <header>
            <span><Volume2 /> Table audio</span>
            <button onClick={() => setOpen(false)} aria-label="Close audio panel"><X /></button>
          </header>

          <div className="audio-now-playing">
            <small>{playback?.playing ? "NOW PLAYING" : playback?.trackId ? "PAUSED" : "STOPPED"}</small>
            <b>{currentTrack?.name ?? "No track selected"}</b>
            {dm && currentTrack && (
              <div>
                {playback?.playing ? (
                  <button disabled={busy} onClick={() => void run(() => campaignAudioService.control(campaignId, "PAUSE"))}><Pause />Pause</button>
                ) : (
                  <button disabled={busy} onClick={() => void run(() => campaignAudioService.control(campaignId, "PLAY", currentTrack.id))}><Play />Resume</button>
                )}
                <button disabled={busy} onClick={() => void run(() => campaignAudioService.control(campaignId, "STOP"))}><Square />Stop</button>
              </div>
            )}
          </div>

          {needsUnlock && playback?.playing && (
            <button
              className="audio-unlock"
              onClick={() => {
                if (!audio.current) return;
                void audio.current.play().then(() => setNeedsUnlock(false));
              }}
            >
              <Volume2 /> Enable music on this device
            </button>
          )}

          <div className="audio-volume-grid">
            <VolumeSlider label="Master" value={volumes.master} onChange={(value) => setVolume("master", value)} />
            <VolumeSlider label="Music" value={volumes.music} onChange={(value) => setVolume("music", value)} />
            <VolumeSlider label="SFX" value={volumes.sfx} onChange={(value) => setVolume("sfx", value)} />
          </div>

          {dm && (
            <>
              <div className="audio-dm-heading">
                <span>DM MUSIC LIBRARY</span>
                <label>
                  <input
                    type="checkbox"
                    checked={playback?.loop ?? true}
                    onChange={(event) =>
                      void run(() =>
                        campaignAudioService.control(
                          campaignId,
                          "LOOP",
                          null,
                          event.target.checked,
                        ),
                      )
                    }
                  />
                  Loop
                </label>
              </div>

              <button className="audio-upload" disabled={busy} onClick={() => input.current?.click()}>
                <Upload />
                <span><b>Upload MP3</b><small>Up to 50 MB</small></span>
              </button>
              <input
                ref={input}
                hidden
                type="file"
                accept=".mp3,audio/mpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void run(() => campaignAudioService.uploadTrack(campaignId, file));
                }}
              />

              <div className="audio-track-list">
                {tracks.length ? tracks.map((track) => {
                  const current = track.id === playback?.trackId;
                  return (
                    <div className={current ? "current" : ""} key={track.id}>
                      <button
                        className="audio-track-play"
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            campaignAudioService.control(campaignId, "PLAY", track.id),
                          )
                        }
                      >
                        <Play />
                        <span><b>{track.name}</b><small>{current ? playback?.playing ? "Playing" : "Selected" : "Play for everyone"}</small></span>
                      </button>
                      <button
                        className="audio-track-delete"
                        disabled={busy}
                        title={`Delete ${track.name}`}
                        aria-label={`Delete ${track.name}`}
                        onClick={() => {
                          if (!confirm(`Delete ${track.name} from this campaign's music library?`)) return;
                          void run(async () => {
                            if (current) await campaignAudioService.control(campaignId, "STOP");
                            await campaignAudioService.deleteTrack(track);
                          });
                        }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  );
                }) : <p className="audio-empty">Upload an MP3 to build this campaign's music library.</p>}
              </div>
            </>
          )}

          {error && <p className="audio-error">{error}</p>}
          {!dm && <p className="audio-local-note">These volume settings only affect this device.</p>}
        </section>
      )}
    </div>
  );
}

function VolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
}) {
  const percent = Math.round(value * 100);
  return (
    <label className="audio-volume">
      <span>{label}<b>{percent}%</b></span>
      <input
        type="range"
        min="0"
        max="100"
        value={percent}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  );
}
