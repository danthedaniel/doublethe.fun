import { useCallback, useEffect, useRef, useState } from "react";
import { defaultUniforms } from "~/utils/defaultUniforms";
import {
  createPendulums,
  PendulumPair,
  PendulumSimulator,
} from "~/utils/pendulumSimulation";

const DEFAULT_TIME_STEP = 0.001;

// Cap on simulation steps per frame so a long frame gap (e.g. a suspended
// tab) doesn't fast-forward the simulation to catch up.
const MAX_STEPS_PER_FRAME = 100;

interface SimulationClockOptions {
  timeStep?: number;
  gravity?: number;
  lengths?: [number, number];
  masses?: [number, number];
}

export interface SimulationClock {
  // One entry per starting configuration, refreshed every animation frame.
  states: PendulumPair[];
  // Simulation time in seconds; exactly stepsTaken * timeStep.
  time: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  reset: () => void;
}

// Drives any number of pendulum simulators from a single animation-frame
// clock so they advance in lockstep and share one time index. Starts paused
// at the initial conditions. The starting configuration is captured on mount;
// remount (e.g. via a React key) to change it.
export function useSimulationClock(
  anglesList: [number, number][],
  options: SimulationClockOptions = {},
): SimulationClock {
  const timeStep = options.timeStep ?? DEFAULT_TIME_STEP;
  const gravity = options.gravity ?? defaultUniforms.gravity;
  const lengths = options.lengths ?? defaultUniforms.pendulumLengths;
  const masses = options.masses ?? defaultUniforms.pendulumMasses;

  // The starting configuration is captured once; later prop changes (e.g. a
  // fresh anglesList array each render) are ignored — remount to change it.
  const configRef = useRef({ anglesList, timeStep, gravity, lengths, masses });

  const buildSimulators = useCallback(() => {
    const config = configRef.current;
    return config.anglesList.map(
      (angles) =>
        new PendulumSimulator(
          config.timeStep,
          createPendulums(angles, config.lengths, config.masses),
          config.gravity,
        ),
    );
  }, []);

  const simulatorsRef = useRef<PendulumSimulator[]>([]);
  const [states, setStates] = useState<PendulumPair[]>(() =>
    anglesList.map((angles) => createPendulums(angles, lengths, masses)),
  );
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const stepsTakenRef = useRef(0);
  // Fractional-step remainder carried between frames so the displayed time
  // tracks wall time instead of drifting by the dropped remainder.
  const carryRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animateRef = useRef<(timestamp: number) => void>(() => {});

  const requestFrame = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame((timestamp) =>
      animateRef.current(timestamp),
    );
  }, []);

  const animate = useCallback(
    (timestamp: number) => {
      requestFrame();

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
        return;
      }

      const config = configRef.current;
      const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = timestamp;

      const wantedSteps = Math.floor(
        (deltaSeconds + carryRef.current) / config.timeStep,
      );
      const steps = Math.min(wantedSteps, MAX_STEPS_PER_FRAME);
      carryRef.current =
        steps === wantedSteps
          ? deltaSeconds + carryRef.current - steps * config.timeStep
          : 0;
      if (steps === 0) return;

      const simulators = simulatorsRef.current;
      for (const simulator of simulators) {
        for (let i = 0; i < steps; i++) {
          simulator.step();
        }
      }
      stepsTakenRef.current += steps;

      setStates(simulators.map((simulator) => simulator.getState()));
      setTime(stepsTakenRef.current * config.timeStep);
    },
    [requestFrame],
  );

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  // Build the simulators once the component is mounted.
  useEffect(() => {
    simulatorsRef.current = buildSimulators();
  }, [buildSimulators]);

  const stopLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const play = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    lastTimestampRef.current = null;
    requestFrame();
    setPlaying(true);
  }, [requestFrame]);

  const pause = useCallback(() => {
    stopLoop();
    setPlaying(false);
  }, [stopLoop]);

  const reset = useCallback(() => {
    stopLoop();
    simulatorsRef.current = buildSimulators();
    stepsTakenRef.current = 0;
    carryRef.current = 0;
    lastTimestampRef.current = null;
    setStates(simulatorsRef.current.map((simulator) => simulator.getState()));
    setTime(0);
    setPlaying(false);
  }, [stopLoop, buildSimulators]);

  useEffect(() => stopLoop, [stopLoop]);

  return { states, time, playing, play, pause, reset };
}
