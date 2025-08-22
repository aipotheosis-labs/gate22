"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { mcpIntegrations } from "@/data/mcp-integrations";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";

export default function MCPServersPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Get unique categories
  const categories = useMemo(() => {
    const allCategories = mcpIntegrations.flatMap((mcp) => mcp.categories);
    return ["all", ...Array.from(new Set(allCategories))].sort();
  }, []);

  // Filter integrations based on search and category
  const filteredIntegrations = useMemo(() => {
    return mcpIntegrations.filter((mcp) => {
      const matchesSearch =
        searchQuery.toLowerCase() === "" ||
        mcp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mcp.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mcp.provider.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "all" || mcp.categories.includes(selectedCategory);

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div>
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h2 className="text-2xl font-bold">MCP Servers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Browse and configure Model Context Protocol servers to extend your AI
          agent&apos;s capabilities
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search MCP servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === "all" ? "All Categories" : category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-sm text-muted-foreground">
          Showing {filteredIntegrations.length} of {mcpIntegrations.length} MCP
          servers
        </div>

        {/* Integration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((mcp) => (
            <Card
              key={mcp.name}
              className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer h-[180px]"
              onClick={() =>
                router.push(`/mcp-servers/${encodeURIComponent(mcp.name)}`)
              }
            >
              <CardHeader className="flex flex-col flex-1 pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-8 shrink-0 flex items-center justify-center">
                    <Image
                      src={mcp.iconUrl}
                      alt={`${mcp.name} logo`}
                      width={32}
                      height={32}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <CardTitle className="text-lg">{mcp.name}</CardTitle>
                </div>
                <CardDescription className="text-sm line-clamp-2 flex-1">
                  {mcp.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                {/* Categories */}
                <div className="flex flex-wrap gap-1">
                  {mcp.categories.map((category) => (
                    <Badge
                      key={category}
                      variant="secondary"
                      className="text-xs"
                    >
                      {category}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty state */}
        {filteredIntegrations.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No MCP servers found matching your criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
