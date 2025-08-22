import { MCPIntegration } from "@/data/mcp-integrations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Github, Shield, Wrench } from "lucide-react";
import Image from "next/image";

interface MCPServerDetailModalProps {
  server: MCPIntegration | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MCPServerDetailModal({
  server,
  open,
  onOpenChange,
}: MCPServerDetailModalProps) {
  if (!server) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative h-16 w-16 shrink-0">
              <Image
                src={server.iconUrl}
                alt={`${server.name} logo`}
                width={64}
                height={64}
                className="object-contain"
                unoptimized
              />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-1">{server.name}</DialogTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>by {server.provider}</span>
                {server.authType && (
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>{server.authType}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogDescription className="text-base">
            {server.description}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Categories */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Categories</h3>
            <div className="flex flex-wrap gap-2">
              {server.categories.map((category) => (
                <Badge key={category} variant="secondary">
                  {category}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Tools */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="h-4 w-4" />
              <h3 className="text-sm font-semibold">
                Available Tools ({server.tools.count})
              </h3>
            </div>
            <div className="space-y-2">
              {server.tools.examples.map((tool, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/50"
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{tool}</div>
                    {server.tools.descriptions &&
                      server.tools.descriptions[index] && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {server.tools.descriptions[index]}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-3">
            {server.repoUrl && (
              <Button variant="outline" asChild>
                <a
                  href={server.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4 mr-2" />
                  View Repository
                </a>
              </Button>
            )}
            {server.docsUrl && (
              <Button variant="outline" asChild>
                <a
                  href={server.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Documentation
                </a>
              </Button>
            )}
            <Button className="ml-auto">
              <ExternalLink className="h-4 w-4 mr-2" />
              Configure Server
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
