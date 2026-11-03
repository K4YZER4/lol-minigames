"use client";

import { useEffect, useRef, useState } from "react";
import { audioDistortionLevel } from "@/lib/audio-distortion";

type Props = {
  src: string;
  level: number;
  label?: string;
};

function makeCurve(amount: number): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(512 * Float32Array.BYTES_PER_ELEMENT));
  if (amount <= 0) {
    for (let i = 0; i < curve.length; i += 1) curve[i] = (i * 2) / (curve.length - 1) - 1;
    return curve;
  }
  const drive = 1 + amount * 18;
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i * 2) / (curve.length - 1) - 1;
    curve[i] = Math.tanh(x * drive) / Math.tanh(drive);
  }
  return curve;
}

export function AudioDistortionPlayer({ src, level, label }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const graphRef = useRef<{
    context: AudioContext;
    source: MediaElementAudioSourceNode;
    highpass: BiquadFilterNode;
    lowpass: BiquadFilterNode;
    shaper: WaveShaperNode;
    delay: DelayNode;
    wet: GainNode;
    dry: GainNode;
    output: GainNode;
    noise: AudioBufferSourceNode | null;
    noiseGain: GainNode;
  } | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => () => {
    const graph = graphRef.current;
    graph?.context.close().catch(() => undefined);
  }, []);

  function ensureGraph() {
    const audio = audioRef.current;
    if (!audio) return null;
    if (graphRef.current) return graphRef.current;

    const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    const context = new AudioContextCtor();
    const source = context.createMediaElementSource(audio);
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const shaper = context.createWaveShaper();
    const delay = context.createDelay(0.5);
    const wet = context.createGain();
    const dry = context.createGain();
    const output = context.createGain();
    const noiseGain = context.createGain();
    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    source.connect(highpass).connect(lowpass).connect(shaper).connect(delay).connect(wet).connect(output);
    source.connect(dry).connect(output);
    noise.connect(noiseGain).connect(output);
    output.connect(context.destination);
    noise.start();

    graphRef.current = { context, source, highpass, lowpass, shaper, delay, wet, dry, output, noise, noiseGain };
    return graphRef.current;
  }

  function applyLevel() {
    const graph = graphRef.current;
    const audio = audioRef.current;
    if (!graph || !audio) return;
    const settings = audioDistortionLevel(level);
    graph.highpass.frequency.value = Math.max(1, settings.highpassHz);
    graph.lowpass.frequency.value = settings.lowpassHz;
    graph.shaper.curve = makeCurve(settings.bitcrush);
    graph.delay.delayTime.value = settings.delayMs / 1000;
    graph.wet.gain.value = settings.bitcrush > 0 ? 0.82 : 0;
    graph.dry.gain.value = settings.bitcrush > 0 ? 0.18 : 1;
    graph.noiseGain.gain.value = settings.noise;
    audio.playbackRate = settings.speed;
  }

  function play() {
    const graph = ensureGraph();
    const audio = audioRef.current;
    if (!graph || !audio) return;
    applyLevel();
    void graph.context.resume().then(() => audio.play()).then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function stop() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="metadata" onEnded={() => setPlaying(false)} />
      <button className="primary" type="button" onClick={playing ? stop : play}>
        {playing ? "Pausar audio" : "▶ Escuchar pista"}
      </button>
      <span className="hint">{label ?? `Pista sonora ${level}`}</span>
    </div>
  );
}
