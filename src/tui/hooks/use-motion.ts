import * as React from "react";

import type { MotionContextValue } from "@/components/ui/types.js";

const getEnv = (name: string): string | undefined =>
  typeof process !== "undefined" && process.env ? process.env[name] : undefined;

const isTruthy = (value: string | undefined): boolean =>
  value === "1" || value?.toLocaleLowerCase() === "true";

export const isReducedMotion = (): boolean =>
  isTruthy(getEnv("NO_MOTION")) ||
  isTruthy(getEnv("CI")) ||
  getEnv("TERM") === "dumb";

export const MotionContext = React.createContext<MotionContextValue>({
  reduced: isReducedMotion(),
});

export const useMotion = (): MotionContextValue =>
  React.useContext(MotionContext);
