export function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <div className={`relative ${className}`} role="img" aria-label="Opencode Studio Logo">
      <span
        className="absolute inset-0 bg-contain bg-center bg-no-repeat dark:opacity-100 opacity-0 transition-opacity duration-0"
        style={{ backgroundImage: "url('/logo-dark.png')" }}
      />
      <span
        className="absolute inset-0 bg-contain bg-center bg-no-repeat dark:opacity-0 opacity-100 transition-opacity duration-0"
        style={{ backgroundImage: "url('/logo-light.png')" }}
      />
    </div>
  );
}
