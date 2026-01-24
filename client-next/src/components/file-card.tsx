"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Code } from "@nsmr/pixelart-react";

interface FileCardProps {
  name: string;
  icon?: React.ReactNode;
  onClick: () => void;
}

export function FileCard({ name, icon, onClick }: FileCardProps) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          {icon || <Code className="h-5 w-5 text-yellow-500" />}
          <span className="font-mono text-sm truncate">{name}</span>
        </div>
      </CardContent>
    </Card>
  );
}
