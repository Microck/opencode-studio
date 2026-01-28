"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getApiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Pause, Play, Trash, ArrowDown } from "@nsmr/pixelart-react";
import { PageHelp } from "@/components/page-help";

interface LogEntry {
  timestamp: number;
  line: string;
}

type LogFilter = "all" | "mcp" | "agent" | "error";

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<LogFilter>("all");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let active = true;
    const connect = async () => {
      try {
        const base = await getApiBaseUrl();
        if (!active) return;
        const source = new EventSource(`${base}/logs/stream`);
        eventSourceRef.current = source;

        source.onmessage = (event) => {
          if (paused) return;
          try {
            const entry = JSON.parse(event.data) as LogEntry;
            setLogs((prev) => [...prev.slice(-500), entry]);
          } catch {
            // ignore parse errors
          }
        };

        source.onerror = () => {
          toast.error("Log stream disconnected");
        };
      } catch (err: any) {
        toast.error(err?.message || "Failed to connect to logs");
      }
    };

    connect();
    return () => {
      active = false;
      eventSourceRef.current?.close();
    };
  }, [paused]);

  useEffect(() => {
    if (!autoScroll) return;
    if (!containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [logs, autoScroll]);

  const filtered = useMemo(() => {
    if (filter === "all") return logs;
    if (filter === "mcp") return logs.filter((l) => l.line.includes("[MCP]"));
    if (filter === "agent") return logs.filter((l) => l.line.includes("[Agent]"));
    if (filter === "error") {
      return logs.filter((l) => l.line.includes("[Error]") || l.line.includes("error=") || l.line.includes("status=429"));
    }
    return logs;
  }, [logs, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PageHelp title="Logs" docUrl="https://opencode.ai/docs/logs" docTitle="Live Log Viewer & Debugger" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as LogFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="mcp">MCP</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setPaused((prev) => !prev)}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" onClick={() => setAutoScroll((prev) => !prev)}>
            <ArrowDown className="h-4 w-4" />
            {autoScroll ? "Auto" : "Manual"}
          </Button>
          <Button variant="outline" onClick={() => setLogs([])}>
            <Trash className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="h-[70vh] overflow-y-auto rounded-md border border-border bg-background px-4 py-3 font-mono text-xs"
      >
        {filtered.length === 0 ? (
          <div className="text-muted-foreground">No log entries yet.</div>
        ) : (
          filtered.map((entry, idx) => (
            <div
              key={`${entry.timestamp}-${idx}`}
              className={cn(
                "whitespace-pre-wrap py-0.5",
                entry.line.includes("[Error]") || entry.line.includes("error=") || entry.line.includes("status=429")
                  ? "text-red-500"
                  : entry.line.includes("[MCP]")
                    ? "text-purple-400"
                    : entry.line.includes("[Agent]")
                      ? "text-emerald-400"
                      : "text-foreground"
              )}
            >
              {entry.line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
