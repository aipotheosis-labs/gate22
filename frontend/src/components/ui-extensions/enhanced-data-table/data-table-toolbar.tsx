"use client";

import { Table } from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

interface EnhancedDataTableToolbarProps<TData> {
  table: Table<TData>;
  placeholder?: string;
  showSearchInput?: boolean;
  filterComponent?: React.ReactNode;
}

export function EnhancedDataTableToolbar<TData>({
  table,
  placeholder = "Search...",
  showSearchInput,
  filterComponent,
}: EnhancedDataTableToolbarProps<TData>) {
  const [searchValue, setSearchValue] = useState("");

  const handleSearch = (value: string) => {
    setSearchValue(value);
    table.setGlobalFilter(value);
  };

  // Don't render toolbar if there's no search input and no filter component
  if (!showSearchInput && !filterComponent) {
    return null;
  }

  return (
    <div className="flex items-center justify-between pb-4">
      <div className="flex items-center gap-4">
        {showSearchInput && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={placeholder}
              value={searchValue}
              onChange={(event) => handleSearch(event.target.value)}
              className="pl-10 w-[250px]"
            />
          </div>
        )}

        {filterComponent}
      </div>
    </div>
  );
}
