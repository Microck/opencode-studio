import { Loader } from "@nsmr/pixelart-react";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
