import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { classNames } from "~/utils/classNames";
import styles from "./Controls.module.css";
import type { InputUniforms } from "./PendulumCanvas";

interface ControlsProps {
  uniforms: InputUniforms;
  setUniforms: (uniforms: InputUniforms) => void;
  lowResScaleFactor: number;
  setLowResScaleFactor: (lowResScaleFactor: number) => void;
  onAdjustStart?: () => void;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision: number;
  hideInput?: boolean;
  reverse?: boolean;
  onChange: (value: number) => void;
  onAdjustStart?: () => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  precision,
  hideInput,
  reverse,
  onChange,
  onAdjustStart,
}: SliderProps) {
  const formattedValue = value.toFixed(precision);
  const [inputValue, setInputValue] = useState(formattedValue);

  // Reflect external value/precision changes in the editable text field. Done
  // during render (tracking the previous formatted value) rather than in an
  // effect, so the field never briefly shows a stale value.
  const [lastFormattedValue, setLastFormattedValue] = useState(formattedValue);
  if (formattedValue !== lastFormattedValue) {
    setLastFormattedValue(formattedValue);
    setInputValue(formattedValue);
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue);
    if (Number.isNaN(numValue)) {
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
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {!hideInput && (
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded w-16 text-center border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onAdjustStart}
        onChange={(e) => onChange(Number(e.target.value))}
        className={classNames(
          "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer",
          reverse ? "transform scale-x-[-1]" : "",
          styles.slider
        )}
      />
    </div>
  );
}

function ControlsContent({
  uniforms,
  setUniforms,
  lowResScaleFactor,
  setLowResScaleFactor,
  onAdjustStart,
}: ControlsProps) {
  return (
    <>
      <Slider
        label="Dynamic Resolution"
        value={lowResScaleFactor}
        min={1}
        max={16}
        step={1}
        precision={0}
        onChange={(value) => setLowResScaleFactor(value)}
        onAdjustStart={onAdjustStart}
        reverse={true}
        hideInput={true}
      />

      <Slider
        label="Step Count"
        value={uniforms.stepCount}
        min={50}
        max={2048}
        step={1}
        precision={0}
        onChange={(value) => setUniforms({ ...uniforms, stepCount: value })}
        onAdjustStart={onAdjustStart}
      />

      <Slider
        label="Gravity"
        value={uniforms.gravity}
        min={0}
        max={20}
        step={0.01}
        precision={2}
        onChange={(value) => setUniforms({ ...uniforms, gravity: value })}
        onAdjustStart={onAdjustStart}
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
        onAdjustStart={onAdjustStart}
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
        onAdjustStart={onAdjustStart}
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
        onAdjustStart={onAdjustStart}
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
        onAdjustStart={onAdjustStart}
      />
    </>
  );
}

export default function Controls({
  uniforms,
  setUniforms,
  lowResScaleFactor,
  setLowResScaleFactor,
}: ControlsProps) {
  // Default to collapsed on small screens, expanded on md+ screens
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Track when a control is being actively dragged, so the mobile panel can
  // fade its background out and reveal the pendulum behind it.
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    if (!isAdjusting) return;

    const stop = () => setIsAdjusting(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);

    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [isAdjusting]);

  // Check if we're on a small screen and adjust default collapsed state
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmallScreen = window.innerWidth < 768; // md breakpoint is 768px
      if (!isSmallScreen) {
        setIsCollapsed(false); // Default to expanded on md+ screens
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return (
    <>
      {/* Mobile version */}
      <div className="md:hidden">
        {/* Sticky collapsed header */}
        <div className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-lg border-b border-gray-200 z-40">
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
        </div>

        {!isCollapsed && (
          <div
             className={classNames(
              "fixed inset-0 z-50 overflow-y-auto transition-colors duration-300",
              isAdjusting ? "bg-white/50" : "bg-white"
            )}
          >
            {/* Sticky header in expanded state */}
            <div
              className={classNames(
                "sticky top-0 border-b z-10 transition-colors duration-300",
                isAdjusting
                  ? "bg-white/50 border-transparent"
                  : "bg-white border-gray-200"
              )}
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsCollapsed(true)}
              >
                <h2 className="text-lg font-semibold text-gray-800">Controls</h2>
                <ChevronDownIcon className="w-5 h-5 text-gray-600" />
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <ControlsContent
                uniforms={uniforms}
                setUniforms={setUniforms}
                lowResScaleFactor={lowResScaleFactor}
                setLowResScaleFactor={setLowResScaleFactor}
                onAdjustStart={() => setIsAdjusting(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Desktop version */}
      <div className="hidden md:block absolute top-4 left-4 bg-white/40 hover:bg-white backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 transition-colors duration-300 overflow-hidden">
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

        <div
          className={classNames(
            "flex flex-col duration-300 ease-in-out w-56",
            isCollapsed ? "max-h-0" : "max-h-200",
            "overflow-hidden"
          )}
        >
          <div className="px-6 py-2">
            <ControlsContent
              uniforms={uniforms}
              setUniforms={setUniforms}
              lowResScaleFactor={lowResScaleFactor}
              setLowResScaleFactor={setLowResScaleFactor}
            />
          </div>
        </div>
      </div>
    </>
  );
}
