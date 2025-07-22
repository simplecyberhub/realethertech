import React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  TrendingUp, 
  Wallet, 
  ShieldCheck,
  Bell, 
  Menu,
  LogOut,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { User } from "@/App";
import { useQueryClient } from "@tanstack/react-query";

interface MobileNavProps {
  user: User;
}

export default function MobileNav({ user }: MobileNavProps) {
  const [location] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        // Clear all queries and reload
        queryClient.clear();
        window.location.reload();
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getNavItems = () => {
    const baseItems = [
      {
        label: "Dashboard",
        icon: Home,
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
        icon: Wallet,
        href: "/portfolio",
        active: location === "/portfolio",
      },
    ];

    if (user?.isAdmin) {
      baseItems.push({
        label: "Admin",
        icon: ShieldCheck,
        href: "/admin",
        active: location === "/admin",
      });
    }

    return baseItems;
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white shadow-sm">
        <div className="flex items-center justify-between h-16 px-4">
          <h1 className="text-xl font-semibold text-primary-600">Realethertech</h1>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="text-gray-500">
              <Bell className="h-5 w-5" />
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-2 text-gray-500">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="py-4">
                  <div className="px-4 mb-6 flex items-center">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-800">
                      <UserIcon size={20} />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {user ? user.username : "Guest"}
                      </p>
                      {user && <p className="text-xs text-gray-500">User #{user.id}</p>}
                    </div>
                  </div>
                  <nav className="space-y-2">
                    {navItems.map((item) => (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={cn(
                            "flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                            item.active
                              ? "bg-primary-100 text-primary-900"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                          )}
                        >
                          <item.icon className={cn(
                            "mr-3 h-5 w-5",
                            item.active ? "text-primary-500" : "text-gray-400"
                          )} />
                          {item.label}
                        </div>
                      </Link>
                    ))}
                  </nav>
                  {user && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <Button
                        variant="outline"
                        onClick={handleLogout}
                        className="w-full justify-start"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Log Out
                      </Button>
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200">
        <div className="flex justify-around">
          {navItems.map((item) => (
            <div key={item.href} className="flex-1">
              <Link href={item.href}>
                <div
                  className={cn(
                    "flex flex-col items-center py-2 cursor-pointer",
                    item.active ? "text-primary-600" : "text-gray-500"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs mt-1">{item.label}</span>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}