"use client";

import { useCallback, useMemo, useRef } from "react";

type SoundType = "move" | "capture" | "check" | "end";

const soundMap: Record<SoundType, string> = {
  move: "/sounds/move.mp3",
  capture: "/sounds/capture.mp3",
  check: "/sounds/check.mp3",
  end: "/sounds/end.mp3",
};

function fallbackTone(type: SoundType, context: AudioContext) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequencies: Record<SoundType, number> = {
    move: 440,
    capture: 330,
    check: 550,
    end: 220,
  };

  oscillator.type = type === "capture" ? "triangle" : "sine";
  oscillator.frequency.value = frequencies[type];
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.08);
}

export function useChessSounds() {
  const cacheRef = useRef<Partial<Record<SoundType, HTMLAudioElement | null>>>({});
  const audioContextRef = useRef<AudioContext | null>(null);

  const canUseAudio = useMemo(
    () => typeof window !== "undefined" && typeof Audio !== "undefined",
    [],
  );

  const play = useCallback(
    async (type: SoundType) => {
      if (!canUseAudio) {
        return;
      }

      try {
        let audio = cacheRef.current[type];
        if (audio === undefined) {
          audio = new Audio(soundMap[type]);
          audio.preload = "auto";
          audio.onerror = () => {
            cacheRef.current[type] = null;
          };
          cacheRef.current[type] = audio;
        }

        if (audio) {
          audio.currentTime = 0;
          await audio.play();
          return;
        }
      } catch {
        // Fall through to synthesized tones.
      }

      try {
        const AudioContextCtor =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;

        if (!AudioContextCtor) {
          return;
        }

        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextCtor();
        }

        fallbackTone(type, audioContextRef.current);
      } catch {
        // Silence is a safe fallback.
      }
    },
    [canUseAudio],
  );

  return { play };
}

