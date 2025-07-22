interface Pendulum {
  angle: number;
  momentum: number;
  length: number;
  mass: number;
}

export type PendulumPair = [Pendulum, Pendulum];

export function createPendulums(
  startingAngles: [number, number],
  lengths: [number, number],
  masses: [number, number]
): PendulumPair {
  return [
    {
      angle: startingAngles[0],
      momentum: 0,
      length: lengths[0],
      mass: masses[0],
    },
    {
      angle: startingAngles[1],
      momentum: 0,
      length: lengths[1],
      mass: masses[1],
    },
  ];
}

export class PendulumSimulator {
  constructor(
    private timeStep: number,
    private pendulums: PendulumPair,
    private gravity: number,
  ) {}

  getState(): PendulumPair {
    return JSON.parse(JSON.stringify(this.pendulums));
  }

  step() {
    const [k1da1, k1da2, k1dp1, k1dp2] = this.derivative(this.pendulums);

    const k2a1 = this.pendulums[0].angle + (k1da1 * this.timeStep) / 2;
    const k2a2 = this.pendulums[1].angle + (k1da2 * this.timeStep) / 2;
    const k2p1 = this.pendulums[0].momentum + (k1dp1 * this.timeStep) / 2;
    const k2p2 = this.pendulums[1].momentum + (k1dp2 * this.timeStep) / 2;

    const k2pendulums: PendulumPair = [
      { ...this.pendulums[0], angle: k2a1, momentum: k2p1 },
      { ...this.pendulums[1], angle: k2a2, momentum: k2p2 },
    ];
    const [k2da1, k2da2, k2dp1, k2dp2] = this.derivative(k2pendulums);

    const k3a1 = this.pendulums[0].angle + (k2da1 * this.timeStep) / 2;
    const k3a2 = this.pendulums[1].angle + (k2da2 * this.timeStep) / 2;
    const k3p1 = this.pendulums[0].momentum + (k2dp1 * this.timeStep) / 2;
    const k3p2 = this.pendulums[1].momentum + (k2dp2 * this.timeStep) / 2;

    const k3pendulums: PendulumPair = [
      { ...this.pendulums[0], angle: k3a1, momentum: k3p1 },
      { ...this.pendulums[1], angle: k3a2, momentum: k3p2 },
    ];
    const [k3da1, k3da2, k3dp1, k3dp2] = this.derivative(k3pendulums);

    const k4a1 = this.pendulums[0].angle + k3da1 * this.timeStep;
    const k4a2 = this.pendulums[1].angle + k3da2 * this.timeStep;
    const k4p1 = this.pendulums[0].momentum + k3dp1 * this.timeStep;
    const k4p2 = this.pendulums[1].momentum + k3dp2 * this.timeStep;

    const k4pendulums: PendulumPair = [
      { ...this.pendulums[0], angle: k4a1, momentum: k4p1 },
      { ...this.pendulums[1], angle: k4a2, momentum: k4p2 },
    ];
    const [k4da1, k4da2, k4dp1, k4dp2] = this.derivative(k4pendulums);

    this.pendulums[0].angle =
      this.pendulums[0].angle +
      ((k1da1 + 2 * k2da1 + 2 * k3da1 + k4da1) * this.timeStep) / 6;
    this.pendulums[0].momentum =
      this.pendulums[0].momentum +
      ((k1dp1 + 2 * k2dp1 + 2 * k3dp1 + k4dp1) * this.timeStep) / 6;

    this.pendulums[1].angle =
      this.pendulums[1].angle +
      ((k1da2 + 2 * k2da2 + 2 * k3da2 + k4da2) * this.timeStep) / 6;
    this.pendulums[1].momentum =
      this.pendulums[1].momentum +
      ((k1dp2 + 2 * k2dp2 + 2 * k3dp2 + k4dp2) * this.timeStep) / 6;

    return this.getState();
  }

  private derivative(pendulums: PendulumPair) {
    const cosDiff = Math.cos(pendulums[0].angle - pendulums[1].angle);
    const sinDiff = Math.sin(pendulums[0].angle - pendulums[1].angle);

    const dAngle1 =
      ((6 / (pendulums[0].mass * pendulums[0].length * pendulums[0].length)) *
        (2 * pendulums[0].momentum - 3 * cosDiff * pendulums[1].momentum)) /
      (16 - 9 * cosDiff * cosDiff);

    const dAngle2 =
      ((6 / (pendulums[1].mass * pendulums[1].length * pendulums[1].length)) *
        (8 * pendulums[1].momentum - 3 * cosDiff * pendulums[0].momentum)) /
      (16 - 9 * cosDiff * cosDiff);

    const dMomentum1 =
      ((pendulums[0].mass * pendulums[0].length * pendulums[0].length) / -2) *
      (+dAngle1 * dAngle2 * sinDiff +
        ((3 * this.gravity) / pendulums[0].length) * Math.sin(pendulums[0].angle));

    const dMomentum2 =
      ((pendulums[1].mass * pendulums[1].length * pendulums[1].length) / -2) *
      (-dAngle1 * dAngle2 * sinDiff +
        ((3 * this.gravity) / pendulums[1].length) * Math.sin(pendulums[1].angle));

    return [dAngle1, dAngle2, dMomentum1, dMomentum2];
  }
}
