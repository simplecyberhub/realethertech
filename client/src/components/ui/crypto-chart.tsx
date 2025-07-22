import { useEffect, useRef } from "react";
import { generateRandomChartData } from "@/lib/utils";

interface CryptoChartProps {
  data?: number[];
  change?: number;
  height?: number;
  width?: number;
  className?: string;
}

export function CryptoChart({
  data,
  change = 0,
  height = 60,
  width = 100,
  className = "",
}: CryptoChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartData = data || generateRandomChartData(change);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set up canvas
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}%`;
    canvas.style.height = `${height}px`;
    ctx.scale(pixelRatio, pixelRatio);
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set chart styling
    const isPositive = change >= 0;
    const mainColor = isPositive ? '#10B981' : '#EF4444';
    const gradientColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    
    // Draw line chart
    const points = chartData.map((value, index) => ({
      x: (index / (chartData.length - 1)) * width,
      y: height - ((value - Math.min(...chartData)) / (Math.max(...chartData) - Math.min(...chartData))) * (height * 0.8),
    }));
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, gradientColor);
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    // Draw area
    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    points.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
  }, [chartData, change, height, width]);
  
  return (
    <canvas 
      ref={canvasRef} 
      height={height} 
      className={className}
    />
  );
}
