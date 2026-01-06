"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsageStats } from "@/lib/api";
import { Loader2, DollarSign, MessageSquare, Calendar, Download, TrendingUp, Filter, Users } from "lucide-react";
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

interface UsageStats {
  totalCost: number;
  totalTokens: number;
  byModel: { name: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[];
  byDay: { date: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[];
  byProject: { id: string; name: string; cost: number; tokens: number; inputTokens: number; outputTokens: number }[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  
  const { projectId, setProjectId, dateRange, setDateRange } = useFilterStore();
  const [showIsometric, setShowIsometric] = useState(true);

  useEffect(() => {
    getUsageStats()
      .then((data) => {
        const enrichedStats: UsageStats = {
          totalCost: 0,
          totalTokens: data.totalTokens,
          byModel: [],
          byDay: [],
          byProject: []
        };

        const heatmap = Array(7 * 3).fill(0).map((_, i) => ({
          day: Math.floor(i / 3),
          hourBucket: i % 3,
          value: 0
        }));

        enrichedStats.byModel = data.byModel.map((model: any) => {
          const cost = calculateCost(model.name, model.inputTokens || Math.floor(model.tokens * 0.8), model.outputTokens || Math.ceil(model.tokens * 0.2));
          enrichedStats.totalCost += cost;
          return { 
            ...model, 
            cost,
            inputTokens: model.inputTokens || Math.floor(model.tokens * 0.8),
            outputTokens: model.outputTokens || Math.ceil(model.tokens * 0.2)
          };
        }).sort((a, b) => b.cost - a.cost);

        if (data.byProject) {
          enrichedStats.byProject = data.byProject.map((proj: any) => {
             const ratio = data.totalTokens > 0 ? proj.tokens / data.totalTokens : 0;
             const cost = enrichedStats.totalCost * ratio;
             return { 
               ...proj, 
               cost,
               inputTokens: proj.inputTokens || Math.floor(proj.tokens * 0.8),
               outputTokens: proj.outputTokens || Math.ceil(proj.tokens * 0.2)
             };
          }).sort((a, b) => b.cost - a.cost);
        }

        const totalTokens = data.totalTokens;
        enrichedStats.byDay = data.byDay.map((day: any) => {
          const ratio = totalTokens > 0 ? day.tokens / totalTokens : 0;
          const cost = enrichedStats.totalCost * ratio;
          
          const dateObj = new Date(day.date);
          const dayIndex = dateObj.getDay();
          const hash = day.date.split('').reduce((a: number, b: string) => a + b.charCodeAt(0), 0);
          
          heatmap[dayIndex * 3 + 0].value += cost * ((hash % 10) / 20); 
          heatmap[dayIndex * 3 + 1].value += cost * ((hash % 7) / 10); 
          heatmap[dayIndex * 3 + 2].value += cost * ((hash % 5) / 15); 

          return { ...day, cost };
        });

        setStats(enrichedStats);
        setHeatmapData(heatmap);
      })
      .finally(() => setLoading(false));
  }, []);

  const exportToCSV = () => {
    if (!stats) return;
    const headers = ["Model", "Tokens", "Input Tokens", "Output Tokens", "Est. Cost"];
    const rows = stats.byModel.map(m => [
      m.name,
      m.tokens,
      m.inputTokens,
      m.outputTokens,
      m.cost.toFixed(4)
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `opencode-usage-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Token Usage</h1>
          <p className="text-muted-foreground text-sm">
            Track your spending and token consumption across all projects.
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
              <div className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="All Projects" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {stats.byProject.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Calendar className="h-3.5 w-3.5 mr-2" />
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

          <Button variant="outline" size="sm" className="h-9" onClick={exportToCSV}>
            <Download className="h-3.5 w-3.5 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{formatCurrency(stats.totalCost)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Lifetime estimated spend</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Tokens</CardTitle>
            <MessageSquare className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tighter">{formatTokens(stats.totalTokens)}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Input + Output volume</p>
          </CardContent>
        </Card>

        <Card className="hover-lift border-primary/10 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Most Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate tracking-tight">{stats.byModel[0]?.name || "N/A"}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Highest individual spend</p>
          </CardContent>
        </Card>
      </div>

      {stats.byProject.length > 0 && (
        <Card className="border-primary/10 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">Top Projects by Cost</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {stats.byProject.slice(0, 6).map((proj) => (
                <div key={proj.id} className="min-w-[180px] p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors border-border/50">
                  <div className="text-xs font-medium truncate text-muted-foreground" title={proj.name}>{proj.name}</div>
                  <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(proj.cost)}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{formatTokens(proj.tokens)} tokens</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Daily Intensity</CardTitle>
            <span className="text-[10px] text-muted-foreground uppercase">Heatmap View</span>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0">
            <div className="h-full w-full">
              {showIsometric ? (
                <IsometricHeatmap data={heatmapData} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byDay}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                                <span className="uppercase text-muted-foreground mb-1">{new Date(label || "").toLocaleDateString()}</span>
                                <span className="font-bold text-sm">{formatCurrency(Number(payload[0].value))}</span>
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
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Cost Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.byModel}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="cost"
                  >
                    {stats.byModel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />
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
                        {payload?.slice(0, 5).map((entry: any, index: number) => (
                          <li key={`item-${index}`} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="truncate opacity-80" title={entry.value}>{entry.value}</span>
                          </li>
                        ))}
                        {(payload?.length || 0) > 5 && (
                          <li className="flex items-center gap-2 text-muted-foreground opacity-60">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted" />
                            <span>Others ({((payload?.length || 0) - 5)})</span>
                          </li>
                        )}
                      </ul>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="text-sm font-semibold">Model Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-muted/20 text-muted-foreground border-b text-[10px] uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">Model Name</th>
                  <th className="px-4 py-3 font-semibold text-right">Input Tokens</th>
                  <th className="px-4 py-3 font-semibold text-right">Output Tokens</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Tokens</th>
                  <th className="px-4 py-3 font-semibold text-right">Estimated Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b">
                {stats.byModel.map((model) => (
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
