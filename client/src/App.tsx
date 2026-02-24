import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavBar } from "@/components/nav-bar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import PlayerPacksPage from "@/pages/player-packs";
import OpenPackPage from "@/pages/open-pack";
import CollectionPage from "@/pages/collection";
import AdminUsersPage from "@/pages/admin-users";
import AdminSetsPage from "@/pages/admin-sets";
import AdminGrantPage from "@/pages/admin-grant";
import AdminBoosterMakerPage from "@/pages/admin-booster-maker";
import AdminCardPoolPage from "@/pages/admin-card-pool";
import AdminBackupPage from "@/pages/admin-backup";

function PrivateRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      <NavBar />
      <main className="flex-1 p-4 md:p-8 md:ml-64 overflow-x-hidden">
        <Component />
      </main>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      
      {/* Player Routes */}
      <Route path="/">
        <PrivateRoute component={PlayerPacksPage} />
      </Route>
      <Route path="/open/:id">
        {/* Open Pack is a full screen experience, no layout */}
        <PrivateRoute component={OpenPackPage} />
      </Route>
      <Route path="/collection">
        <PrivateRoute component={CollectionPage} />
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/users">
        <PrivateRoute component={AdminUsersPage} adminOnly />
      </Route>
      <Route path="/admin/sets">
        <PrivateRoute component={AdminSetsPage} adminOnly />
      </Route>
      <Route path="/admin/grant">
        <PrivateRoute component={AdminGrantPage} adminOnly />
      </Route>
      <Route path="/admin/booster-maker">
        <PrivateRoute component={AdminBoosterMakerPage} adminOnly />
      </Route>
      <Route path="/admin/card-pool">
        <PrivateRoute component={AdminCardPoolPage} adminOnly />
      </Route>
      <Route path="/admin/backup">
        <PrivateRoute component={AdminBackupPage} adminOnly />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
