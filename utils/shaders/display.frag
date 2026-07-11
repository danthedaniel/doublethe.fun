#version 300 es

precision highp float;

uniform sampler2D u_reference_state;
uniform sampler2D u_adjacent_state;
uniform vec2 u_canvas_resolution; // Drawing buffer size in pixels
// View transform applied to the sample coordinate before sampling the cached
// state. Identity (1, 1)/(0, 0) re-displays the cached frame unchanged.
uniform vec2 u_uv_scale;  // identity: (1, 1)
uniform vec2 u_uv_offset; // identity: (0, 0)

out vec4 fragColor;

const float PI = 3.14159265358979323846;

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    // The state textures may be lower resolution than the canvas; nearest
    // filtering upscales them with the same pixelated look as before.
    vec2 uv = (gl_FragCoord.xy / u_canvas_resolution) * u_uv_scale + u_uv_offset;

    // Fragments that fall outside [0,1] are exposed when zooming out beyond the
    // cached frame. Render them black instead of letting CLAMP_TO_EDGE smear
    // the border texels outward.
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec4 reference = texture(u_reference_state, uv);
    vec4 adjacent = texture(u_adjacent_state, uv);

    vec2 angleDifferences = abs(vec2(
        reference.x - adjacent.x,
        reference.z - adjacent.z
    ));
    vec2 normalizedAngleDifferences = normalize(angleDifferences);

    float hue = atan(normalizedAngleDifferences.y, normalizedAngleDifferences.x) + 0.5;
    float saturation = 0.9;
    float value = (angleDifferences.x + angleDifferences.y) / (2.0 * 2.0 * PI);
    vec3 color = hsv2rgb(vec3(hue, saturation, value));

    fragColor = vec4(color, 1.0);
}
