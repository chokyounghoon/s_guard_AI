import { useState, useEffect, useCallback } from 'react';

export function useResizable(initialWidths, storageKey = null) {
  const [widths, setWidths] = useState(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length === initialWidths.length) return parsed;
        } catch (e) {}
      }
    }
    return initialWidths;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(widths));
    }
  }, [widths, storageKey]);

  const startDrag = useCallback((index) => {
    setIsDragging(true);
    setDragIndex(index);
  }, []);

  const onDrag = useCallback(
    (e) => {
      if (!isDragging || dragIndex === null) return;
      const movementX = e.movementX;
      const containerWidth = window.innerWidth;
      const deltaPercent = (movementX / containerWidth) * 100;

      setWidths((prev) => {
        const next = [...prev];
        const minWidth = 15;
        const newCurrentWidth = next[dragIndex] + deltaPercent;
        const newNextWidth = next[dragIndex + 1] - deltaPercent;
        if (newCurrentWidth > minWidth && newNextWidth > minWidth) {
          next[dragIndex] = newCurrentWidth;
          next[dragIndex + 1] = newNextWidth;
        }
        return next;
      });
    },
    [isDragging, dragIndex]
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
    setDragIndex(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
    } else {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [isDragging, onDrag, stopDrag]);

  return { widths, startDrag, isDragging };
}

export function useResizableVertical(initialHeights, storageKey = null) {
  const [heights, setHeights] = useState(() => {
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length === initialHeights.length) return parsed;
        } catch (e) {}
      }
    }
    return initialHeights;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(heights));
    }
  }, [heights, storageKey]);

  const startVDrag = useCallback((index) => {
    setIsDragging(true);
    setDragIndex(index);
  }, []);

  const onDrag = useCallback(
    (e) => {
      if (!isDragging || dragIndex === null) return;
      const movementY = e.movementY;
      const containerHeight = window.innerHeight;
      const deltaPercent = (movementY / containerHeight) * 100;

      setHeights((prev) => {
        const next = [...prev];
        const minHeight = 10;
        const newCurrentHeight = next[dragIndex] + deltaPercent;
        const newNextHeight = next[dragIndex + 1] - deltaPercent;
        if (newCurrentHeight > minHeight && newNextHeight > minHeight) {
          next[dragIndex] = newCurrentHeight;
          next[dragIndex + 1] = newNextHeight;
        }
        return next;
      });
    },
    [isDragging, dragIndex]
  );

  const stopDrag = useCallback(() => {
    setIsDragging(false);
    setDragIndex(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
    } else {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [isDragging, onDrag, stopDrag]);

  return { heights, startVDrag, isDragging };
}
