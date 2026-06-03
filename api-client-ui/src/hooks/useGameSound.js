import { useCallback, useEffect, useRef } from "react";

const createAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  return AudioContextCtor ? new AudioContextCtor() : null;
};

const SOUND_VOLUME_MULTIPLIER = 8;

export const useGameSound = ({ myTurn = false, actionSignal = "" } = {}) => {
  const audioContextRef = useRef(null);
  const unlockedRef = useRef(false);
  const previousMyTurnRef = useRef(false);
  const previousActionSignalRef = useRef("");
  const playingRef = useRef(false);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }
    return audioContextRef.current;
  }, []);

  const unlock = useCallback(() => {
    const context = getContext();
    if (!context) return;
    unlockedRef.current = true;
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }
  }, [getContext]);

  const play = useCallback((kind) => {
    const context = getContext();
    if (!context || !unlockedRef.current || playingRef.current) return;
    if (context.state === "suspended") {
      context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const master = context.createGain();
    const gain = context.createGain();
    const primary = context.createOscillator();
    const accent = context.createOscillator();
    const isTurn = kind === "turn";
    const duration = isTurn ? 0.18 : 0.09;

    try {
      playingRef.current = true;
      master.gain.setValueAtTime((isTurn ? 0.11 : 0.075) * SOUND_VOLUME_MULTIPLIER, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(isTurn ? 0.22 : 0.16, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      primary.type = isTurn ? "sine" : "triangle";
      accent.type = "triangle";
      primary.frequency.setValueAtTime(isTurn ? 587.33 : 659.25, now);
      primary.frequency.exponentialRampToValueAtTime(isTurn ? 783.99 : 523.25, now + duration);
      accent.frequency.setValueAtTime(isTurn ? 880 : 987.77, now + 0.025);
      accent.frequency.exponentialRampToValueAtTime(isTurn ? 1174.66 : 783.99, now + duration);

      primary.connect(gain);
      accent.connect(gain);
      gain.connect(master);
      master.connect(context.destination);
      primary.start(now);
      accent.start(now + (isTurn ? 0.035 : 0.015));
      primary.stop(now + duration);
      accent.stop(now + duration);
      window.setTimeout(() => {
        playingRef.current = false;
      }, Math.ceil(duration * 1000) + 30);
    } catch {
      playingRef.current = false;
    }
  }, [getContext]);

  useEffect(() => {
    const onUserGesture = () => unlock();
    window.addEventListener("pointerdown", onUserGesture, { passive: true });
    window.addEventListener("keydown", onUserGesture);
    return () => {
      window.removeEventListener("pointerdown", onUserGesture);
      window.removeEventListener("keydown", onUserGesture);
    };
  }, [unlock]);

  useEffect(() => {
    if (myTurn && !previousMyTurnRef.current) {
      play("turn");
    }
    previousMyTurnRef.current = Boolean(myTurn);
  }, [myTurn, play]);

  useEffect(() => {
    if (actionSignal && previousActionSignalRef.current && actionSignal !== previousActionSignalRef.current) {
      play("action");
    }
    previousActionSignalRef.current = actionSignal || "";
  }, [actionSignal, play]);

  return { unlockGameSound: unlock, playGameSound: play };
};

export default useGameSound;
