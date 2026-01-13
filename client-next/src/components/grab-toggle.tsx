"use client";

import { useEffect } from "react";

export function GrabToggle() {
  useEffect(() => {
    // Poll for the API to be ready
    const checkApi = setInterval(() => {
      const api = (window as any).__REACT_GRAB__;
      if (api) {
        clearInterval(checkApi);
        // Deactivate initially (hide by default)
        if (api.isActive()) {
          api.deactivate();
        }
      }
    }, 100);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F1") {
        e.preventDefault();
        const api = (window as any).__REACT_GRAB__;
        if (api) {
          api.toggle();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearInterval(checkApi);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}
