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
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useTabletop } from "../../contexts/TabletopContext";
import { isDmRole } from "../../domain/types";
import { supabase } from "../../lib/supabase";
import {
  campaignAudioService,
  type CampaignAmbiencePlayback,
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

type Playback = CampaignAudioPlayback | CampaignAmbiencePlayback;

function useSyncedChannel({
  element,
  playback,
  track,
  volume,
  onEnded,
  setNeedsUnlock,
}: {
  element: RefObject<HTMLAudioElement | null>;
  playback: Playback | null;
  track: CampaignAudioTrack | null;
  volume: number;
  onEnded(): void;
  setNeedsUnlock(value: boolean): void;
}) {
  useEffect(() => {
    if (!element.current) return;
    element.current.volume = clamp(volume);
  }, [element, volume]);

  useEffect(() => {
    const audio = element.current;
    if (!audio) return;

    if (!playback?.trackId || !track?.url) {
      audio.pause();
      audio.removeAttribute("src");
      audio.dataset.trackId = "";
      audio.load();
      return;
    }

    if (audio.dataset.trackId !== track.id) {
      audio.src = track.url;
      audio.dataset.trackId = track.id;
      audio.load();
    }

    audio.loop = playback.loop;

    const applyState = () => {
      let desiredSeconds = playback.positionMs / 1000;
      if (playback.playing && playback.startedAt) {
        desiredSeconds += Math.max(
          0,
          (serverNowMs() - Date.parse(playback.startedAt)) / 1000,
        );
      }

      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        desiredSeconds = playback.loop
          ? desiredSeconds % audio.duration
          : Math.min(desiredSeconds, Math.max(0, audio.duration - 0.05));
      }

      if (
        Number.isFinite(desiredSeconds) &&
        Math.abs(audio.currentTime - desiredSeconds) > 1
      ) {
        try {
          audio.currentTime = Math.max(0, desiredSeconds);
        } catch {
          // Metadata can still be settling. loadedmetadata retries this path.
        }
      }

      if (playback.playing) {
        void audio
          .play()
          .then(() => setNeedsUnlock(false))
          .catch(() => setNeedsUnlock(true));
      } else {
        audio.pause();
      }
    };

    if (audio.readyState >= 1) applyState();
    else audio.addEventListener("loadedmetadata", applyState, { once: true });

    return () => audio.removeEventListener("loadedmetadata", applyState);
  }, [element, playback, setNeedsUnlock, track]);

  useEffect(() => {
    const audio = element.current;
    if (!audio) return;
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [element, onEnded]);
}

export function LiveAudio() {
  const { state } = useTabletop();
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<CampaignAudioTrack[]>([]);
  const [playback, setPlayback] = useState<CampaignAudioPlayback | null>(null);
  const [ambience, setAmbience] = useState<CampaignAmbiencePlayback | null>(null);
  const [volumes, setVolumes] = useState<LocalVolumes>(loadVolumes);
  const [busy, setBusy] = useState(false);
  const [needsMusicUnlock, setNeedsMusicUnlock] = useState(false);
  const [needsAmbienceUnlock, setNeedsAmbienceUnlock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const musicAudio = useRef<HTMLAudioElement>(null);
  const ambienceAudio = useRef<HTMLAudioElement>(null);

  const campaignId = state?.campaign.id ?? "";
  const dm = Boolean(state && isDmRole(state.role));
  const currentTrack = useMemo(
    () => tracks.find((track) => track.id === playback?.trackId) ?? null,
    [tracks, playback?.trackId],
  );
  const queuedTrack = useMemo(
    () => tracks.find((track) => track.id === playback?.nextTrackId) ?? null,
    [tracks, playback?.nextTrackId],
  );
  const ambienceTrack = useMemo(
    () => tracks.find((track) => track.id === ambience?.trackId) ?? null,
    [tracks, ambience?.trackId],
  );

  const refresh = useCallback(async () => {
    if (!campaignId) return;
    try {
      const next = await campaignAudioService.load(campaignId);
      setTracks(next.tracks);
      setPlayback(next.playback);
      setAmbience(next.ambience);
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_ambience_state",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [campaignId, refresh]);

  const musicEnded = useCallback(() => {
    if (!dm || !campaignId || !playback?.playing || playback.loop) return;
    void campaignAudioService.advanceMusic(campaignId).then(() => refresh());
  }, [campaignId, dm, playback?.loop, playback?.playing, refresh]);

  const ambienceEnded = useCallback(() => {
    if (!dm || !campaignId || !ambience?.playing || ambience.loop) return;
    void campaignAudioService
      .controlAmbience(campaignId, "STOP")
      .then(() => refresh());
  }, [ambience?.loop, ambience?.playing, campaignId, dm, refresh]);

  useSyncedChannel({
    element: musicAudio,
    playback,
    track: currentTrack,
    volume: volumes.master * volumes.music,
    onEnded: musicEnded,
    setNeedsUnlock: setNeedsMusicUnlock,
  });
  useSyncedChannel({
    element: ambienceAudio,
    playback: ambience,
    track: ambienceTrack,
    volume: volumes.master * volumes.sfx,
    onEnded: ambienceEnded,
    setNeedsUnlock: setNeedsAmbienceUnlock,
  });

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

  const unlock = (audio: HTMLAudioElement | null, setter: (value: boolean) => void) => {
    if (!audio) return;
    void audio.play().then(() => setter(false));
  };

  const togglePanel = () => {
    setOpen((value) => !value);
    if (playback?.playing && musicAudio.current?.paused) {
      unlock(musicAudio.current, setNeedsMusicUnlock);
    }
    if (ambience?.playing && ambienceAudio.current?.paused) {
      unlock(ambienceAudio.current, setNeedsAmbienceUnlock);
    }
  };

  if (!state) return null;

  return (
    <div className="live-audio">
      <audio ref={musicAudio} preload="auto" />
      <audio ref={ambienceAudio} preload="auto" />
      <button
        className={`live-audio-toggle ${playback?.playing || ambience?.playing ? "playing" : ""}`}
        onClick={togglePanel}
        title="Music, ambience, and volume"
        aria-label="Open music, ambience, and volume"
      >
        <Music />
        <span>
          {dm ? (
            <>
              <small>{playback?.playing ? "NOW PLAYING" : ambience?.playing ? "AMBIENCE" : "AUDIO"}</small>
              <b>{currentTrack?.name ?? ambienceTrack?.name ?? "Music & ambience"}</b>
            </>
          ) : (
            <>
              <small>VOLUME</small>
              <b>Table volume</b>
            </>
          )}
        </span>
      </button>

      {open && (
        <section className="live-audio-panel">
          <header>
            <span><Volume2 /> Table audio</span>
            <button onClick={() => setOpen(false)} aria-label="Close audio panel"><X /></button>
          </header>

          {dm && <>
          <div className="audio-channel-title">MUSIC</div>
          <div className="audio-now-playing">
            <small>{playback?.playing ? "NOW PLAYING" : playback?.trackId ? "PAUSED" : "STOPPED"}</small>
            <b>{currentTrack?.name ?? "No music selected"}</b>
            {queuedTrack && <em>Next: {queuedTrack.name}{playback?.nextLoop ? " · loops" : ""}</em>}
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

          {needsMusicUnlock && playback?.playing && (
            <button className="audio-unlock" onClick={() => unlock(musicAudio.current, setNeedsMusicUnlock)}>
              <Volume2 /> Enable music on this device
            </button>
          )}

          {dm && (
            <div className="audio-queue-controls">
              <label>
                <span>Queue next song</span>
                <select
                  value={playback?.nextTrackId ?? ""}
                  onChange={(event) =>
                    void run(() =>
                      campaignAudioService.queueMusic(
                        campaignId,
                        event.target.value || null,
                        playback?.nextLoop ?? true,
                      ),
                    )
                  }
                >
                  <option value="">Nothing queued</option>
                  {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
                </select>
              </label>
              <label className="audio-inline-toggle">
                <input
                  type="checkbox"
                  checked={playback?.nextLoop ?? true}
                  disabled={!playback?.nextTrackId}
                  onChange={(event) =>
                    void run(() =>
                      campaignAudioService.queueMusic(
                        campaignId,
                        playback?.nextTrackId ?? null,
                        event.target.checked,
                      ),
                    )
                  }
                />
                Loop queued song
              </label>
              {playback?.loop && playback?.nextTrackId && <small>Queued music waits until current loop is turned off.</small>}
            </div>
          )}

          <div className="audio-channel-title">AMBIENCE</div>
          <div className="audio-now-playing ambience">
            <small>{ambience?.playing ? "PLAYING" : ambience?.trackId ? "PAUSED" : "STOPPED"}</small>
            <b>{ambienceTrack?.name ?? "No ambience selected"}</b>
            {dm && ambienceTrack && (
              <div>
                {ambience?.playing ? (
                  <button disabled={busy} onClick={() => void run(() => campaignAudioService.controlAmbience(campaignId, "PAUSE"))}><Pause />Pause</button>
                ) : (
                  <button disabled={busy} onClick={() => void run(() => campaignAudioService.controlAmbience(campaignId, "PLAY", ambienceTrack.id))}><Play />Resume</button>
                )}
                <button disabled={busy} onClick={() => void run(() => campaignAudioService.controlAmbience(campaignId, "STOP"))}><Square />Stop</button>
              </div>
            )}
          </div>

          {needsAmbienceUnlock && ambience?.playing && (
            <button className="audio-unlock" onClick={() => unlock(ambienceAudio.current, setNeedsAmbienceUnlock)}>
              <Volume2 /> Enable ambience on this device
            </button>
          )}

          {dm && (
            <div className="audio-ambience-controls">
              <label>
                <span>Ambience track</span>
                <select
                  value={ambience?.trackId ?? ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      void run(() =>
                        campaignAudioService.controlAmbience(
                          campaignId,
                          "PLAY",
                          event.target.value,
                          ambience?.loop ?? true,
                        ),
                      );
                    } else {
                      void run(() => campaignAudioService.controlAmbience(campaignId, "STOP"));
                    }
                  }}
                >
                  <option value="">None</option>
                  {tracks.map((track) => <option key={track.id} value={track.id}>{track.name}</option>)}
                </select>
              </label>
              <label className="audio-inline-toggle">
                <input
                  type="checkbox"
                  checked={ambience?.loop ?? true}
                  onChange={(event) =>
                    void run(() =>
                      campaignAudioService.controlAmbience(
                        campaignId,
                        "LOOP",
                        null,
                        event.target.checked,
                      ),
                    )
                  }
                />
                Loop ambience
              </label>
            </div>
          )}

          </>}

          <div className="audio-volume-grid">
            <VolumeSlider label="Master" value={volumes.master} onChange={(value) => setVolume("master", value)} />
            <VolumeSlider label="Music" value={volumes.music} onChange={(value) => setVolume("music", value)} />
            <VolumeSlider label="SFX / Ambience" value={volumes.sfx} onChange={(value) => setVolume("sfx", value)} />
          </div>

          {dm && (
            <>
              <div className="audio-dm-heading">
                <span>DM AUDIO LIBRARY</span>
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
                  Loop music
                </label>
              </div>

              <button className="audio-upload" disabled={busy} onClick={() => input.current?.click()}>
                <Upload />
                <span><b>Upload MP3</b><small>Music or ambience · up to 50 MB</small></span>
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
                  const ambient = track.id === ambience?.trackId;
                  return (
                    <div className={current || ambient ? "current" : ""} key={track.id}>
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
                        <span><b>{track.name}</b><small>{current ? playback?.playing ? "Music playing" : "Music selected" : ambient ? "Used as ambience" : "Play as music"}</small></span>
                      </button>
                      <button
                        className="audio-track-delete"
                        disabled={busy}
                        title={`Delete ${track.name}`}
                        aria-label={`Delete ${track.name}`}
                        onClick={() => {
                          if (!confirm(`Delete ${track.name} from this campaign's audio library?`)) return;
                          void run(async () => {
                            if (current) await campaignAudioService.control(campaignId, "STOP");
                            if (ambient) await campaignAudioService.controlAmbience(campaignId, "STOP");
                            if (track.id === playback?.nextTrackId) await campaignAudioService.queueMusic(campaignId, null);
                            await campaignAudioService.deleteTrack(track);
                          });
                        }}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  );
                }) : <p className="audio-empty">Upload an MP3 to build this campaign's audio library.</p>}
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
