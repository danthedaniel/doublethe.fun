#version 300 es

precision highp float;

uniform vec2 u_sim_resolution; // State texture size in texels
uniform vec2 u_size; // Size of angle space
uniform vec2 u_center; // Center in angle space

// State layout: angle1, momentum1, angle2, momentum2
layout(location = 0) out vec4 referenceState;
layout(location = 1) out vec4 adjacentState;

const float EPSILON = 0.0001;

void main() {
    // Normalize coordinates to -0.5..0.5
    vec2 uv = gl_FragCoord.xy / u_sim_resolution - vec2(0.5);
    vec2 angles = uv * u_size + u_center;

    referenceState = vec4(angles.x, 0.0, angles.y, 0.0);
    adjacentState = vec4(angles.x + EPSILON, 0.0, angles.y + EPSILON, 0.0);
}
