import type { ReactNode } from "react";
import { useSimulationClock } from "~/hooks/useSimulationClock";
import { fromTopDegrees } from "~/utils/angles";
import MiniPendulum from "./MiniPendulum";
import SimControls from "./SimControls";

// One starting configuration: the first and second pendulum angles in degrees
// clockwise from straight up.
export type PairAngles = [number, number];

interface PendulumPairStageProps {
  // Explanatory copy shown above the pendulums.
  children: ReactNode;
  // Two side-by-side configurations to compare.
  sims: [PairAngles, PairAngles];
}

// Reusable layout for stages 1-3: a paragraph of explanation over two
// side-by-side (stacked on mobile) double pendulums that start paused at their
// initial conditions.
export default function PendulumPairStage({
  children,
  sims,
}: PendulumPairStageProps) {
  const clock = useSimulationClock(
    sims.map(
      ([first, second]) =>
        [fromTopDegrees(first), fromTopDegrees(second)] as PairAngles,
    ),
  );

  return (
    <div className="flex w-full flex-col items-center gap-4 sm-tall:gap-8">
      <p className="mx-auto max-w-2xl text-center text-base sm:text-xl md:text-2xl">
        {children}
      </p>

      <div className="mx-auto grid w-full max-w-[min(48rem,58dvh)] grid-cols-2 gap-4 sm:gap-6">
        {sims.map(([first, second], index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <div className="w-full max-w-[240px]">
              <MiniPendulum pendulums={clock.states[index]} />
            </div>
            <span className="text-center font-mono text-sm text-gray-600">
              {first}° / {second}° from top
            </span>
          </div>
        ))}
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
