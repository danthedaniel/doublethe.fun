// JS port of utils/shaders/display.frag so DOM elements can be colored with
// the same divergence scheme as the WebGL map.

function fract(x: number): number {
  return x - Math.floor(x);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const channel = (k: number) =>
    v * mix(1, clamp01(Math.abs(fract(h + k) * 6 - 3) - 1), s);
  return [channel(1), channel(2 / 3), channel(1 / 3)];
}

// `reference` and `adjacent` are the [angle1, angle2] of a simulation and its
// neighbor. Mirrors display.frag exactly, including the quirk of adding 0.5 to
// an angle in radians and using it directly as a hue fraction (hsv2rgb wraps
// it via fract); the shader's normalize() is a no-op under atan2 and the
// (0, 0) case it would turn into NaN is guarded instead.
export function divergenceColor(
  reference: [number, number],
  adjacent: [number, number],
): string {
  const d1 = Math.abs(reference[0] - adjacent[0]);
  const d2 = Math.abs(reference[1] - adjacent[1]);

  const hue = (d1 === 0 && d2 === 0 ? 0 : Math.atan2(d2, d1)) + 0.5;
  const saturation = 0.9;
  // Can exceed 1 for strongly diverged pairs; the GLSL output is implicitly
  // clamped, so clamp the channels below.
  const value = (d1 + d2) / (2 * 2 * Math.PI);

  const [r, g, b] = hsv2rgb(hue, saturation, value).map(clamp01);
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}
