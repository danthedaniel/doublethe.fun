import { ReadonlyURLSearchParams } from "next/navigation";
import { InputUniforms } from "~/components/PendulumCanvas";

function parseNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

function parseTuple(value: string | null): [number, number] | null {
  if (value === null) {
    return null;
  }

  const [a, b] = value.split(",").map(parseNumber);
  if (a === null || b === null) {
    return null;
  }

  return [a, b];
}

export function parseInputUniforms(params: ReadonlyURLSearchParams): InputUniforms | null {
  const gravity = parseNumber(params.get("gravity"));
  if (gravity === null) {
    return null;
  }

  const pendulumLengths = parseTuple(params.get("pendulumLengths"));
  if (pendulumLengths === null) {
    return null;
  }

  const pendulumMasses = parseTuple(params.get("pendulumMasses"));
  if (pendulumMasses === null) {
    return null;
  }

  const stepCount = parseNumber(params.get("stepCount"));
  if (stepCount === null) {
    return null;
  }

  return {
    gravity,
    pendulumLengths,
    pendulumMasses,
    stepCount,
  };
}

interface CanvasParams {
  size: [number, number];
  center: [number, number];
  clickedAngles: [number, number] | null;
}

export function parseCanvasParams(params: ReadonlyURLSearchParams): CanvasParams | null {
  const size = parseTuple(params.get("size"));
  if (size === null) {
    return null;
  }

  const center = parseTuple(params.get("center"));
  if (center === null) {
    return null;
  }

  const clickedAngles = parseTuple(params.get("clickedAngles"));

  return {
    size,
    center,
    clickedAngles,
  };
}
