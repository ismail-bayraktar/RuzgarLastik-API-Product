"use client";

import { useEffect, useRef, useCallback } from "react";
import { X, Maximize2, Minimize2, ChevronUp, ChevronDown } from "lucide-react";

export type DrawerSize = "half" | "large" | "full";

interface BottomDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size: DrawerSize;
  onSizeChange?: (size: DrawerSize) => void;
  children: React.ReactNode;
  showSizeControls?: boolean;
}

const sizeToHeight: Record<DrawerSize, string> = {
  half: "50vh",
  large: "75vh",
  full: "95vh",
};

const sizeOrder: DrawerSize[] = ["half", "large", "full"];

export function BottomDrawer({
  open,
  onClose,
  title,
  subtitle,
  size,
  onSizeChange,
  children,
  showSizeControls = true,
}: BottomDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleExpand = useCallback(() => {
    if (!onSizeChange) return;
    const currentIndex = sizeOrder.indexOf(size);
    if (currentIndex < sizeOrder.length - 1) {
      onSizeChange(sizeOrder[currentIndex + 1]);
    }
  }, [size, onSizeChange]);

  const handleShrink = useCallback(() => {
    if (!onSizeChange) return;
    const currentIndex = sizeOrder.indexOf(size);
    if (currentIndex > 0) {
      onSizeChange(sizeOrder[currentIndex - 1]);
    }
  }, [size, onSizeChange]);

  const handleToggleFullScreen = useCallback(() => {
    if (!onSizeChange) return;
    if (size === "full") {
      onSizeChange("half");
    } else {
      onSizeChange("full");
    }
  }, [size, onSizeChange]);

  if (!open) return null;

  const currentIndex = sizeOrder.indexOf(size);
  const canExpand = currentIndex < sizeOrder.length - 1;
  const canShrink = currentIndex > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-xl shadow-2xl transition-all duration-300 ease-out flex flex-col"
        style={{ height: sizeToHeight[size] }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-foreground truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>

          <div className="flex items-center gap-1 ml-4">
            {showSizeControls && onSizeChange && (
              <>
                <button
                  onClick={handleShrink}
                  disabled={!canShrink}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Küçült"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
                <button
                  onClick={handleExpand}
                  disabled={!canExpand}
                  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                  title="Büyüt"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  onClick={handleToggleFullScreen}
                  className="p-2 rounded-lg hover:bg-muted transition"
                  title={size === "full" ? "Küçült" : "Tam Ekran"}
                >
                  {size === "full" ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition ml-2"
              title="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </>
  );
}

export default BottomDrawer;
