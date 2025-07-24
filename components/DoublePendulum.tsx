import { useCallback, useEffect, useRef, useState } from "react";
import { useWindowSize } from "~/hooks/useWindowSize";
import { createPendulums, PendulumPair, PendulumSimulator } from "./pendulumSimulation";

const timeStep = 0.001;

interface DoublePendulumProps {
  canvasSize: [number, number];
  canvasCenter: [number, number];
  startingAngles: [number, number];
  gravity: number;
  lengths: [number, number];
  masses: [number, number];
}

const nodeRadius = 0.006;
const nodeStrokeWidth = 0.002;
const lineWidth = 0.012;
const lengthScale = 0.05;

interface Coordinate {
  x: number;
  y: number;
}

export default function DoublePendulum({
  canvasSize,
  canvasCenter,
  startingAngles,
  gravity,
  lengths: lengthsProp,
  masses: massesProp,
}: DoublePendulumProps) {
  const windowSize = useWindowSize();
  const scale = Math.min(windowSize.width, windowSize.height);

  const animationFuncRef = useRef<((timestamp: number) => void) | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const simulatorRef = useRef<PendulumSimulator | null>(null);
  const [pendulums, setPendulums] = useState<PendulumPair | null>(null);

  const animate = useCallback(
    (timestamp: number) => {
      if (!simulatorRef.current) {
        throw new Error("Simulator not initialized");
      }

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
        simulatorRef.current.step();
      }

      lastTimestampRef.current = timestamp;
      animationFrameRef.current = requestAnimationFrame((timestamp) =>
        animationFuncRef?.current?.(timestamp)
      );

      // Trigger a re-render
      setPendulums(simulatorRef.current.getState());
    },
    []
  );

  useEffect(() => {
    animationFuncRef.current = animate;
  }, [animate]);

  // Start animation on property changes
  useEffect(() => {
    simulatorRef.current = new PendulumSimulator(
      timeStep,
      createPendulums([startingAngles[0], startingAngles[1]], lengthsProp, massesProp),
      gravity
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
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [
    gravity,
    startingAngles[0],
    startingAngles[1],
    lengthsProp[0],
    lengthsProp[1],
    massesProp[0],
    massesProp[1],
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

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
