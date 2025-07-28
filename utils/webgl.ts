import fragmentShaderSource from "~/components/shader.frag";
import vertexShaderSource from "~/components/shader.vert";

export interface ShaderUniforms {
  resolution: [number, number];
  pixelRatio: number;
  size: [number, number];
  center: [number, number];
  gravity: number;
  pendulumLengths: [number, number];
  pendulumMasses: [number, number];
  stepCount: number;
}

export interface GLContext {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  positionBuffer: WebGLBuffer;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

export function initGL(
  canvas: HTMLCanvasElement,
  uniforms: ShaderUniforms
): GLContext | null {
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    console.error("WebGL2 not supported");
    return null;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);

  // Create shaders
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );

  if (!vertexShader || !fragmentShader) {
    console.error("Failed to create shaders");
    return null;
  }

  // Create program
  const program = createProgram(gl, vertexShader, fragmentShader);
  if (!program) {
    console.error("Failed to create program");
    return null;
  }

  // Create full-screen quad
  // prettier-ignore
  const positions = new Float32Array([
    -1, -1, 0, 0, // bottom-left
     1, -1, 1, 0, // bottom-right
    -1,  1, 0, 1, // top-left
     1,  1, 1, 1, // top-right
  ]);

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

  // Get attribute locations
  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  // Create VAO
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  // Set up position attribute
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(
    positionAttributeLocation,
    2,
    gl.FLOAT,
    false,
    4 * 4,
    0
  );

  gl.useProgram(program);
  setUniforms(gl, program, uniforms);

  return { gl, program, vao, vertexShader, fragmentShader, positionBuffer };
}

export function setUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  uniforms: ShaderUniforms
) {
  gl.uniform2f(
    gl.getUniformLocation(program, "u_resolution"),
    uniforms.resolution[0],
    uniforms.resolution[1]
  );
  gl.uniform1f(
    gl.getUniformLocation(program, "u_pixel_ratio"),
    uniforms.pixelRatio
  );
  gl.uniform2f(
    gl.getUniformLocation(program, "u_size"),
    uniforms.size[0],
    uniforms.size[1]
  );
  gl.uniform2f(
    gl.getUniformLocation(program, "u_center"),
    uniforms.center[0],
    uniforms.center[1]
  );
  // prettier-ignore
  gl.uniform1f(
    gl.getUniformLocation(program, "u_gravity"),
    uniforms.gravity
  );
  gl.uniform2f(
    gl.getUniformLocation(program, "u_pendulum_lengths"),
    uniforms.pendulumLengths[0],
    uniforms.pendulumLengths[1]
  );
  gl.uniform2f(
    gl.getUniformLocation(program, "u_pendulum_masses"),
    uniforms.pendulumMasses[0],
    uniforms.pendulumMasses[1]
  );
  gl.uniform1f(
    gl.getUniformLocation(program, "u_step_count"),
    uniforms.stepCount
  );
}

export function downscaledUniforms(
  uniforms: ShaderUniforms,
  factor: number
): ShaderUniforms {
  return {
    ...uniforms,
    resolution: [
      uniforms.resolution[0] / factor,
      uniforms.resolution[1] / factor,
    ],
  };
}

export function setViewport(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  pixelRatio: number
) {
  gl.viewport(0, 0, width * pixelRatio, height * pixelRatio);
}
