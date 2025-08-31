"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface JsonSchemaViewerProps {
  schema?: Record<string, unknown>;
  title?: string;
  className?: string;
}

interface SchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: unknown;
  properties?: Record<string, unknown>;
  required?: string[];
  example?: unknown;
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export function JsonSchemaViewer({
  schema,
  title = "Schema",
  className,
}: JsonSchemaViewerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const copyToClipboard = (text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case "string":
        return "text-green-600 dark:text-green-400";
      case "number":
      case "integer":
        return "text-blue-600 dark:text-blue-400";
      case "boolean":
        return "text-purple-600 dark:text-purple-400";
      case "array":
        return "text-orange-600 dark:text-orange-400";
      case "object":
        return "text-pink-600 dark:text-pink-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  const getTypeBadgeVariant = ():
    | "default"
    | "secondary"
    | "outline"
    | "destructive" => {
    return "outline";
  };

  const formatJsonValue = (value: unknown): string => {
    if (typeof value === "string") return `"${value}"`;
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    return JSON.stringify(value, null, 2);
  };

  const renderProperty = (
    name: string,
    property: SchemaProperty,
    path: string,
    depth: number = 0,
    isRequired: boolean = false,
  ): JSX.Element => {
    const isExpanded = expandedNodes.has(path);
    const hasChildren = property.type === "object" && property.properties;
    const isArray = property.type === "array";
    const indent = depth * 24;

    return (
      <div key={path} className="font-mono text-sm">
        <div
          className={cn(
            "group flex items-start py-2 hover:bg-muted/50 rounded-md transition-colors",
            depth > 0 && "border-l-2 border-muted",
          )}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          {/* Expand/Collapse for objects and arrays */}
          {(hasChildren || isArray) && (
            <button
              onClick={() => toggleNode(path)}
              className="mr-2 p-0.5 hover:bg-muted rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}

          {/* Property name */}
          <div className="flex-1 flex items-start gap-2">
            <span className="font-semibold text-foreground">
              {!hasChildren && !isArray && (
                <span className="mr-2 text-muted-foreground">•</span>
              )}
              {name}
            </span>

            {/* Type badge */}
            <Badge
              variant={getTypeBadgeVariant()}
              className={cn(
                "text-xs px-1.5 py-0 h-5",
                getTypeColor(property.type),
              )}
            >
              {property.type}
            </Badge>

            {/* Required badge */}
            {isRequired && (
              <Badge
                variant="outline"
                className="text-xs px-1.5 py-0 h-5 text-red-600 dark:text-red-400 border-red-600 dark:border-red-400"
              >
                required
              </Badge>
            )}

            {/* Format badge */}
            {property.format && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                {property.format}
              </Badge>
            )}
          </div>

          {/* Copy button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => copyToClipboard(name, path)}
          >
            {copiedPath === path ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        </div>

        {/* Description */}
        {property.description && (
          <div
            className="text-xs text-muted-foreground mt-1"
            style={{ paddingLeft: `${indent + 32}px` }}
          >
            {property.description}
          </div>
        )}

        {/* Constraints */}
        <div
          className="flex flex-wrap gap-2 mt-1"
          style={{ paddingLeft: `${indent + 32}px` }}
        >
          {property.default !== undefined && (
            <span className="text-xs text-muted-foreground">
              default:{" "}
              <code className="bg-muted px-1 rounded">
                {formatJsonValue(property.default)}
              </code>
            </span>
          )}
          {property.enum && (
            <span className="text-xs text-muted-foreground">
              enum:{" "}
              {property.enum.map((v, i) => (
                <span key={i}>
                  <code className="bg-muted px-1 rounded">
                    {formatJsonValue(v)}
                  </code>
                  {i < property.enum!.length - 1 && ", "}
                </span>
              ))}
            </span>
          )}
          {property.minLength !== undefined && (
            <span className="text-xs text-muted-foreground">
              minLength:{" "}
              <code className="bg-muted px-1 rounded">
                {property.minLength}
              </code>
            </span>
          )}
          {property.maxLength !== undefined && (
            <span className="text-xs text-muted-foreground">
              maxLength:{" "}
              <code className="bg-muted px-1 rounded">
                {property.maxLength}
              </code>
            </span>
          )}
          {property.minimum !== undefined && (
            <span className="text-xs text-muted-foreground">
              min:{" "}
              <code className="bg-muted px-1 rounded">{property.minimum}</code>
            </span>
          )}
          {property.maximum !== undefined && (
            <span className="text-xs text-muted-foreground">
              max:{" "}
              <code className="bg-muted px-1 rounded">{property.maximum}</code>
            </span>
          )}
          {property.pattern && (
            <span className="text-xs text-muted-foreground">
              pattern:{" "}
              <code className="bg-muted px-1 rounded text-xs">
                {property.pattern}
              </code>
            </span>
          )}
        </div>

        {/* Example */}
        {property.example !== undefined && (
          <div
            className="text-xs text-muted-foreground mt-1"
            style={{ paddingLeft: `${indent + 32}px` }}
          >
            example:{" "}
            <code className="bg-muted px-1 rounded">
              {formatJsonValue(property.example)}
            </code>
          </div>
        )}

        {/* Nested properties for objects */}
        {isExpanded && hasChildren && property.properties && (
          <div className="mt-1">
            {Object.entries(property.properties).map(
              ([childName, childProp]) => {
                const childPath = `${path}.${childName}`;
                const isChildRequired =
                  property.required?.includes(childName) || false;
                return renderProperty(
                  childName,
                  childProp as SchemaProperty,
                  childPath,
                  depth + 1,
                  isChildRequired,
                );
              },
            )}
          </div>
        )}

        {/* Array items */}
        {isExpanded && isArray && property.items && (
          <div className="mt-1">
            {renderProperty(
              "items",
              property.items as SchemaProperty,
              `${path}.items`,
              depth + 1,
              false,
            )}
          </div>
        )}
      </div>
    );
  };

  if (!schema) {
    return (
      <div className={cn("p-6 text-center text-muted-foreground", className)}>
        No schema defined
      </div>
    );
  }

  const properties = schema.properties || {};
  const required = schema.required || [];

  if (Object.keys(properties).length === 0) {
    return (
      <div className={cn("p-6 text-center text-muted-foreground", className)}>
        No properties defined
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-card", className)}>
      <div className="border-b bg-muted/30 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="p-2">
        {Object.entries(properties).map(([name, property]) => {
          const isRequired = required.includes(name);
          return renderProperty(
            name,
            property as SchemaProperty,
            name,
            0,
            isRequired,
          );
        })}
      </div>
    </div>
  );
}
