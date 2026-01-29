"use client";

import { InfoBox } from "@nsmr/pixelart-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PageHelpProps {
  title: string;
  docUrl: string;
  docTitle: string;
}

export interface PageHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: string;
}

export function PageHelp({ title, docUrl, docTitle }: PageHelpProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <h1 className="text-2xl font-bold">{title}</h1>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${docTitle}`}
              className="inline-flex items-center"
            >
              <InfoBox className="h-4 w-4 text-muted-foreground hover:text-primary" />
            </a>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-2">
              <p className="text-sm font-medium">{docTitle}</p>
              <p className="text-xs text-muted-foreground">Open documentation</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
