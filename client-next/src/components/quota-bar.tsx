"use client";

import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock } from "@nsmr/pixelart-react";
import type { QuotaInfo } from "@/types";

interface QuotaBarProps {
  quota: QuotaInfo
  compact?: boolean;
}

function getQuotaColor(percentage: number): string {
  if (percentage > 50) return "text-green-600";
  if (percentage > 30) return "text-yellow-600";
  return "text-red-600";
}

function getProgressColor(percentage: number): string {
  if (percentage > 50) return "[&>div]:bg-green-500";
  if (percentage > 30) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

function formatResetTime(resetAt: string): string {
  const reset = new Date(resetAt);
  const now = new Date();
  const diff = reset.getTime() - now.getTime();
  
  if (diff <= 0) return "Resetting...";
  
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function QuotaBar({ quota, compact = false }: QuotaBarProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Progress
          value={quota.percentage}
          className={`h-2 w-24 ${getProgressColor(quota.percentage)}`}
        />
        <span className={`text-xs font-medium ${getQuotaColor(quota.percentage)}`}>
          {quota.percentage}%
        </span>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-lg bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Daily Quota</span>
          <Badge variant="outline" className={getQuotaColor(quota.percentage)}>
            {quota.percentage}%
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Resets in {formatResetTime(quota.resetAt)}</span>
        </div>
      </div>
      
      <Progress
        value={quota.percentage}
        className={`h-2 ${getProgressColor(quota.percentage)}`}
      />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{quota.used.toLocaleString()} used</span>
        <span>{quota.remaining.toLocaleString()} remaining</span>
      </div>
    </div>
  );
}
