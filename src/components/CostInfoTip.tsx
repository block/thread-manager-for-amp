import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

const TOOLTIP_TEXT =
  'Cost shown without ~ prefix is the actual cost from Amp. Cost with ~ is estimated and may differ from actual billing.';

export function CostInfoTip() {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const el = iconRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      left: Math.max(8, rect.left - 220),
    });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <>
      <span ref={iconRef} className="cost-info-icon" onMouseEnter={show} onMouseLeave={hide}>
        <Info size={10} />
      </span>
      {pos &&
        createPortal(
          <div className="cost-tooltip-portal" style={{ top: pos.top, left: pos.left }}>
            {TOOLTIP_TEXT}
          </div>,
          document.body,
        )}
    </>
  );
}
