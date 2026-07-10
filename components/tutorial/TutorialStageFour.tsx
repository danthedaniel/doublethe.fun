import { fromTopDegrees } from "~/utils/angles";
import GridStage from "./GridStage";

// Angle step between adjacent grid cells on each axis.
const DELTA = Math.PI / 16;

// A grid of simulations centered on the stage-three region so the narrative
// connects one step to the next.
export default function TutorialStageFour() {
  return (
    <GridStage
      baseAngles={[fromTopDegrees(278) - DELTA, fromTopDegrees(290) - DELTA]}
      delta={DELTA}
    >
      We can run many of these simulations in a grid, where each axis corresponds to
      the angle of the red or green pendulum. Each cell background is colored by how
      much it differs from the angles of its neighbor — darker means more similar.
    </GridStage>
  );
}
