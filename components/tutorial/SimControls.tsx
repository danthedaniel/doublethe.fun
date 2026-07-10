import { ArrowPathIcon, PauseIcon, PlayIcon } from "@heroicons/react/24/outline";

interface SimControlsProps {
  playing: boolean;
  time: number;
  onPlayPause: () => void;
  onReset: () => void;
}

// Play/Pause + Reset transport and a monospaced simulation-time readout shared
// by every tutorial stage that animates simulations.
export default function SimControls({
  playing,
  time,
  onPlayPause,
  onReset,
}: SimControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={playing ? "Pause" : "Play"}
        className="cursor-pointer rounded-full border border-gray-300 p-2 text-gray-800 hover:bg-gray-100"
      >
        {playing ? (
          <PauseIcon className="h-5 w-5" />
        ) : (
          <PlayIcon className="h-5 w-5" />
        )}
      </button>
      <button
        type="button"
        onClick={onReset}
        aria-label="Reset"
        className="cursor-pointer rounded-full border border-gray-300 p-2 text-gray-800 hover:bg-gray-100"
      >
        <ArrowPathIcon className="h-5 w-5" />
      </button>
      <span className="font-mono tabular-nums text-sm text-gray-600">
        t = {time.toFixed(1)}s
      </span>
    </div>
  );
}
