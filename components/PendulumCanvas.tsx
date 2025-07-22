"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import fragmentShaderSource from "./shader.frag";
import vertexShaderSource from "./shader.vert";
import DoublePendulum from "./DoublePendulum";
import PendulumAudio from "./PendulumAudio";

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

function createProgram(
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

function initGL(
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

function setUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  uniforms: ShaderUniforms
) {
  gl.uniform2f(
    gl.getUniformLocation(program, "u_resolution"),
    uniforms.resolution[0],
    uniforms.resolution[1]
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

function downscaledUniforms(
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

function setCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number
) {
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

interface ShaderUniforms {
  resolution: [number, number];
  size: [number, number];
  center: [number, number];
  gravity: number;
  pendulumLengths: [number, number];
  pendulumMasses: [number, number];
  stepCount: number;
}

export type InputUniforms = Omit<
  ShaderUniforms,
  "resolution" | "size" | "center"
>;

interface GLContext {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  vao: WebGLVertexArrayObject;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  positionBuffer: WebGLBuffer;
}

interface PendulumCanvasProps {
  lowResScaleFactor: number;
  uniforms: InputUniforms;
}

export default function PendulumCanvas({
  lowResScaleFactor,
  uniforms,
}: PendulumCanvasProps) {
  const animationFrameRef = useRef<number | null>(null);
  const fullRenderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContext = useRef<GLContext | null>(null);

  const [fullUniforms, setFullUniforms] = useState<ShaderUniforms | null>(null);
  // prettier-ignore
  const [size, setSize] = useState<[number, number]>([Math.PI, Math.PI]);
  const [center, setCenter] = useState<[number, number]>([Math.PI, Math.PI]);

  // Mouse state
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<[number, number]>([0, 0]);
  const [clickedPosition, setClickedPosition] = useState<
    [number, number] | null
  >(null);
  const [clickedAngles, setClickedAngles] = useState<[number, number] | null>(
    null
  );

  const render = useCallback(() => {
    if (!glContext.current) return;

    const { gl, vao } = glContext.current;

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    animationFrameRef.current = null;
  }, []);

  // Handle mouse wheel for zooming
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Get mouse position (normalised 0-1) relative to the canvas.
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / rect.width;
      const mouseY = (e.clientY - rect.top) / rect.height;

      // Zoom factor – scroll up to zoom in, scroll down to zoom out.
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

      // Perform **functional** state updates so each wheel event composes
      // correctly even when many events fire in rapid succession.
      setSize((prevSize) => {
        const newSize: [number, number] = [
          prevSize[0] * zoomFactor,
          prevSize[1] * zoomFactor,
        ];

        setCenter((prevCenter) => {
          const newCenterX = prevCenter[0] + mouseX * (newSize[0] - prevSize[0]);
          const newCenterY = prevCenter[1] + (1 - mouseY) * (newSize[1] - prevSize[1]);

          // Keep the DoublePendulum anchor fixed in world-space.
          if (clickedPosition) {
            const currentWorldX = clickedPosition[0] * prevSize[0] - prevCenter[0];
            const currentWorldY =
              (1 - clickedPosition[1]) * prevSize[1] - prevCenter[1];

            const newClickedX = (currentWorldX + newCenterX) / newSize[0];
            const newClickedY = 1 - (currentWorldY + newCenterY) / newSize[1];

            setClickedPosition([newClickedX, newClickedY]);
          }

          return [newCenterX, newCenterY];
        });

        return newSize;
      });
    },
    [clickedPosition]
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const position: [number, number] = [
        (e.clientX - rect.left) / rect.width,
        (e.clientY - rect.top) / rect.height,
      ];
      setClickedPosition(position);

      const angles: [number, number] = [
        position[0] * size[0] - center[0] + Math.PI / 2,
        (1 - position[1]) * size[1] - center[1] + Math.PI / 2,
      ];
      setClickedAngles(angles);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size[0], size[1], center[0], center[1]]
  );

  // Handle mouse down for panning
  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      switch (e.button) {
        case 0:
          handleClick(e);
          break;

        case 1:
          setIsDragging(true);
          setLastMousePos([e.clientX, e.clientY]);
          break;
      }
    },
    [handleClick]
  );

  // Handle mouse move for panning
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const deltaX = (e.clientX - lastMousePos[0]) / rect.width;
      const deltaY = (e.clientY - lastMousePos[1]) / rect.height;

      // Convert screen delta to world delta
      const worldDeltaX = deltaX * size[0];
      const worldDeltaY = -deltaY * size[1];

      setCenter([
        center[0] + worldDeltaX * window.devicePixelRatio,
        center[1] + worldDeltaY * window.devicePixelRatio,
      ]);
      setLastMousePos([e.clientX, e.clientY]);

      if (clickedPosition) {
        // Update clickedPosition to maintain the same world position
        // Convert current clicked position to world coordinates (matching the startingAngles calculation)
        const currentWorldX = clickedPosition[0] * size[0] - center[0];
        const currentWorldY = (1 - clickedPosition[1]) * size[1] - center[1];

        // Convert back to normalized coordinates with new center
        const newClickedX = (currentWorldX + center[0] + worldDeltaX) / size[0];
        const newClickedY =
          1 - (currentWorldY + center[1] + worldDeltaY) / size[1];

        setClickedPosition([newClickedX, newClickedY]);
      }
    },
    [isDragging, lastMousePos, size, center, clickedPosition]
  );

  // Handle mouse up for panning
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Change cursor on drag
  useEffect(() => {
    document.body.style.cursor = isDragging ? "move" : "default";
  }, [isDragging]);

  // Add event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleWheel, handleMouseDown, handleMouseMove, handleMouseUp]);

  // Update fullUniforms when uniforms change
  useEffect(() => {
    if (!canvasRef.current) return;

    setFullUniforms({
      ...uniforms,
      size,
      center,
      resolution: [
        canvasRef.current.clientWidth,
        canvasRef.current.clientHeight,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(uniforms), size, center, canvasRef.current]);

  // Update fullUniforms when canvas size changes
  useEffect(() => {
    if (!canvasRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!canvasRef.current) return;

      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      setFullUniforms((prev) => {
        if (!prev) return null;

        return {
          ...prev,
          resolution: [width, height],
        };
      });
    });

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  }, []);

  // Setup WebGL context
  useEffect(() => {
    if (!fullUniforms) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasWidthPixels = canvas.clientWidth;
    const canvasHeightPixels = canvas.clientHeight;
    setCanvasSize(
      canvas,
      canvasWidthPixels,
      canvasHeightPixels,
      window.devicePixelRatio
    );

    glContext.current = initGL(canvas, fullUniforms);
    if (!glContext.current) return;

    animationFrameRef.current = requestAnimationFrame(() => render());

    return () => {
      if (!glContext.current) return;

      const { gl, program, vao, vertexShader, fragmentShader, positionBuffer } =
        glContext.current;

      // Clean up WebGL resources
      try {
        if (program) gl.deleteProgram(program);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        if (positionBuffer) gl.deleteBuffer(positionBuffer);
        if (vao) gl.deleteVertexArray(vao);
      } catch (e) {
        // Ignore cleanup errors
        console.error(e);
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render, fullUniforms === null]);

  const scheduleRenders = useCallback(
    (fullUniforms: ShaderUniforms): [number, NodeJS.Timeout] => {
      const { gl, program } = glContext.current!;

      const animationFrame = requestAnimationFrame(() => {
        const scaleFactor = lowResScaleFactor;
        setUniforms(gl, program, downscaledUniforms(fullUniforms, scaleFactor));
        setCanvasSize(
          canvasRef.current!,
          fullUniforms.resolution[0],
          fullUniforms.resolution[1],
          window.devicePixelRatio / scaleFactor
        );

        render();
      });

      const fullResRenderTimeout = setTimeout(() => {
        animationFrameRef.current = requestAnimationFrame(() => {
          setUniforms(gl, program, fullUniforms);
          setCanvasSize(
            canvasRef.current!,
            fullUniforms.resolution[0],
            fullUniforms.resolution[1],
            window.devicePixelRatio
          );

          render();
        });
      }, 150);

      return [animationFrame, fullResRenderTimeout];
    },
    [render, lowResScaleFactor]
  );

  // Re-render when fullUniforms changes
  useEffect(() => {
    if (!glContext) return;
    if (!fullUniforms) return;
    if (!canvasRef.current) return;

    const [animationFrame, fullResRenderTimeout] = scheduleRenders(
      fullUniforms
    );
    animationFrameRef.current = animationFrame;
    fullRenderTimeoutRef.current = fullResRenderTimeout;

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (fullRenderTimeoutRef.current) {
        clearTimeout(fullRenderTimeoutRef.current);
        fullRenderTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(fullUniforms), scheduleRenders]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          imageRendering: "pixelated",
        }}
      />
      {clickedPosition && clickedAngles && (
        <>
          <DoublePendulum
            startingAngles={clickedAngles}
            lengths={uniforms.pendulumLengths}
            masses={uniforms.pendulumMasses}
            gravity={uniforms.gravity}
            position={clickedPosition}
          />
          <PendulumAudio
            startingAngles={clickedAngles}
            lengths={uniforms.pendulumLengths}
            masses={uniforms.pendulumMasses}
            gravity={uniforms.gravity}
          />
        </>
      )}
    </>
  );
}
