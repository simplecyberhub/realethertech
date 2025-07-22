import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PriceChangeProps {
  change: number | string;
  showIcon?: boolean;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function PriceChange({
  change,
  showIcon = true,
  className,
  prefix = "",
  suffix = "%",
}: PriceChangeProps) {
  const changeValue = typeof change === "string" ? parseFloat(change) : change;
  const isPositive = changeValue > 0;
  const isNegative = changeValue < 0;
  
  return (
    <div
      className={cn(
        "inline-flex items-center text-sm",
        isPositive && "text-green-600",
        isNegative && "text-red-600",
        !isPositive && !isNegative && "text-gray-600",
        className
      )}
    >
      {showIcon && (
        <>
          {isPositive && <TrendingUp className="w-4 h-4 mr-1" />}
          {isNegative && <TrendingDown className="w-4 h-4 mr-1" />}
        </>
      )}
      <span>
        {isPositive && "+"}
        {prefix}
        {changeValue.toFixed(2)}
        {suffix}
      </span>
    </div>
  );
}
