import MapStage from "./MapStage";
import type { TutorialStageProps } from "./Tutorial";

// The full chaos map; finishing here leaves the tutorial for the real thing.
export default function TutorialStageFive({ onDone }: TutorialStageProps) {
  return (
    <MapStage onFinish={onDone}>
      If we shrink the grid down to pixel scale it shows a map of where the
      simulation is stable and chaotic. The darker the pixel, the more stable
      the simulation at those starting angles.
    </MapStage>
  );
}
