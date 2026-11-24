"use client";

import { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

// À placer dans un <Link> : réagit dès le clic, pendant que la page arrive.
export function Attente({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center transition-opacity ${className} ${
        pending ? "animate-pulse opacity-40" : ""
      }`}
    >
      {children}
    </span>
  );
}
