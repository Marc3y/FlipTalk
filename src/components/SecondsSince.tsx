"use client";
import { useEffect, useState } from "react";

export function SecondsSince({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!since) return null;
  return <span className="font-mono tabular-nums text-white/40">{Math.max(0, Math.floor((now - since) / 1000))}s</span>;
}
