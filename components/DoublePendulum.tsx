import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowSize } from "~/hooks/useWindowSize";
import { createPendulums, type PendulumPair, PendulumSimulator } from "../utils/pendulumSimulation";

const timeStep = 0.001;

interface DoublePendulumProps {
  canvasSize: [number, number];
  canvasCenter: [number, number];
  startingAngles: [number, number];
  gravity: number;
  lengths: [number, number];
  masses: [number, number];
  onRemove: () => void;
}

const nodeRadius = 0.006;
const nodeStrokeWidth = 0.002;
const lineWidth = 0.012;
const lengthScale = 0.05;

// Trailing path traced by the tip. It spans the last TRAIL_DURATION_MS and is
// drawn below full opacity so it always reads as translucent.
const TRAIL_DURATION_MS = 30000;
const MAX_TRAIL_OPACITY = 0.8;
const trailWidth = 0.006;

interface Coordinate {
  x: number;
  y: number;
}

interface TrailPoint {
  // Offset from the pivot (firstNode) in pixels. Stored relative to the pivot
  // rather than as absolute screen coordinates so panning and zooming, which
  // only reposition the pivot, keep the trail attached to the tip instead of
  // dragging behind it.
  dx: number;
  dy: number;
  t: number;
}

export default function DoublePendulum({
  canvasSize,
  canvasCenter,
  startingAngles,
  gravity,
  lengths: lengthsProp,
  masses: massesProp,
  onRemove,
}: DoublePendulumProps) {
  const windowSize = useWindowSize();
  const scale = Math.min(windowSize.width, windowSize.height);

  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const simulatorRef = useRef<PendulumSimulator | null>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const [pendulums, setPendulums] = useState<PendulumPair | null>(null);

  const animate = useCallback((timestamp: number) => {
    if (!simulatorRef.current) {
      throw new Error("Simulator not initialized");
    }

    animationFrameRef.current = requestAnimationFrame(animate);

    if (lastTimestampRef.current === null) {
      lastTimestampRef.current = timestamp;
      return;
    }

    const deltaSeconds = (timestamp - lastTimestampRef.current) / 1000;
    const steps = Math.floor(deltaSeconds / timeStep);

    for (let i = 0; i < steps; i++) {
      simulatorRef.current.step();
    }

    lastTimestampRef.current = timestamp;

    // Trigger a re-render
    setPendulums(simulatorRef.current.getState());
  }, []);

  // Start animation on property changes
  useEffect(() => {
    simulatorRef.current = new PendulumSimulator(
      timeStep,
      createPendulums([startingAngles[0], startingAngles[1]], lengthsProp, massesProp),
      gravity
    );
    trailRef.current = [];

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      lastTimestampRef.current = null;
    };
  }, [
    animate,
    gravity,
    startingAngles[0],
    startingAngles[1],
    lengthsProp[0],
    lengthsProp[1],
    massesProp[0],
    massesProp[1],
  ]);

  if (!pendulums) {
    return null;
  }

  const pixelsPerRadianX = windowSize.width / canvasSize[0];
  const pixelsPerRadianY = windowSize.height / canvasSize[1];

  const bottomLeftCorner: [number, number] = [
    canvasCenter[0] - canvasSize[0] / 2,
    canvasCenter[1] - canvasSize[1] / 2,
  ];
  const radiansFromBottomLeft: [number, number] = [
    startingAngles[0] - bottomLeftCorner[0],
    startingAngles[1] - bottomLeftCorner[1],
  ];
  const pixelsFromBottomLeft: [number, number] = [
    pixelsPerRadianX * radiansFromBottomLeft[0],
    pixelsPerRadianY * radiansFromBottomLeft[1],
  ];

  const firstNode: Coordinate = {
    x: pixelsFromBottomLeft[0],
    y: windowSize.height - pixelsFromBottomLeft[1],
  };

  // prettier-ignore
  const secondNode: Coordinate = {
    x: firstNode.x + pendulums[0].length * Math.cos(pendulums[0].angle + Math.PI / 2) * lengthScale * scale,
    y: firstNode.y + pendulums[0].length * Math.sin(pendulums[0].angle + Math.PI / 2) * lengthScale * scale,
  };

  // prettier-ignore
  const thirdNode: Coordinate = {
    x: secondNode.x + pendulums[1].length * Math.cos(pendulums[1].angle + Math.PI / 2) * lengthScale * scale,
    y: secondNode.y + pendulums[1].length * Math.sin(pendulums[1].angle + Math.PI / 2) * lengthScale * scale,
  };

  const now = performance.now();
  const tipDx = thirdNode.x - firstNode.x;
  const tipDy = thirdNode.y - firstNode.y;
  const trail = trailRef.current;
  const lastTrailPoint = trail[trail.length - 1];
  if (!lastTrailPoint || lastTrailPoint.dx !== tipDx || lastTrailPoint.dy !== tipDy) {
    trail.push({ dx: tipDx, dy: tipDy, t: now });
  }
  while (trail.length > 0 && now - trail[0].t > TRAIL_DURATION_MS) {
    trail.shift();
  }

  const trailD = trail
    .map((p, i) => `${i === 0 ? "M" : "L"}${firstNode.x + p.dx},${firstNode.y + p.dy}`)
    .join("");

  return (
    <svg
      width="100vw"
      height="100vh"
      viewBox={`0 0 ${windowSize.width} ${windowSize.height}`}
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
      <title>Double pendulum</title>

      {trailD && (
        <path
          d={trailD}
          style={{
            fill: "none",
            stroke: "rgb(0,220,0)",
            strokeOpacity: MAX_TRAIL_OPACITY,
            strokeWidth: `${trailWidth * scale}px`,
          }}
        />
      )}

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
          cursor: "pointer",
          pointerEvents: "auto",
        }}
        onClick={onRemove}
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
