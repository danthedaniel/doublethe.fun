import { type ReactNode, useEffect, useRef } from "react";
import { defaultUniforms } from "~/utils/defaultUniforms";
import { PendulumRenderer } from "~/utils/pendulumRenderer";

interface MapStageProps {
  // Explanatory copy shown above the map.
  children: ReactNode;
  onFinish: () => void;
}

// Reusable final stage: an inset of the real chaos map. Clicking it (or the
// button) leaves the tutorial and opens the full-screen visualization.
export default function MapStage({ children, onFinish }: MapStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // One-shot render at mount size. StrictMode is off, so this runs once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio;
    canvas.width = Math.round(rect.width * pixelRatio);
    canvas.height = Math.round(rect.height * pixelRatio);

    const renderer = PendulumRenderer.create(canvas);
    renderer?.startRender(
      {
        ...defaultUniforms,
        resolution: [rect.width, rect.height],
        pixelRatio,
        size: [2 * Math.PI, 2 * Math.PI],
        center: [0, 0],
      },
      { scaleFactor: 3, stepsPerChunk: 40, progressive: true },
    );

    return () => renderer?.dispose();
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-4 sm-tall:gap-8">
      <p className="mx-auto max-w-2xl text-center text-base sm:text-xl md:text-2xl">
        {children}
      </p>

      <div className="relative mx-auto aspect-square w-full max-w-[min(28rem,38dvh)] overflow-hidden rounded shadow">
        <canvas
          ref={canvasRef}
          onClick={onFinish}
          className="h-full w-full cursor-zoom-in"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <button
        type="button"
        onClick={onFinish}
        className="cursor-pointer rounded-full bg-black px-6 py-2 text-white hover:bg-gray-800"
      >
        Go fullscreen
      </button>
    </div>
  );
}
