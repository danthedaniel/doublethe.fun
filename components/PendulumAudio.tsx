import { useCallback, useEffect, useRef } from "react";
import { createPendulums, PendulumPair, PendulumSimulator } from "../utils/pendulumSimulation";

const timeStep = 0.005;
const sampleRate = 44100;

function smoothAudioEnds(samples: number[], crossFadeMs: number, sampleRate: number): number[] {
  const N = Math.floor((crossFadeMs / 1000) * sampleRate);
  const len = samples.length;
  if (N <= 0 || N * 2 >= len) {
    return samples;
  }

  const window = [...samples];

  for (let k = 0; k < N; k++) {
    const fadeOut = 0.5 * (1 + Math.cos(Math.PI * k / N));
    const fadeIn  = 1 - fadeOut;
    const tailIdx = len - N + k;
    const headIdx = k;

    const mixed = fadeOut * samples[tailIdx] + fadeIn * samples[headIdx];
    window[tailIdx] = mixed;
    window[headIdx] = mixed;
  }

  return window;
}

/**
 * Similarity metric for pendulum pairs.
 */
function pendulumPairDistance(a: PendulumPair, b: PendulumPair): number {
  return Math.sqrt(
    (a[0].angle    - b[0].angle   ) ** 2 +
    (a[0].momentum - b[0].momentum) ** 2 +
    (a[1].angle    - b[1].angle   ) ** 2 +
    (a[1].momentum - b[1].momentum) ** 2
  );
}

/**
 * Convert an angle in the range `0..2pi` to a sample value in the range `-1..1`
 */
function angleToSample(angle: number): number {
  return (angle % (2 * Math.PI)) / Math.PI - 1.0;
}

interface PendulumAudioProps {
  startingAngles: [number, number];
  lengths: [number, number];
  masses: [number, number];
  gravity: number;
}

export default function PendulumAudio({ startingAngles, lengths, masses, gravity }: PendulumAudioProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const simulatorRef = useRef<PendulumSimulator | null>(null);

  const generateAudioChunk = useCallback(async (maxSeconds: number): Promise<[Float32Array, Float32Array, boolean]> => {
    if (!simulatorRef.current) {
      throw new Error("Simulator not initialized");
    }

    const states: PendulumPair[] = [];

    // Skip the first 1000 steps to get the system to a stable state
    for (let i = 0; i < 1000; i++) {
      simulatorRef.current.step();
    }

    // Get the initial state
    states.push(simulatorRef.current.getState());

    const minSamples = 100;
    // We use the minimum distance from the first few samples as a reference for
    // how distant we typically are from the initial state.
    let minDistance = Infinity;
    // Collect at least 100 samples
    for (let i = 0; i < minSamples; i++) {
      const newState = simulatorRef.current.step();

      const distance = pendulumPairDistance(newState, states[0]);
      if (distance < minDistance) {
        minDistance = distance;
      }

      states.push(newState);
    }

    let loopFound = false;
    // Search for a sample that is close to the initial state
    for (let i = 0; i < (sampleRate * maxSeconds - (minSamples + 1)); i++) {
      if (i % 4410 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const newState = simulatorRef.current.step();
      if (pendulumPairDistance(newState, states[0]) < (minDistance * 1.01)) {
        loopFound = true;
        break;
      }

      states.push(newState);
    }

    let left = states.map((state) => angleToSample(state[0].angle));
    let right = states.map((state) => angleToSample(state[1].angle));

    if (!loopFound) {
      left = smoothAudioEnds(left, 10, sampleRate);
      right = smoothAudioEnds(right, 10, sampleRate);
    }

    return [new Float32Array(left), new Float32Array(right), loopFound];
  }, []);

  const playAudioChunk = useCallback(async (maxSeconds: number) => {
    if (!audioContextRef.current) {
      throw new Error("Audio context not initialized");
    }

    const [left, right, loopFound] = await generateAudioChunk(maxSeconds);

    const buffer = audioContextRef.current.createBuffer(2, left.length, sampleRate);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Lower volume if loop is not found
    if (!loopFound) {
      const gain = audioContextRef.current.createGain();
      gain.gain.value = 0.1;

      gain.connect(audioContextRef.current.destination);
      source.connect(gain);
    } else {
      source.connect(audioContextRef.current.destination);
    }

    source.start(audioContextRef.current.currentTime);
  }, [generateAudioChunk]);

  useEffect(() => {
    simulatorRef.current = new PendulumSimulator(
      timeStep,
      createPendulums([startingAngles[0], startingAngles[1]], lengths, masses),
      gravity
    );

    audioContextRef.current = new AudioContext();
    audioContextRef.current.resume()
      .then(() => playAudioChunk(1))
      .catch(console.error);

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    };
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [
    startingAngles[0],
    startingAngles[1],
    lengths[0],
    lengths[1],
    masses[0],
    masses[1],
    gravity,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return null;
}
