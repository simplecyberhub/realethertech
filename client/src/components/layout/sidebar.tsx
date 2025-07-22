import React from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Settings,
  LogOut,
  User as UserIcon,
} from "lucide-react";

interface SidebarProps {
  user: {
    id: number;
    username: string;
    isAdmin: boolean;
  };
}

function Sidebar({ user }: SidebarProps) {
  const [location] = useLocation();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        // Refresh the page to trigger auth check
        window.location.reload();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const getNavItems = () => {
    const baseItems = [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/",
        active: location === "/",
      },
      {
        label: "Market",
        icon: TrendingUp,
        href: "/market",
        active: location === "/market",
      },
      {
        label: "Portfolio",
        icon: Briefcase,
        href: "/portfolio",
        active: location === "/portfolio",
      },
    ];

    if (user?.isAdmin) {
      baseItems.push({
        label: "Admin",
        icon: Settings,
        href: "/admin",
        active: location === "/admin",
      });
    }

    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex flex-col flex-grow pt-5 bg-white overflow-y-auto border-r border-gray-200">
        <div className="flex items-center flex-shrink-0 px-4">
          <h1 className="text-xl font-bold text-primary">Realethertech</h1>
        </div>

        <div className="mt-8 flex flex-col flex-grow">
          <nav className="flex-1 px-2 space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors",
                  item.active
                    ? "bg-primary-100 text-primary-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}>
                  <item.icon className={cn(
                    "mr-3 h-5 w-5",
                    item.active ? "text-primary-500" : "text-gray-400 group-hover:text-gray-500"
                  )} />
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>

          {/* User section at bottom */}
          <div className="flex-shrink-0 p-4 border-t border-gray-200">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-primary-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{user.username}</p>
                <p className="text-xs text-gray-500">
                  {user.isAdmin ? "Administrator" : "User"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full justify-start"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
export { Sidebar };