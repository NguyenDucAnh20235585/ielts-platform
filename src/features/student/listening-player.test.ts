// @vitest-environment jsdom

import { act, createElement, useLayoutEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListeningPlayer } from "./listening-player";
import type { StudentSection, StudentTestVersion } from "./types";

vi.mock("./student-context", () => ({
  useStudent: () => ({ user: { id: "student-audio-test" } }),
}));

const attemptId = "mock-audio-attempt";
const pointerKey = "ielts:audio-current:student-audio-test:" + attemptId;
const playbackKey = (sectionId: string) => "ielts:audio:student-audio-test:" + attemptId + ":" + sectionId;
const sections: StudentSection[] = [1, 2].map((order) => ({
  id: "section-" + order,
  order_no: order,
  title: "Section " + order,
  instruction: null,
  content: null,
  audio: { url: "https://audio.example.test/section-" + order + ".mp3", expires_at: null },
  numbers: null,
  question_groups: [],
}));
const version: StudentTestVersion = {
  id: "listening-version",
  test_id: "listening-test",
  version_number: 1,
  title: "Listening Mock",
  type: "LISTENING",
  mode: "MOCK",
  duration_seconds: 1920,
  question_count: 0,
  settings: {
    answer_visibility: "AFTER_SUBMIT",
    allow_pause: false,
    allow_seek: false,
    allow_replay: false,
    max_plays: 1,
  },
};

type PlayerProps = Parameters<typeof ListeningPlayer>[0];
let container: HTMLDivElement;
let root: Root;
let props: PlayerProps;

async function renderPlayer(overrides: Partial<PlayerProps> = {}) {
  props = { ...props, ...overrides };
  await act(async () => { root.render(createElement(ListeningPlayer, props)); });
  const player = container.querySelector("audio");
  if (!player) throw new Error("Listening player did not mount.");
  return player;
}

async function remountPlayer() {
  await act(async () => { root.unmount(); });
  root = createRoot(container);
  return renderPlayer();
}

async function ready(player: HTMLAudioElement) {
  Object.defineProperty(player, "duration", { configurable: true, value: 120 });
  await act(async () => {
    player.dispatchEvent(new Event("loadedmetadata"));
    player.dispatchEvent(new Event("seeked"));
    player.dispatchEvent(new Event("canplay"));
  });
}

async function clickPlay() {
  await act(async () => { container.querySelector("button")?.click(); });
}

async function advance(player: HTMLAudioElement, time: number) {
  await act(async () => {
    player.currentTime = time;
    player.dispatchEvent(new Event("timeupdate"));
  });
}

async function end(player: HTMLAudioElement) {
  await act(async () => {
    player.currentTime = player.duration;
    Object.defineProperty(player, "ended", { configurable: true, value: true });
    player.dispatchEvent(new Event("ended"));
  });
}

function saved(sectionId: string) {
  return JSON.parse(localStorage.getItem(playbackKey(sectionId)) ?? "null");
}

beforeEach(() => {
  // React DOM cần cờ này khi dùng act trong môi trường test.
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  window.history.replaceState(null, "", "/student/attempts/" + attemptId);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  props = { sections, version, attemptId, selectedSection: sections[0].id, disabled: false, onSection: vi.fn() };
  // JSDOM không phát media thật: mô phỏng API và phát sự kiện tường minh.
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (this: HTMLMediaElement) {
    this.currentTime = 0;
    Object.defineProperty(this, "ended", { configurable: true, value: false });
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(async () => {
  await act(async () => { root.unmount(); });
  container.remove();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Listening Mock: reload and section navigation", () => {
  it("does not overwrite the resume checkpoint with a reset timeupdate before metadata", async () => {
    localStorage.setItem(playbackKey(sections[0].id), JSON.stringify({ time: 38, plays: 1, ended: false }));
    vi.mocked(HTMLMediaElement.prototype.load).mockImplementation(function (this: HTMLMediaElement) {
      this.currentTime = 0;
      this.dispatchEvent(new Event("timeupdate"));
    });

    const player = await renderPlayer();
    await ready(player);

    expect(player.currentTime).toBe(38);
    expect(saved(sections[0].id)).toEqual({ time: 38, plays: 1, ended: false });
  });

  it("does not copy the completed audio state into the next section during a native source reset", async () => {
    function NativeSourceReset() {
      const [selectedSection, onSection] = useState(sections[0].id);
      useLayoutEffect(() => {
        if (selectedSection !== sections[1].id) return;
        const player = container.querySelector("audio");
        if (!player) throw new Error("Missing audio during source reset.");
        // Đổi src có thể phát timeupdate sau commit, trước effect khôi phục.
        player.currentTime = 0;
        player.dispatchEvent(new Event("timeupdate"));
      }, [selectedSection]);
      return createElement(ListeningPlayer, { ...props, selectedSection, onSection });
    }
    await act(async () => { root.render(createElement(NativeSourceReset)); });
    const player = container.querySelector("audio")!;
    await ready(player);
    await clickPlay();
    await end(player);
    await ready(player);

    expect(player.src).toBe(sections[1].audio?.url);
    expect(saved(sections[0].id).ended).toBe(true);
    expect(saved(sections[1].id)).toEqual({ time: 0, plays: 1, ended: false });
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it("restores the saved position after remount without consuming a second play", async () => {
    let player = await renderPlayer();
    await ready(player);
    await clickPlay();
    await advance(player, 37.5);

    player = await remountPlayer();
    await ready(player);
    expect(player.currentTime).toBe(37.5);
    expect(saved(sections[0].id)).toEqual({ time: 37.5, plays: 1, ended: false });

    await clickPlay();
    expect(saved(sections[0].id).plays).toBe(1);
  });

  it("resumes at the saved position with start=1 instead of starting from zero", async () => {
    localStorage.setItem(playbackKey(sections[0].id), JSON.stringify({ time: 42, plays: 1, ended: false }));
    window.history.replaceState(null, "", window.location.pathname + "?start=1");

    const player = await renderPlayer();
    await ready(player);

    expect(player.currentTime).toBe(42);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(saved(sections[0].id).plays).toBe(1);
  });

  it("keeps the current audio playing when switching question sections and returning", async () => {
    const player = await renderPlayer();
    await ready(player);
    await clickPlay();
    await advance(player, 35);
    const loads = vi.mocked(player.load).mock.calls.length;

    await renderPlayer({ selectedSection: sections[1].id });
    await renderPlayer({ selectedSection: sections[0].id });

    expect(player.src).toBe(sections[0].audio?.url);
    expect(player.currentTime).toBe(35);
    expect(player.load).toHaveBeenCalledTimes(loads);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(saved(sections[0].id).plays).toBe(1);
  });

  it("advances after ending and cannot reopen an earlier audio through question navigation", async () => {
    const player = await renderPlayer();
    await ready(player);
    await clickPlay();
    await end(player);
    await ready(player);

    expect(saved(sections[0].id)).toEqual({ time: 120, plays: 1, ended: true });
    expect(props.onSection).toHaveBeenCalledWith(sections[1].id);
    expect(localStorage.getItem(pointerKey)).toBe(sections[1].id);
    expect(player.src).toBe(sections[1].audio?.url);
    expect(player.play).toHaveBeenCalledTimes(2);

    await advance(player, 16);
    await renderPlayer({ selectedSection: sections[0].id });
    expect(player.src).toBe(sections[1].audio?.url);
    expect(player.currentTime).toBe(16);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it("restores the current audio independently of the selected question section", async () => {
    localStorage.setItem(pointerKey, sections[1].id);
    localStorage.setItem(playbackKey(sections[0].id), JSON.stringify({ time: 120, plays: 1, ended: true }));
    localStorage.setItem(playbackKey(sections[1].id), JSON.stringify({ time: 29, plays: 1, ended: false }));

    const player = await renderPlayer({ selectedSection: sections[0].id });
    await ready(player);

    expect(player.src).toBe(sections[1].audio?.url);
    expect(player.currentTime).toBe(29);
    expect(saved(sections[1].id).plays).toBe(1);
  });

  it("skips completed audio when the current-section pointer is missing", async () => {
    localStorage.setItem(playbackKey(sections[0].id), JSON.stringify({ time: 120, plays: 1, ended: true }));

    const player = await renderPlayer();
    await ready(player);

    expect(player.src).toBe(sections[1].audio?.url);
    expect(localStorage.getItem(pointerKey)).toBe(sections[1].id);
  });
});

describe("Listening Mock: lock after ending", () => {
  it("ignores a stale ended event when the current audio has not actually ended", async () => {
    const player = await renderPlayer();
    await ready(player);
    await clickPlay();
    await act(async () => { player.dispatchEvent(new Event("ended")); });

    expect(player.src).toBe(sections[0].audio?.url);
    expect(saved(sections[0].id).ended).toBe(false);
    expect(props.onSection).not.toHaveBeenCalled();
  });

  it("disables replay after the final audio ends, including after remount", async () => {
    let player = await renderPlayer({ sections: [sections[0]] });
    await ready(player);
    await clickPlay();
    await end(player);

    expect(container.querySelector("button")?.disabled).toBe(true);
    await clickPlay();
    expect(player.play).toHaveBeenCalledTimes(1);

    window.history.replaceState(null, "", window.location.pathname + "?start=1");
    player = await remountPlayer();
    await ready(player);
    expect(container.querySelector("button")?.disabled).toBe(true);
    await clickPlay();
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(saved(sections[0].id).ended).toBe(true);
  });
});

describe("Listening Mock: known client-storage bypass (not an acceptance pass)", () => {
  it("allows another listen after clearing localStorage and remounting", async () => {
    let player = await renderPlayer({ sections: [sections[0]] });
    await ready(player);
    await clickPlay();
    await end(player);
    expect(container.querySelector("button")?.disabled).toBe(true);

    localStorage.clear();
    player = await remountPlayer();
    await ready(player);
    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(player.currentTime).toBe(0);
    await clickPlay();

    expect(player.play).toHaveBeenCalledTimes(2);
    expect(saved(sections[0].id)).toEqual({ time: 0, plays: 1, ended: false });
  });

  it("allows another listen after changing the stored playback state", async () => {
    let player = await renderPlayer({ sections: [sections[0]] });
    await ready(player);
    await clickPlay();
    await end(player);

    localStorage.setItem(playbackKey(sections[0].id), JSON.stringify({ time: 0, plays: 0, ended: false }));
    player = await remountPlayer();
    await ready(player);
    await clickPlay();

    expect(player.play).toHaveBeenCalledTimes(2);
    expect(saved(sections[0].id).ended).toBe(false);
  });
});
