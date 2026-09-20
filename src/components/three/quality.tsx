"use client";

import { createContext, useContext } from "react";

export type Quality = "high" | "low";

/** Read inside a <Canvas>: low on phones / coarse pointers, high otherwise. Drives segment counts and DPR. */
export const QualityContext = createContext<Quality>("high");

export const useQuality = () => useContext(QualityContext);

export const dprFor = (q: Quality): [number, number] => (q === "low" ? [1, 1.5] : [1, 2]);
