"use client";

import { useState, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { InputUniforms } from "./PendulumCanvas";
import styles from "./Controls.module.css";

interface ControlsProps {
  uniforms: InputUniforms;
  setUniforms: (uniforms: InputUniforms) => void;
  lowResScaleFactor: number;
  setLowResScaleFactor: (lowResScaleFactor: number) => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  onChange: (value: number) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  precision,
  onChange,
}: SliderProps) {
  const [inputValue, setInputValue] = useState(value.toFixed(precision));

  // Update input value when slider value changes
  useEffect(() => {
    setInputValue(value.toFixed(precision));
  }, [value, precision]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      setInputValue(value.toFixed(precision));
      return;
    }

    // Clamp the value to the allowed range
    const clampedValue = Math.max(min, Math.min(max, numValue));
    onChange(clampedValue);
    setInputValue(clampedValue.toFixed(precision));
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded w-16 text-center border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${styles.slider}`}
      />
    </div>
  );
}

export default function Controls({
  uniforms,
  setUniforms,
  lowResScaleFactor,
  setLowResScaleFactor,
}: ControlsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Header with toggle button */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 className="text-lg font-semibold text-gray-800">Controls</h2>
        <ChevronDownIcon
          className={`w-5 h-5 text-gray-600 transition-transform duration-200 ${
            isCollapsed ? "rotate-180" : ""
          }`}
        />
      </div>

      {/* Collapsible content */}
      <div
        className={`flex flex-col duration-300 ease-in-out w-56 ${
          isCollapsed ? "max-h-0" : "max-h-[800px]"
        } overflow-hidden`}
      >
        <div className="px-6 py-2">
          <Slider
            label="Low Res Scale"
            value={lowResScaleFactor}
            min={1}
            max={16}
            step={1}
            precision={0}
            onChange={(value) => setLowResScaleFactor(value)}
          />

          <Slider
            label="Step Count"
            value={uniforms.stepCount}
            min={50}
            max={1000}
            step={1}
            precision={0}
            onChange={(value) => setUniforms({ ...uniforms, stepCount: value })}
          />

          <Slider
            label="Gravity"
            value={uniforms.gravity}
            min={0}
            max={20}
            step={0.1}
            precision={1}
            onChange={(value) => setUniforms({ ...uniforms, gravity: value })}
          />

          <h3 className="text-md font-medium text-gray-700 mb-3 border-b border-gray-200 pb-1">
            Pendulum A
          </h3>
          <Slider
            label="Length"
            value={uniforms.pendulumLengths[0]}
            min={0.1}
            max={10}
            step={0.1}
            precision={1}
            onChange={(value) =>
              setUniforms({
                ...uniforms,
                pendulumLengths: [value, uniforms.pendulumLengths[1]],
              })
            }
          />
          <Slider
            label="Mass"
            value={uniforms.pendulumMasses[0]}
            min={0.1}
            max={10}
            step={0.1}
            precision={1}
            onChange={(value) =>
              setUniforms({
                ...uniforms,
                pendulumMasses: [value, uniforms.pendulumMasses[1]],
              })
            }
          />

          <h3 className="text-md font-medium text-gray-700 mb-3 border-b border-gray-200 pb-1">
            Pendulum B
          </h3>
          <Slider
            label="Length"
            value={uniforms.pendulumLengths[1]}
            min={0.1}
            max={10}
            step={0.1}
            precision={1}
            onChange={(value) =>
              setUniforms({
                ...uniforms,
                pendulumLengths: [uniforms.pendulumLengths[0], value],
              })
            }
          />
          <Slider
            label="Mass"
            value={uniforms.pendulumMasses[1]}
            min={0.1}
            max={10}
            step={0.1}
            precision={1}
            onChange={(value) =>
              setUniforms({
                ...uniforms,
                pendulumMasses: [uniforms.pendulumMasses[0], value],
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
