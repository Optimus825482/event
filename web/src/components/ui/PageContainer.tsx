"use client";

import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl" | "7xl" | "full";
}

// Tüm modüller için standart sayfa container'ı
// Responsive padding ve max-width değerleri
export function PageContainer({
  children,
  className,
  maxWidth = "7xl",
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "4xl": "max-w-4xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full",
  };

  return (
    <div
      className={cn(
        "min-h-[calc(100vh-4rem)] bg-slate-900",
        "px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8",
        className
      )}
    >
      <div className={cn("mx-auto w-full", maxWidthClasses[maxWidth])}>
        {children}
      </div>
    </div>
  );
}

// Sayfa başlığı için standart component
interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && <div className="flex-shrink-0">{icon}</div>}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
          {description && (
            <p className="text-sm sm:text-base text-slate-400">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

// İstatistik kartları için grid container
interface StatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 5 | 6;
}

export function StatsGrid({ children, columns = 4 }: StatsGridProps) {
  const colClasses = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 md:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div className={cn("grid gap-3 sm:gap-4", colClasses[columns])}>
      {children}
    </div>
  );
}

// Kart grid'i için container
interface CardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
}

export function CardGrid({ children, columns = 3 }: CardGridProps) {
  const colClasses = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4 sm:gap-6", colClasses[columns])}>
      {children}
    </div>
  );
}
