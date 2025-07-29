"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWindowSize } from "~/hooks/useWindowSize";
import { parseCanvasParams } from "~/utils/paramParser";
import {
  ShaderUniforms,
  GLContext,
  initGL,
  setUniforms,
  downscaledUniforms,
  setViewport,
} from "~/utils/webgl";
import DoublePendulum from "./DoublePendulum";
import InfoButton from "./InfoButton";
import PendulumAudio from "./PendulumAudio";
import ShareButton from "./ShareButton";

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

export type InputUniforms = Omit<
  ShaderUniforms,
  "resolution" | "size" | "center" | "pixelRatio"
>;

interface PendulumCanvasProps {
  lowResScaleFactor: number;
  uniforms: InputUniforms;
}

export default function PendulumCanvas({
  lowResScaleFactor,
  uniforms,
}: PendulumCanvasProps) {
  const searchParams = useSearchParams();
  const windowSize = useWindowSize();

  const animationFrameRef = useRef<number | null>(null);
  const fullRenderTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glContext = useRef<GLContext | null>(null);

  const [fullUniforms, setFullUniforms] = useState<ShaderUniforms | null>(null);
  // prettier-ignore
  const [size, setSize] = useState<[number, number]>([2 * Math.PI, 2 * Math.PI]);
  const [center, setCenter] = useState<[number, number]>([0, 0]);

  // Mouse state
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<[number, number]>([0, 0]);
  const [clickedAngles, setClickedAngles] = useState<[number, number] | null>(
    null
  );

  // Touch state
  const [isTouching, setIsTouching] = useState(false);
  const [wasTouched, setWasTouched] = useState(false);
  const [lastTouchPos, setLastTouchPos] = useState<[number, number]>([0, 0]);
  const [lastTouchDistance, setLastTouchDistance] = useState<number>(0);

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

      const zoomFactor = e.deltaY > 0 ? 10 / 9 : 9 / 10;

      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert mouse position to normalized coordinates (0 to 1)
      const normalizedX = mouseX / rect.width;
      const normalizedY = (rect.height - mouseY) / rect.height; // Flip Y for shader coordinates

      // Convert normalized coordinates to world coordinates
      const worldMouseX = center[0] - size[0] / 2 + normalizedX * size[0];
      const worldMouseY = center[1] - size[1] / 2 + normalizedY * size[1];

      setSize((prevSize) => {
        const newSize: [number, number] = [
          prevSize[0] * zoomFactor,
          prevSize[1] * zoomFactor,
        ];

        // Calculate new center to keep mouse position fixed
        const newWorldMouseX =
          center[0] - newSize[0] / 2 + normalizedX * newSize[0];
        const newWorldMouseY =
          center[1] - newSize[1] / 2 + normalizedY * newSize[1];

        const centerOffsetX = worldMouseX - newWorldMouseX;
        const centerOffsetY = worldMouseY - newWorldMouseY;

        setCenter([center[0] + centerOffsetX, center[1] + centerOffsetY]);

        return newSize;
      });
    },
    [center, size]
  );

  // Helper function to get touch distance
  const getTouchDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Helper function to get touch center
  const getTouchCenter = useCallback((touches: TouchList): [number, number] => {
    if (touches.length === 1) {
      return [touches[0].clientX, touches[0].clientY];
    }
    const touch1 = touches[0];
    const touch2 = touches[1];
    return [
      (touch1.clientX + touch2.clientX) / 2,
      (touch1.clientY + touch2.clientY) / 2,
    ];
  }, []);

  const handleClick = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Shader origin is in the bottom left corner.
      const bottomLeftCorner: [number, number] = [
        center[0] - size[0] / 2,
        center[1] - size[1] / 2,
      ];

      const rect = canvas.getBoundingClientRect();
      const radiansFromBottomLeft: [number, number] = [
        ((clientX - rect.left) / rect.width) * size[0],
        ((rect.bottom - clientY) / rect.height) * size[1],
      ];

      const angles: [number, number] = [
        bottomLeftCorner[0] + radiansFromBottomLeft[0],
        bottomLeftCorner[1] + radiansFromBottomLeft[1],
      ];
      setClickedAngles(angles);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size[0], size[1], center[0], center[1]]
  );

  const handleMouseClick = useCallback(
    (e: MouseEvent) => {
      handleClick(e.clientX, e.clientY);
    },
    [handleClick]
  );

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setLastMousePos([e.clientX, e.clientY]);
    }
  }, []);

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
      const worldDeltaX = -deltaX * size[0];
      const worldDeltaY = deltaY * size[1];

      setWasDragged(true);
      setCenter([center[0] + worldDeltaX, center[1] + worldDeltaY]);
      setLastMousePos([e.clientX, e.clientY]);
    },
    [isDragging, lastMousePos, size, center]
  );

  // Handle mouse up for panning
  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      if (event.button === 0) {
        setIsDragging(false);
        setWasDragged((prev) => {
          if (!prev) {
            handleMouseClick(event);
          }

          return false;
        });
      }
    },
    [handleMouseClick]
  );

  // Handle touch start
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      const touches = e.touches;
      if (touches.length === 1) {
        // Single finger - start panning
        setIsTouching(true);
        setLastTouchPos([touches[0].clientX, touches[0].clientY]);
      } else if (touches.length === 2) {
        // Two fingers - start pinch zoom
        setIsTouching(true);
        const distance = getTouchDistance(touches);
        setLastTouchDistance(distance);
      }
    },
    [getTouchDistance]
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      if (!isTouching) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const touches = e.touches;

      if (touches.length === 1) {
        // Single finger - pan
        const touch = touches[0];
        const rect = canvas.getBoundingClientRect();

        const deltaX = (touch.clientX - lastTouchPos[0]) / rect.width;
        const deltaY = (touch.clientY - lastTouchPos[1]) / rect.height;

        // Convert screen delta to world delta
        const worldDeltaX = -deltaX * size[0];
        const worldDeltaY = deltaY * size[1];

        setWasTouched(true);
        setCenter([center[0] + worldDeltaX, center[1] + worldDeltaY]);
        setLastTouchPos([touch.clientX, touch.clientY]);
      } else if (touches.length === 2) {
        // Two fingers - pinch zoom
        const distance = getTouchDistance(touches);
        const touchCenter = getTouchCenter(touches);

        if (lastTouchDistance > 0) {
          const zoomFactor = distance / lastTouchDistance;

          // Get touch center relative to canvas
          const rect = canvas.getBoundingClientRect();
          const normalizedX = (touchCenter[0] - rect.left) / rect.width;
          const normalizedY =
            (rect.height - (touchCenter[1] - rect.top)) / rect.height;

          // Convert normalized coordinates to world coordinates
          const worldTouchX = center[0] - size[0] / 2 + normalizedX * size[0];
          const worldTouchY = center[1] - size[1] / 2 + normalizedY * size[1];

          setSize((prevSize) => {
            const newSize: [number, number] = [
              prevSize[0] / zoomFactor,
              prevSize[1] / zoomFactor,
            ];

            // Calculate new center to keep touch center fixed
            const newWorldTouchX =
              center[0] - newSize[0] / 2 + normalizedX * newSize[0];
            const newWorldTouchY =
              center[1] - newSize[1] / 2 + normalizedY * newSize[1];

            const centerOffsetX = worldTouchX - newWorldTouchX;
            const centerOffsetY = worldTouchY - newWorldTouchY;

            setCenter([center[0] + centerOffsetX, center[1] + centerOffsetY]);

            return newSize;
          });
        }

        setWasTouched(true);
        setLastTouchDistance(distance);
      }
    },
    [
      isTouching,
      lastTouchPos,
      lastTouchDistance,
      size,
      center,
      getTouchDistance,
      getTouchCenter,
    ]
  );

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      if (e.touches.length === 0) {
        // All fingers lifted
        setIsTouching(false);
        setWasTouched((prev) => {
          if (!prev && e.changedTouches.length === 1) {
            // Single tap
            const touch = e.changedTouches[0];
            handleClick(touch.clientX, touch.clientY);
          }
          return false;
        });
      } else if (e.touches.length === 1 && lastTouchDistance > 0) {
        // Went from two fingers to one - reset for panning
        setLastTouchDistance(0);
        setLastTouchPos([e.touches[0].clientX, e.touches[0].clientY]);
      }
    },
    [lastTouchDistance, handleClick]
  );

  useEffect(() => {
    const canvasParams = parseCanvasParams(searchParams);
    if (!canvasParams) {
      return;
    }

    setSize(canvasParams.size);
    setCenter(canvasParams.center);
    setClickedAngles(canvasParams.clickedAngles);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  // Change cursor on drag
  useEffect(() => {
    document.body.style.cursor =
      (isDragging && wasDragged) || (isTouching && wasTouched)
        ? "move"
        : "default";
  }, [isDragging, wasDragged, isTouching, wasTouched]);

  // Add event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);

    // Touch events
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);

      // Touch events
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  // Update fullUniforms when uniforms change
  useEffect(() => {
    if (!canvasRef.current) return;

    setFullUniforms({
      ...uniforms,
      size,
      center,
      pixelRatio: window.devicePixelRatio,
      resolution: [
        canvasRef.current.clientWidth,
        canvasRef.current.clientHeight,
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(uniforms), size, center, canvasRef.current]);

  // Update fullUniforms when window size changes
  useEffect(() => {
    setFullUniforms((prev) => {
      if (!prev) return null;

      return {
        ...prev,
        resolution: [windowSize.width, windowSize.height],
      };
    });
  }, [windowSize.width, windowSize.height]);

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

        setViewport(
          gl,
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

          setViewport(
            gl,
            fullUniforms.resolution[0],
            fullUniforms.resolution[1],
            window.devicePixelRatio
          );

          render();
        });
      }, 250);

      return [animationFrame, fullResRenderTimeout];
    },
    [render, lowResScaleFactor]
  );

  // Re-render when fullUniforms changes
  useEffect(() => {
    if (!glContext) return;
    if (!fullUniforms) return;
    if (!canvasRef.current) return;

    const [animationFrame, fullResRenderTimeout] =
      scheduleRenders(fullUniforms);
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

  const handleRemove = useCallback(() => {
    setClickedAngles(null);
  }, []);

  const handleShare = useCallback(() => {
    const params = new URLSearchParams();
    params.set("gravity", uniforms.gravity.toString());
    params.set("pendulumLengths", uniforms.pendulumLengths.join(","));
    params.set("pendulumMasses", uniforms.pendulumMasses.join(","));
    params.set("stepCount", uniforms.stepCount.toString());
    params.set("size", size.join(","));
    params.set("center", center.join(","));
    params.set("clickedAngles", clickedAngles?.join(",") ?? "");

    const url = `${window.location.origin}${
      window.location.pathname
    }?${params.toString()}`;
    navigator.clipboard.writeText(url);
  }, [uniforms, size, center, clickedAngles]);

  const handleInfo = useCallback(() => {
    window.open("https://www.youtube.com/watch?v=dtjb2OhEQcU", "_blank");
  }, []);

  return (
    <>
      <div className="absolute bottom-4 md:top-4 right-4">
        <ShareButton onShare={handleShare} />
      </div>
      <div className="absolute bottom-18 md:top-18 right-4">
        <InfoButton onInfo={handleInfo} />
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          imageRendering: "pixelated",
        }}
      />
      {clickedAngles && (
        <>
          <DoublePendulum
            canvasSize={size}
            canvasCenter={center}
            startingAngles={clickedAngles}
            lengths={uniforms.pendulumLengths}
            masses={uniforms.pendulumMasses}
            gravity={uniforms.gravity}
            onRemove={handleRemove}
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
