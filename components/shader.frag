#version 300 es

precision mediump float;

uniform vec2 u_resolution; // Canvas resolution
uniform float u_pixel_ratio; // Pixel ratio
uniform vec2 u_size; // Size of angle space
uniform vec2 u_center; // Center in angle space
uniform float u_gravity; // Acceleration due to gravity (m/s^2)
uniform vec2 u_pendulum_lengths;
uniform vec2 u_pendulum_masses;
uniform float u_step_count;

// Output color
out vec4 fragColor;

const float PI = 3.14159265358979323846;
const float TIME_STEP = 0.03; // seconds
const float EPSILON = 0.0001;

struct PendulumPair {
    vec4 a; // length, mass, angle, momentum
    vec4 b; // length, mass, angle, momentum
};

PendulumPair pendulums(vec2 angles) {
    PendulumPair pair;

    pair.a.x = u_pendulum_lengths.x;
    pair.a.y = u_pendulum_masses.x;
    pair.a.z = angles.x;
    pair.a.w = 0.0;

    pair.b.x = u_pendulum_lengths.y;
    pair.b.y = u_pendulum_masses.y;
    pair.b.z = angles.y;
    pair.b.w = 0.0;

    return pair;
}

vec2 pendulumAngles(PendulumPair pair) {
    return vec2(pair.a.z, pair.b.z);
}

vec4 derivative(vec4 a, vec4 b) {
    float cosDiff = cos(a.z - b.z);
    float sinDiff = sin(a.z - b.z);

    float dAngle1 =
      ((6.0 / (a.y * a.x * a.x)) *
        (2.0 * a.w - 3.0 * cosDiff * b.w)) /
      (16.0 - 9.0 * cosDiff * cosDiff);

    float dAngle2 =
      ((6.0 / (b.y * b.x * b.x)) *
        (8.0 * b.w - 3.0 * cosDiff * a.w)) /
      (16.0 - 9.0 * cosDiff * cosDiff);

    float dMomentum1 =
        ((a.y * a.x * a.x) / -2.0) *
        (+dAngle1 * dAngle2 * sinDiff +
        ((3.0 * u_gravity) / a.x) * sin(a.z));

    float dMomentum2 =
        ((b.y * b.x * b.x) / -2.0) *
        (-dAngle1 * dAngle2 * sinDiff +
        ((3.0 * u_gravity) / b.x) * sin(b.z));

    return vec4(dAngle1, dAngle2, dMomentum1, dMomentum2);
}

void simulateTimeStep(inout vec4 a, inout vec4 b) {
    vec4 k1 = derivative(a, b);
    float k1da1 = k1.x;
    float k1da2 = k1.y;
    float k1dp1 = k1.z;
    float k1dp2 = k1.w;

    float k2a1 = a.z + (k1da1 * TIME_STEP) / 2.0;
    float k2a2 = b.z + (k1da2 * TIME_STEP) / 2.0;
    float k2p1 = a.w + (k1dp1 * TIME_STEP) / 2.0;
    float k2p2 = b.w + (k1dp2 * TIME_STEP) / 2.0;

    vec4 k2pendulumA = vec4(a.x, a.y, k2a1, k2p1);
    vec4 k2pendulumB = vec4(b.x, b.y, k2a2, k2p2);

    vec4 k2 = derivative(k2pendulumA, k2pendulumB);
    float k2da1 = k2.x;
    float k2da2 = k2.y;
    float k2dp1 = k2.z;
    float k2dp2 = k2.w;

    float k3a1 = a.z + (k2da1 * TIME_STEP) / 2.0;
    float k3a2 = b.z + (k2da2 * TIME_STEP) / 2.0;
    float k3p1 = a.w + (k2dp1 * TIME_STEP) / 2.0;
    float k3p2 = b.w + (k2dp2 * TIME_STEP) / 2.0;

    vec4 k3pendulumA = vec4(a.x, a.y, k3a1, k3p1);
    vec4 k3pendulumB = vec4(b.x, b.y, k3a2, k3p2);

    vec4 k3 = derivative(k3pendulumA, k3pendulumB);
    float k3da1 = k3.x;
    float k3da2 = k3.y;
    float k3dp1 = k3.z;
    float k3dp2 = k3.w;

    float k4a1 = a.z + (k3da1 * TIME_STEP);
    float k4a2 = b.z + (k3da2 * TIME_STEP);
    float k4p1 = a.w + (k3dp1 * TIME_STEP);
    float k4p2 = b.w + (k3dp2 * TIME_STEP);

    vec4 k4pendulumA = vec4(a.x, a.y, k4a1, k4p1);
    vec4 k4pendulumB = vec4(b.x, b.y, k4a2, k4p2);

    vec4 k4 = derivative(k4pendulumA, k4pendulumB);
    float k4da1 = k4.x;
    float k4da2 = k4.y;
    float k4dp1 = k4.z;
    float k4dp2 = k4.w;

    a.z = a.z + (k1da1 + 2.0 * k2da1 + 2.0 * k3da1 + k4da1) * (TIME_STEP / 6.0);
    a.w = a.w + (k1dp1 + 2.0 * k2dp1 + 2.0 * k3dp1 + k4dp1) * (TIME_STEP / 6.0);
    b.z = b.z + (k1da2 + 2.0 * k2da2 + 2.0 * k3da2 + k4da2) * (TIME_STEP / 6.0);
    b.w = b.w + (k1dp2 + 2.0 * k2dp2 + 2.0 * k3dp2 + k4dp2) * (TIME_STEP / 6.0);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    // Normalize coordinates to -0.5..0.5
    vec2 uv = gl_FragCoord.xy / (u_resolution.xy * vec2(u_pixel_ratio)) - vec2(0.5);

    PendulumPair referencePendulums = pendulums(uv * u_size + u_center);
    PendulumPair adjacentPendulums = pendulums(uv * u_size + u_center + vec2(EPSILON));

    for (float i = 0.0; i < u_step_count; i++) {
        simulateTimeStep(referencePendulums.a, referencePendulums.b);
        simulateTimeStep(adjacentPendulums.a, adjacentPendulums.b);
    }

    vec2 angleDifferences = abs(
        pendulumAngles(referencePendulums) -
        pendulumAngles(adjacentPendulums)
    );
    vec2 normalizedAngleDifferences = normalize(angleDifferences);

    float hue = atan(normalizedAngleDifferences.y, normalizedAngleDifferences.x) + 0.5;
    float saturation = 0.9;
    float value = (angleDifferences.x + angleDifferences.y) / (2.0 * 2.0 * PI);
    vec3 color = hsv2rgb(vec3(hue, saturation, value));

    fragColor = vec4(color, 1.0);
}
