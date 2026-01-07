"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsageStats, UsageStats } from "@/lib/api";
import { 
  Loader2, DollarSign, MessageSquare, Calendar, Download, 
  TrendingUp, Filter, Users, Image as ImageIcon,
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
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [showAllModels, setShowAllModels] = useState(false);
  
  const { projectId, setProjectId, dateRange, setDateRange, granularity, setGranularity } = useFilterStore();

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
      setStats(enrichedStats);
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
    if (showAllModels || stats.byModel.length <= 6) {
      // Even if showing all, ensure "Others" (if it exists from backend) is at bottom
      const othersIndex = stats.byModel.findIndex(m => m.name === "Others");
      if (othersIndex !== -1) {
        const others = stats.byModel.splice(othersIndex, 1)[0];
        return [...stats.byModel, others];
      }
      return stats.byModel;
    }
    
    const topModels = stats.byModel.slice(0, 5);
    const otherModels = stats.byModel.slice(5);
    const othersCost = otherModels.reduce((acc, m) => acc + m.cost, 0);
    const othersTokens = otherModels.reduce((acc, m) => acc + m.tokens, 0);
    const othersInput = otherModels.reduce((acc, m) => acc + m.inputTokens, 0);
    const othersOutput = otherModels.reduce((acc, m) => acc + m.outputTokens, 0);
    
    return [
      ...topModels,
      { 
        name: "Others", 
        cost: othersCost, 
        tokens: othersTokens, 
        inputTokens: othersInput, 
        outputTokens: othersOutput 
      }
    ];
  }, [stats, showAllModels]);

  const tableData = useMemo(() => {
    if (!stats) return [];
    const data = [...stats.byModel];
    const othersIndex = data.findIndex(m => m.name === "Others");
    if (othersIndex !== -1) {
      const others = data.splice(othersIndex, 1)[0];
      return [...data, others];
    }
    return data;
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
    <div ref={dashboardRef} className="flex flex-col gap-6 p-6 pb-32 h-full overflow-y-auto bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Token Usage</h1>
          <p className="text-muted-foreground text-sm">
            Analysis of spending and token consumption across your projects.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
              <SelectItem value="1y">Last Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={granularity} onValueChange={(v: any) => setGranularity(v)}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-3 w-3 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
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
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Usage Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0 px-6 pt-4">
            <div className="h-full w-full">
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
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 border-primary/10 bg-muted/5 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/10 pb-3 mb-4 px-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <PieChartIcon className="h-3.5 w-3.5 text-primary" />
              Cost Breakdown
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 text-[8px] uppercase px-2 font-black opacity-60 hover:opacity-100"
              onClick={() => setShowAllModels(!showAllModels)}
            >
              {showAllModels ? "Hide Small" : "View All"}
            </Button>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0 px-6 pt-4">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="65%"
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
                    align="left"
                    wrapperStyle={{ fontSize: "11px", maxWidth: "120px", left: 0 }}
                    content={({ payload }) => (
                      <ul className="space-y-2">
                        {payload?.map((entry: any, index: number) => (
                          <li key={`item-${index}`} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="truncate text-[10px] font-medium opacity-80 max-w-[90px]" title={entry.value}>{entry.value}</span>
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

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="col-span-1 border-primary/10 shadow-sm overflow-hidden flex flex-col bg-muted/5">
          <CardHeader className="bg-muted/10 border-b py-3 px-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary" />
              Top Projects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
            <table className="w-full text-[11px] text-left border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground border-b text-[9px] uppercase font-bold sticky top-0 z-10">
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3 text-right">Estimated Cost</th>
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
                    <td className="px-6 py-3 font-medium truncate max-w-[150px]">{proj.name}</td>
                    <td className="px-6 py-3 text-right font-bold tabular-nums text-primary/80">{formatCurrency(proj.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-primary/10 shadow-sm overflow-hidden flex flex-col bg-muted/5">
          <CardHeader className="bg-muted/10 border-b py-3 px-6">
            <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Model Performance Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
            <div className="w-full">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="sticky top-0 bg-muted z-10 shadow-sm">
                  <tr className="text-muted-foreground border-b text-[9px] uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Model Interface</th>
                    <th className="px-6 py-4 text-right">Input</th>
                    <th className="px-6 py-4 text-right">Output</th>
                    <th className="px-6 py-4 text-right text-primary">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {(tableData || []).map((model) => (
                    <tr key={model.name} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-4 font-bold text-foreground/80">{model.name}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground font-mono tabular-nums">{model.inputTokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-muted-foreground font-mono tabular-nums">{model.outputTokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-black tabular-nums text-primary">{formatCurrency(model.cost)}</td>
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
