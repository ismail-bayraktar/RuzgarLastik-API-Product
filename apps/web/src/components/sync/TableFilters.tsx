"use client";

import { Search, Filter, Columns, Check } from "lucide-react";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
}

interface TableFiltersProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;

  // Filters
  showFilters: boolean;
  onToggleFilters: () => void;
  hasActiveFilters?: boolean;
  filterContent?: React.ReactNode;

  // Columns
  columns: ColumnConfig[];
  onToggleColumn: (columnId: string) => void;
  showColumnMenu: boolean;
  onToggleColumnMenu: () => void;

  // Additional content
  leftContent?: React.ReactNode;
}

export function TableFilters({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Ara...",
  showFilters,
  onToggleFilters,
  hasActiveFilters = false,
  filterContent,
  columns,
  onToggleColumn,
  showColumnMenu,
  onToggleColumnMenu,
  leftContent,
}: TableFiltersProps) {
  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {leftContent}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9 pr-4 py-2 text-sm bg-muted border-0 rounded-lg w-64 focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={onToggleFilters}
            className={`p-2 rounded-lg transition ${
              showFilters || hasActiveFilters
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>

          {/* Columns Menu */}
          <div className="relative">
            <button
              onClick={onToggleColumnMenu}
              className={`p-2 rounded-lg transition ${
                showColumnMenu ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              <Columns className="h-4 w-4" />
            </button>
            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 py-2 min-w-[160px]">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border mb-1">
                  Görünür Kolonlar
                </div>
                {columns.map(col => (
                  <button
                    key={col.id}
                    onClick={() => onToggleColumn(col.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted transition text-left"
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                      col.visible
                        ? "bg-primary border-primary"
                        : "border-input"
                    }`}>
                      {col.visible && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    {col.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Filter Content */}
      {showFilters && filterContent && (
        <div className="mt-4 pt-4 border-t border-border">
          {filterContent}
        </div>
      )}
    </div>
  );
}

// Pagination component
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  selectedCount?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  startIndex,
  endIndex,
  selectedCount = 0,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const ChevronLeft = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );

  const ChevronRight = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
    <div className="p-4 border-t border-border flex items-center justify-between text-sm">
      <div className="flex items-center gap-4 text-muted-foreground">
        <span>
          Toplam: {totalItems} ürün
          {selectedCount > 0 && ` • ${selectedCount} seçili`}
        </span>
        <span>•</span>
        <span>
          Gösterilen: {startIndex + 1}-{Math.min(endIndex, totalItems)}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Sayfa başına:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-sm bg-muted border-0 rounded"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            title="İlk sayfa"
          >
            <ChevronLeft className="h-4 w-4" />
            <ChevronLeft className="h-4 w-4 -ml-2" />
          </button>
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            title="Önceki sayfa"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1 px-2">
            <input
              type="number"
              value={currentPage}
              onChange={(e) => {
                const page = Math.max(1, Math.min(totalPages, Number(e.target.value)));
                onPageChange(page);
              }}
              min={1}
              max={totalPages}
              className="w-12 px-2 py-1 text-center text-sm bg-muted border-0 rounded"
            />
            <span className="text-muted-foreground">/ {totalPages || 1}</span>
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            title="Sonraki sayfa"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
            title="Son sayfa"
          >
            <ChevronRight className="h-4 w-4" />
            <ChevronRight className="h-4 w-4 -ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TableFilters;
