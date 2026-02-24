import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  LogOut, 
  User as UserIcon, 
  Package, 
  Layers, 
  Settings, 
  Users,
  Shield,
  Menu,
  Wand2,
  Eye,
  HardDrive,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export function NavBar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const NavLink = ({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <Button 
          variant={isActive ? "secondary" : "ghost"} 
          className={`w-full justify-start gap-2 ${isActive ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
          onClick={() => setOpen(false)}
        >
          <Icon className="h-4 w-4" />
          {children}
        </Button>
      </Link>
    );
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="py-6 px-4">
        <h1 className="text-2xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
          MTG Simulator
        </h1>
        <p className="text-xs text-muted-foreground mt-1">v1.0.0 • {user.username}</p>
      </div>

      <div className="flex-1 px-2 space-y-6">
        <div>
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Player Zone
          </h3>
          <div className="space-y-1">
            <NavLink href="/" icon={Package}>My Packs</NavLink>
            <NavLink href="/collection" icon={Layers}>Collection</NavLink>
          </div>
        </div>

        {isAdmin && (
          <div>
            <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Admin Nexus
            </h3>
            <div className="space-y-1">
              <NavLink href="/admin/users" icon={Users}>Manage Users</NavLink>
              <NavLink href="/admin/sets" icon={Settings}>Set Management</NavLink>
              <NavLink href="/admin/grant" icon={Shield}>Grant Packs</NavLink>
              <NavLink href="/admin/card-pool" icon={Eye}>Card Pool</NavLink>
              <NavLink href="/admin/booster-maker" icon={Wand2}>Booster Maker</NavLink>
              <NavLink href="/admin/backup" icon={HardDrive}>Backup & Restore</NavLink>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5">
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2 text-red-400 hover:text-red-300 hover:bg-red-950/20 border-red-900/20"
          onClick={() => logout()}
        >
          <LogOut className="h-4 w-4" />
          Logout
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
        <span className="font-display font-bold ml-4">MTG Simulator</span>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-card border-r border-white/10">
        <NavContent />
      </div>
    </>
  );
}
