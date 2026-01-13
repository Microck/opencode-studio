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
          // Sync class for CSS hiding
          if (api.isActive()) {
            document.body.classList.add('react-grab-visible');
          } else {
            document.body.classList.remove('react-grab-visible');
          }
        } else {
          document.body.classList.toggle('react-grab-visible');
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearInterval(checkApi);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <style jsx global>{`
      /* Hide React Grab UI by default */
      body:not(.react-grab-visible) [data-react-grab-toolbar-toggle],
      body:not(.react-grab-visible) [data-react-grab-toolbar-collapse] {
        display: none !important;
      }
      
      /* Hide the white container box */
      body:not(.react-grab-visible) div:has([data-react-grab-toolbar-toggle]) {
        display: none !important;
      }
    `}</style>
  );
}
