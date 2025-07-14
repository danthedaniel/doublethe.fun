#version 300 es

precision mediump float;

uniform vec2 u_resolution; // Canvas resolution
uniform vec2 u_size; // Size of angle space
uniform vec2 u_center; // Center in angle space
uniform float u_gravity; // Acceleration due to gravity (m/s^2)
uniform vec2 u_pendulum_lengths;
uniform vec2 u_pendulum_masses;
uniform float u_step_count;

// From vertex shader
in vec2 v_texCoord;
in vec3 v_normal;
in vec3 v_position;

// Output color
out vec4 fragColor;

const float PI = 3.14159265358979323846;
const float TIME_STEP = 0.025; // seconds
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

void simulateTimeStep(inout Pendulum a, inout Pendulum b) {
    float delta = a.angle - b.angle;
    float D = 16.0 - 9.0 * pow(cos(delta), 2.0);

    float thetaADot = (6.0 / (a.mass * a.len * a.len * D)) * (2.0 * a.momentum - 3.0 * cos(delta) * b.momentum);
    float thetaBDot = (6.0 / (b.mass * b.len * b.len * D)) * (8.0 * b.momentum - 3.0 * cos(delta) * a.momentum);

    float momentumADot = (-1.0 / 2.0) * a.mass * a.len * (3.0 * u_gravity * sin(a.angle) + a.len * thetaADot * thetaBDot * sin(delta));
    float momentumBDot = (-1.0 / 2.0) * b.mass * b.len * (u_gravity * sin(b.angle) - b.len * thetaADot * thetaBDot * sin(delta));

    a.angle = a.angle + thetaADot * TIME_STEP;
    a.momentum = a.momentum + momentumADot * TIME_STEP;

    b.angle = b.angle + thetaBDot * TIME_STEP;
    b.momentum = b.momentum + momentumBDot * TIME_STEP;
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    // Normalize coordinates to 0.0 - 1.0
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;

    PendulumPair referencePendulums = pendulums(uv * u_size - u_center);
    PendulumPair adjacentPendulums = pendulums(uv * u_size - u_center + vec2(EPSILON));

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
