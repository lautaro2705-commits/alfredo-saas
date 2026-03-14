/**
 * Skeleton loaders — shape-matched to real content.
 * Use these instead of generic spinners for perceived performance.
 */
import clsx from 'clsx'

// ── Base skeleton block ──

function Skeleton({ className }) {
  return <div className={clsx('skeleton', className)} />
}

function SkeletonText({ className, lines = 1 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'skeleton-text',
            i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full',
            className
          )}
        />
      ))}
    </div>
  )
}

// ── Dashboard skeleton ──

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-page-in">
      {/* Greeting banner */}
      <Skeleton className="h-32 rounded-2xl" />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card-static flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Quick metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card-static text-center space-y-2 py-4">
            <Skeleton className="h-8 w-12 mx-auto" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-static space-y-3">
          <Skeleton className="h-5 w-32" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
              <Skeleton className="w-4 h-4 rounded mt-0.5" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="card-static space-y-3">
          <Skeleton className="h-5 w-28" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Card grid skeleton (Stock, Peritajes) ──

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>

      {/* Filters */}
      <div className="card-static">
        <div className="flex flex-col sm:flex-row gap-4">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="card-static space-y-3">
            <div className="flex justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3.5 w-12" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-3.5 w-4" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <div className="flex justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <Skeleton className="h-3.5 w-12" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Table skeleton (Clientes, etc.) ──

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-6 animate-page-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Table */}
      <div className="card-static overflow-hidden p-0">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b">
          <div className="flex gap-4">
            {[...Array(cols)].map((_, i) => (
              <Skeleton key={i} className="h-3 w-20" />
            ))}
          </div>
        </div>
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <div className="flex items-center gap-4">
              {[...Array(cols)].map((_, j) => (
                <Skeleton key={j} className={clsx('h-4', j === 0 ? 'w-32' : 'w-20')} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Generic page spinner (fallback) ──

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="relative">
        <div className="w-10 h-10 border-2 border-primary-200 dark:border-primary-700 rounded-full" />
        <div className="absolute top-0 w-10 h-10 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

export default { DashboardSkeleton, CardGridSkeleton, TableSkeleton, PageSpinner }
