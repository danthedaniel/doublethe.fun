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

struct Pendulum {
    float len; // meters
    float mass; // kilograms
    float angle; // radians
    float momentum; // kg*m^2/s
};

struct PendulumPair {
    Pendulum a;
    Pendulum b;
};

PendulumPair pendulums(vec2 angles) {
    PendulumPair pair;

    pair.a.len = u_pendulum_lengths.x;
    pair.a.mass = u_pendulum_masses.x;
    pair.a.angle = angles.x;
    pair.a.momentum = 0.0;

    pair.b.len = u_pendulum_lengths.y;
    pair.b.mass = u_pendulum_masses.y;
    pair.b.angle = angles.y;
    pair.b.momentum = 0.0;

    return pair;
}

vec2 pendulumAngles(PendulumPair pair) {
    return vec2(pair.a.angle, pair.b.angle);
}

vec4 derivative(PendulumPair pair) {
    float cosDiff = cos(pair.a.angle - pair.b.angle);
    float sinDiff = sin(pair.a.angle - pair.b.angle);

    float dAngle1 =
      ((6.0 / (pair.a.mass * pair.a.len * pair.a.len)) *
        (2.0 * pair.a.momentum - 3.0 * cosDiff * pair.b.momentum)) /
      (16.0 - 9.0 * cosDiff * cosDiff);

    float dAngle2 =
      ((6.0 / (pair.b.mass * pair.b.len * pair.b.len)) *
        (8.0 * pair.b.momentum - 3.0 * cosDiff * pair.a.momentum)) /
      (16.0 - 9.0 * cosDiff * cosDiff);

    float dMomentum1 =
        ((pair.a.mass * pair.a.len * pair.a.len) / -2.0) *
        (+dAngle1 * dAngle2 * sinDiff +
        ((3.0 * u_gravity) / pair.a.len) * sin(pair.a.angle));

    float dMomentum2 =
        ((pair.b.mass * pair.b.len * pair.b.len) / -2.0) *
        (-dAngle1 * dAngle2 * sinDiff +
        ((3.0 * u_gravity) / pair.b.len) * sin(pair.b.angle));

    return vec4(dAngle1, dAngle2, dMomentum1, dMomentum2);
}

void simulateTimeStep(inout PendulumPair pair) {
    vec4 k1 = derivative(pair);
    float k1da1 = k1.x;
    float k1da2 = k1.y;
    float k1dp1 = k1.z;
    float k1dp2 = k1.w;

    float k2a1 = pair.a.angle + (k1da1 * TIME_STEP) / 2.0;
    float k2a2 = pair.b.angle + (k1da2 * TIME_STEP) / 2.0;
    float k2p1 = pair.a.momentum + (k1dp1 * TIME_STEP) / 2.0;
    float k2p2 = pair.b.momentum + (k1dp2 * TIME_STEP) / 2.0;

    PendulumPair k2pendulums;
    k2pendulums.a.len = pair.a.len;
    k2pendulums.a.mass = pair.a.mass;
    k2pendulums.a.angle = k2a1;
    k2pendulums.a.momentum = k2p1;
    k2pendulums.b.len = pair.b.len;
    k2pendulums.b.mass = pair.b.mass;
    k2pendulums.b.angle = k2a2;
    k2pendulums.b.momentum = k2p2;

    vec4 k2 = derivative(k2pendulums);
    float k2da1 = k2.x;
    float k2da2 = k2.y;
    float k2dp1 = k2.z;
    float k2dp2 = k2.w;

    float k3a1 = pair.a.angle + (k2da1 * TIME_STEP) / 2.0;
    float k3a2 = pair.b.angle + (k2da2 * TIME_STEP) / 2.0;
    float k3p1 = pair.a.momentum + (k2dp1 * TIME_STEP) / 2.0;
    float k3p2 = pair.b.momentum + (k2dp2 * TIME_STEP) / 2.0;

    PendulumPair k3pendulums;
    k3pendulums.a.len = pair.a.len;
    k3pendulums.a.mass = pair.a.mass;
    k3pendulums.a.angle = k3a1;
    k3pendulums.a.momentum = k3p1;
    k3pendulums.b.len = pair.b.len;
    k3pendulums.b.mass = pair.b.mass;
    k3pendulums.b.angle = k3a2;
    k3pendulums.b.momentum = k3p2;

    vec4 k3 = derivative(k3pendulums);
    float k3da1 = k3.x;
    float k3da2 = k3.y;
    float k3dp1 = k3.z;
    float k3dp2 = k3.w;

    float k4a1 = pair.a.angle + (k3da1 * TIME_STEP);
    float k4a2 = pair.b.angle + (k3da2 * TIME_STEP);
    float k4p1 = pair.a.momentum + (k3dp1 * TIME_STEP);
    float k4p2 = pair.b.momentum + (k3dp2 * TIME_STEP);

    PendulumPair k4pendulums;
    k4pendulums.a.len = pair.a.len;
    k4pendulums.a.mass = pair.a.mass;
    k4pendulums.a.angle = k4a1;
    k4pendulums.a.momentum = k4p1;
    k4pendulums.b.len = pair.b.len;
    k4pendulums.b.mass = pair.b.mass;
    k4pendulums.b.angle = k4a2;
    k4pendulums.b.momentum = k4p2;

    vec4 k4 = derivative(k4pendulums);
    float k4da1 = k4.x;
    float k4da2 = k4.y;
    float k4dp1 = k4.z;
    float k4dp2 = k4.w;

    pair.a.angle = pair.a.angle + (k1da1 + 2.0 * k2da1 + 2.0 * k3da1 + k4da1) * (TIME_STEP / 6.0);
    pair.a.momentum = pair.a.momentum + (k1dp1 + 2.0 * k2dp1 + 2.0 * k3dp1 + k4dp1) * (TIME_STEP / 6.0);
    pair.b.angle = pair.b.angle + (k1da2 + 2.0 * k2da2 + 2.0 * k3da2 + k4da2) * (TIME_STEP / 6.0);
    pair.b.momentum = pair.b.momentum + (k1dp2 + 2.0 * k2dp2 + 2.0 * k3dp2 + k4dp2) * (TIME_STEP / 6.0);
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
        simulateTimeStep(referencePendulums);
        simulateTimeStep(adjacentPendulums);
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
