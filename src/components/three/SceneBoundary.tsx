"use client";

import { Component, type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

/** A WebGL scene that throws (no context, lost context) falls back to a static panel instead of a blank page. */
export class SceneBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    if (process.env.NODE_ENV !== "production") console.warn("[starminer] scene failed, using fallback:", error.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
