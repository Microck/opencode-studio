import { useEffect, useRef } from 'react';
// @ts-ignore - obelisk.js doesn't have types
import obelisk from 'obelisk.js';

interface IsometricHeatmapProps {
  data: {
    day: number; 
    hourBucket: number; 
    value: number; 
  }[];
}

export function IsometricHeatmap({ data }: IsometricHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (!parent) return;

    const width = parent.clientWidth;
    const height = parent.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const point = new obelisk.Point(width / 2, 60);
    const pixelView = new obelisk.PixelView(canvas, point);

    const dimension = new obelisk.CubeDimension(24, 24, 4);
    const grayColor = new obelisk.CubeColor().getByHorizontalColor(0x1a1e24);
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
      
      const barHeight = Math.max(4, (item.value / maxValue) * 80);
      
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

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/20 rounded-md relative overflow-hidden group border border-primary/5">
      <div className="absolute top-3 left-4 flex flex-col gap-1 z-10 pointer-events-none">
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
          Dimensional Activity
        </span>
        <div className="flex gap-4 mt-1 text-[9px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-blue-500/50" /> Low
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-green-500/50" /> Normal
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-amber-500/50" /> Busy
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-red-500/50" /> Peak
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-3 right-4 text-[9px] font-mono text-muted-foreground/40 z-10">
        X: Days • Y: Time (Morning/Day/Night)
      </div>

      <canvas ref={canvasRef} className="w-full h-full transition-transform duration-500 group-hover:scale-[1.02]" />
    </div>
  );
}
