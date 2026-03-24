import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { Loader2, Wand2, UserPlus, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const { login, isLoggingIn, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (user) {
    setLocation("/");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ username, password });
      setLocation("/");
    } catch (error) {
      // Error handled in hook toast
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", { username, password, invitationCode });
      if (res.ok) {
        toast({ title: "Account created", description: "Welcome to MTG Pack Simulator!" });
        // Auto login by reloading as the server sets the session cookie
        window.location.reload();
      } else {
        const data = await res.json();
        toast({ title: "Registration failed", description: data.message, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

      <Card className="w-full max-w-md border-white/10 bg-black/40 backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid grid-cols-2 w-full bg-white/5 p-1 rounded-none border-b border-white/10">
            <TabsTrigger value="login" className="rounded-none data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Login</TabsTrigger>
            <TabsTrigger value="register" className="rounded-none data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Register</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-0">
            <CardHeader className="text-center space-y-4 pb-2">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-purple-900 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 border border-white/10">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                  Planeswalker Access
                </CardTitle>
                <CardDescription className="text-gray-400 mt-2">
                  Enter your credentials to access the multiverse database.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="username">Codename</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Jace Beleren"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-primary/50 transition-all h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Secret Phrase</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-primary/50 transition-all h-12"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-medium bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                  disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    "Enter the Multiverse"
                  )}
                </Button>
              </form>
            </CardContent>
          </TabsContent>

          <TabsContent value="register" className="mt-0">
            <CardHeader className="text-center space-y-4 pb-2">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-purple-900 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 border border-white/10">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <div>
                <CardTitle className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                  Join the Spark
                </CardTitle>
                <CardDescription className="text-gray-400 mt-2">
                  Create your profile with an invitation code.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">Codename</Label>
                  <Input
                    id="reg-username"
                    type="text"
                    placeholder="Chandra Nalaar"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-primary/50 transition-all h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Secret Phrase</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-primary/50 transition-all h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invitation">Invitation Code</Label>
                  <Input
                    id="invitation"
                    type="text"
                    placeholder="ABCD-1234"
                    value={invitationCode}
                    onChange={(e) => setInvitationCode(e.target.value)}
                    className="bg-white/5 border-white/10 focus:border-primary/50 transition-all h-12"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg font-medium bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
                  disabled={isRegistering}
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Awakening...
                    </>
                  ) : (
                    "Ignite your Spark"
                  )}
                </Button>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
      <div className="absolute bottom-4 text-xs text-muted-foreground opacity-50 text-center w-full">
        MTG Pack Simulator is unofficial Fan Content. Not approved/endorsed by Wizards.
      </div>
    </div>
  );
}
