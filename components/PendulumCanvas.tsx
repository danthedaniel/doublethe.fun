import { useCallback, useEffect, useRef, useState } from "react";
import { initialSearchParams } from "~/utils/initialSearchParams";
import { parseCanvasParams } from "~/utils/paramParser";
import {
  ShaderUniforms,
  PendulumRenderer,
  FULL_RES_STEPS_PER_CHUNK,
} from "~/utils/pendulumRenderer";
import DoublePendulum from "./DoublePendulum";
import InfoButton from "./InfoButton";
import PendulumAudio from "./PendulumAudio";
import ShareButton from "./ShareButton";

// Delay after the last parameter change before the full resolution render
// starts.
const FULL_RES_DELAY_MS = 500;

// Initial view (size/center/clicked pendulum) decoded once from the URL the
// page was opened with. Parsed at module load so it can seed component state
// directly instead of being applied in a mount effect.
const initialCanvasParams = parseCanvasParams(initialSearchParams);

function setCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  pixelRatio: number,
) {
  // Only the drawing buffer is sized here; the display size is left to CSS
  // (`w-full h-full`) so the canvas exactly fills its layout box and can never
  // overflow the viewport.
  const bufferWidth = Math.round(width * pixelRatio);
  const bufferHeight = Math.round(height * pixelRatio);

  // Assigning width/height clears the canvas, so only resize when needed.
  if (canvas.width === bufferWidth && canvas.height === bufferHeight) {
    return;
  }

  canvas.width = bufferWidth;
  canvas.height = bufferHeight;
}

// Helper function to get touch distance
function getTouchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;

  const touch1 = touches[0];
  const touch2 = touches[1];
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Helper function to get touch center
function getTouchCenter(touches: TouchList): [number, number] {
  if (touches.length === 1) {
    return [touches[0].clientX, touches[0].clientY];
  }

  const touch1 = touches[0];
  const touch2 = touches[1];
  return [
    (touch1.clientX + touch2.clientX) / 2,
    (touch1.clientY + touch2.clientY) / 2,
  ];
}

export type InputUniforms = Omit<
  ShaderUniforms,
  "resolution" | "size" | "center" | "pixelRatio"
>;

interface PendulumCanvasProps {
  lowResScaleFactor: number;
  uniforms: InputUniforms;
  onInfo: () => void;
}

export default function PendulumCanvas({
  lowResScaleFactor,
  uniforms,
  onInfo,
}: PendulumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PendulumRenderer | null>(null);

  const [fullUniforms, setFullUniforms] = useState<ShaderUniforms | null>(null);
  const [fullResProgress, setFullResProgress] = useState<number | null>(null);
  // prettier-ignore
  const [size, setSize] = useState<[number, number]>(initialCanvasParams?.size ?? [2 * Math.PI, 2 * Math.PI]);
  const [center, setCenter] = useState<[number, number]>(initialCanvasParams?.center ?? [0, 0]);

  // Mouse state
  const [isDragging, setIsDragging] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const [lastMousePos, setLastMousePos] = useState<[number, number]>([0, 0]);
  const [clickedAngles, setClickedAngles] = useState<[number, number] | null>(
    initialCanvasParams?.clickedAngles ?? null,
  );

  // Touch state
  const [isTouching, setIsTouching] = useState(false);
  const [wasTouched, setWasTouched] = useState(false);
  const [lastTouchPos, setLastTouchPos] = useState<[number, number]>([0, 0]);
  const [lastTouchDistance, setLastTouchDistance] = useState<number>(0);

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
    [center, size],
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

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
    [size[0], size[1], center[0], center[1]],
  );

  const handleMouseClick = useCallback(
    (e: MouseEvent) => {
      handleClick(e.clientX, e.clientY);
    },
    [handleClick],
  );

  // Handle mouse down for panning
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setLastMousePos([e.clientX, e.clientY]);
    }
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("mousedown", handleMouseDown);
    return () => canvas.removeEventListener("mousedown", handleMouseDown);
  }, [handleMouseDown]);

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
    [isDragging, lastMousePos, size, center],
  );
  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

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
    [handleMouseClick],
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("mouseup", handleMouseUp);
    return () => canvas.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // Handle touch start
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();

    switch (e.touches.length) {
      case 1:
        // Single finger - start panning
        setIsTouching(true);
        setLastTouchPos([e.touches[0].clientX, e.touches[0].clientY]);
        break;
      case 2: {
        // Two fingers - start pinch zoom
        setIsTouching(true);
        const distance = getTouchDistance(e.touches);
        setLastTouchDistance(distance);
        break;
      }
    }
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    return () => canvas.removeEventListener("touchstart", handleTouchStart);
  }, [handleTouchStart]);

  const handleTouchPan = useCallback(
    (canvas: HTMLCanvasElement, touch: Touch) => {
      const rect = canvas.getBoundingClientRect();

      const deltaX = (touch.clientX - lastTouchPos[0]) / rect.width;
      const deltaY = (touch.clientY - lastTouchPos[1]) / rect.height;

      // Convert screen delta to world delta
      const worldDeltaX = -deltaX * size[0];
      const worldDeltaY = deltaY * size[1];

      setWasTouched(true);
      setCenter([center[0] + worldDeltaX, center[1] + worldDeltaY]);
      setLastTouchPos([touch.clientX, touch.clientY]);
    },
    [size, center, lastTouchPos],
  );

  const handleTouchZoom = useCallback(
    (canvas: HTMLCanvasElement, touches: TouchList) => {
      // Two fingers - pinch zoom
      const distance = getTouchDistance(touches);
      setLastTouchDistance(distance);
      if (distance === 0) {
        return;
      }

      const touchCenter = getTouchCenter(touches);
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

      setWasTouched(true);
    },
    [center, size, lastTouchDistance],
  );

  // Handle touch move
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      if (!isTouching) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      switch (e.touches.length) {
        case 1:
          handleTouchPan(canvas, e.touches[0]);
          break;
        case 2:
          handleTouchZoom(canvas, e.touches);
          break;
      }
    },
    [isTouching, handleTouchPan, handleTouchZoom],
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => canvas.removeEventListener("touchmove", handleTouchMove);
  }, [handleTouchMove]);

  // Handle touch end
  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      switch (e.touches.length) {
        case 0:
          setIsTouching(false);
          setWasTouched((prev) => {
            if (!prev && e.changedTouches.length === 1) {
              // Single tap
              const touch = e.changedTouches[0];
              handleClick(touch.clientX, touch.clientY);
            }
            return false;
          });
          break;
        case 1:
          if (lastTouchDistance > 0) {
            // Went from two fingers to one - reset for panning
            setLastTouchDistance(0);
            setLastTouchPos([e.touches[0].clientX, e.touches[0].clientY]);
          }
          break;
      }
    },
    [lastTouchDistance, handleClick],
  );
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => canvas.removeEventListener("touchend", handleTouchEnd);
  }, [handleTouchEnd]);

  // Change cursor on drag
  useEffect(() => {
    document.body.style.cursor =
      (isDragging && wasDragged) || (isTouching && wasTouched)
        ? "move"
        : "default";
  }, [isDragging, wasDragged, isTouching, wasTouched]);

  // Update fullUniforms when uniforms change. The canvas is always rendered, so
  // its ref is populated by the time this effect first runs after mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setFullUniforms({
      ...uniforms,
      size,
      center,
      pixelRatio: window.devicePixelRatio,
      resolution: [canvas.clientWidth, canvas.clientHeight],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(uniforms), size, center]);

  // Update fullUniforms when the canvas's layout box changes size. Reading the
  // canvas's own client size (rather than the window's) keeps the resolution in
  // sync with what CSS actually lays out, so the canvas never overflows.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateResolution = () => {
      setFullUniforms((prev) => {
        if (!prev) return prev;
        if (
          prev.resolution[0] === canvas.clientWidth &&
          prev.resolution[1] === canvas.clientHeight
        ) {
          return prev;
        }

        return {
          ...prev,
          resolution: [canvas.clientWidth, canvas.clientHeight],
        };
      });
    };

    const observer = new ResizeObserver(updateResolution);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // Setup the WebGL renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = PendulumRenderer.create(canvas);
    rendererRef.current = renderer;

    return () => {
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Render when fullUniforms changes: start an iterative low resolution
  // render right away, then an iterative full resolution render once the
  // parameters have settled. Any change cancels the renders in flight.
  useEffect(() => {
    const renderer = rendererRef.current;
    const canvas = canvasRef.current;
    if (!renderer || !canvas || !fullUniforms) return;

    setCanvasSize(
      canvas,
      fullUniforms.resolution[0],
      fullUniforms.resolution[1],
      fullUniforms.pixelRatio,
    );

    // Low resolution renders every step in a single chunk so panning and
    // zooming show the final image right away instead of an early iteration.
    renderer.startRender(fullUniforms, {
      scaleFactor: lowResScaleFactor,
      stepsPerChunk: fullUniforms.stepCount,
      progressive: false,
    });

    const fullResRenderTimeout = setTimeout(() => {
      // The full resolution render keeps the low resolution image on screen
      // until it completes; the progress bar tracks it in the meantime.
      renderer.startRender(fullUniforms, {
        scaleFactor: 1,
        stepsPerChunk: FULL_RES_STEPS_PER_CHUNK,
        progressive: false,
        onProgress: setFullResProgress,
        onComplete: () => setFullResProgress(null),
      });
    }, FULL_RES_DELAY_MS);

    return () => {
      clearTimeout(fullResRenderTimeout);
      renderer.cancelRender();
      setFullResProgress(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(fullUniforms), lowResScaleFactor]);

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

    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url);
  }, [uniforms, size, center, clickedAngles]);

  return (
    <>
      <div className="absolute bottom-4 md:top-4 right-4">
        <ShareButton onShare={handleShare} />
      </div>
      <div className="absolute bottom-18 md:top-18 right-4">
        <InfoButton onInfo={onInfo} />
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          imageRendering: "pixelated",
        }}
      />
      {fullResProgress !== null && (
        <div
          className="pointer-events-none fixed bottom-0 left-0 h-1 w-full bg-black/50"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fullResProgress * 100)}
        >
          <div
            className="h-full bg-white/90"
            style={{ width: `${fullResProgress * 100}%` }}
          />
        </div>
      )}
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
