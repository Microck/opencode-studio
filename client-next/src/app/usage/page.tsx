"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsageStats, UsageStats } from "@/lib/api";
import { 
  Loader2, DollarSign, MessageSquare, Calendar, Download, 
  TrendingUp, Filter, Users, Image as ImageIcon, ArrowLeft,
  BarChart3, PieChart as PieChartIcon
} from "lucide-react";
import { calculateCost } from "@/lib/data/pricing";
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
import { IsometricHeatmap } from "@/components/isometric-heatmap";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  
  const { projectId, setProjectId, dateRange, setDateRange, granularity, setGranularity } = useFilterStore();
  const [showIsometric, setShowIsometric] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getUsageStats(projectId, granularity);
      
      const enrichedStats: UsageStats = {
        totalCost: 0,
        totalTokens: data.totalTokens,
        byModel: (data.byModel || []).map(m => ({
          ...m,
          cost: calculateCost(m.name, m.inputTokens, m.outputTokens)
        })).sort((a, b) => b.cost - a.cost),
        byDay: (data.byDay || []).map(d => ({
          ...d,
          cost: calculateCost("default", d.inputTokens, d.outputTokens) 
        })),
        byProject: (data.byProject || []).map(p => ({
          ...p,
          cost: calculateCost("default", p.inputTokens, p.outputTokens)
        })).sort((a, b) => b.cost - a.cost)
      };

      enrichedStats.totalCost = enrichedStats.byModel.reduce((acc, m) => acc + m.cost, 0);

      const heatmap = Array(7 * 3).fill(0).map((_, i) => ({
        day: Math.floor(i / 3),
        hourBucket: i % 3,
        value: 0
      }));

      enrichedStats.byDay.forEach(day => {
        const dateObj = new Date(day.date);
        const dayOfWeek = dateObj.getDay();
        const hour = dateObj.getUTCHours();
        
        let bucket = 1; 
        if (hour < 8) bucket = 0; 
        else if (hour > 18) bucket = 2; 
        
        heatmap[dayOfWeek * 3 + bucket].value += day.cost;
      });

      setStats(enrichedStats);
      setHeatmapData(heatmap);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [projectId, granularity, dateRange]);

  const pieData = useMemo(() => {
    if (!stats) return [];
    if (showAllModels || stats.byModel.length <= 6) return stats.byModel;
    
    const topModels = stats.byModel.slice(0, 5);
    const otherModels = stats.byModel.slice(5);
    const othersCost = otherModels.reduce((acc, m) => acc + m.cost, 0);
    
    return [
      ...topModels,
      { name: "Others", cost: othersCost, tokens: 0, inputTokens: 0, outputTokens: 0 }
    ];
  }, [stats, showAllModels]);

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
    const link = document.createElement("a");
    link.href = url;
    link.download = `opencode-usage-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToImage = async () => {
    if (!dashboardRef.current) return;
    try {
      const dataUrl = await toPng(dashboardRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = 'opencode-dashboard.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
    }
  };

  const projectedCost = stats ? (stats.totalCost * 1.2) : 0; 

  if (loading && !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div ref={dashboardRef} className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Token Usage</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Analysis of spending and token consumption across your projects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-muted/50 px-3 py-1.5 rounded-md border border-border">
            <Switch 
              id="isometric-mode" 
              checked={showIsometric} 
              onCheckedChange={setShowIsometric} 
            />
            <Label htmlFor="isometric-mode" className="text-xs cursor-pointer select-none">3D Heatmap</Label>
          </div>
          
          <Select value={projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? null : v)}>
            <SelectTrigger className="w-[160px] h-9">
              <div className="flex items-center gap-2 text-xs">
                <Filter className="h-3 w-3 text-muted-foreground" />
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
              <Button variant="outline" size="sm" className="h-9 text-xs">
                <Calendar className="h-3 w-3 mr-2" />
                {dateRange === 'all' ? 'All Time' : dateRange}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDateRange("24h")}>Last 24 Hours</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("7d")}>Last 7 Days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("30d")}>Last 30 Days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDateRange("all")}>All Time</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tighter">{formatCurrency(stats.totalCost)}</div>
            <div className="flex items-center gap-2 mt-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-muted-foreground">Projected: {formatCurrency(projectedCost)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Input Volume</CardTitle>
            <MessageSquare className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tighter">{formatTokens(stats.byModel.reduce((acc, m) => acc + m.inputTokens, 0))}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Context / Prompts</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Output Volume</CardTitle>
            <TrendingUp className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tighter">{formatTokens(stats.byModel.reduce((acc, m) => acc + m.outputTokens, 0))}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Generation / Responses</p>
          </CardContent>
        </Card>
      </div>

      {(stats.byProject || []).length > 0 && (
        <Card className="border-primary/10 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Project Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 border-t">
            <div className="flex divide-x divide-border/50 overflow-x-auto scrollbar-hide">
              {stats.byProject.slice(0, 8).map((proj) => (
                <div 
                  key={proj.id} 
                  className={cn(
                    "min-w-[160px] p-4 hover:bg-muted/30 transition-colors cursor-pointer group",
                    projectId === proj.id && "bg-muted/50"
                  )}
                  onClick={() => setProjectId(proj.id === projectId ? null : proj.id)}
                >
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center justify-between">
                    <span className="truncate">{proj.name}</span>
                    {projectId === proj.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  <div className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(proj.cost)}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors">
                    {formatTokens(proj.tokens)} tokens
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Usage Timeline
            </CardTitle>
            <div className="flex gap-1">
              {['hourly', 'daily', 'weekly', 'monthly'].map((g) => (
                <Button 
                  key={g} 
                  variant={granularity === g ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-6 text-[9px] uppercase px-2"
                  onClick={() => setGranularity(g as any)}
                >
                  {g}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0 pt-4">
            <div className="h-full w-full">
              {showIsometric ? (
                <IsometricHeatmap data={heatmapData} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(v) => {
                        const date = new Date(v || "");
                        if (granularity === 'hourly') return date.getHours() + ':00';
                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      }}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tickFormatter={(v) => `$${v}`}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-sm text-[10px]">
                              <div className="flex flex-col">
                                <span className="uppercase text-muted-foreground mb-1">{new Date(label || "").toLocaleString()}</span>
                                <span className="font-bold text-sm">{formatCurrency(Number(payload[0].value))}</span>
                                <span className="text-muted-foreground mt-1">{payload[0].payload.tokens.toLocaleString()} tokens</span>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              Cost Distribution
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-[9px] uppercase px-2"
              onClick={() => setShowAllModels(!showAllModels)}
            >
              {showAllModels ? "Show Top 5" : "Show All"}
            </Button>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0 pt-4">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="cost"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.name === "Others" ? "#64748b" : COLORS[index % COLORS.length]} 
                        stroke="hsl(var(--background))" 
                        strokeWidth={2} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm text-[10px]">
                            <div className="flex flex-col">
                              <span className="font-bold truncate max-w-[150px] mb-1">{payload[0].name}</span>
                              <span className="font-bold text-sm">{formatCurrency(Number(payload[0].value))}</span>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    layout="vertical" 
                    verticalAlign="middle" 
                    align="right"
                    wrapperStyle={{ fontSize: "10px", maxWidth: "100px" }}
                    content={({ payload }) => (
                      <ul className="space-y-1">
                        {payload?.map((entry: any, index: number) => (
                          <li key={`item-${index}`} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="truncate opacity-80" title={entry.value}>{entry.value}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden mb-8 min-h-0 flex flex-col">
        <CardHeader className="bg-muted/30 border-b py-3">
          <CardTitle className="text-sm font-semibold">Model Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
          <div className="w-full">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="bg-muted/10 text-muted-foreground border-b text-[10px] uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Model</th>
                  <th className="px-4 py-3 font-semibold text-right">Input (Context)</th>
                  <th className="px-4 py-3 font-semibold text-right">Output (Gen)</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Tokens</th>
                  <th className="px-4 py-3 font-semibold text-right">Estimated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b">
                {(stats.byModel || []).map((model) => (
                  <tr key={model.name} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 font-medium truncate max-w-[200px]">{model.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums font-mono text-xs">{model.inputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums font-mono text-xs">{model.outputTokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums font-mono text-xs font-semibold group-hover:text-foreground">{model.tokens.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-primary/90">{formatCurrency(model.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
