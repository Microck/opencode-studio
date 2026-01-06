"use client";

import Image from "next/image";

export function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Image
        src="/logo-dark.png"
        alt="Opencode Studio Logo"
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-contain dark:opacity-100 opacity-0 transition-opacity duration-0"
        priority
      />
      <Image
        src="/logo-light.png"
        alt="Opencode Studio Logo"
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-contain dark:opacity-0 opacity-100 transition-opacity duration-0"
        priority
      />
    </div>
  );
}
