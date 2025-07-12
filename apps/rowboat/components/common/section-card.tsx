import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SectionCardProps {
  title: React.ReactNode;
  children: React.ReactNode;
  labelWidth?: string; // e.g., 'md:w-32'
  className?: string;
}

export function SectionCard({ title, children, labelWidth = 'md:w-32', className = '' }: SectionCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`rounded-lg shadow border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-gray-900 ${className}`}>
      <button
        type="button"
        className={`flex items-center gap-2 ${labelWidth} ${expanded ? 'mb-6' : 'mb-1'} focus:outline-none select-none`}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        {title}
      </button>
      <div
        style={{
          maxHeight: expanded ? 9999 : 0,
          overflow: "hidden",
          transition: "max-height 0.2s cubic-bezier(0.4,0,0.2,1)"
        }}
      >
        {expanded && children}
      </div>
    </div>
  );
}
