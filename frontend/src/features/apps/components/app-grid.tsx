"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AppCard } from "./app-card";
import { useState, useMemo } from "react";
import { App } from "@/features/apps/types/app.types";
import { useAppConfigs } from "@/features/app-configs/hooks/use-app-config";

enum AuthType {
  ALL = "All Auth Types",
  API_KEY = "api_key",
  OAUTH2 = "oauth2",
  NO_AUTH = "no_auth",
}

interface AppGridProps {
  apps: App[];
}

export function AppGrid({ apps }: AppGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<string>("All Categories");
  const [selectedAuthType, setSelectedAuthType] = useState<string>(
    AuthType.ALL,
  );

  const { data: appConfigs = [] } = useAppConfigs();

  const categories = Array.from(
    new Set(apps.flatMap((app) => app.categories || [])),
  );

  const authTypes = Array.from(
    new Set(
      apps.flatMap((app) => Object.keys(app.supported_security_schemes || {})),
    ),
  ).filter((authType) =>
    [AuthType.API_KEY, AuthType.OAUTH2, AuthType.NO_AUTH].includes(
      authType as AuthType,
    ),
  );

  const configuredAppNames = useMemo(() => {
    return new Set(appConfigs.map((config) => config.app_name));
  }, [appConfigs]);
  const matchesCategory = useMemo(() => {
    return (app: App, category: string): boolean => {
      switch (category) {
        case "All Categories":
          return true;
        default:
          return (app.categories || []).includes(category);
      }
    };
  }, []);

  const matchesAuthType = useMemo(() => {
    return (app: App, authType: string): boolean => {
      if (authType === AuthType.ALL) {
        return true;
      }
      return Object.keys(app.supported_security_schemes || {}).includes(
        authType,
      );
    };
  }, []);

  const matchesSearchQuery = useMemo(() => {
    return (app: App, query: string): boolean => {
      if (!query) return true;

      const lowerQuery = query.toLowerCase();
      return (
        app.name.toLowerCase().includes(lowerQuery) ||
        app.description.toLowerCase().includes(lowerQuery) ||
        (app.categories || []).some((c) => c.toLowerCase().includes(lowerQuery))
      );
    };
  }, []);

  const filteredAndSortedApps = useMemo(() => {
    const filtered = apps.filter((app) => {
      return (
        matchesSearchQuery(app, searchQuery) &&
        matchesCategory(app, selectedCategory) &&
        matchesAuthType(app, selectedAuthType)
      );
    });

    // Sort alphabetically by name (A-Z)
    return filtered.sort((a, b) =>
      (a.display_name || a.name || "").localeCompare(
        b.display_name || b.name || "",
      ),
    );
  }, [
    apps,
    searchQuery,
    selectedCategory,
    selectedAuthType,
    matchesSearchQuery,
    matchesCategory,
    matchesAuthType,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search apps by name, description, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Categories">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedAuthType} onValueChange={setSelectedAuthType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={AuthType.ALL}>All Auth Types</SelectItem>
            {authTypes.map((authType) => (
              <SelectItem key={authType} value={authType}>
                {authType === AuthType.API_KEY
                  ? "API Key"
                  : authType === AuthType.OAUTH2
                    ? "OAuth2"
                    : authType === AuthType.NO_AUTH
                      ? "No Auth"
                      : authType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* <Select onValueChange={setSelectedTag}>
          <SelectTrigger className="w-[80px]">
            <SelectValue placeholder="Tags" />
          </SelectTrigger>
          <SelectContent>
            {["all", ...tags].map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select> */}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredAndSortedApps.map((app) => (
          <AppCard
            key={app.id || app.name}
            app={app}
            isConfigured={configuredAppNames.has(app.name)}
          />
        ))}
      </div>

      {filteredAndSortedApps.length === 0 && (
        <div className="text-center text-muted-foreground">
          No apps found matching your criteria
        </div>
      )}
    </div>
  );
}
