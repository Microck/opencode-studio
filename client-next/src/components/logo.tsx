"use client";

import Image from "next/image";

export function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Image
        src="/opencode-logo.png"
        alt="Opencode Logo"
        fill
        className="object-contain"
        priority
      />
    </div>
  );
}
