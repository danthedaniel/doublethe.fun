"use client";

import { useState } from "react";
import Controls from "~/components/Controls";
import PendulumCanvas, { InputUniforms } from "~/components/PendulumCanvas";

export default function Home() {
  const [uniforms, setUniforms] = useState<InputUniforms>({
    gravity: 9.81,
    pendulumLengths: [1.0, 1.0],
    pendulumMasses: [3.0, 3.0],
    stepCount: 600,
  });

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen">
      <PendulumCanvas uniforms={uniforms} />
      <Controls uniforms={uniforms} setUniforms={setUniforms} />
    </div>
  );
}
