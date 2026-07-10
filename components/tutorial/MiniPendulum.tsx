import { PendulumPair } from "~/utils/pendulumSimulation";

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

// A small, self-contained SVG rendering of one double pendulum. Angle 0 hangs
// straight down; the +PI/2 offset and screen-down Y match the render math in
// DoublePendulum.tsx so poses read the same as the main visualization.
export default function MiniPendulum({ pendulums }: MiniPendulumProps) {
  const firstX =
    PIVOT + pendulums[0].length * Math.cos(pendulums[0].angle + Math.PI / 2) * LENGTH_SCALE;
  const firstY =
    PIVOT + pendulums[0].length * Math.sin(pendulums[0].angle + Math.PI / 2) * LENGTH_SCALE;

  const secondX =
    firstX + pendulums[1].length * Math.cos(pendulums[1].angle + Math.PI / 2) * LENGTH_SCALE;
  const secondY =
    firstY + pendulums[1].length * Math.sin(pendulums[1].angle + Math.PI / 2) * LENGTH_SCALE;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      className="w-full h-auto"
      style={{ strokeLinecap: "round", strokeLinejoin: "round" }}
    >
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
