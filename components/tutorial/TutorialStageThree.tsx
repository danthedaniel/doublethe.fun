import PendulumPairStage from "./PendulumPairStage";

// A non-trivial stable region: differ by a degree yet track each other.
export default function TutorialStageThree() {
  return (
    <PendulumPairStage
      sims={[
        [241, 289],
        [242, 290],
      ]}
    >
      There are more interesting cases. These pendulums start off differed by a couple
      of degrees, but maintain a similar cycle for a long time.
    </PendulumPairStage>
  );
}
