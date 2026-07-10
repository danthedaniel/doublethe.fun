import PendulumPairStage from "./PendulumPairStage";

// Two nearly-identical starts that diverge quickly — the classic chaos example.
export default function TutorialStageOne() {
  return (
    <PendulumPairStage
      sims={[
        [0, 90],
        [1, 91],
      ]}
    >
      A double pendulum is often cited as an example of a chaotic system, meaning a
      small change to the initial conditions results in a large change as the system
      progresses.
    </PendulumPairStage>
  );
}
