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

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const point = new obelisk.Point(canvas.width / 2, 100);
    const pixelView = new obelisk.PixelView(canvas, point);

    const dimension = new obelisk.CubeDimension(20, 20, 4);
    const grayColor = new obelisk.CubeColor().getByHorizontalColor(0x1a1e24);
    const base = new obelisk.Cube(dimension, grayColor);

    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 3; y++) {
        const p3d = new obelisk.Point3D(x * 24, y * 24, 0);
        pixelView.renderObject(base, p3d);
      }
    }

    const maxValue = Math.max(...data.map(d => d.value)) || 1;

    data.forEach(item => {
      const x = item.day;
      const y = item.hourBucket;
      
      const height = Math.max(4, (item.value / maxValue) * 60);
      
      let color = 0x216e39;
      if (item.value > maxValue * 0.8) color = 0xff4444; 
      else if (item.value > maxValue * 0.5) color = 0xffa500; 
      else color = 0x40c463; 

      const barDim = new obelisk.CubeDimension(16, 16, height);
      const barColor = new obelisk.CubeColor().getByHorizontalColor(color);
      const bar = new obelisk.Cube(barDim, barColor);
      
      const p3d = new obelisk.Point3D(x * 24 + 2, y * 24 + 2, 0);
      pixelView.renderObject(bar, p3d);
    });

  }, [data]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0d1117] rounded-md relative">
      <div className="absolute top-2 left-2 text-xs text-muted-foreground flex flex-col gap-1">
        <span>Y: Time (M/A/N)</span>
        <span>X: Day (Mon-Sun)</span>
      </div>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
