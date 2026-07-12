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

// [angle1, angle2, momentum1, momentum2]
type StateVector = [number, number, number, number];

export class PendulumSimulator {
  constructor(
    private timeStep: number,
    private pendulums: PendulumPair,
    private gravity: number,
  ) {}

  getState(): PendulumPair {
    return [{ ...this.pendulums[0] }, { ...this.pendulums[1] }];
  }

  // Classic RK4 integration of the state vector.
  step() {
    const y: StateVector = [
      this.pendulums[0].angle,
      this.pendulums[1].angle,
      this.pendulums[0].momentum,
      this.pendulums[1].momentum,
    ];
    const at = (k: StateVector, scale: number): StateVector => [
      y[0] + k[0] * scale,
      y[1] + k[1] * scale,
      y[2] + k[2] * scale,
      y[3] + k[3] * scale,
    ];

    const k1 = this.derivative(y);
    const k2 = this.derivative(at(k1, this.timeStep / 2));
    const k3 = this.derivative(at(k2, this.timeStep / 2));
    const k4 = this.derivative(at(k3, this.timeStep));

    this.pendulums[0].angle +=
      ((k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) * this.timeStep) / 6;
    this.pendulums[1].angle +=
      ((k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) * this.timeStep) / 6;
    this.pendulums[0].momentum +=
      ((k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]) * this.timeStep) / 6;
    this.pendulums[1].momentum +=
      ((k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]) * this.timeStep) / 6;

    return this.getState();
  }

  private derivative([a1, a2, p1, p2]: StateVector): StateVector {
    const cosDiff = Math.cos(a1 - a2);
    const sinDiff = Math.sin(a1 - a2);

    const m1 = this.pendulums[0].mass;
    const m2 = this.pendulums[1].mass;
    const l1 = this.pendulums[0].length;
    const l2 = this.pendulums[1].length;

    const alpha = (m1 / 3 + m2) * l1 * l1;
    const beta = (m2 * l2 * l2) / 3;
    const gamma = (m2 * l1 * l2) / 2;
    const det = alpha * beta - gamma * gamma * cosDiff * cosDiff;

    const dAngle1 = (beta * p1 - gamma * cosDiff * p2) / det;
    const dAngle2 = (-gamma * cosDiff * p1 + alpha * p2) / det;

    const grav1 = (m1 / 2 + m2) * l1 * this.gravity;
    const grav2 = (m2 * l2 / 2) * this.gravity;

    const dMomentum1 = -gamma * sinDiff * dAngle1 * dAngle2 - grav1 * Math.sin(a1);
    const dMomentum2 = gamma * sinDiff * dAngle1 * dAngle2 - grav2 * Math.sin(a2);

    return [dAngle1, dAngle2, dMomentum1, dMomentum2];
  }
}
