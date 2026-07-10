import type { CSSProperties, ReactNode } from "react";
import { useSimulationClock } from "~/hooks/useSimulationClock";
import { divergenceColor } from "~/utils/pendulumColor";
import MiniPendulum from "./MiniPendulum";
import SimControls from "./SimControls";

interface GridStageProps {
  // Explanatory copy shown above the grid.
  children: ReactNode;
  // Starting angles of the bottom-left displayed cell (simulation radians).
  baseAngles: [number, number];
  // Angle step between adjacent cells on each axis.
  delta: number;
}

// One extra row/column is simulated beyond the 3x3 shown so each displayed
// cell has a real neighbor (+delta on both angles) to compare against, mirroring
// the shader's adjacent-sample divergence coloring.
const DISPLAY = 3;
const LATTICE = DISPLAY + 1;

// Axis label colors match the two pendulum arms in MiniPendulum: angle1 (first
// pendulum, bottom axis) is red, angle2 (second pendulum, left axis) is green.
// The black stroke is painted behind the fill for readability over any cell.
const ANGLE1_COLOR = "rgb(255,45,45)";
const ANGLE2_COLOR = "rgb(0,200,0)";
const labelOutline: CSSProperties = {
  WebkitTextStroke: "2px black",
  paintOrder: "stroke",
  letterSpacing: "0.12em",
};

// Convert a simulation angle to "degrees clockwise from top", normalized to
// [0, 360), for the axis labels.
function topDegrees(angle: number): number {
  const deg = (angle * 180) / Math.PI + 180;
  return Math.round(((deg % 360) + 360) % 360);
}

export default function GridStage({
  children,
  baseAngles,
  delta,
}: GridStageProps) {
  const idx = (i: number, j: number) => j * LATTICE + i;

  const anglesList: [number, number][] = [];
  for (let j = 0; j < LATTICE; j++) {
    for (let i = 0; i < LATTICE; i++) {
      anglesList.push([baseAngles[0] + i * delta, baseAngles[1] + j * delta]);
    }
  }

  const clock = useSimulationClock(anglesList);

  // Rows are rendered top-down but angle2 increases upward, so display the
  // highest j first.
  const rows = [];
  for (let j = DISPLAY - 1; j >= 0; j--) {
    const cells = [];
    for (let i = 0; i < DISPLAY; i++) {
      const reference = clock.states[idx(i, j)];
      const adjacent = clock.states[idx(i + 1, j + 1)];
      const background = divergenceColor(
        [reference[0].angle, reference[1].angle],
        [adjacent[0].angle, adjacent[1].angle],
      );

      cells.push(
        <div
          key={i}
          className="aspect-square rounded p-1 transition-colors"
          style={{ backgroundColor: background }}
        >
          <MiniPendulum pendulums={reference} />
        </div>,
      );
    }

    rows.push(
      <div key={j} className="contents">
        <span
          className="flex items-center justify-end pr-2 font-mono text-xs font-bold"
          style={{ color: ANGLE2_COLOR, ...labelOutline }}
        >
          {topDegrees(baseAngles[1] + j * delta)}°
        </span>
        {cells}
      </div>,
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4 sm-tall:gap-8">
      <p className="mx-auto max-w-2xl text-center text-base sm:text-xl md:text-2xl">
        {children}
      </p>

      <div className="mx-auto w-full max-w-[min(28rem,38dvh)]">
        <div className="grid grid-cols-[auto_repeat(3,1fr)] gap-1">
          {rows}
          {/* Bottom axis: angle1 (first pendulum) labels. */}
          <span />
          {Array.from({ length: DISPLAY }, (_, i) => (
            <span
              key={i}
              className="pt-1 text-center font-mono text-xs font-bold"
              style={{ color: ANGLE1_COLOR, ...labelOutline }}
            >
              {topDegrees(baseAngles[0] + i * delta)}°
            </span>
          ))}
        </div>
      </div>

      <SimControls
        playing={clock.playing}
        time={clock.time}
        onPlayPause={clock.playing ? clock.pause : clock.play}
        onReset={clock.reset}
      />
    </div>
  );
}
