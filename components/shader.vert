#version 300 es

precision mediump float;

in vec2 a_position;
in vec2 a_texCoord;

out vec2 v_texCoord;
out vec3 v_normal;
out vec3 v_position;

void main() {
    v_texCoord = a_texCoord;
    v_normal = vec3(0.0, 0.0, 1.0);
    v_position = vec3(a_position, 0.0);
    gl_Position = vec4(a_position, 0.0, 1.0);
}
