#version 300 es

precision mediump float;

in vec2 a_position;

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
}
