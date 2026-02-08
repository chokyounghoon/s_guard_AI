import React, { useEffect, useState } from 'react';

export default function ServerStatusChart() {
  const [points, setPoints] = useState([]);
  const maxPoints = 30;

  useEffect(() => {
    // Initialize data
    const initialPoints = Array.from({ length: maxPoints }, (_, i) => ({
      cpu: 40 + Math.random() * 30,
      memory: 50 + Math.random() * 20
    }));
    setPoints(initialPoints);

    const interval = setInterval(() => {
      setPoints(prev => {
        const newPoint = {
          cpu: 40 + Math.random() * 40, // 40-80%
          memory: 50 + Math.random() * 30 // 50-80%
        };
        return [...prev.slice(1), newPoint];
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Generate SVG paths
  const getPath = (key, color) => {
    if (points.length === 0) return '';
    
    const width = 100; // percent
    const height = 100; // pixels (internal coordinate)
    
    // Calculate X step
    const stepX = 100 / (maxPoints - 1);
    
    const pathData = points.map((p, i) => {
      const x = i * stepX;
      const y = 100 - p[key]; // Invert Y because SVG 0 is top
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    return (
        <>
            {/* Fill Area */}
            <path d={`${pathData} L 100 100 L 0 100 Z`} fill={color} fillOpacity="0.2" className="transition-all duration-500 ease-in-out" />
            {/* Stroke Line */}
            <path d={pathData} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-all duration-500 ease-in-out" />
        </>
    );
  };

  return (
    <div className="w-full bg-slate-900/50 rounded-xl border border-white/5 p-4 mt-3 shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
            <div className="relative">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75"></div>
            </div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live System Metrics</h4>
        </div>
        <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-0.5 bg-blue-500 rounded-full"></span>
                <span className="text-[10px] text-slate-400 font-mono">CPU: {Math.round(points[points.length-1]?.cpu || 0)}%</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-0.5 bg-purple-500 rounded-full"></span>
                <span className="text-[10px] text-slate-400 font-mono">MEM: {Math.round(points[points.length-1]?.memory || 0)}%</span>
            </div>
        </div>
      </div>
      
      <div className="relative w-full h-32 overflow-hidden bg-[#0f1219] rounded-lg border border-white/5">
        {/* Grid Lines */}
        <div className="absolute inset-0 grid grid-rows-4 gap-0 pointer-events-none">
            <div className="border-b border-white/5 w-full"></div>
            <div className="border-b border-white/5 w-full"></div>
            <div className="border-b border-white/5 w-full"></div>
            <div className="border-b border-white/5 w-full"></div>
        </div>

        {/* SVG Chart */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full absolute inset-0">
             {getPath('cpu', '#3b82f6')}
             {getPath('memory', '#a855f7')}
        </svg>
      </div>
    </div>
  );
}
