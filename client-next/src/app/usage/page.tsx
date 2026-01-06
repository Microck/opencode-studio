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
      const data = await getUsageStats(projectId, granularity, dateRange);
      
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
    <div ref={dashboardRef} className="flex flex-col gap-6 p-6 h-full overflow-y-auto bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Token Usage</h1>
          <p className="text-muted-foreground text-sm">
            Detailed spending analysis and token consumption metrics.
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
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <div className="flex items-center gap-2">
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

          <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
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
        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{formatCurrency(stats.totalCost)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Estimated lifetime spend</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Input Volume</CardTitle>
            <MessageSquare className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{formatTokens(totalInputTokens)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Context and prompts</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Output Volume</CardTitle>
            <TrendingUp className="h-3 w-3 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{formatTokens(totalOutputTokens)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">AI responses</p>
          </CardContent>
        </Card>
      </div>

      {(stats.byProject || []).length > 0 && (
        <Card className="border-primary/10 shadow-sm overflow-hidden bg-muted/5">
          <CardHeader className="pb-3 border-b bg-muted/10">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Top Projects</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex divide-x divide-border/50 overflow-x-auto scrollbar-hide">
              {stats.byProject.slice(0, 10).map((proj) => (
                <div 
                  key={proj.id} 
                  className={cn(
                    "min-w-[180px] p-4 hover:bg-muted/30 transition-colors cursor-pointer group",
                    projectId === proj.id && "bg-muted/50"
                  )}
                  onClick={() => setProjectId(proj.id === projectId ? null : proj.id)}
                >
                  <div className="text-[9px] font-bold uppercase text-muted-foreground flex items-center justify-between">
                    <span className="truncate max-w-[120px]">{proj.name}</span>
                    {projectId === proj.id && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  <div className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(proj.cost)}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 opacity-60">
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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3 mb-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Usage Over Time
            </CardTitle>
            <div className="flex gap-1 bg-muted/50 p-0.5 rounded-md">
              {['hourly', 'daily', 'weekly', 'monthly'].map((g) => (
                <Button 
                  key={g} 
                  variant={granularity === g ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-6 text-[8px] uppercase px-2 font-bold"
                  onClick={() => setGranularity(g as any)}
                >
                  {g}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0">
            <div className="h-full w-full">
              {showIsometric ? (
                <IsometricHeatmap data={heatmapData} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.05} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(v) => {
                        const date = new Date(v || "");
                        if (granularity === 'hourly') return date.getHours() + 'h';
                        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
                      cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background/95 p-3 shadow-2xl text-[10px] backdrop-blur-md border-primary/20">
                              <div className="flex flex-col gap-1">
                                <span className="uppercase text-muted-foreground font-bold">{new Date(label || "").toLocaleString()}</span>
                                <span className="text-base font-bold text-primary">{formatCurrency(Number(payload[0].value))}</span>
                                <div className="mt-1 pt-1 border-t border-border/50 flex flex-col gap-0.5">
                                  <span className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Input</span>
                                    <span className="font-mono">{payload[0].payload.inputTokens?.toLocaleString()}</span>
                                  </span>
                                  <span className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Output</span>
                                    <span className="font-mono">{payload[0].payload.outputTokens?.toLocaleString()}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-3 mb-4">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <PieChartIcon className="h-3.5 w-3.5 text-primary" />
              Cost Breakdown
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-[8px] uppercase px-2 font-bold opacity-60 hover:opacity-100"
              onClick={() => setShowAllModels(!showAllModels)}
            >
              {showAllModels ? "Hide Small" : "View All"}
            </Button>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="45%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="cost"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.name === "Others" ? "#475569" : COLORS[index % COLORS.length]} 
                        stroke="hsl(var(--background))" 
                        strokeWidth={2} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background/95 p-2 shadow-xl text-[10px] backdrop-blur-md border-primary/20">
                            <div className="flex flex-col">
                              <span className="font-bold truncate max-w-[150px]">{payload[0].name}</span>
                              <span className="text-sm font-bold text-primary">{formatCurrency(Number(payload[0].value))}</span>
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
                    content={({ payload }) => (
                      <ul className="space-y-1.5">
                        {payload?.map((entry: any, index: number) => (
                          <li key={`item-${index}`} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="truncate text-[9px] font-medium opacity-70 max-w-[80px]" title={entry.value}>{entry.value}</span>
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

      <Card className="border-primary/10 shadow-sm overflow-hidden mb-8 flex flex-col">
        <CardHeader className="bg-muted/30 border-b py-3">
          <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Model Performance Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted/10 text-muted-foreground border-b text-[9px] uppercase tracking-wider font-bold">
                  <th className="px-6 py-4">Model Interface</th>
                  <th className="px-6 py-4 text-right">Input (Context)</th>
                  <th className="px-6 py-4 text-right">Output (Generation)</th>
                  <th className="px-6 py-4 text-right">Total Tokens</th>
                  <th className="px-6 py-4 text-right text-primary">Estimated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(stats.byModel || []).map((model) => (
                  <tr key={model.name} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 font-bold text-foreground/80">{model.name}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground font-mono tabular-nums">{model.inputTokens.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right text-muted-foreground font-mono tabular-nums">{model.outputTokens.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-mono tabular-nums opacity-40 group-hover:opacity-100 transition-opacity">{model.tokens.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right font-black tabular-nums text-primary">{formatCurrency(model.cost)}</td>
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
