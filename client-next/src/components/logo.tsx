"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function Logo({ className = "w-6 h-6" }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={`relative ${className}`} />;
  }

  const logoSrc = resolvedTheme === "dark" ? "/logo-dark.png" : "/logo-light.png";

  return (
    <div className={`relative ${className}`}>
      <Image
        src={logoSrc}
        alt="Opencode Studio Logo"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
