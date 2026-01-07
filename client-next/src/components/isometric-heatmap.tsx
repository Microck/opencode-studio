import { useEffect, useRef, useState, useCallback } from 'react';
// @ts-ignore - obelisk.js doesn't have types
import obelisk from 'obelisk.js';

interface IsometricHeatmapProps {
  data: {
    day: number; 
    hourBucket: number; 
    value: number; 
    date?: string;
  }[];
}

const WEEK_NAMES = ["Mon", "Wed", "Fri"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function IsometricHeatmap({ data }: IsometricHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number, y: number, text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const parent = containerRef.current;
    
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const point = new obelisk.Point(width / 2, 60);
    const pixelView = new obelisk.PixelView(canvas, point);

    const weeks = 52;
    const days = 7;
    const cellSize = 12;
    const cellGap = 4;
    
    const dimension = new obelisk.CubeDimension(cellSize, cellSize, 2);
    const emptyColor = new obelisk.CubeColor().getByHorizontalColor(0x1e293b); 
    const base = new obelisk.Cube(dimension, emptyColor);

    for (let x = 0; x < weeks; x++) {
      for (let y = 0; y < days; y++) {
        const p3d = new obelisk.Point3D(x * (cellSize + cellGap), y * (cellSize + cellGap), 0);
        pixelView.renderObject(base, p3d);
      }
    }

    const maxValue = Math.max(...data.map(d => d.value)) || 1;

    data.forEach(item => {
      const weekIndex = Math.floor(item.day / 7);
      const dayIndex = item.day % 7;
      
      if (weekIndex >= weeks) return;

      const intensity = item.value / maxValue;
      const barHeight = Math.max(4, intensity * 40);
      
      let color = 0x1e293b; 
      
      if (item.value > 0) {
        if (intensity < 0.25) color = 0x14532d; 
        else if (intensity < 0.5) color = 0x166534;
        else if (intensity < 0.75) color = 0x22c55e;
        else color = 0x4ade80; 
      }

      if (item.value === 0) return;

      const barDim = new obelisk.CubeDimension(cellSize, cellSize, barHeight);
      const barColor = new obelisk.CubeColor().getByHorizontalColor(color);
      const bar = new obelisk.Cube(barDim, barColor);
      
      const p3d = new obelisk.Point3D(weekIndex * (cellSize + cellGap), dayIndex * (cellSize + cellGap), 0);
      pixelView.renderObject(bar, p3d);
    });
  }, [data]);

  useEffect(() => {
    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [render]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltip(null); 
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex flex-col items-center justify-center bg-black/40 rounded-xl relative overflow-hidden group border border-primary/10 shadow-2xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      <div className="absolute top-4 left-5 flex flex-col gap-1 z-10 pointer-events-none text-left">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Yearly Intensity
        </span>
        <div className="flex gap-4 mt-2 text-[9px] text-muted-foreground font-bold font-mono uppercase">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#14532d]" /> Low
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#166534]" /> Med
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#22c55e]" /> High
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-[#4ade80]" /> Max
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 right-6 text-[10px] font-black font-mono text-muted-foreground/30 z-10 uppercase tracking-widest">
        Iso • 52 Weeks
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full cursor-none transition-all duration-700 group-hover:brightness-110" 
      />
    </div>
  );
}
