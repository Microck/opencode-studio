"use client";

import { useEffect, useRef } from 'react';
// @ts-ignore - obelisk.js doesn't have types
import obelisk from 'obelisk.js';

interface IsometricChartProps {
  data: { date: string; cost: number; tokens: number }[];
}

export function IsometricChart({ data }: IsometricChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data.length) return;

    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (!parent) return;

    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;

    const point = new obelisk.Point(canvas.width / 2, canvas.height / 2 + 100);
    const pixelView = new obelisk.PixelView(canvas, point);

    const maxCost = Math.max(...data.map(d => d.cost));
    
    data.forEach((day, index) => {
      const height = Math.max(2, Math.floor((day.cost / maxCost) * 120)); 
      
      let color = 0xeeeeee;
      if (day.cost > 0) color = 0x9be9a8;
      if (day.cost > maxCost * 0.25) color = 0x40c463;
      if (day.cost > maxCost * 0.5) color = 0x30a14e;
      if (day.cost > maxCost * 0.75) color = 0x216e39;

      const dimension = new obelisk.CubeDimension(16, 16, height);
      const cubeColor = new obelisk.CubeColor().getByHorizontalColor(color);
      const cube = new obelisk.Cube(dimension, cubeColor);

      const p3d = new obelisk.Point3D(index * 20, 0, 0);
      pixelView.renderObject(cube, p3d);
    });

  }, [data]);

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden bg-[#0d1117] rounded-md">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
