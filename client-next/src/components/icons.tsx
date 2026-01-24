"use client";

interface IconProps {
  className?: string;
}

export function TerminalIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M3 3h18v18H3V3zm2 2v6h14V5H5zm14 8H5v6h14v-6zM7 7h2v2H7V7zm2 8H7v2h2v-2z" fill="currentColor"/>
    </svg>
  );
}

export function PuzzleIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M3 3h10v10H3V3zm8 8V5H5v6h6zm12 8h-8v2h8v2h8v-2h-8V9h2v-2h2V9h2v-2h2V9h2z" fill="currentColor"/>
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M13 3h-2v2H9v2H7v2H5v2H3v2h2v2h2v2h2v2h2v2h2v-2h2v-2h2v-2h2v-2h2v-2h2v-2h2v-2h2v-2h-2v-2h-2v-2h-2V9h-2V7h-2V5h-2V3h-2v1zm0 2v2h2v2h2v2h2v2h2v2h-2v2h-2v-2h-2v-2h-2v-2h-2v-2h-2v-2h-2v-2h2v-2h2v-2h2v-2h2v-2h2zm-8 6H8v2H7v-2h-1z" fill="currentColor"/>
    </svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M4 4h16v12H8V8h8v6h2V6H6v12h14v2H4V4zm10 10v-4h-4v4h4z" fill="currentColor"/>
    </svg>
  );
}

export function LayersIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M3 2h10v2H3V2zm8 8H3v2h8v-2zm-8 4h10v2H3v-2zm12 0H5v2h10v-2zm-8 4v2h2v2H7v-2h-2v2h2v2H3v-2zm12 8h-2v2h2v-2z" fill="currentColor"/>
    </svg>
  );
}

export function RocketIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M12 2L9 7h2v2H7v2h2v2H9v2h2v2h2v-2h2v-2h2v-2h-2V9h2V7h-2V7h-2V2zm-3 6v2h2v-2h2v2h2v-2h-2zm6 2v-2h2v2h-2z" fill="currentColor"/>
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M16 2H8v2H6v2H4v2h2v2h2v2h2v2h2v2h2v-2h2v-2h2v-2h2v-2h2v-2h2V6h-2V4h-2V2h-2zm-8 6H7v2h2v2h2v-2h2v-2h2v-2zm12 4v-2h2v2h-2zm0 0v2h-2v2h2v-2z" fill="currentColor"/>
    </svg>
  );
}

export function WandIcon({ className }: IconProps) {
  return (
    <svg fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className}>
      <path d="M8 2h2v2H8V2zm4 2h2v2h-2V4zm4 2h2v2h-2V6zm2 4v2h2v2h-2v-2h-2v-2zm4 2v2h2v-2h-2zm-2 2v2h2v-2zm-6 4h2v2h-2v-2zm-2 2v2h2v-2zm-2 2v2h2v-2z" fill="currentColor"/>
    </svg>
  );
}
