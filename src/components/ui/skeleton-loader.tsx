import { cn } from "@/lib/utils"

interface SkeletonLoaderProps {
  className?: string
  variant?: "default" | "card" | "avatar" | "text" | "button" | "list"
  count?: number
}

export function SkeletonLoader({ className, variant = "default", count = 1 }: SkeletonLoaderProps) {
  const baseClass = "animate-pulse bg-gradient-to-r from-muted/50 via-muted to-muted/50 bg-[length:200%_100%] animate-shimmer rounded-lg"
  
  const variants = {
    default: "h-4 w-full",
    card: "h-48 w-full",
    avatar: "h-12 w-12 rounded-full",
    text: "h-3 w-3/4",
    button: "h-10 w-24",
    list: "h-16 w-full"
  }

  const items = Array.from({ length: count }, (_, i) => i)

  return (
    <>
      {items.map((index) => (
        <div
          key={index}
          className={cn(baseClass, variants[variant], className)}
        />
      ))}
    </>
  )
}

// Specialized skeleton components for common patterns
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-6 space-y-4", className)}>
      <div className="flex items-center space-x-4">
        <SkeletonLoader variant="avatar" />
        <div className="flex-1 space-y-2">
          <SkeletonLoader variant="text" />
          <SkeletonLoader variant="text" className="w-1/2" />
        </div>
      </div>
      <SkeletonLoader variant="card" className="h-32" />
      <div className="space-y-2">
        <SkeletonLoader variant="text" />
        <SkeletonLoader variant="text" className="w-5/6" />
      </div>
    </div>
  )
}

export function BubbleSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <SkeletonLoader className="h-5 w-32" />
          <SkeletonLoader variant="text" className="w-24" />
        </div>
        <SkeletonLoader className="h-8 w-8 rounded-full" />
      </div>
      <SkeletonLoader variant="text" />
      <SkeletonLoader variant="text" className="w-4/5" />
      <div className="flex items-center gap-4 pt-2">
        <SkeletonLoader className="h-4 w-16" />
        <SkeletonLoader className="h-4 w-20" />
      </div>
    </div>
  )
}

export function StorySkeleton() {
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="relative">
        <SkeletonLoader variant="avatar" className="h-16 w-16" />
      </div>
      <SkeletonLoader className="h-3 w-16" />
    </div>
  )
}

export function MessageSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4">
      <SkeletonLoader variant="avatar" className="h-10 w-10" />
      <div className="flex-1 space-y-2">
        <SkeletonLoader className="h-4 w-24" />
        <SkeletonLoader variant="text" className="w-full" />
        <SkeletonLoader variant="text" className="w-3/4" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4">
        <SkeletonLoader variant="avatar" className="h-24 w-24" />
        <div className="text-center space-y-2">
          <SkeletonLoader className="h-6 w-32 mx-auto" />
          <SkeletonLoader variant="text" className="w-48 mx-auto" />
        </div>
      </div>
      <div className="space-y-4">
        <SkeletonLoader variant="card" className="h-20" />
        <SkeletonLoader variant="card" className="h-20" />
        <SkeletonLoader variant="card" className="h-20" />
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
      <div className="text-center space-y-4">
        <SkeletonLoader variant="avatar" className="h-16 w-16 mx-auto" />
        <div className="space-y-2">
          <SkeletonLoader className="h-4 w-32 mx-auto" />
          <SkeletonLoader variant="text" className="w-48 mx-auto" />
        </div>
      </div>
    </div>
  )
}
