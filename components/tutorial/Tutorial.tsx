import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { type ComponentType, useState } from "react";
import { useSwipe } from "~/hooks/useSwipe";
import { classNames } from "~/utils/classNames";
import TutorialStageFive from "./TutorialStageFive";
import TutorialStageFour from "./TutorialStageFour";
import TutorialStageOne from "./TutorialStageOne";
import TutorialStageThree from "./TutorialStageThree";
import TutorialStageTwo from "./TutorialStageTwo";

export interface TutorialStageProps {
  // Leaves the tutorial. The final stage wires this to its "go fullscreen"
  // action; earlier stages ignore it.
  onDone: () => void;
}

// The ordered stages, swapped in and out one at a time as the user advances.
const STAGES: ComponentType<TutorialStageProps>[] = [
  TutorialStageOne,
  TutorialStageTwo,
  TutorialStageThree,
  TutorialStageFour,
  TutorialStageFive,
];

interface TutorialProps {
  // Called when the tutorial is completed or skipped.
  onDone: () => void;
}

export default function Tutorial({ onDone }: TutorialProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const Stage = STAGES[stageIndex];
  const isLast = stageIndex === STAGES.length - 1;
  const isFirst = stageIndex === 0;

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => { if (!isLast) setStageIndex((i) => i + 1); },
    onSwipeRight: () => { if (!isFirst) setStageIndex((i) => i - 1); },
  });

  return (
    <div
      className="relative flex min-h-dvh w-full flex-col bg-white text-gray-900"
      {...swipeHandlers}
    >
      <button
        type="button"
        onClick={onDone}
        className="absolute right-4 top-4 z-10 cursor-pointer text-sm text-gray-500 hover:text-gray-800"
      >
        Skip
      </button>

      {/* Remounting per stage (via key) tears down each stage's simulators and
          renderer and rebuilds the next stage's from scratch. */}
      <div
        key={stageIndex}
        className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-4 sm-tall:gap-8 sm-tall:py-12"
      >
        <Stage onDone={onDone} />
      </div>

      <div className="flex items-center justify-center gap-4 py-3 sm-tall:py-6 sm-tall:-mt-4 mb-2">
        <button
          type="button"
          aria-label="Previous"
          disabled={isFirst}
          onClick={() => setStageIndex((index) => index - 1)}
          className={classNames(
            "flex h-9 w-9 items-center justify-center rounded-full border border-gray-300",
            isFirst
              ? "cursor-default text-gray-300"
              : "cursor-pointer text-gray-800 hover:bg-gray-100",
          )}
        >
          <ChevronLeftIcon className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-3">
          {STAGES.map((StageComponent, index) => (
            <button
              key={StageComponent.name}
              type="button"
              aria-label={`Step ${index + 1}`}
              aria-current={index === stageIndex}
              onClick={() => setStageIndex(index)}
              className="-m-3 cursor-pointer p-3"
            >
              <span
                className={classNames(
                  "block h-9 w-9 rounded-full transition-colors",
                  index === stageIndex
                    ? "bg-gray-900"
                    : "bg-gray-300 hover:bg-gray-400",
                )}
              />
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-label="Next"
          disabled={isLast}
          onClick={() => setStageIndex((index) => index + 1)}
          className={classNames(
            "flex h-9 w-9 items-center justify-center rounded-full border border-gray-300",
            isLast
              ? "cursor-default text-gray-300"
              : "cursor-pointer text-gray-800 hover:bg-gray-100",
          )}
        >
          <ChevronRightIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
