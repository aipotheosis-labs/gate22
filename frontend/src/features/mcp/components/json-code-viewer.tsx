"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

interface JsonCodeViewerProps {
  data: unknown;
  title?: string;
  className?: string;
  defaultExpanded?: boolean;
  maxHeight?: string;
  compact?: boolean;
}

export function JsonCodeViewer({
  data,
  title = "JSON",
  className,
  maxHeight = "500px",
  compact = false,
}: JsonCodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        compact ? "rounded-lg border" : "rounded-xl border shadow-sm",
        "bg-muted/30 dark:bg-muted/20 overflow-hidden",
        className,
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b bg-background/50 backdrop-blur-sm",
          compact ? "px-3 py-2" : "px-6 py-4",
        )}
      >
        <span
          className={cn(
            "font-medium text-foreground/70",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {title}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "p-0 text-muted-foreground hover:text-foreground transition-colors",
            compact ? "h-6 w-6" : "h-8 w-8",
          )}
          onClick={handleCopy}
        >
          {copied ? (
            <Check className={compact ? "h-3 w-3" : "h-4 w-4"} />
          ) : (
            <Copy className={compact ? "h-3 w-3" : "h-4 w-4"} />
          )}
        </Button>
      </div>

      {/* JSON Content */}
      <div
        className={cn(
          "overflow-auto custom-json-viewer bg-background/30",
          compact ? "p-3 compact-json" : "p-6",
        )}
        style={{
          maxHeight: maxHeight,
        }}
      >
        <JsonView
          data={data as object | unknown[]}
          shouldExpandNode={() => true}
          clickToExpandNode={false}
          style={
            {
              container: {
                backgroundColor: "transparent",
                fontFamily:
                  "ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace",
                fontSize: compact ? "11px" : "14px",
                lineHeight: compact ? "1.4" : "1.6",
              },
              basicChildStyle: {
                paddingLeft: compact ? "16px" : "24px",
              },
              label: {
                color: "hsl(var(--foreground) / 0.7)",
                marginRight: compact ? "4px" : "8px",
                fontWeight: "500",
              },
              stringValue: {
                color: "hsl(142 76% 36%)",
              },
              numberValue: {
                color: "hsl(221 83% 53%)",
              },
              booleanValue: {
                color: "hsl(280 68% 60%)",
              },
              nullValue: {
                color: "hsl(var(--muted-foreground))",
              },
              punctuation: {
                color: "hsl(var(--muted-foreground))",
              },
              otherValue: {
                color: "hsl(45 93% 47%)",
              },
              collapseIcon: {
                display: "none",
              },
              expandIcon: {
                display: "none",
              },
              collapsedContent: {
                display: "none",
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any
          }
        />
      </div>

      {/* Add custom styles */}
      <style jsx global>{`
        .custom-json-viewer .json-view-lite {
          background-color: transparent !important;
        }

        .custom-json-viewer .json-view-lite__toggle {
          display: none !important;
        }

        .custom-json-viewer::-webkit-scrollbar {
          width: ${compact ? "6px" : "10px"};
          height: ${compact ? "6px" : "10px"};
        }

        .custom-json-viewer::-webkit-scrollbar-track {
          background: hsl(var(--muted) / 0.3);
          border-radius: ${compact ? "3px" : "6px"};
        }

        .custom-json-viewer::-webkit-scrollbar-thumb {
          background: hsl(var(--muted-foreground) / 0.3);
          border-radius: ${compact ? "3px" : "6px"};
        }

        .custom-json-viewer::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.5);
        }

        /* Compact mode specific styles */
        .compact-json .json-view-lite {
          line-height: 1.3 !important;
        }

        /* Dark mode specific colors */
        .dark .custom-json-viewer .json-view-lite__string {
          color: hsl(142 71% 45%) !important;
        }

        .dark .custom-json-viewer .json-view-lite__number {
          color: hsl(217 91% 60%) !important;
        }

        .dark .custom-json-viewer .json-view-lite__boolean {
          color: hsl(280 85% 70%) !important;
        }
      `}</style>
    </div>
  );
}
