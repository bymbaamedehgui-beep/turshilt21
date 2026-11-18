// Урамшууллын үлдсэн хугацаа «23:05:09» — секунд тутам зөвхөн өөрийгөө шинэчилнэ (бүх хуудсыг дахин зурахгүй), дуусахад onEnd.
import { useState, useEffect } from 'react';
import { fmtLeft } from '../lib/plans';

export function Clock({ until, onEnd, className = 'cm-clock' }) {
  const end = new Date(until).getTime();
  const [left, setLeft] = useState(() => end - Date.now());
  useEffect(() => {
    const tick = () => { const l = end - Date.now(); setLeft(l); return l; };
    if (tick() <= 0) { if (onEnd) onEnd(); return undefined; }
    const t = setInterval(() => { if (tick() <= 0) { clearInterval(t); if (onEnd) onEnd(); } }, 1000);
    return () => clearInterval(t);
  }, [end]);
  return <b className={className} role="timer">{fmtLeft(left)}</b>;
}
