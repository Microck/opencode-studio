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

const BUCKET_NAMES = ["Morning", "Day", "Night"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

    const point = new obelisk.Point(width / 2, 80);
    const pixelView = new obelisk.PixelView(canvas, point);

    const dimension = new obelisk.CubeDimension(24, 24, 2);
    const grayColor = new obelisk.CubeColor().getByHorizontalColor(0x1e293b); 
    const base = new obelisk.Cube(dimension, grayColor);

    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 3; y++) {
        const p3d = new obelisk.Point3D(x * 28, y * 28, 0);
        pixelView.renderObject(base, p3d);
      }
    }

    const maxValue = Math.max(...data.map(d => d.value)) || 1;

    data.forEach(item => {
      const x = item.day;
      const y = item.hourBucket;
      
      const barHeight = Math.max(2, (item.value / maxValue) * 100);
      
      let color = 0x3b82f6; 
      if (item.value > maxValue * 0.8) color = 0xef4444; 
      else if (item.value > maxValue * 0.5) color = 0xf59e0b; 
      else if (item.value > 0) color = 0x22c55e; 

      const barDim = new obelisk.CubeDimension(20, 20, barHeight);
      const barColor = new obelisk.CubeColor().getByHorizontalColor(color);
      const bar = new obelisk.Cube(barDim, barColor);
      
      const p3d = new obelisk.Point3D(x * 28 + 4, y * 28 + 4, 0);
      pixelView.renderObject(bar, p3d);
    });
  }, [data]);

  useEffect(() => {
    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [render]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const gridX = Math.floor((mx - (rect.width / 2 - 100)) / 28);
    const gridY = Math.floor((my - 80) / 28);

    if (gridX >= 0 && gridX < 7 && gridY >= 0 && gridY < 3) {
      const item = data.find(d => d.day === gridX && d.hourBucket === gridY);
      if (item && item.value > 0) {
        setTooltip({
          x: mx,
          y: my,
          text: `${DAY_NAMES[gridX]} ${BUCKET_NAMES[gridY]}: $${item.value.toFixed(2)}`
        });
        return;
      }
    }
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
          Dimensional Analysis
        </span>
        <div className="flex gap-4 mt-2 text-[9px] text-muted-foreground font-bold font-mono uppercase">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Low
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-green-500" /> Normal
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Busy
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Peak
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 right-6 text-[10px] font-black font-mono text-muted-foreground/30 z-10 uppercase tracking-widest">
        Iso • 7x3 Grid
      </div>

      <canvas 
        ref={canvasRef} 
        className="w-full h-full cursor-none transition-all duration-700 group-hover:brightness-110" 
      />
      
      {tooltip && (
        <div 
          className="absolute bg-background/90 backdrop-blur-md border border-primary/20 p-2.5 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)] text-[11px] font-bold pointer-events-none z-50 animate-in fade-in zoom-in-90 duration-150"
          style={{ left: tooltip.x + 15, top: tooltip.y - 40 }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground uppercase text-[9px] tracking-tighter">{tooltip.text.split(':')[0]}</span>
            <span className="text-primary text-sm tracking-tight">{tooltip.text.split(':')[1]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
