"use client";

import {
  Cloud, FileSearch, Tags, DollarSign, ShoppingBag,
  ArrowRight, CheckCircle2, XCircle, Loader2, Circle
} from "lucide-react";

export type PipelineStep = "ingest" | "parsing" | "metafields" | "pricing" | "shopify";
export type StepStatus = "idle" | "running" | "completed" | "error" | "warning";

interface PipelineStepInfo {
  id: PipelineStep;
  label: string;
  icon: React.ElementType;
  count?: number;
  errorCount?: number;
}

interface SyncPipelineProps {
  activeStep?: PipelineStep;
  stepStatuses?: Record<string, StepStatus>;
  stepCounts?: Record<string, { total: number; success: number; error: number }>;
  onStepClick?: (step: PipelineStep) => void;
  isRunning?: boolean;
}

const steps: PipelineStepInfo[] = [
  { id: "ingest", label: "Veri Alımı", icon: Cloud },
  { id: "parsing", label: "Ayrıştırma", icon: FileSearch },
  { id: "metafields", label: "Zenginleştirme", icon: Tags },
  { id: "pricing", label: "Fiyatlandırma", icon: DollarSign },
  { id: "shopify", label: "Shopify Sync", icon: ShoppingBag },
];

function getStatusIcon(status: StepStatus) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "warning":
      return <Circle className="h-4 w-4 text-amber-500 fill-amber-500" />;
    default:
      return null;
  }
}

function getStepStyles(status: StepStatus, isActive: boolean) {
  const baseStyles = "relative flex flex-col items-center gap-2 p-3 rounded-lg transition-all cursor-pointer";

  if (isActive) {
    return `${baseStyles} bg-primary/10 border-2 border-primary`;
  }

  switch (status) {
    case "completed":
      return `${baseStyles} bg-green-500/10 border border-green-500/30 hover:bg-green-500/20`;
    case "running":
      return `${baseStyles} bg-blue-500/10 border border-blue-500/30 animate-pulse`;
    case "error":
      return `${baseStyles} bg-red-500/10 border border-red-500/30 hover:bg-red-500/20`;
    case "warning":
      return `${baseStyles} bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20`;
    default:
      return `${baseStyles} bg-muted/50 border border-border hover:bg-muted`;
  }
}

export function SyncPipeline({
  activeStep,
  stepStatuses = {},
  stepCounts = {},
  onStepClick,
  isRunning = false,
}: SyncPipelineProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">Sync Pipeline</h3>
        {isRunning && (
          <span className="flex items-center gap-2 text-xs text-blue-600 bg-blue-500/10 px-2 py-1 rounded">
            <Loader2 className="h-3 w-3 animate-spin" />
            İşlem devam ediyor...
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const status = stepStatuses[step.id] || "idle";
          const isActive = activeStep === step.id;
          const counts = stepCounts[step.id];
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => onStepClick?.(step.id)}
                className={getStepStyles(status, isActive)}
                style={{ minWidth: "100px" }}
              >
                {/* Status indicator */}
                <div className="absolute -top-1 -right-1">
                  {getStatusIcon(status)}
                </div>

                {/* Icon */}
                <div className={`p-2 rounded-lg ${
                  isActive ? "bg-primary/20" :
                  status === "completed" ? "bg-green-500/20" :
                  status === "running" ? "bg-blue-500/20" :
                  status === "error" ? "bg-red-500/20" :
                  "bg-muted"
                }`}>
                  <Icon className={`h-5 w-5 ${
                    isActive ? "text-primary" :
                    status === "completed" ? "text-green-600" :
                    status === "running" ? "text-blue-600" :
                    status === "error" ? "text-red-600" :
                    "text-muted-foreground"
                  }`} />
                </div>

                {/* Label */}
                <span className={`text-xs font-medium ${
                  isActive ? "text-primary" :
                  status === "completed" ? "text-green-600" :
                  status === "running" ? "text-blue-600" :
                  status === "error" ? "text-red-600" :
                  "text-muted-foreground"
                }`}>
                  {step.label}
                </span>

                {/* Counts */}
                {counts && (
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-green-600">{counts.success}</span>
                    {counts.error > 0 && (
                      <>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-red-600">{counts.error}</span>
                      </>
                    )}
                  </div>
                )}
              </button>

              {/* Arrow */}
              {index < steps.length - 1 && (
                <ArrowRight className={`h-4 w-4 mx-1 flex-shrink-0 ${
                  status === "completed" ? "text-green-500" :
                  status === "running" ? "text-blue-500" :
                  "text-muted-foreground/50"
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            isRunning ? "bg-blue-500 animate-pulse" : "bg-green-500"
          }`}
          style={{
            width: `${
              Object.values(stepStatuses).filter(s => s === "completed").length / steps.length * 100
            }%`,
          }}
        />
      </div>
    </div>
  );
}

export default SyncPipeline;
