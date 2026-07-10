// Simulation angles measure 0 as hanging straight down and increase clockwise
// on screen (see the render math in components/DoublePendulum.tsx). The
// tutorial copy uses the friendlier "degrees clockwise from pointing straight
// up" convention; these helpers convert between the two.
export function fromTopDegrees(degrees: number): number {
  return ((degrees - 180) * Math.PI) / 180;
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
