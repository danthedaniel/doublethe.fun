import PendulumPairStage from "./PendulumPairStage";

// The trivial stable case: both pairs hang close to straight down and stay put.
export default function TutorialStageTwo() {
  return (
    <PendulumPairStage
      sims={[
        [177, 183],
        [179, 181],
      ]}
    >
      But not all initial conditions lead to chaotic behavior. In the trivial case,
      consider two sets of pendulums both pointing close to straight down.
    </PendulumPairStage>
  );
}
