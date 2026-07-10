import { useRef } from "react";
import type { PendulumPair } from "~/utils/pendulumSimulation";

interface MiniPendulumProps {
  pendulums: PendulumPair;
}

// Fixed drawing coordinate system; CSS controls the displayed size.
const VIEWBOX = 200;
const PIVOT = VIEWBOX / 2;
// Pixels per unit of pendulum length. Both arms fully extended span 2 units,
// so this keeps the swing comfortably inside the viewBox.
const LENGTH_SCALE = 42;
const armWidth = 8;
const nodeRadius = 4;
const nodeStrokeWidth = 1.5;

// Trailing path traced by the tip. It spans the last few seconds and fades out
// with age, capped below full opacity so it always reads as translucent.
const TRAIL_DURATION_MS = 3000;
const MAX_TRAIL_OPACITY = 0.8;
const trailWidth = 3;

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

// A small, self-contained SVG rendering of one double pendulum. Angle 0 hangs
// straight down; the +PI/2 offset and screen-down Y match the render math in
// DoublePendulum.tsx so poses read the same as the main visualization.
export default function MiniPendulum({ pendulums }: MiniPendulumProps) {
  const trailRef = useRef<TrailPoint[]>([]);

  const firstX =
    PIVOT + pendulums[0].length * Math.cos(pendulums[0].angle + Math.PI / 2) * LENGTH_SCALE;
  const firstY =
    PIVOT + pendulums[0].length * Math.sin(pendulums[0].angle + Math.PI / 2) * LENGTH_SCALE;

  const secondX =
    firstX + pendulums[1].length * Math.cos(pendulums[1].angle + Math.PI / 2) * LENGTH_SCALE;
  const secondY =
    firstY + pendulums[1].length * Math.sin(pendulums[1].angle + Math.PI / 2) * LENGTH_SCALE;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const trail = trailRef.current;
  const last = trail[trail.length - 1];
  if (!last || last.x !== secondX || last.y !== secondY) {
    trail.push({ x: secondX, y: secondY, t: now });
  }
  while (trail.length > 0 && now - trail[0].t > TRAIL_DURATION_MS) {
    trail.shift();
  }

  const trailSegments = [];
  for (let i = 1; i < trail.length; i++) {
    const opacity = MAX_TRAIL_OPACITY * (1 - (now - trail[i].t) / TRAIL_DURATION_MS);
    if (opacity <= 0) continue;
    trailSegments.push(
      <path
        key={i}
        d={`M${trail[i - 1].x},${trail[i - 1].y}L${trail[i].x},${trail[i].y}`}
        stroke="rgb(0,220,0)"
        strokeOpacity={opacity}
        strokeWidth={trailWidth}
        fill="none"
      />
    );
  }

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      className="w-full h-auto"
      style={{ strokeLinecap: "round", strokeLinejoin: "round" }}
    >
      <title>Double pendulum</title>
      {trailSegments}
      <path
        d={`M${PIVOT},${PIVOT}L${firstX},${firstY}`}
        stroke="rgb(255,0,0)"
        strokeWidth={armWidth}
        fill="none"
      />
      <path
        d={`M${firstX},${firstY}L${secondX},${secondY}`}
        stroke="rgb(0,200,0)"
        strokeWidth={armWidth}
        fill="none"
      />
      <circle
        cx={PIVOT}
        cy={PIVOT}
        r={nodeRadius}
        fill="white"
        stroke="black"
        strokeWidth={nodeStrokeWidth}
      />
      <circle
        cx={firstX}
        cy={firstY}
        r={nodeRadius}
        fill="white"
        stroke="black"
        strokeWidth={nodeStrokeWidth}
      />
      <circle
        cx={secondX}
        cy={secondY}
        r={nodeRadius}
        fill="white"
        stroke="black"
        strokeWidth={nodeStrokeWidth}
      />
    </svg>
  );
}
