import * as React from "react"
import { cn } from "@/lib/utils"

interface ExplorationBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  percentage: number
}

export function ExplorationBadge({
  percentage,
  className,
  ...props
}: ExplorationBadgeProps) {
  return (
    <div
      className={cn(
        "fixed top-4 right-4 z-50 px-3 py-1 rounded-full",
        "bg-purple-500/80 backdrop-blur-sm",
        "text-white text-sm font-medium",
        "shadow-lg",
        "animate-in fade-in duration-300",
        className
      )}
      {...props}
    >
      {percentage.toFixed(4)}% explored
    </div>
  )
}