'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, PanInfo, useAnimationControls } from 'framer-motion';

const DEFAULT_SNAP_POINTS = [25, 50, 90];

interface BottomSheetProps {
  children: React.ReactNode;
  snapPoints?: number[]; // vh values for visible height, e.g. [25, 50, 90]
  defaultSnap?: number;  // index into snapPoints
  className?: string;    // allow callers to override styles (e.g. z-index)
  onSnapChange?: (snapIndex: number) => void; // called when snap point changes
}

export function BottomSheet({
  children,
  snapPoints = DEFAULT_SNAP_POINTS,
  defaultSnap = 0,
  className = '',
  onSnapChange,
}: BottomSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const controls = useAnimationControls();
  const [windowHeight, setWindowHeight] = useState(800);
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const [scrolledPast, setScrolledPast] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    setWindowHeight(window.innerHeight);
    const onResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Stabilize snapPoints: only recompute when values actually change,
  // not when parent passes a new array reference with identical values.
  const snapPointsKey = snapPoints.join(',');
  const stableSnapPoints = useMemo(() => snapPoints, [snapPointsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The sheet has height = largest snap point in px.
  // It's positioned with top: 100% (offscreen below viewport).
  // We use translateY with negative values to pull it up into view.
  // For a 25vh peek: translateY = -(25% of windowHeight)
  const maxHeightVh = stableSnapPoints[stableSnapPoints.length - 1];
  const maxHeight = (maxHeightVh / 100) * windowHeight;

  // Snap positions as translateY values (all negative, pulling sheet up)
  const snapYValues = useMemo(
    () => stableSnapPoints.map((vh) => -(vh / 100) * windowHeight),
    [stableSnapPoints, windowHeight]
  );

  // Drag constraints: most negative = highest snap, least negative = lowest snap
  const dragTop = snapYValues[snapYValues.length - 1]; // e.g. -90vh (fully open)
  const dragBottom = snapYValues[0]; // e.g. -25vh (peek)

  const snapTo = useCallback(
    (snapIndex: number) => {
      setCurrentSnap(snapIndex);
      onSnapChange?.(snapIndex);
      controls.start({
        y: snapYValues[snapIndex],
        transition: { type: 'spring', stiffness: 400, damping: 35 },
      });
    },
    [controls, snapYValues, onSnapChange]
  );

  // Animate to default snap on mount only (not on every re-render)
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      controls.start({
        y: snapYValues[defaultSnap],
        transition: { type: 'spring', stiffness: 400, damping: 35 },
      });
    }
  }, [controls, snapYValues, defaultSnap]);

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const velocity = info.velocity.y;

      // Flick detection
      if (Math.abs(velocity) > 500) {
        if (velocity < 0 && currentSnap < stableSnapPoints.length - 1) {
          snapTo(currentSnap + 1);
          return;
        }
        if (velocity > 0 && currentSnap > 0) {
          snapTo(currentSnap - 1);
          return;
        }
      }

      // Snap to nearest based on current visual position
      // Get the element's current transform
      const el = containerRef.current;
      if (!el) {
        snapTo(currentSnap);
        return;
      }

      const style = window.getComputedStyle(el);
      const matrix = new DOMMatrixReadOnly(style.transform);
      const currentTranslateY = matrix.m42;

      let nearestIdx = 0;
      let nearestDist = Math.abs(currentTranslateY - snapYValues[0]);
      for (let i = 1; i < snapYValues.length; i++) {
        const dist = Math.abs(currentTranslateY - snapYValues[i]);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      snapTo(nearestIdx);
    },
    [currentSnap, stableSnapPoints.length, snapTo, snapYValues]
  );

  // When the scroll container is scrolled past the top, intercept pointer
  // events on it so they don't reach the motion.div's drag handler.
  // This lets the user scroll content without dragging the sheet.
  // When scrolled to top (scrollTop === 0), pointer events pass through
  // normally so dragging anywhere on the sheet works.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      setScrolledPast(el.scrollTop > 0);
    }
  }, []);

  return (
    <motion.div
      ref={containerRef}
      className={`fixed left-0 right-0 z-50 flex flex-col bg-c2c-base/95 backdrop-blur rounded-t-3xl border-t-2 border-x-2 border-c2c-orange shadow-2xl ${className}`}
      style={{
        top: '100%',
        height: maxHeight,
        touchAction: 'none',
      }}
      drag="y"
      dragConstraints={{
        top: dragTop,
        bottom: dragBottom,
      }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      animate={controls}
      initial={{ y: snapYValues[defaultSnap] }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing shrink-0">
        <div className="w-10 h-1 rounded-full bg-gray-400" />
      </div>

      {/* Content - captures pointer events when scrolled to prevent drag conflict */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain min-h-0"
        style={{ touchAction: scrolledPast ? 'pan-y' : 'none' }}
        onScroll={handleScroll}
        onPointerDownCapture={(e) => {
          // When content is scrolled down, stop the event from reaching
          // the motion.div so framer-motion doesn't start a drag.
          if (scrollRef.current && scrollRef.current.scrollTop > 0) {
            e.stopPropagation();
          }
        }}
      >
        {children}
      </div>
    </motion.div>
  );
}
