"use client";

import {
  Filters,
  createFilter,
  type Filter,
  type FilterFieldConfig,
} from "@/components/reui/filters";
import { SearchField } from "@/components/shared/list-kit";
import type { Epic } from "@/lib/bmad/types";

const STATUS_OPTIONS = [
  { value: "done", label: "Done" },
  { value: "in-progress", label: "In Progress" },
  { value: "review", label: "In Review" },
  { value: "blocked", label: "Blocked" },
  { value: "ready-for-dev", label: "Ready for Dev" },
  { value: "backlog", label: "Backlog" },
];

interface StoryFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Filter<string>[];
  onFiltersChange: (filters: Filter<string>[]) => void;
  epics: Epic[];
}

export function StoryFilters({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  epics,
}: StoryFiltersProps) {
  const fields: FilterFieldConfig<string>[] = [
    {
      key: "status",
      label: "Status",
      type: "multiselect",
      options: STATUS_OPTIONS,
    },
    {
      key: "epicId",
      label: "Epic",
      type: "select",
      options: epics.map((e) => ({
        value: e.id,
        label: `Epic ${e.id}: ${e.title}`,
      })),
    },
  ];

  return (
    <div className="contents sm:flex sm:flex-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
      <SearchField
        value={search}
        onChange={onSearchChange}
        placeholder="Search stories"
        className="order-1 min-w-0 flex-1 sm:order-none sm:max-w-sm"
      />
      <div className="order-3 basis-full sm:order-none sm:basis-auto">
        <Filters
          filters={filters}
          fields={fields}
          onChange={onFiltersChange}
          size="sm"
        />
      </div>
    </div>
  );
}

export { createFilter, type Filter };
