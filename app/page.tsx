"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Controls from "~/components/Controls";
import PendulumCanvas, { InputUniforms } from "~/components/PendulumCanvas";
import { parseInputUniforms } from "~/utils/paramParser";

function getLowResScaleFactor() {
  if (typeof window !== "undefined") {
    const lowResScaleFactor = localStorage.getItem("lowResScaleFactor");
    if (lowResScaleFactor) {
      return parseInt(lowResScaleFactor);
    }
  }

  return 8;
}

const defaultUniforms: InputUniforms = {
  gravity: 9.81,
  pendulumLengths: [1.0, 1.0],
  pendulumMasses: [3.0, 3.0],
  stepCount: 800,
};

function Visualizer() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [lowResScaleFactor, setLowResScaleFactorInner] = useState(getLowResScaleFactor());
  const [uniforms, setUniforms] = useState<InputUniforms>(parseInputUniforms(searchParams) ?? defaultUniforms);

  const setLowResScaleFactor = useCallback((lowResScaleFactor: number) => {
    localStorage.setItem("lowResScaleFactor", lowResScaleFactor.toString());
    setLowResScaleFactorInner(lowResScaleFactor);
  }, []);

  useEffect(() => {
    console.log("Source: https://github.com/danthedaniel/doublethe.fun");
  }, []);

  // Clear URL parameters after load
  useEffect(() => {
    router.replace("/", { scroll: false });
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen pt-15 md:pt-0">
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

function Loading() {
  return (
    <div className="w-full h-full flex items-center justify-center text-center text-gray-500">
      Loading...
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <Visualizer />
    </Suspense>
  );
}