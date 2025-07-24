"use client";

import { Suspense, useState } from "react";
import Controls from "~/components/Controls";
import PendulumCanvas, { InputUniforms } from "~/components/PendulumCanvas";
import { useSearchParams } from "next/navigation";
import { parseInputUniforms } from "~/utils/paramParser";

const defaultUniforms: InputUniforms = {
  gravity: 9.81,
  pendulumLengths: [1.0, 1.0],
  pendulumMasses: [3.0, 3.0],
  stepCount: 600,
};

function Visualizer() {
  const searchParams = useSearchParams();

  const [lowResScaleFactor, setLowResScaleFactor] = useState(8);
  const [uniforms, setUniforms] = useState<InputUniforms>(parseInputUniforms(searchParams) ?? defaultUniforms);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen">
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

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Visualizer />
    </Suspense>
  );
}