"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsageStats } from "@/lib/api";
import { Loader2, DollarSign, MessageSquare, Calendar, Download, TrendingUp, Filter } from "lucide-react";
import { calculateCost } from "@/lib/data/pricing";
import { formatCurrency, formatTokens, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  byModel: { name: string; cost: number; tokens: number }[];
  byDay: { date: string; cost: number; tokens: number }[];
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsageStats()
      .then((data) => {
        const enrichedStats = {
          totalCost: 0,
          totalTokens: data.totalTokens,
          byModel: [] as any[],
          byDay: [] as any[]
        };

        enrichedStats.byModel = data.byModel.map((model: any) => {
          const inputTokens = Math.floor(model.tokens * 0.8);
          const outputTokens = model.tokens - inputTokens;
          const cost = calculateCost(model.name, inputTokens, outputTokens);
          
          enrichedStats.totalCost += cost;
          return { ...model, cost };
        }).sort((a: any, b: any) => b.cost - a.cost);

        const totalTokens = enrichedStats.totalTokens;
        enrichedStats.byDay = data.byDay.map((day: any) => {
          const ratio = totalTokens > 0 ? day.tokens / totalTokens : 0;
          return {
            ...day,
            cost: enrichedStats.totalCost * ratio
          };
        });

        setStats(enrichedStats);
      })
      .finally(() => setLoading(false));
  }, []);

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Token Usage</h1>
        <p className="text-muted-foreground">
          Track your spending and token consumption across all Opencode sessions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">Lifetime spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTokens.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Input + Output tokens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Used Model</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {stats.byModel[0]?.name || "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              By total cost
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Daily Cost</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] w-full min-h-0">
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    fontSize={12}
                  />
                  <YAxis 
                      tickFormatter={(value) => `$${value}`}
                      fontSize={12}
                  />
                  <Tooltip 
                      formatter={(value: any) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString()}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Cost by Model</CardTitle>
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
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="cost"
                  >
                    {stats.byModel.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                      formatter={(value: any) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.byModel.map((model) => (
              <div
                key={model.name}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">{model.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {model.tokens.toLocaleString()} tokens
                  </p>
                </div>
                <div className="font-medium">
                  ${model.cost.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
