import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  LogOut, 
  Package, 
  Layers, 
  Settings, 
  Users,
  Shield,
  Menu,
  Wand2,
  Eye,
  HardDrive,
  ShoppingBag,
  Coins,
  CalendarClock,
  BookOpen,
  BookMarked,
  Key,
  Globe,
  ShieldCheck,
  UserCircle,
  Settings2,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function NavBar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { t, lang } = useI18n();

  const balance = useQuery<{ balance: number; settings: { economyEnabled: boolean; marketplaceEnabled: boolean; currencyName: string; currencySymbol: string } | null }>({
    queryKey: ["/api/player/balance"],
    enabled: !!user,
    staleTime: 30000,
  });

  const appSettings = useQuery<{ appName: string; hasFavicon: boolean }>({
    queryKey: ["/api/app/settings"],
    staleTime: 60000,
  });
  const appName = appSettings.data?.appName || "MTG Simulator";

  const langMutation = useMutation({
    mutationFn: async (language: string) => apiRequest("PATCH", "/api/player/preferences/language", { language }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
  });

  if (!user) return null;

  const isAdmin = user.role === "admin";
  const econ = balance.data?.settings;
  const showMarketplace = !!econ?.economyEnabled && econ?.marketplaceEnabled !== false;

  const NavLink = ({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <Button 
          variant={isActive ? "secondary" : "ghost"} 
          className={`w-full justify-start gap-2 ${isActive ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
          onClick={() => setOpen(false)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{children}</span>
        </Button>
      </Link>
    );
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="py-5 px-4">
        <h1 className="text-xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent" data-testid="text-app-name">
          {appName}
        </h1>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground">{user.username}</p>
          {balance.data && econ?.economyEnabled && (
            <span className="text-xs font-mono text-amber-400 bg-amber-950/30 border border-amber-500/20 px-1.5 py-0.5 rounded">
              {balance.data.balance.toLocaleString()} {econ.currencySymbol}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 px-2 space-y-5 overflow-y-auto pb-4">
        {/* Player section */}
        <div>
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            {isAdmin ? "Player Zone" : "My Account"}
          </h3>
          <div className="space-y-0.5">
            <NavLink href="/" icon={Package}>{t("nav.packs")}</NavLink>
            <NavLink href="/collection" icon={Layers}>{t("nav.collection")}</NavLink>
            {showMarketplace && (
              <NavLink href="/marketplace" icon={ShoppingBag}>{t("nav.marketplace")}</NavLink>
            )}
            <NavLink href="/profile" icon={UserCircle}>Profile</NavLink>
          </div>
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div>
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Admin Nexus
            </h3>
            <div className="space-y-0.5">
              <NavLink href="/admin/users" icon={Users}>{t("nav.admin.users")}</NavLink>
              <NavLink href="/admin/sets" icon={Settings}>{t("nav.admin.sets")}</NavLink>
              <NavLink href="/admin/grant" icon={Shield}>{t("nav.admin.grant")}</NavLink>
              <NavLink href="/admin/card-pool" icon={Eye}>{t("nav.admin.cardpool")}</NavLink>
              <NavLink href="/admin/booster-maker" icon={Wand2}>{t("nav.admin.booster")}</NavLink>
              <NavLink href="/admin/economy" icon={Coins}>{t("nav.admin.economy")}</NavLink>
              <NavLink href="/admin/marketplace" icon={ShoppingBag}>{t("nav.admin.marketplace")}</NavLink>
              <NavLink href="/admin/schedules" icon={CalendarClock}>{t("nav.admin.schedules")}</NavLink>
              <NavLink href="/admin/decklist" icon={ShieldCheck}>{t("nav.admin.decklist")}</NavLink>
              <NavLink href="/admin/api-keys" icon={Key}>{t("nav.admin.apikeys")}</NavLink>
              <NavLink href="/admin/backup" icon={HardDrive}>{t("nav.admin.backup")}</NavLink>
              <NavLink href="/admin/settings" icon={Settings2}>App Settings</NavLink>
            </div>
          </div>
        )}

        {/* Resources section */}
        <div>
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Resources
          </h3>
          <div className="space-y-0.5">
            <NavLink href="/api-docs" icon={BookOpen}>{t("nav.api_docs")}</NavLink>
            {isAdmin && <NavLink href="/guides" icon={BookMarked}>{t("nav.guides")}</NavLink>}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-white/5 space-y-2">
        {/* Language selector */}
        <div className="flex items-center gap-2 px-1">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select
            value={lang}
            onValueChange={(v) => langMutation.mutate(v)}
          >
            <SelectTrigger className="h-7 text-xs border-white/10 bg-transparent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 border-red-900/20"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-md border-b border-white/5 flex items-center px-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-card border-r border-white/10">
            <NavContent />
          </SheetContent>
        </Sheet>
        <span className="font-display font-bold ml-4">{appName}</span>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-card border-r border-white/10">
        <NavContent />
      </div>
    </>
  );
}
