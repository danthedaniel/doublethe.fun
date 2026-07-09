import displayFragmentSource from "./shaders/display.frag?raw";
import initFragmentSource from "./shaders/init.frag?raw";
import quadVertexSource from "./shaders/quad.vert?raw";
import stepFragmentSource from "./shaders/step.frag?raw";

// Simulation steps advanced per draw call before yielding back to the event
// loop. Smaller chunks keep the page responsive during a render.
export const FULL_RES_STEPS_PER_CHUNK = 10;

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

export interface RenderOptions {
  // State textures are allocated at 1/scaleFactor of the canvas resolution.
  scaleFactor: number;
  stepsPerChunk: number;
  // Draw intermediate states to the canvas as they complete. When false the
  // canvas keeps its previous contents until the render finishes.
  progressive: boolean;
  onProgress?: (fraction: number) => void;
  onComplete?: () => void;
}

interface ProgramInfo {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

// A framebuffer with reference and adjacent pendulum state textures attached
// as color attachments 0 and 1.
interface StateTarget {
  framebuffer: WebGLFramebuffer;
  reference: WebGLTexture;
  adjacent: WebGLTexture;
}

interface RenderJob {
  animationFrame: number;
  cancelled: boolean;
}

function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
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

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentSource: string,
  uniformNames: string[],
): ProgramInfo | null {
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  // Pin the quad attribute to location 0 so one VAO works for every program.
  gl.bindAttribLocation(program, 0, "a_position");
  gl.linkProgram(program);
  // The program keeps the compiled shader alive; flag it for deletion so it
  // is freed along with the program.
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }

  return { program, uniforms };
}

export class PendulumRenderer {
  private gl: WebGL2RenderingContext;
  private initProgram: ProgramInfo;
  private stepProgram: ProgramInfo;
  private displayProgram: ProgramInfo;
  private vao: WebGLVertexArrayObject;
  private positionBuffer: WebGLBuffer;

  // Ping-pong state targets; `current` holds the latest simulation state.
  private targets: [StateTarget, StateTarget];
  private current = 0;
  private simSize: [number, number] = [0, 0];

  private job: RenderJob | null = null;

  static create(canvas: HTMLCanvasElement): PendulumRenderer | null {
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      console.error("WebGL2 not supported");
      return null;
    }

    // Required to render into RGBA32F textures.
    if (!gl.getExtension("EXT_color_buffer_float")) {
      console.error("EXT_color_buffer_float not supported");
      return null;
    }

    try {
      return new PendulumRenderer(gl);
    } catch (e) {
      console.error("Failed to initialize renderer:", e);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, quadVertexSource);
    if (!vertexShader) throw new Error("Failed to compile vertex shader");

    const initProgram = createProgram(gl, vertexShader, initFragmentSource, [
      "u_sim_resolution",
      "u_size",
      "u_center",
    ]);
    const stepProgram = createProgram(gl, vertexShader, stepFragmentSource, [
      "u_reference_state",
      "u_adjacent_state",
      "u_gravity",
      "u_pendulum_lengths",
      "u_pendulum_masses",
      "u_steps",
    ]);
    const displayProgram = createProgram(
      gl,
      vertexShader,
      displayFragmentSource,
      ["u_reference_state", "u_adjacent_state", "u_canvas_resolution"],
    );
    gl.deleteShader(vertexShader);

    if (!initProgram || !stepProgram || !displayProgram) {
      throw new Error("Failed to create programs");
    }

    this.initProgram = initProgram;
    this.stepProgram = stepProgram;
    this.displayProgram = displayProgram;

    // Full-screen quad shared by every pass.
    // prettier-ignore
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) throw new Error("Failed to create buffer");
    this.positionBuffer = positionBuffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create VAO");
    this.vao = vao;
    gl.bindVertexArray(vao);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.targets = [this.createStateTarget(), this.createStateTarget()];
  }

  private createStateTexture(): WebGLTexture {
    const { gl } = this;

    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create texture");

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  private createStateTarget(): StateTarget {
    const { gl } = this;

    const reference = this.createStateTexture();
    const adjacent = this.createStateTexture();

    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) throw new Error("Failed to create framebuffer");

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // prettier-ignore
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, reference, 0);
    // prettier-ignore
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, adjacent, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return { framebuffer, reference, adjacent };
  }

  // Allocate (or reallocate) the state textures to match the simulation size.
  private allocateStateTextures(width: number, height: number) {
    const { gl } = this;

    if (this.simSize[0] === width && this.simSize[1] === height) return;
    this.simSize = [width, height];

    for (const target of this.targets) {
      for (const texture of [target.reference, target.adjacent]) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // prettier-ignore
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
      }
    }
  }

  private drawQuad() {
    const { gl } = this;

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Write initial pendulum states for every pixel into the current target.
  private runInitPass(uniforms: ShaderUniforms) {
    const { gl } = this;
    const { program, uniforms: locations } = this.initProgram;

    gl.useProgram(program);
    gl.uniform2f(locations.u_sim_resolution, this.simSize[0], this.simSize[1]);
    gl.uniform2f(locations.u_size, uniforms.size[0], uniforms.size[1]);
    gl.uniform2f(locations.u_center, uniforms.center[0], uniforms.center[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[this.current].framebuffer);
    gl.viewport(0, 0, this.simSize[0], this.simSize[1]);
    this.drawQuad();
  }

  // Advance the simulation by `steps`, reading from the current target and
  // writing into the other one.
  private runStepPass(uniforms: ShaderUniforms, steps: number) {
    const { gl } = this;
    const { program, uniforms: locations } = this.stepProgram;
    const source = this.targets[this.current];
    const destination = this.targets[1 - this.current];

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.reference);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source.adjacent);
    gl.uniform1i(locations.u_reference_state, 0);
    gl.uniform1i(locations.u_adjacent_state, 1);
    gl.uniform1f(locations.u_gravity, uniforms.gravity);
    // prettier-ignore
    gl.uniform2f(locations.u_pendulum_lengths, uniforms.pendulumLengths[0], uniforms.pendulumLengths[1]);
    // prettier-ignore
    gl.uniform2f(locations.u_pendulum_masses, uniforms.pendulumMasses[0], uniforms.pendulumMasses[1]);
    gl.uniform1i(locations.u_steps, steps);

    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.viewport(0, 0, this.simSize[0], this.simSize[1]);
    this.drawQuad();

    this.current = 1 - this.current;
  }

  // Color the current state and draw it to the canvas.
  private runDisplayPass() {
    const { gl } = this;
    const { program, uniforms: locations } = this.displayProgram;
    const source = this.targets[this.current];

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.reference);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source.adjacent);
    gl.uniform1i(locations.u_reference_state, 0);
    gl.uniform1i(locations.u_adjacent_state, 1);
    // prettier-ignore
    gl.uniform2f(locations.u_canvas_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.drawQuad();
  }

  // Start an iterative render, cancelling any render already in flight. One
  // chunk of steps is simulated per animation frame so the main thread and
  // GPU stay responsive in between.
  startRender(uniforms: ShaderUniforms, options: RenderOptions) {
    this.cancelRender();

    const totalSteps = Math.max(0, Math.round(uniforms.stepCount));
    const width = Math.max(
      1,
      Math.round((uniforms.resolution[0] * uniforms.pixelRatio) / options.scaleFactor),
    );
    const height = Math.max(
      1,
      Math.round((uniforms.resolution[1] * uniforms.pixelRatio) / options.scaleFactor),
    );

    this.allocateStateTextures(width, height);
    this.runInitPass(uniforms);
    options.onProgress?.(0);

    let stepsDone = 0;
    const job: RenderJob = { animationFrame: 0, cancelled: false };
    this.job = job;

    const renderChunk = () => {
      if (job.cancelled) return;

      const steps = Math.min(options.stepsPerChunk, totalSteps - stepsDone);
      if (steps > 0) {
        this.runStepPass(uniforms, steps);
        stepsDone += steps;
      }

      if (options.progressive || stepsDone >= totalSteps) {
        this.runDisplayPass();
      }
      options.onProgress?.(totalSteps === 0 ? 1 : stepsDone / totalSteps);

      if (stepsDone >= totalSteps) {
        this.job = null;
        options.onComplete?.();
        return;
      }

      job.animationFrame = requestAnimationFrame(renderChunk);
    };

    job.animationFrame = requestAnimationFrame(renderChunk);
  }

  cancelRender() {
    if (!this.job) return;

    this.job.cancelled = true;
    cancelAnimationFrame(this.job.animationFrame);
    this.job = null;
  }

  dispose() {
    this.cancelRender();

    const { gl } = this;
    try {
      for (const target of this.targets) {
        gl.deleteFramebuffer(target.framebuffer);
        gl.deleteTexture(target.reference);
        gl.deleteTexture(target.adjacent);
      }
      gl.deleteProgram(this.initProgram.program);
      gl.deleteProgram(this.stepProgram.program);
      gl.deleteProgram(this.displayProgram.program);
      gl.deleteBuffer(this.positionBuffer);
      gl.deleteVertexArray(this.vao);
    } catch (e) {
      // Ignore cleanup errors
      console.error(e);
    }
  }
}
