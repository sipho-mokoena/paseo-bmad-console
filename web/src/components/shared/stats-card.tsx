import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  className?: string;
  color?: "primary" | "info" | "success" | "warning" | "destructive" | "violet";
}

const colorStyles = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  violet: {
    bg: "bg-violet-500/15",
    text: "text-violet-600 dark:text-violet-400",
  },
  info: { bg: "bg-info/15", text: "text-info-foreground" },
  success: { bg: "bg-success/15", text: "text-success-foreground" },
  warning: { bg: "bg-warning/15", text: "text-warning-foreground" },
  destructive: { bg: "bg-destructive/15", text: "text-destructive-foreground" },
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  className,
  color = "primary",
}: StatsCardProps) {
  const c = colorStyles[color];

  return (
    <Card
      className={cn(
        "glass-card",
        className,
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-4xl font-bold">{value}</p>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={cn("rounded-xl p-3", c.bg)}>
            <Icon className={cn("h-5 w-5", c.text)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
