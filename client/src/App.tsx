import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";
import Dashboard from "./pages/dashboard";
import Market from "./pages/market";
import Portfolio from "./pages/portfolio";
import AuthPage from "./pages/auth-page";
import Admin from "./pages/admin";
import NotFound from "./pages/not-found";
import Sidebar from "./components/layout/sidebar";
import MobileNav from "./components/layout/mobile-nav";
import { Toaster } from "./components/ui/toaster";
import { useQuery } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function AppContent() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const res = await fetch("/api/auth/user", {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) {
          return null; // Not authenticated
        }
        throw new Error("Failed to fetch user");
      }
      const data = await res.json();
      return data.user;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Connection Error</h1>
          <p className="text-gray-600">Unable to connect to server. Please try again later.</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show auth page
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col overflow-hidden md:ml-64">
        <MobileNav user={user} />
        <main className="flex-1 overflow-auto p-4">
          <Switch>
            <Route path="/" component={() => <Dashboard user={user} />} />
            <Route path="/dashboard" component={() => <Dashboard user={user} />} />
            <Route path="/market" component={() => <Market user={user} />} />
            <Route path="/portfolio" component={() => <Portfolio user={user} />} />
            {user.isAdmin && (
              <Route path="/admin" component={() => <Admin user={user} />} />
            )}
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}