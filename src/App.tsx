import { useCallback, useEffect, useState } from "react";
import Controls from "~/components/Controls";
import PendulumCanvas, { InputUniforms } from "~/components/PendulumCanvas";
import { initialSearchParams } from "~/utils/initialSearchParams";
import { parseInputUniforms } from "~/utils/paramParser";

function getLowResScaleFactor() {
  const lowResScaleFactor = localStorage.getItem("lowResScaleFactor");
  if (lowResScaleFactor) {
    return parseInt(lowResScaleFactor);
  }

  return 10;
}

const defaultUniforms: InputUniforms = {
  gravity: 9.81,
  pendulumLengths: [1.0, 1.0],
  pendulumMasses: [3.0, 3.0],
  stepCount: 800,
};

export default function App() {
  const [lowResScaleFactor, setLowResScaleFactorInner] = useState(getLowResScaleFactor());
  const [uniforms, setUniforms] = useState<InputUniforms>(
    parseInputUniforms(initialSearchParams) ?? defaultUniforms,
  );

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

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full pt-15 md:pt-0">
      <PendulumCanvas
        lowResScaleFactor={lowResScaleFactor}
        uniforms={uniforms}
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
