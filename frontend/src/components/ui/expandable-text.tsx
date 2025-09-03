"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  text: string;
  className?: string;
  expandButtonClassName?: string;
  maxLines?: number;
}

export function ExpandableText({
  text,
  className,
  expandButtonClassName,
  maxLines = 2,
}: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if text is long enough to need expansion
  // This is a simple heuristic - you might want to measure actual rendered height
  const needsExpansion = text.length > 150; // Adjust threshold as needed

  if (!needsExpansion) {
    return <span className={className}>{text}</span>;
  }

  return (
    <div className="space-y-1">
      <span
        className={cn(
          className,
          !isExpanded && maxLines === 2 && "line-clamp-2",
          !isExpanded && maxLines === 3 && "line-clamp-3",
          !isExpanded && maxLines === 1 && "line-clamp-1",
        )}
      >
        {text}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "h-auto p-0 text-xs font-normal text-muted-foreground hover:text-foreground",
          expandButtonClassName,
        )}
      >
        {isExpanded ? (
          <>
            Show less <ChevronUp className="ml-1 h-3 w-3" />
          </>
        ) : (
          <>
            Show more <ChevronDown className="ml-1 h-3 w-3" />
          </>
        )}
      </Button>
    </div>
  );
}
