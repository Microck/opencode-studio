"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsageStats, UsageStats } from "@/lib/api";
import { 
  Loader2, DollarSign, MessageSquare, Calendar, Download, 
  TrendingUp, Filter, Users, Image as ImageIcon,
  BarChart3, PieChart as PieChartIcon, Activity
} from "lucide-react";
import { toast } from "sonner";
import { calculateCost, calculateDetailedCost } from "@/lib/data/pricing";
import { formatCurrency, formatTokens, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFilterStore } from "@/lib/store/filters";
import { toPng } from 'html-to-image';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ["#D1C6C6", "#AC9F9F", "#877A7A", "#615757", "#3C3636"];
// Reversed colors for timeline stacking (Darkest first/bottom -> Lightest last/top)
const STACK_COLORS = [...COLORS].reverse();

const TIME_RANGES = [
  { label: "24 Hours", value: "24h", granularity: "hourly" },
  { label: "7 Days", value: "7d", granularity: "daily" },
  { label: "30 Days", value: "30d", granularity: "daily" },
  { label: "3 Months", value: "3m", granularity: "daily" }, // Approx 90 days
  { label: "6 Months", value: "6m", granularity: "weekly" }, // Weekly is better for 6m
  { label: "1 Year", value: "1y", granularity: "monthly" },
  { label: "Custom", value: "custom", granularity: "daily" }, // Placeholder for now
];

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  const [pieConfig, setPieConfig] = useState({ cx: "45%", cy: "45%", legendRight: 35 });
  const [timeRange, setTimeRange] = useState("30d");
  const hoveredModelRef = useRef<string | null>(null);
  const barTooltipRef = useRef<HTMLDivElement>(null);
  const pieTooltipRef = useRef<HTMLDivElement>(null);
  
  const { projectId, setProjectId } = useFilterStore();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const selectedRange = TIME_RANGES.find(r => r.value === timeRange) || TIME_RANGES[2];
      const data = await getUsageStats(projectId, selectedRange.granularity, selectedRange.value);
      
      const enrichedStats: UsageStats = {
        totalCost: 0,
        totalTokens: data.totalTokens,
        byModel: (data.byModel || []).map(m => ({
          ...m,
          cost: calculateCost(m.name, m.inputTokens, m.outputTokens)
        })).sort((a, b) => b.cost - a.cost),
        byDay: (data.byDay || []).map((d: any) => {
          const modelCosts: Record<string, number> = {};
          (data.byModel || []).forEach(m => {
             modelCosts[m.name] = 0;
          });
          
          (data.byModel || []).forEach(m => {
             const mid = m.name;
             const it = d[`${mid}_input`] || 0;
             const ot = d[`${mid}_output`] || 0;
             if (it > 0 || ot > 0) {
                 modelCosts[mid] = calculateCost(mid, it, ot);
             }
          });
          return {
            ...d,
            ...modelCosts,
            cost: calculateCost("default", d.inputTokens, d.outputTokens)
          };
        }),
        byProject: (data.byProject || []).map(p => ({
          ...p,
          cost: calculateCost("default", p.inputTokens, p.outputTokens)
        })).sort((a, b) => b.cost - a.cost)
      };

      enrichedStats.totalCost = enrichedStats.byModel.reduce((acc, m) => acc + m.cost, 0);
      setStats(enrichedStats);
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || "Unknown error";
      toast.error(`Failed to fetch usage stats: ${msg}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [projectId, timeRange]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    
    // Always put "Others" last if it exists in the raw data or after slicing
    let finalModels = [...stats.byModel];
    
    if (!showAllModels && stats.byModel.length > 6) {
      const topModels = stats.byModel.slice(0, 5);
      const otherModels = stats.byModel.slice(5);
      const othersCost = otherModels.reduce((acc, m) => acc + m.cost, 0);
      const othersTokens = otherModels.reduce((acc, m) => acc + m.tokens, 0);
      const othersInput = otherModels.reduce((acc, m) => acc + m.inputTokens, 0);
      const othersOutput = otherModels.reduce((acc, m) => acc + m.outputTokens, 0);
      
      finalModels = [
        ...topModels,
        { 
          name: "Others", 
          cost: othersCost, 
          tokens: othersTokens, 
          inputTokens: othersInput, 
          outputTokens: othersOutput 
        }
      ];
    } else {
        // Just ensure Others is last if it exists from backend
        const othersIndex = finalModels.findIndex(m => m.name === "Others");
        if (othersIndex !== -1) {
            const others = finalModels.splice(othersIndex, 1)[0];
            finalModels.push(others);
        }
    }
    
    return finalModels;
  }, [stats, showAllModels]);

  const legendData = useMemo(() => {
    if (!stats) return [];
    // Ensure "Others" is at the bottom for the legend list as well
    const data = [...stats.byModel];
    const othersIndex = data.findIndex(m => m.name === "Others");
    if (othersIndex !== -1) {
      const others = data.splice(othersIndex, 1)[0];
      data.push(others);
    }
    return data;
  }, [stats]);

  const tableData = useMemo(() => {
    // Re-use sorted logic
    return legendData; 
  }, [legendData]);

  const modelIds = useMemo(() => {
    if (!stats) return [];
    // Ensure "Others" is included and at index 0 to render at the bottom of the stack
    const ids = stats.byModel.map(m => m.name).filter(name => name !== "Others");
    
    // Check if "Others" exists in the data and prepend it
    const othersExists = stats.byModel.some(m => m.name === "Others");
    if (othersExists) {
        ids.unshift("Others");
    }
    
    return ids;
  }, [stats]);

  const exportToCSV = () => {
    if (!stats) return;
    const headers = ["Model", "Input Tokens", "Output Tokens", "Total Tokens", "Est. Cost"];
    const rows = stats.byModel.map(m => [
      m.name,
      m.inputTokens,
      m.outputTokens,
      m.tokens,
      m.cost.toFixed(4)
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement("a"));
    link.href = url;
    link.download = `opencode-usage-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    document.body.removeChild(link);
  };

  const exportToImage = async () => {
    if (!dashboardRef.current) return;
    try {
      const dataUrl = await toPng(dashboardRef.current, { cacheBust: true, backgroundColor: '#000' });
      const link = document.body.appendChild(document.createElement('a'));
      link.download = 'opencode-dashboard.png';
      link.href = dataUrl;
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export image', err);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const totalInputTokens = stats.byModel.reduce((acc, m) => acc + m.inputTokens, 0);
  const totalOutputTokens = stats.byModel.reduce((acc, m) => acc + m.outputTokens, 0);

  return (
    <div ref={dashboardRef} className="flex flex-col gap-6 p-6 pb-8 bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Token Usage</h1>
          <p className="text-muted-foreground text-sm">
            Analysis of spending and token consumption across your projects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
             <SelectTrigger className="w-[120px] h-9 text-xs">
                <div className="flex items-center gap-2">
                   <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                   <SelectValue placeholder="Range" />
                </div>
             </SelectTrigger>
             <SelectContent>
                {TIME_RANGES.map((r) => (
                   <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
             </SelectContent>
          </Select>

          <Select value={projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Projects" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {(stats.byProject || []).map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>



          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToImage}>
                <ImageIcon className="h-4 w-4 mr-2" /> Save Screenshot
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-lift border-primary/10 shadow-sm bg-muted/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter text-foreground">{formatCurrency(stats.totalCost)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Estimated total spend</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm bg-muted/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Input Volume</CardTitle>
            <MessageSquare className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter text-foreground">{formatTokens(totalInputTokens)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Context and prompts</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm bg-muted/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Output Volume</CardTitle>
            <TrendingUp className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter text-foreground">{formatTokens(totalOutputTokens)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">AI responses</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="col-span-2 border-primary/10 bg-muted/5 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/10 pb-3 mb-4 px-6">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Usage Timeline
            </CardTitle>
          </CardHeader>
<CardContent className="h-[300px] w-full min-h-0 px-6 pt-4">
            <div 
              className="h-full w-full relative"
              onMouseMove={(e) => {
                if (barTooltipRef.current) {
                  barTooltipRef.current.style.transform = `translate(${e.clientX + 12}px, ${e.clientY - 12}px)`;
                }
              }}
              onMouseLeave={() => {
                if (barTooltipRef.current) {
                  barTooltipRef.current.style.opacity = '0';
                  barTooltipRef.current.style.pointerEvents = 'none';
                }
              }}
            >
              <div
                ref={barTooltipRef}
                className="fixed left-0 top-0 z-50 pointer-events-none rounded-lg border bg-background/95 p-3 shadow-2xl text-[10px] backdrop-blur-md border-primary/20 will-change-transform transition-opacity duration-75"
                style={{ opacity: 0 }}
              >
                <div className="flex flex-col gap-1">
                  <span data-bar-date className="uppercase text-muted-foreground font-bold border-b pb-1 mb-1"></span>
                  <div className="flex items-center gap-2 mb-1">
                    <span data-bar-color className="w-2 h-2 rounded-full" />
                    <span data-bar-model className="font-bold text-sm"></span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Input Cost</span>
                      <span data-bar-input className="font-mono"></span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Output Cost</span>
                      <span data-bar-output className="font-mono"></span>
                    </div>
                    <div className="flex justify-between gap-4 border-t pt-1 mt-0.5 font-bold">
                      <span>Total Cost</span>
                      <span data-bar-total className="text-primary"></span>
                    </div>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(v) => {
                      const date = new Date(v || "");
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'currentColor', opacity: 0.5 }}
                  />
                  <YAxis 
                    tickFormatter={(v) => `$${v}`}
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: 'currentColor', opacity: 0.5 }}
                  />
                  <Tooltip 
                    cursor={false}
                    content={({ active, payload, label }) => {
                      const hovered = hoveredModelRef.current;
                      if (barTooltipRef.current && active && payload && payload.length && hovered) {
                        const entry = payload.find((p: any) => p.name === hovered);
                        if (entry) {
                          const inputTokens = entry.payload[`${hovered}_input`] || 0;
                          const outputTokens = entry.payload[`${hovered}_output`] || 0;
                          const costs = calculateDetailedCost(hovered, inputTokens, outputTokens);
                          const tooltip = barTooltipRef.current;
                          tooltip.style.opacity = '1';
                          tooltip.querySelector('[data-bar-date]')!.textContent = new Date(label || "").toLocaleDateString('en-US', { dateStyle: 'medium' });
                          tooltip.querySelector('[data-bar-color]')!.setAttribute('style', `background-color: ${entry.color}`);
                          tooltip.querySelector('[data-bar-model]')!.textContent = hovered;
                          tooltip.querySelector('[data-bar-input]')!.textContent = formatCurrency(costs.inputCost);
                          tooltip.querySelector('[data-bar-output]')!.textContent = formatCurrency(costs.outputCost);
                          tooltip.querySelector('[data-bar-total]')!.textContent = formatCurrency(costs.total);
                        }
                      } else if (barTooltipRef.current) {
                        barTooltipRef.current.style.opacity = '0';
                      }
                      return null;
                    }}
                  />
                  {modelIds.map((modelId, index) => (
                    <Bar 
                      key={modelId}
                      dataKey={modelId}
                      stackId="a"
                      fill={modelId === "Others" ? "#2e2e2e" : STACK_COLORS[index % STACK_COLORS.length]}
                      radius={[0, 0, 0, 0]}
                      onMouseEnter={() => { hoveredModelRef.current = modelId; }}
                      onMouseLeave={() => { hoveredModelRef.current = null; }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-primary/10 bg-muted/5 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/10 pb-3 mb-4 px-6">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <PieChartIcon className="h-3.5 w-3.5 text-primary" />
              Cost Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0 px-6 pt-4 pb-12">
            <div 
              className="h-full w-full relative"
              onMouseMove={(e) => {
                if (pieTooltipRef.current) {
                  pieTooltipRef.current.style.transform = `translate(${e.clientX + 12}px, ${e.clientY - 12}px)`;
                }
              }}
              onMouseLeave={() => {
                if (pieTooltipRef.current) {
                  pieTooltipRef.current.style.opacity = '0';
                }
              }}
            >
              <div
                ref={pieTooltipRef}
                className="fixed left-0 top-0 z-50 pointer-events-none rounded-lg border bg-background/95 p-2 shadow-xl text-[10px] backdrop-blur-md border-primary/20 will-change-transform transition-opacity duration-75"
                style={{ opacity: 0 }}
              >
                <div className="flex flex-col">
                  <span data-pie-name className="font-bold truncate max-w-[150px]"></span>
                  <span data-pie-value className="text-sm font-bold text-primary"></span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx={pieConfig.cx}
                    cy={pieConfig.cy}
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="cost"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.name === "Others" ? "#2e2e2e" : COLORS[index % COLORS.length]} 
                        stroke="hsl(var(--background))" 
                        strokeWidth={2} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    isAnimationActive={false}
                    content={({ active, payload }) => {
                      if (pieTooltipRef.current && active && payload && payload.length) {
                        const name = payload[0].name as string;
                        const value = Number(payload[0].value);
                        const tooltip = pieTooltipRef.current;
                        tooltip.style.opacity = '1';
                        tooltip.querySelector('[data-pie-name]')!.textContent = name;
                        tooltip.querySelector('[data-pie-value]')!.textContent = formatCurrency(value);
                      } else if (pieTooltipRef.current) {
                        pieTooltipRef.current.style.opacity = '0';
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: "11px", right: pieConfig.legendRight }}
                    content={({ payload }) => {
                      const sortedPayload = [...(payload || [])].sort((a: any, b: any) => {
                        if (a.value === "Others") return 1;
                        if (b.value === "Others") return -1;
                        const aCost = pieData.find(p => p.name === a.value)?.cost || 0;
                        const bCost = pieData.find(p => p.name === b.value)?.cost || 0;
                        return bCost - aCost;
                      });
                      return (
                        <ul className="space-y-2">
                          {sortedPayload.map((entry: any, index: number) => (
                            <li key={`item-${index}`} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                              <span className="truncate text-[10px] font-medium opacity-80" title={entry.value}>{entry.value}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="col-span-1 border-primary/10 shadow-sm overflow-hidden flex flex-col bg-muted/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/10 pb-3 mb-4 px-6">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              Top Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground border-b text-[9px] uppercase font-bold sticky top-0 z-10">
                  <th className="px-6 py-2">Project</th>
                  <th className="px-6 py-2 text-right">Estimated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {(stats.byProject || []).map((proj) => (
                  <tr 
                    key={proj.id} 
                    className={cn(
                      "hover:bg-muted/20 transition-colors cursor-pointer group",
                      projectId === proj.id && "bg-muted/40"
                    )}
                    onClick={() => setProjectId(proj.id === projectId ? null : proj.id)}
                  >
                    <td className="px-6 py-2 font-medium truncate max-w-[150px]">{proj.name}</td>
                    <td className="px-6 py-2 text-right font-bold tabular-nums text-primary/80">{formatCurrency(proj.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-primary/10 shadow-sm overflow-hidden flex flex-col bg-muted/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/10 pb-3 mb-4 px-6">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Model Performance Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
            <div className="w-full">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="sticky top-0 bg-muted z-10 shadow-sm">
                  <tr className="text-muted-foreground border-b text-[9px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-2">Model Interface</th>
                    <th className="px-6 py-2 text-right">Input</th>
                    <th className="px-6 py-2 text-right">Output</th>
                    <th className="px-6 py-2 text-right text-primary">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(tableData || []).map((model) => (
                    <tr key={model.name} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-2 font-bold text-foreground/80">{model.name}</td>
                      <td className="px-6 py-2 text-right text-muted-foreground font-mono tabular-nums">{model.inputTokens.toLocaleString()}</td>
                      <td className="px-6 py-2 text-right text-muted-foreground font-mono tabular-nums">{model.outputTokens.toLocaleString()}</td>
                      <td className="px-6 py-2 text-right font-black tabular-nums text-primary">{formatCurrency(model.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="h-12" />
    </div>
  );
}
