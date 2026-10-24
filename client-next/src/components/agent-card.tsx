"use client";

import { useTranslations } from "next-intl";
import type { AgentInfo } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Code, Trash, ToggleLeft, ToggleRight } from "@nsmr/pixelart-react";

interface AgentCardProps {
  agent: AgentInfo;
  onEdit: (agent: AgentInfo) => void;
  onDelete: (agent: AgentInfo) => void;
  onToggle: (agent: AgentInfo) => void;
}

export function AgentCard({ agent, onEdit, onDelete, onToggle }: AgentCardProps) {
  const t = useTranslations("agents");
  const sourceLabelKey = ["json", "json-config"].includes(agent.source) ? "sourceJson" : agent.source === "markdown" ? "sourceMarkdown" : "sourceBuiltin";
  const modeLabel = agent.mode || (agent.configurationFormat === "v2" ? "primary" : t("defaultMode"));

  return (
    <Card className={cn("border-border/70", agent.disabled && "opacity-60")}> 
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{modeLabel}</Badge>
          <Badge variant="outline">{t(sourceLabelKey)}</Badge>
          {agent.disabled && <Badge variant="destructive">{t("disabled")}</Badge>}
        </div>
        <CardTitle className="text-base">{agent.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {agent.description || t("noDescription")}
        </div>
        {agent.model && (
          <div className="text-xs text-muted-foreground font-mono">{agent.model}</div>
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => onToggle(agent)}>
            {agent.disabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {agent.disabled ? t("enable") : t("disable")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(agent)}>
            <Code className="h-4 w-4" />
            {t("edit")}
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(agent)}>
            <Trash className="h-4 w-4" />
            {t("delete")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
