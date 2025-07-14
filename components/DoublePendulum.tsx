import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowSize } from "~/hooks/useWindowSize";

function deriviative(
  pendulums: PendulumPair,
  gravity: number
): [number, number, number, number] {
  let cos12 = Math.cos(pendulums[0].angle - pendulums[1].angle);
  let sin12 = Math.sin(pendulums[0].angle - pendulums[1].angle);
  let da1 =
    ((6 / (pendulums[0].mass * pendulums[0].length * pendulums[0].length)) *
      (2 * pendulums[0].momentum - 3 * cos12 * pendulums[1].momentum)) /
    (16 - 9 * cos12 * cos12);
  let da2 =
    ((6 / (pendulums[1].mass * pendulums[1].length * pendulums[1].length)) *
      (8 * pendulums[1].momentum - 3 * cos12 * pendulums[0].momentum)) /
    (16 - 9 * cos12 * cos12);
  let dp1 =
    ((pendulums[0].mass * pendulums[0].length * pendulums[0].length) / -2) *
    (+da1 * da2 * sin12 +
      ((3 * gravity) / pendulums[0].length) * Math.sin(pendulums[0].angle));
  let dp2 =
    ((pendulums[1].mass * pendulums[1].length * pendulums[1].length) / -2) *
    (-da1 * da2 * sin12 +
      ((3 * gravity) / pendulums[1].length) * Math.sin(pendulums[1].angle));
  return [da1, da2, dp1, dp2];
}

// Update pendulum by timestep
function rk4(
  pendulums: PendulumPair,
  gravity: number,
  dt: number
): PendulumPair {
  let [k1da1, k1da2, k1dp1, k1dp2] = deriviative(pendulums, gravity);

  let k2a1 = pendulums[0].angle + (k1da1 * dt) / 2;
  let k2a2 = pendulums[1].angle + (k1da2 * dt) / 2;
  let k2p1 = pendulums[0].momentum + (k1dp1 * dt) / 2;
  let k2p2 = pendulums[1].momentum + (k1dp2 * dt) / 2;

  let k2pendulums: PendulumPair = [
    { ...pendulums[0], angle: k2a1, momentum: k2p1 },
    { ...pendulums[1], angle: k2a2, momentum: k2p2 },
  ];
  let [k2da1, k2da2, k2dp1, k2dp2] = deriviative(k2pendulums, gravity);

  let k3a1 = pendulums[0].angle + (k2da1 * dt) / 2;
  let k3a2 = pendulums[1].angle + (k2da2 * dt) / 2;
  let k3p1 = pendulums[0].momentum + (k2dp1 * dt) / 2;
  let k3p2 = pendulums[1].momentum + (k2dp2 * dt) / 2;

  let k3pendulums: PendulumPair = [
    { ...pendulums[0], angle: k3a1, momentum: k3p1 },
    { ...pendulums[1], angle: k3a2, momentum: k3p2 },
  ];
  let [k3da1, k3da2, k3dp1, k3dp2] = deriviative(k3pendulums, gravity);

  let k4a1 = pendulums[0].angle + k3da1 * dt;
  let k4a2 = pendulums[1].angle + k3da2 * dt;
  let k4p1 = pendulums[0].momentum + k3dp1 * dt;
  let k4p2 = pendulums[1].momentum + k3dp2 * dt;

  let k4pendulums: PendulumPair = [
    { ...pendulums[0], angle: k4a1, momentum: k4p1 },
    { ...pendulums[1], angle: k4a2, momentum: k4p2 },
  ];
  let [k4da1, k4da2, k4dp1, k4dp2] = deriviative(k4pendulums, gravity);

  return [
    {
      ...pendulums[0],
      angle:
        pendulums[0].angle + ((k1da1 + 2 * k2da1 + 2 * k3da1 + k4da1) * dt) / 6,
      momentum:
        pendulums[0].momentum +
        ((k1dp1 + 2 * k2dp1 + 2 * k3dp1 + k4dp1) * dt) / 6,
    },
    {
      ...pendulums[1],
      angle:
        pendulums[1].angle + ((k1da2 + 2 * k2da2 + 2 * k3da2 + k4da2) * dt) / 6,
      momentum:
        pendulums[1].momentum +
        ((k1dp2 + 2 * k2dp2 + 2 * k3dp2 + k4dp2) * dt) / 6,
    },
  ];
}

interface DoublePendulumProps {
  position: [number, number];
  startingAngles: [number, number];
  gravity: number;
  lengths: [number, number];
  masses: [number, number];
}

const nodeRadius = 0.006;
const nodeStrokeWidth = 0.002;
const lineWidth = 0.012;
const lengthScale = 0.05;

const timeStep = 0.001;

interface Coordinates {
  x: number;
  y: number;
}

interface Pendulum {
  angle: number;
  momentum: number;
  length: number;
  mass: number;
}

type PendulumPair = [Pendulum, Pendulum];

function createPendulums(
  startingAngles: [number, number],
  lengths: [number, number],
  masses: [number, number]
): PendulumPair {
  return [
    {
      angle: startingAngles[0],
      momentum: 0,
      length: lengths[0],
      mass: masses[0],
    },
    {
      angle: startingAngles[1],
      momentum: 0,
      length: lengths[1],
      mass: masses[1],
    },
  ];
}

export default function DoublePendulum({
  position,
  startingAngles,
  gravity,
  lengths: lengthsProp,
  masses: massesProp,
}: DoublePendulumProps) {
  const { width, height } = useWindowSize();
  const scale = Math.min(width, height);

  const animationFuncRef = useRef<((timestamp: number) => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const pendulumsRef = useRef<PendulumPair>(
    createPendulums(startingAngles, lengthsProp, massesProp)
  );
  const [pendulums, setPendulums] = useState<PendulumPair>(
    pendulumsRef.current
  );

  const firstNode: Coordinates = {
    x: position[0] * width,
    y: position[1] * height,
  };

  // prettier-ignore
  const secondNode: Coordinates = {
    x: firstNode.x + pendulums[0].length * Math.cos(pendulums[0].angle + Math.PI / 2) * lengthScale * scale,
    y: firstNode.y + pendulums[0].length * Math.sin(pendulums[0].angle + Math.PI / 2) * lengthScale * scale,
  };

  // prettier-ignore
  const thirdNode: Coordinates = {
    x: secondNode.x + pendulums[1].length * Math.cos(pendulums[1].angle + Math.PI / 2) * lengthScale * scale,
    y: secondNode.y + pendulums[1].length * Math.sin(pendulums[1].angle + Math.PI / 2) * lengthScale * scale,
  };

  const simulateTimeStep = useCallback(
    (pendulums: PendulumPair) => rk4(pendulums, gravity, timeStep),
    [gravity]
  );

  const animate = useCallback(
    (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
        animationFrameRef.current = requestAnimationFrame((timestamp) =>
          animationFuncRef?.current?.(timestamp)
        );
        return;
      }

      const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
      const steps = Math.floor(deltaSeconds / timeStep);

      for (let i = 0; i < steps; i++) {
        pendulumsRef.current = simulateTimeStep(pendulumsRef.current);
      }

      // Trigger a re-render
      setPendulums(pendulumsRef.current);
      lastTimestampRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame((timestamp) =>
        animationFuncRef?.current?.(timestamp)
      );
    },
    [simulateTimeStep]
  );

  useEffect(() => {
    animationFuncRef.current = animate;
  }, [animate]);

  // Start animation on property changes
  useEffect(() => {
    pendulumsRef.current = createPendulums(
      startingAngles,
      lengthsProp,
      massesProp
    );

    animationFrameRef.current = requestAnimationFrame((timestamp) =>
      animationFuncRef?.current?.(timestamp)
    );

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      lastTimestampRef.current = null;
    };
  }, [
    gravity,
    startingAngles[0],
    startingAngles[1],
    lengthsProp[0],
    lengthsProp[1],
    massesProp[0],
    massesProp[1],
    simulateTimeStep,
  ]);

  return (
    <svg
      width="100vw"
      height="100vh"
      viewBox={`0 0 ${width} ${height}`}
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        fillRule: "evenodd",
        clipRule: "evenodd",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: 1.5,
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
    >
      <path
        d={`M${firstNode.x},${firstNode.y}L${secondNode.x},${secondNode.y}`}
        style={{
          fill: "none",
          stroke: "rgb(255,0,0)",
          strokeWidth: `${lineWidth * scale}px`,
        }}
      />

      <path
        d={`M${secondNode.x},${secondNode.y}L${thirdNode.x},${thirdNode.y}`}
        style={{
          fill: "none",
          stroke: "rgb(0,255,0)",
          strokeWidth: `${lineWidth * scale}px`,
        }}
      />

      <circle
        cx={firstNode.x}
        cy={firstNode.y}
        r={nodeRadius * scale}
        style={{
          fill: "white",
          stroke: "black",
          strokeWidth: `${nodeStrokeWidth * scale}px`,
        }}
      />

      <circle
        cx={secondNode.x}
        cy={secondNode.y}
        r={nodeRadius * scale}
        style={{
          fill: "white",
          stroke: "black",
          strokeWidth: `${nodeStrokeWidth * scale}px`,
        }}
      />
    </svg>
  );
}
