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

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Per-scaleFactor cache of simulation state. Each tier owns its own ping-pong
// targets so low-res drag renders don't wipe the full-res buffer.
interface TierCache {
  targets: [StateTarget, StateTarget];
  current: number;
  simSize: [number, number];
  // Last COMPLETED render's uniforms (center is the snapped center). Used to
  // detect pure pans vs. everything else.
  renderedUniforms: ShaderUniforms | null;
  complete: boolean;
  lastUsed: number;
}

interface RenderJob {
  animationFrame: number;
  cancelled: boolean;
}

// Maximum number of tiers kept alive simultaneously. Low-res drag renders and
// the full-res render use different scaleFactors; keeping both avoids
// reallocation on every drag→settle cycle.
const MAX_TIERS = 2;

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

// Deep-copy uniforms so the cache can't be mutated by the caller.
function deepCopyUniforms(u: ShaderUniforms): ShaderUniforms {
  return {
    resolution: [u.resolution[0], u.resolution[1]],
    pixelRatio: u.pixelRatio,
    size: [u.size[0], u.size[1]],
    center: [u.center[0], u.center[1]],
    gravity: u.gravity,
    pendulumLengths: [u.pendulumLengths[0], u.pendulumLengths[1]],
    pendulumMasses: [u.pendulumMasses[0], u.pendulumMasses[1]],
    stepCount: u.stepCount,
  };
}

// Element-wise comparison of every uniform except center. Used to detect a
// pure pan (only center changed) vs. a settings/zoom/resolution change.
function uniformsMatchExceptCenter(
  a: ShaderUniforms,
  b: ShaderUniforms,
): boolean {
  return (
    a.resolution[0] === b.resolution[0] &&
    a.resolution[1] === b.resolution[1] &&
    a.pixelRatio === b.pixelRatio &&
    a.size[0] === b.size[0] &&
    a.size[1] === b.size[1] &&
    a.gravity === b.gravity &&
    a.pendulumLengths[0] === b.pendulumLengths[0] &&
    a.pendulumLengths[1] === b.pendulumLengths[1] &&
    a.pendulumMasses[0] === b.pendulumMasses[0] &&
    a.pendulumMasses[1] === b.pendulumMasses[1] &&
    a.stepCount === b.stepCount
  );
}

// Element-wise comparison of every uniform except size AND center. Used to
// detect a pure view change (only size and/or center changed) vs. a settings
// or resolution change. This is what makes a cached frame eligible as a
// reproject preview source during a zoom.
function uniformsMatchExceptView(
  a: ShaderUniforms,
  b: ShaderUniforms,
): boolean {
  return (
    a.resolution[0] === b.resolution[0] &&
    a.resolution[1] === b.resolution[1] &&
    a.pixelRatio === b.pixelRatio &&
    a.gravity === b.gravity &&
    a.pendulumLengths[0] === b.pendulumLengths[0] &&
    a.pendulumLengths[1] === b.pendulumLengths[1] &&
    a.pendulumMasses[0] === b.pendulumMasses[0] &&
    a.pendulumMasses[1] === b.pendulumMasses[1] &&
    a.stepCount === b.stepCount
  );
}

// Compute the newly exposed edge strips after a pan of (dx, dy) texels. The
// strips are non-overlapping so each texel is initialized and stepped exactly
// once. Content moves by (-dx, -dy) in texel space.
function computeExposedRects(
  dx: number,
  dy: number,
  W: number,
  H: number,
): Rect[] {
  const rects: Rect[] = [];
  if (dx !== 0) {
    rects.push({
      x: dx > 0 ? W - dx : 0,
      y: 0,
      width: Math.abs(dx),
      height: H,
    });
  }
  if (dy !== 0) {
    rects.push({
      x: Math.max(0, -dx),
      y: dy > 0 ? H - dy : 0,
      width: W - Math.abs(dx),
      height: Math.abs(dy),
    });
  }
  return rects;
}

export class PendulumRenderer {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: read via `const { gl } = this` destructuring, which this rule doesn't track.
  private gl: WebGL2RenderingContext;
  private initProgram: ProgramInfo;
  private stepProgram: ProgramInfo;
  private displayProgram: ProgramInfo;
  private vao: WebGLVertexArrayObject;
  private positionBuffer: WebGLBuffer;

  // Per-scaleFactor state cache, LRU-evicted beyond MAX_TIERS.
  private tiers = new Map<number, TierCache>();

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
      [
        "u_reference_state",
        "u_adjacent_state",
        "u_canvas_resolution",
        "u_uv_scale",
        "u_uv_offset",
      ],
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

  // Get or create the tier for `scaleFactor`, allocating/reallocating state
  // textures to match `width`×`height`. LRU-evicts beyond MAX_TIERS.
  private getTier(
    scaleFactor: number,
    width: number,
    height: number,
  ): TierCache {
    let tier = this.tiers.get(scaleFactor);

    if (tier) {
      tier.lastUsed = Date.now();
      if (tier.simSize[0] !== width || tier.simSize[1] !== height) {
        this.allocateTierTextures(tier, width, height);
        tier.renderedUniforms = null;
        tier.complete = false;
      }
      return tier;
    }

    // Evict least-recently-used tier if at capacity.
    if (this.tiers.size >= MAX_TIERS) {
      let oldestKey: number | null = null;
      let oldestTime = Infinity;
      for (const [key, t] of this.tiers) {
        if (t.lastUsed < oldestTime) {
          oldestTime = t.lastUsed;
          oldestKey = key;
        }
      }
      if (oldestKey !== null) {
        this.disposeTier(this.tiers.get(oldestKey) as TierCache);
        this.tiers.delete(oldestKey);
      }
    }

    tier = {
      targets: [this.createStateTarget(), this.createStateTarget()],
      current: 0,
      simSize: [0, 0],
      renderedUniforms: null,
      complete: false,
      lastUsed: Date.now(),
    };
    this.tiers.set(scaleFactor, tier);
    this.allocateTierTextures(tier, width, height);
    return tier;
  }

  private allocateTierTextures(tier: TierCache, width: number, height: number) {
    const { gl } = this;
    tier.simSize = [width, height];
    for (const target of tier.targets) {
      for (const texture of [target.reference, target.adjacent]) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        // prettier-ignore
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
      }
    }
  }

  private disposeTier(tier: TierCache) {
    const { gl } = this;
    for (const target of tier.targets) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.reference);
      gl.deleteTexture(target.adjacent);
    }
  }

  private drawQuad() {
    const { gl } = this;

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Blit a region from `src` to `dst` for both color attachments, one at a
  // time (blitFramebuffer writes to ALL enabled draw buffers). Uses NEAREST
  // filtering which is required for RGBA32F under EXT_color_buffer_float.
  // Caller must ensure SCISSOR_TEST is disabled (scissor clips blits too).
  private blitBothAttachments(
    src: StateTarget,
    dst: StateTarget,
    srcX: number,
    srcY: number,
    w: number,
    h: number,
    dstX: number,
    dstY: number,
  ) {
    const { gl } = this;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst.framebuffer);

    // Attachment 0
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]);
    // prettier-ignore
    gl.blitFramebuffer(srcX, srcY, srcX + w, srcY + h, dstX, dstY, dstX + w, dstY + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);

    // Attachment 1
    gl.readBuffer(gl.COLOR_ATTACHMENT1);
    gl.drawBuffers([gl.NONE, gl.COLOR_ATTACHMENT1]);
    // prettier-ignore
    gl.blitFramebuffer(srcX, srcY, srcX + w, srcY + h, dstX, dstY, dstX + w, dstY + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  }

  // Restore the per-FBO draw-buffer and read-buffer state that init/step rely
  // on (both attachments enabled, read from attachment 0).
  private restoreFboState(target: StateTarget) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.readBuffer(gl.COLOR_ATTACHMENT0);
  }

  // Shift the retained region of both targets by (−dx, −dy) texels. After
  // this call both A and B hold the retained region at its new position; the
  // exposed strip regions contain stale data that will be overwritten by the
  // init pass. Same-image blits are INVALID_OPERATION in WebGL2, so the shift
  // goes through the other target (A→B shift, then B→A aligned copy).
  private shiftRetainedRegion(tier: TierCache, dx: number, dy: number) {
    const { gl } = this;
    const [W, H] = tier.simSize;
    const A = tier.targets[tier.current];
    const B = tier.targets[1 - tier.current];

    const srcX = Math.max(0, dx);
    const srcY = Math.max(0, dy);
    const w = W - Math.abs(dx);
    const h = H - Math.abs(dy);
    const dstX = Math.max(0, -dx);
    const dstY = Math.max(0, -dy);

    if (w <= 0 || h <= 0) return;

    gl.disable(gl.SCISSOR_TEST);

    // Hop 1: shift-blit A → B (retained region to its new position in B).
    this.blitBothAttachments(A, B, srcX, srcY, w, h, dstX, dstY);
    // Hop 2: aligned-blit B → A (same position, so A also holds the retained
    // region — required because step ping-pongs and progressive display may
    // read from either target).
    this.blitBothAttachments(B, A, dstX, dstY, w, h, dstX, dstY);

    // Restore per-FBO state for both targets.
    this.restoreFboState(A);
    this.restoreFboState(B);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // Write initial pendulum states into the current target. When `rects` is
  // provided, only those regions are written (scissored); otherwise the full
  // frame is initialized as before.
  private runInitPass(
    tier: TierCache,
    uniforms: ShaderUniforms,
    rects?: Rect[],
  ) {
    const { gl } = this;
    const { program, uniforms: locations } = this.initProgram;

    // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL2 API call, not a React hook.
    gl.useProgram(program);
    gl.uniform2f(locations.u_sim_resolution, tier.simSize[0], tier.simSize[1]);
    gl.uniform2f(locations.u_size, uniforms.size[0], uniforms.size[1]);
    gl.uniform2f(locations.u_center, uniforms.center[0], uniforms.center[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, tier.targets[tier.current].framebuffer);
    // Full-size viewport keeps gl_FragCoord mapping intact; scissor clips the
    // actual writes.
    gl.viewport(0, 0, tier.simSize[0], tier.simSize[1]);

    if (rects && rects.length > 0) {
      gl.enable(gl.SCISSOR_TEST);
      for (const rect of rects) {
        gl.scissor(rect.x, rect.y, rect.width, rect.height);
        this.drawQuad();
      }
      gl.disable(gl.SCISSOR_TEST);
    } else {
      this.drawQuad();
    }
  }

  // Advance the simulation by `steps`, reading from the current target and
  // writing into the other one. When `rects` is provided, only those regions
  // are written (scissored) so retained texels are never re-stepped.
  private runStepPass(
    tier: TierCache,
    uniforms: ShaderUniforms,
    steps: number,
    rects?: Rect[],
  ) {
    const { gl } = this;
    const { program, uniforms: locations } = this.stepProgram;
    const source = tier.targets[tier.current];
    const destination = tier.targets[1 - tier.current];

    // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL2 API call, not a React hook.
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
    gl.viewport(0, 0, tier.simSize[0], tier.simSize[1]);

    if (rects && rects.length > 0) {
      gl.enable(gl.SCISSOR_TEST);
      for (const rect of rects) {
        gl.scissor(rect.x, rect.y, rect.width, rect.height);
        this.drawQuad();
      }
      gl.disable(gl.SCISSOR_TEST);
    } else {
      this.drawQuad();
    }

    tier.current = 1 - tier.current;
  }

  // Color the current state and draw it to the canvas. The optional
  // `uvScale`/`uvOffset` reproject the cached frame under a new view
  // transform (identity by default re-displays the cached frame unchanged).
  private runDisplayPass(
    tier: TierCache,
    uvScale: [number, number] = [1, 1],
    uvOffset: [number, number] = [0, 0],
  ) {
    const { gl } = this;
    const { program, uniforms: locations } = this.displayProgram;
    const source = tier.targets[tier.current];

    // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL2 API call, not a React hook.
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.reference);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, source.adjacent);
    gl.uniform1i(locations.u_reference_state, 0);
    gl.uniform1i(locations.u_adjacent_state, 1);
    // prettier-ignore
    gl.uniform2f(locations.u_canvas_resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(locations.u_uv_scale, uvScale[0], uvScale[1]);
    gl.uniform2f(locations.u_uv_offset, uvOffset[0], uvOffset[1]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    this.drawQuad();
  }

  // Start an iterative render, cancelling any render already in flight. One
  // chunk of steps is simulated per animation frame so the main thread and
  // GPU stay responsive in between. When the requested view is a pure pan of
  // the last completed render on this tier, the previous state buffer is
  // reused: the retained region is shifted and only the newly exposed edge
  // strips are initialized and simulated.
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

    const tier = this.getTier(options.scaleFactor, width, height);

    let effectiveUniforms = uniforms;
    let rects: Rect[] | undefined;
    let isIncremental = false;

    // --- Pan detection ---
    if (tier.complete && tier.renderedUniforms) {
      const cached = tier.renderedUniforms;
      if (uniformsMatchExceptCenter(cached, uniforms)) {
        const dx = Math.round(
          ((uniforms.center[0] - cached.center[0]) * width) / uniforms.size[0],
        );
        const dy = Math.round(
          ((uniforms.center[1] - cached.center[1]) * height) / uniforms.size[1],
        );

        if (Math.abs(dx) >= width || Math.abs(dy) >= height) {
          // Pan exceeds the frame — full render.
        } else if (dx === 0 && dy === 0) {
          // Sub-texel jitter: the cached frame is already correct. Display
          // it and short-circuit (also makes the debounced full-res render
          // free when lowResScaleFactor === 1).
          this.runDisplayPass(tier);
          options.onProgress?.(1);
          options.onComplete?.();
          return;
        } else {
          // Incremental pan: snap center to the texel grid, shift the
          // retained region, and simulate only the exposed strips.
          isIncremental = true;
          const snappedCenter: [number, number] = [
            cached.center[0] + (dx * uniforms.size[0]) / width,
            cached.center[1] + (dy * uniforms.size[1]) / height,
          ];
          effectiveUniforms = { ...uniforms, center: snappedCenter };
          rects = computeExposedRects(dx, dy, width, height);

          // Mark incomplete before blitting (blit destroys old state).
          tier.complete = false;
          this.shiftRetainedRegion(tier, dx, dy);
        }
      }
    }

    if (!isIncremental) {
      tier.complete = false;
    }

    this.runInitPass(tier, effectiveUniforms, rects);
    options.onProgress?.(0);

    // Scale steps-per-chunk by the area ratio so wall time tracks strip area
    // rather than the full-frame chunk count.
    let stepsPerChunk = options.stepsPerChunk;
    if (isIncremental && rects) {
      const fullArea = width * height;
      let stripArea = 0;
      for (const rect of rects) {
        stripArea += rect.width * rect.height;
      }
      if (stripArea > 0) {
        stepsPerChunk = Math.min(
          totalSteps || 1,
          Math.max(
            options.stepsPerChunk,
            Math.ceil((options.stepsPerChunk * fullArea) / stripArea),
          ),
        );
      }
    }

    let stepsDone = 0;
    const job: RenderJob = { animationFrame: 0, cancelled: false };
    this.job = job;

    const renderChunk = () => {
      if (job.cancelled) return;

      const steps = Math.min(stepsPerChunk, totalSteps - stepsDone);
      if (steps > 0) {
        this.runStepPass(tier, effectiveUniforms, steps, rects);
        stepsDone += steps;
      }

      if (options.progressive || stepsDone >= totalSteps) {
        this.runDisplayPass(tier);
      }
      options.onProgress?.(totalSteps === 0 ? 1 : stepsDone / totalSteps);

      if (stepsDone >= totalSteps) {
        this.job = null;
        tier.renderedUniforms = deepCopyUniforms(effectiveUniforms);
        tier.complete = true;
        options.onComplete?.();
        return;
      }

      job.animationFrame = requestAnimationFrame(renderChunk);
    };

    // Run synchronously when the whole render fits in one chunk. This avoids
    // the rAF cancellation race during fast drags where the React effect
    // cleanup cancels on every center change.
    if (totalSteps <= stepsPerChunk) {
      renderChunk();
    } else {
      job.animationFrame = requestAnimationFrame(renderChunk);
    }
  }

  cancelRender() {
    if (!this.job) return;

    this.job.cancelled = true;
    cancelAnimationFrame(this.job.animationFrame);
    this.job = null;
  }

  // Re-display the last completed simulation resampled under a new view
  // transform — one textured-quad draw, no simulation. Used to give instant
  // per-frame feedback during a zoom while the full render is debounced.
  //
  // Finds a completed tier whose uniforms match `uniforms` except for size
  // and center, preferring the lowest scaleFactor (highest resolution). The
  // transform maps the requested view onto the cached one:
  //   u_uv_scale  = s1 / s0
  //   u_uv_offset = ((c1 - s1/2) - (c0 - s0/2)) / s0
  // Returns true if a preview was drawn, false if no usable tier was found.
  previewView(uniforms: ShaderUniforms): boolean {
    let bestKey: number | null = null;
    let bestTier: TierCache | null = null;

    for (const [key, tier] of this.tiers) {
      if (!tier.complete || !tier.renderedUniforms) continue;
      if (!uniformsMatchExceptView(tier.renderedUniforms, uniforms)) continue;
      if (bestKey === null || key < bestKey) {
        bestKey = key;
        bestTier = tier;
      }
    }

    if (!bestTier || bestKey === null) return false;

    const cached = bestTier.renderedUniforms as ShaderUniforms;
    const s0 = cached.size;
    const s1 = uniforms.size;
    const c0 = cached.center;
    const c1 = uniforms.center;

    const uvScale: [number, number] = [s1[0] / s0[0], s1[1] / s0[1]];
    const uvOffset: [number, number] = [
      (c1[0] - s1[0] / 2 - (c0[0] - s0[0] / 2)) / s0[0],
      (c1[1] - s1[1] / 2 - (c0[1] - s0[1] / 2)) / s0[1],
    ];

    this.runDisplayPass(bestTier, uvScale, uvOffset);
    return true;
  }

  dispose() {
    this.cancelRender();

    const { gl } = this;
    try {
      for (const tier of this.tiers.values()) {
        this.disposeTier(tier);
      }
      this.tiers.clear();
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
