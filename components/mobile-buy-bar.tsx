"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Viewport-docked buy bar. Portaled to body so page transforms cannot trap it. */
export function MobileBuyBar({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--border)] bg-[var(--header-bg-scrolled)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
      {children}
    </div>,
    document.body,
  );
}
