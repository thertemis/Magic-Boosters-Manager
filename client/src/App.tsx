import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NavBar } from "@/components/nav-bar";
import { useAuth } from "@/hooks/use-auth";
import { I18nProvider } from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import PlayerPacksPage from "@/pages/player-packs";
import OpenPackPage from "@/pages/open-pack";
import CollectionPage from "@/pages/collection";
import MarketplacePage from "@/pages/marketplace";
import AdminDecklistPage from "@/pages/admin-decklist";
import AdminUsersPage from "@/pages/admin-users";
import AdminSetsPage from "@/pages/admin-sets";
import AdminGrantPage from "@/pages/admin-grant";
import AdminBoosterMakerPage from "@/pages/admin-booster-maker";
import AdminCardPoolPage from "@/pages/admin-card-pool";
import AdminBackupPage from "@/pages/admin-backup";
import AdminEconomyPage from "@/pages/admin-economy";
import AdminMarketplacePage from "@/pages/admin-marketplace";
import AdminSchedulesPage from "@/pages/admin-schedules";
import AdminApiKeysPage from "@/pages/admin-api-keys";
import ApiDocsPage from "@/pages/api-docs";
import UpdateGuidesPage from "@/pages/update-guides";
import ProfilePage from "@/pages/profile";
import AdminSettingsPage from "@/pages/admin-settings";

function AppMeta() {
  const appSettings = useQuery<{ appName: string; hasFavicon: boolean }>({
    queryKey: ["/api/app/settings"],
    staleTime: 60000,
  });
  useEffect(() => {
    const name = appSettings.data?.appName || "MTG Pack Simulator";
    document.title = name;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (appSettings.data?.hasFavicon) {
      link.href = `/api/app/favicon?v=${Date.now()}`;
    } else {
      link.href = "/favicon.ico";
    }
  }, [appSettings.data]);
  return null;
}

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
      <main className="flex-1 p-4 md:p-8 md:ml-64 overflow-x-hidden mt-16 md:mt-0">
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
        <PrivateRoute component={OpenPackPage} />
      </Route>
      <Route path="/collection">
        <PrivateRoute component={CollectionPage} />
      </Route>
      <Route path="/marketplace">
        <PrivateRoute component={MarketplacePage} />
      </Route>
      <Route path="/profile">
        <PrivateRoute component={ProfilePage} />
      </Route>
      <Route path="/api-docs">
        <PrivateRoute component={ApiDocsPage} />
      </Route>
      <Route path="/guides">
        <PrivateRoute component={UpdateGuidesPage} />
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
      <Route path="/admin/economy">
        <PrivateRoute component={AdminEconomyPage} adminOnly />
      </Route>
      <Route path="/admin/marketplace">
        <PrivateRoute component={AdminMarketplacePage} adminOnly />
      </Route>
      <Route path="/admin/schedules">
        <PrivateRoute component={AdminSchedulesPage} adminOnly />
      </Route>
      <Route path="/admin/api-keys">
        <PrivateRoute component={AdminApiKeysPage} adminOnly />
      </Route>
      <Route path="/admin/decklist">
        <PrivateRoute component={AdminDecklistPage} adminOnly />
      </Route>
      <Route path="/admin/settings">
        <PrivateRoute component={AdminSettingsPage} adminOnly />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <I18nProvider>
          <AppMeta />
          <Router />
          <Toaster />
        </I18nProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
