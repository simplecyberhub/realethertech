import { PortfolioOverview } from "@/components/portfolio/portfolio-overview";
import type { User } from "@/App";

interface PortfolioProps {
  user: User | null;
}

export default function Portfolio({ user }: PortfolioProps) {
  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Your Portfolio</h2>
        <p className="text-sm text-gray-500">
          Track your cryptocurrency investments.
        </p>
      </div>
      
      <PortfolioOverview user={user} />
    </div>
  );
}
