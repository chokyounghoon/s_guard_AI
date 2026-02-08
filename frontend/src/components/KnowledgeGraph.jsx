import React, { useState } from 'react';

export default function KnowledgeGraph() {
  const [hoveredNode, setHoveredNode] = useState(null);

  // Hardcoded layout for safety
  const nodes = [
    { id: 'root', x: 100, y: 150, label: 'CPU Load', color: 'red' },
    { id: 'mid1', x: 250, y: 80, label: 'Batch Job', color: 'orange' },
    { id: 'mid2', x: 250, y: 220, label: 'DB Pool', color: 'orange' },
    { id: 'end', x: 400, y: 150, label: 'Service Down', color: 'purple' },
  ];

  return (
    <div className="w-full h-64 bg-slate-900 rounded-xl border border-white/10 relative overflow-hidden p-4">
      <div className="absolute top-2 left-4 text-xs font-bold text-slate-400">
        ROOT CAUSE ANALYSIS
      </div>
      
      <svg className="w-full h-full" viewBox="0 0 500 300">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="20" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Lines */}
        <line x1="100" y1="150" x2="250" y2="80" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />
        <line x1="100" y1="150" x2="250" y2="220" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />
        <line x1="250" y1="80" x2="400" y2="150" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />
        <line x1="250" y1="220" x2="400" y2="150" stroke="#334155" strokeWidth="2" markerEnd="url(#arrow)" />

        {/* Node: Root */}
        <circle cx="100" cy="150" r="20" fill="#1e293b" stroke="#ef4444" strokeWidth="3" />
        <text x="100" y="190" textAnchor="middle" fill="#94a3b8" fontSize="12">CPU Load</text>

        {/* Node: Mid1 */}
        <circle cx="250" cy="80" r="20" fill="#1e293b" stroke="#f59e0b" strokeWidth="3" />
        <text x="250" y="120" textAnchor="middle" fill="#94a3b8" fontSize="12">Batch Job</text>

        {/* Node: Mid2 */}
        <circle cx="250" cy="220" r="20" fill="#1e293b" stroke="#f59e0b" strokeWidth="3" />
        <text x="250" y="260" textAnchor="middle" fill="#94a3b8" fontSize="12">DB Pool</text>

        {/* Node: End */}
        <circle cx="400" cy="150" r="20" fill="#1e293b" stroke="#8b5cf6" strokeWidth="3" />
        <text x="400" y="190" textAnchor="middle" fill="#94a3b8" fontSize="12">Service Down</text>
      </svg>
    </div>
  );
}
