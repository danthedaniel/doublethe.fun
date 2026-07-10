import { useCallback, useEffect, useState } from "react";
import Controls from "~/components/Controls";
import PendulumCanvas, { type InputUniforms } from "~/components/PendulumCanvas";
import Tutorial from "~/components/tutorial/Tutorial";
import { defaultUniforms } from "~/utils/defaultUniforms";
import { initialSearchParams } from "~/utils/initialSearchParams";
import { parseInputUniforms } from "~/utils/paramParser";

function getLowResScaleFactor() {
  const lowResScaleFactor = localStorage.getItem("lowResScaleFactor");
  if (lowResScaleFactor) {
    return parseInt(lowResScaleFactor, 10);
  }

  return 10;
}

// Show the intro on load unless it's been dismissed before, or the page was
// opened from a share link (which carries its own view to display).
function getShowTutorial() {
  return (
    localStorage.getItem("tutorialCompleted") !== "true" &&
    initialSearchParams.size === 0
  );
}

export default function App() {
  const [showTutorial, setShowTutorial] = useState(getShowTutorial);
  const [lowResScaleFactor, setLowResScaleFactorInner] = useState(getLowResScaleFactor());
  const [uniforms, setUniforms] = useState<InputUniforms>(
    parseInputUniforms(initialSearchParams) ?? defaultUniforms,
  );

  const handleTutorialDone = useCallback(() => {
    localStorage.setItem("tutorialCompleted", "true");
    setShowTutorial(false);
  }, []);

  const handleShowTutorial = useCallback(() => setShowTutorial(true), []);

  const setLowResScaleFactor = useCallback((lowResScaleFactor: number) => {
    localStorage.setItem("lowResScaleFactor", lowResScaleFactor.toString());
    setLowResScaleFactorInner(lowResScaleFactor);
  }, []);

  useEffect(() => {
    console.log("Source: https://github.com/danthedaniel/doublethe.fun");
  }, []);

  // Clear URL parameters after load
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  if (showTutorial) {
    return <Tutorial onDone={handleTutorialDone} />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full pt-15 md:pt-0">
      <PendulumCanvas
        lowResScaleFactor={lowResScaleFactor}
        uniforms={uniforms}
        onInfo={handleShowTutorial}
      />
      <Controls
        uniforms={uniforms}
        setUniforms={setUniforms}
        lowResScaleFactor={lowResScaleFactor}
        setLowResScaleFactor={setLowResScaleFactor}
      />
    </div>
  );
}
