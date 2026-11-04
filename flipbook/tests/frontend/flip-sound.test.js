// @vitest-environment jsdom
import { beforeEach, afterEach, test, expect, vi } from "vitest";
import { FlipSound } from "../../public/flip-sound.js";
let sound, context, source;
beforeEach(() => {
  localStorage.clear();
  source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  context = {
    state: "running",
    sampleRate: 8000,
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    close: vi.fn().mockResolvedValue(),
    createBuffer: vi.fn(() => ({
      getChannelData: () => new Float32Array(1760),
    })),
    createBufferSource: vi.fn(() => ({ ...source })),
    createBiquadFilter: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      frequency: {},
      Q: {},
    })),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
  };
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function () {
      return context;
    }),
  );
});
afterEach(() => sound?.destroy());
test("audio is lazy and no context is created on load or when muted", async () => {
  sound = new FlipSound();
  expect(AudioContext).not.toHaveBeenCalled();
  sound.setEnabled(false);
  await sound.play();
  expect(AudioContext).not.toHaveBeenCalled();
});
test("sound preference persists and enabled turns reuse the buffer and context", async () => {
  sound = new FlipSound();
  sound.setEnabled(false);
  expect(new FlipSound().enabled).toBe(false);
  sound.setEnabled(true);
  await sound.play();
  await sound.play();
  expect(AudioContext).toHaveBeenCalledTimes(1);
  expect(context.createBuffer).toHaveBeenCalledTimes(1);
  expect(source.start).toHaveBeenCalledTimes(2);
});
test("paper rustle has a bounded gain envelope and a short stop time", async () => {
  sound = new FlipSound();
  await sound.play();
  const gain = context.createGain.mock.results[0].value.gain;
  expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.11, 0.025);
  expect(source.stop).toHaveBeenCalledWith(0.22);
});
test("muting during resume prevents a delayed sound from starting", async () => {
  let resume;
  context.state = "suspended";
  context.resume.mockImplementation(
    () =>
      new Promise(
        (r) =>
          (resume = () => {
            context.state = "running";
            r();
          }),
      ),
  );
  sound = new FlipSound();
  const pending = sound.play();
  sound.setEnabled(false);
  resume();
  await pending;
  expect(source.start).not.toHaveBeenCalled();
});
test("unsupported audio and storage failures never stop reading", async () => {
  vi.stubGlobal("AudioContext", undefined);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  sound = new FlipSound();
  await expect(sound.play()).resolves.toBeUndefined();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  expect(() => sound.setEnabled(false)).not.toThrow();
});
test("destroy stops playback and prevents later audio allocation", async () => {
  sound = new FlipSound();
  await sound.play();
  sound.destroy();
  await sound.play();
  expect(context.close).toHaveBeenCalled();
  expect(source.start).toHaveBeenCalledTimes(1);
});
