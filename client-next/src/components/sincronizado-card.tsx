"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Github, ExternalLink } from "@nsmr/pixelart-react";

export function SincronizadoCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5 text-primary" />
          <CardTitle>Sincronizado</CardTitle>
        </div>
        <CardDescription>
          Hyper-local development stack with remote AI execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-muted/30 rounded-lg space-y-2">
          <p className="text-sm">
            Sincronizado bridges local editing with remote AI execution on VPS.
            Perfect for development workflows with OpenCode or Claude Code.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full">
            <a href="https://github.com/Microck/sincronizado" target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4 mr-2" />
              View Repository
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="https://sincronizado.micr.dev" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Documentation
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
