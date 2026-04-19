import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const REFRESH_THRESHOLD = 90;

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const y = useMotionValue(0);
  const rotation = useTransform(y, [0, REFRESH_THRESHOLD], [0, 360]);
  const opacity = useTransform(y, [0, 20, REFRESH_THRESHOLD], [0, 0.5, 1]);
  const scale = useTransform(y, [0, REFRESH_THRESHOLD], [0.8, 1]);
  
  const containerRef = useRef(null);
  const isAtTop = useRef(true);

  // Check if we are at the top of the scrollable container
  const handleScroll = (e) => {
    isAtTop.current = e.currentTarget.scrollTop === 0;
  };

  const handleDrag = (_, info) => {
    if (disabled || isRefreshing || !isAtTop.current) return;
    
    // Only allow pulling down when at the very top
    if (info.offset.y > 0) {
      const progress = Math.min(info.offset.y / REFRESH_THRESHOLD, 1.2);
      setPullProgress(progress);
    } else {
      setPullProgress(0);
    }
  };

  const handleDragEnd = async (_, info) => {
    if (disabled || isRefreshing || !isAtTop.current) return;

    if (info.offset.y >= REFRESH_THRESHOLD) {
      setIsRefreshing(true);
      setPullProgress(1);
      
      // Keep it at threshold while refreshing
      animate(y, REFRESH_THRESHOLD, { type: 'spring', damping: 20 });
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullProgress(0);
        animate(y, 0, { type: 'spring', damping: 20 });
      }
    } else {
      setPullProgress(0);
      animate(y, 0, { type: 'spring', damping: 20 });
    }
  };

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden w-full h-full">
      {/* Pull Indicator */}
      <motion.div
        style={{ 
          y, 
          opacity, 
          scale,
          top: -60,
          left: '50%',
          x: '-50%'
        }}
        className="absolute z-[100] w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/20"
      >
        <motion.div
          style={{ rotate: isRefreshing ? undefined : rotation }}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: "linear" } : {}}
        >
          <RefreshCw className={`w-5 h-5 ${pullProgress >= 1 ? 'text-blue-400' : 'text-slate-400'}`} />
        </motion.div>
      </motion.div>

      {/* Content wrapper with drag */}
      <motion.div
        ref={containerRef}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.6}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ y }}
        onScroll={handleScroll}
        className="flex-1 flex flex-col overflow-y-auto overscroll-behavior-y-none"
      >
        {children}
      </motion.div>
    </div>
  );
}
