import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

const NOTE_FREQUENCIES = [261.63, 329.63, 392, 523.25];

export function SoundBox() {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
  }, []);

  const playStudyTone = useCallback(() => {
    if (muted) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    void context.resume();
    const start = context.currentTime;
    NOTE_FREQUENCIES.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const when = start + index * 0.18;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.07, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.42);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(when);
      oscillator.stop(when + 0.45);
    });
    setPlaying(true);
    timerRef.current = window.setTimeout(() => setPlaying(false), 900);
  }, [muted]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    void audioContextRef.current?.close();
  }, []);

  return (
    <aside className="fixed bottom-4 right-4 z-50 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-primary/20 bg-card/95 p-3 shadow-xl backdrop-blur" aria-label="Jelite Tutor sound box">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Headphones className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Study sound box</p>
          <p className="truncate text-xs text-muted-foreground">Tap to preview a focus chime</p>
        </div>
        <Button type="button" size="icon" variant="outline" onClick={playing ? stop : playStudyTone} aria-label={playing ? "Stop study sound" : "Play study sound"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{playing ? "Playing" : "Ready to preview"}</span>
        <button type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted" onClick={() => setMuted(value => !value)} aria-label={muted ? "Unmute sound box" : "Mute sound box"}>
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          {muted ? "Muted" : "Sound on"}
        </button>
      </div>
    </aside>
  );
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
