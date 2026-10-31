"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StudentSection, StudentTestVersion } from "./types";
import { useStudent } from "./student-context";
import { StudentIcon } from "./student-icons";
import { clockLabel } from "./format";
import s from "./student.module.css";

type Playback = { time: number; plays: number; ended: boolean };
export function ListeningPlayer({ sections, version, attemptId, selectedSection, disabled, onSection }: {
  sections: StudentSection[]; version: StudentTestVersion; attemptId: string; selectedSection: string; disabled: boolean; onSection: (id: string) => void;
}) {
  const { user } = useStudent();
  const playable = useMemo(() => sections.filter((section) => section.audio), [sections]);
  const [index, setIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [plays, setPlays] = useState(0);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const state = useRef<Playback>({ time: 0, plays: 0, ended: false });
  const activeKey = useRef("");
  const metadataReady = useRef(false);
  const restoring = useRef(false);
  const shouldPlay = useRef(false);
  const firstLoad = useRef(true);
  const settings = version.settings;
  // Chỉ đồng bộ sau khi khôi phục audio và khi section được chọn có audio hợp lệ.
  if (settings.allow_seek && index !== null) {
    const next = playable.findIndex((item) => item.id === selectedSection);
    if (next >= 0 && next !== index) setIndex(next);
  }
  const section = index === null ? undefined : playable[index];
  const key = section ? "ielts:audio:" + user.id + ":" + attemptId + ":" + section.id : "";
  const pointerKey = "ielts:audio-current:" + user.id + ":" + attemptId;
  function isCurrentPlayback() { return activeKey.current === key && metadataReady.current; }
  function persist() { if (key && activeKey.current === key) { try { localStorage.setItem(key, JSON.stringify(state.current)); } catch {} } }
  useEffect(() => {
    let active = true;
    let next = 0;
    try {
      const pointer = localStorage.getItem(pointerKey);
      const pointed = playable.findIndex((item) => item.id === pointer);
      if (pointed >= 0) next = pointed;
      if (!settings.allow_replay) {
        while (next < playable.length - 1) {
          const saved = JSON.parse(localStorage.getItem("ielts:audio:" + user.id + ":" + attemptId + ":" + playable[next].id) ?? "null") as Playback | null;
          if (!saved?.ended) break;
          next += 1;
        }
      }
    } catch {}
    void Promise.resolve().then(() => { if (active) setIndex(next); });
    return () => { active = false; };
  }, [pointerKey, playable, user.id, attemptId, settings.allow_replay]);
  useEffect(() => {
    if (!section) return;
    try { localStorage.setItem(pointerKey, section.id); } catch {}
  }, [pointerKey, section]);
  useEffect(() => {
    const player = audioRef.current;
    if (!player || !section) return;
    let cached: Playback = { time: 0, plays: 0, ended: false };
    try {
      const value = JSON.parse(localStorage.getItem(key) ?? "null") as Playback | null;
      if (value && Number.isFinite(value.time) && Number.isFinite(value.plays)) cached = { time: Math.max(0, value.time), plays: Math.max(0, value.plays), ended: Boolean(value.ended) };
    } catch {}
    activeKey.current = key;
    metadataReady.current = false;
    state.current = cached;
    restoring.current = false;
    const continueAutomatically = shouldPlay.current || (firstLoad.current && new URLSearchParams(window.location.search).get("start") === "1");
    shouldPlay.current = continueAutomatically;
    firstLoad.current = false;
    void Promise.resolve().then(() => {
      setTime(cached.time); setPlays(cached.plays); setEnded(cached.ended); setPlaying(false); setReady(false); setDuration(0); setError(null);
    });
    player.load();
    return () => { activeKey.current = ""; metadataReady.current = false; player.pause(); };
  }, [key, section]);
  useEffect(() => { if (disabled) audioRef.current?.pause(); }, [disabled]);
  async function startPlayback() {
    const player = audioRef.current;
    if (!player || disabled || !isCurrentPlayback()) return;
    if (state.current.ended) {
      if (!settings.allow_replay || (settings.max_plays !== null && state.current.plays >= settings.max_plays)) return;
      state.current.time = 0; state.current.ended = false;
      restoring.current = true; player.currentTime = 0;
      state.current.plays += 1;
    } else if (state.current.plays === 0) state.current.plays = 1;
    setPlays(state.current.plays); setEnded(false); persist();
    try { await player.play(); if (activeKey.current === key) setError(null); }
    catch { if (activeKey.current === key) setError("Nhấn Phát để bắt đầu hoặc tiếp tục nghe."); }
  }
  if (index === null && playable.length) return <div className={s.listeningPlayer} role="status">Đang khôi phục audio…</div>;
  if (index === null || !section) return <div className={s.audioError}>Audio chưa khả dụng cho bài này.</div>;
  const replayBlocked = ended && (!settings.allow_replay || (settings.max_plays !== null && plays >= settings.max_plays));
  return <section className={s.listeningPlayer} aria-label="Audio Listening">
    <audio ref={audioRef} src={section.audio?.url} preload="auto"
      onLoadedMetadata={() => {
        const player = audioRef.current;
        if (!player || activeKey.current !== key) return;
        setDuration(Number.isFinite(player.duration) ? player.duration : 0);
        if (state.current.time > 0 && !state.current.ended && state.current.time < player.duration) {
          restoring.current = true; player.currentTime = state.current.time;
        }
        metadataReady.current = true;
      }}
      onCanPlay={() => { if (!isCurrentPlayback()) return; setReady(true); if (shouldPlay.current) { shouldPlay.current = false; void startPlayback(); } }}
      onPlay={() => { if (isCurrentPlayback()) setPlaying(true); }} onPause={() => { if (activeKey.current === key) setPlaying(false); }}
      onTimeUpdate={() => {
        // Đổi src/load() có thể phát timeupdate trước khi cache mới được khôi phục.
        if (!isCurrentPlayback()) return;
        const value = audioRef.current?.currentTime ?? 0;
        if (!restoring.current) { state.current.time = value; persist(); }
        setTime(value);
      }}
      onSeeking={() => {
        if (!isCurrentPlayback()) return;
        const player = audioRef.current;
        if (player && !settings.allow_seek && !restoring.current && Math.abs(player.currentTime - state.current.time) > 1) {
          restoring.current = true; player.currentTime = state.current.time;
        }
      }}
      onSeeked={() => { if (isCurrentPlayback()) restoring.current = false; }}
      onEnded={() => {
        if (!isCurrentPlayback() || !audioRef.current?.ended) return;
        state.current.ended = true; state.current.time = audioRef.current?.duration ?? time; persist(); setEnded(true);
        if (index + 1 < playable.length) { shouldPlay.current = true; setIndex(index + 1); onSection(playable[index + 1].id); }
      }}
      onError={() => { if (activeKey.current !== key) return; metadataReady.current = false; setReady(false); setError("Không thể tải audio. Kiểm tra kết nối và thử tải lại."); }}
    />
    <button className={s.audioPlayButton} type="button" aria-label={playing ? "Tạm dừng audio" : ended ? "Nghe lại audio" : "Phát audio"}
      disabled={disabled || !ready || replayBlocked || (playing && !settings.allow_pause)}
      onClick={() => { if (playing && settings.allow_pause) audioRef.current?.pause(); else void startPlayback(); }}>
      <StudentIcon name={playing ? "pause" : ended ? "replay" : "play"} width="23" height="23" />
    </button>
    <div className={s.audioBody}><div className={s.audioTitle}><strong title={section.title ?? ""}>{section.title || "Section " + section.order_no}</strong>
      <span>{!ready ? "Đang tải…" : playing ? "Đang phát" : ended ? "Đã nghe xong" : "Sẵn sàng"} · {plays}{settings.max_plays === null ? "" : "/" + settings.max_plays} lượt</span></div>
      <input type="range" aria-label="Vị trí phát audio" min="0" max={duration || 1} step="0.1" value={Math.min(time, duration || 1)}
        disabled={!settings.allow_seek || disabled || !ready} onChange={(event) => {
          const next = Number(event.target.value);
          if (audioRef.current && settings.allow_seek) { state.current.time = next; audioRef.current.currentTime = next; setTime(next); persist(); }
        }} />
      {error && <div className={s.audioError}>{error}<button type="button" className={s.textButton} onClick={() => { setError(null); audioRef.current?.load(); }}>Tải lại</button></div>}
    </div>
    <span className={s.audioClock}>{clockLabel(time)} / {clockLabel(duration)}</span>
    <label className={s.volume}><StudentIcon name="volume" width="19" height="19" /><input type="range" aria-label="Âm lượng" min="0" max="1" step="0.05" value={volume} onChange={(event) => {
      const next = Number(event.target.value); setVolume(next); if (audioRef.current) audioRef.current.volume = next;
    }} /></label>
  </section>;
}
