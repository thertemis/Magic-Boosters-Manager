import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Link2, Link2Off, Info } from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const profile = useQuery<{ discordUserId: string | null }>({
    queryKey: ["/api/player/profile"],
    staleTime: 60000,
  });

  const [discordInput, setDiscordInput] = useState<string>("");

  const linkMutation = useMutation({
    mutationFn: async (discordUserId: string | null) =>
      apiRequest("PATCH", "/api/player/discord", { discordUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/player/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: discordInput ? "Discord account linked!" : "Discord account unlinked" });
      setDiscordInput("");
    },
    onError: async (err: any) => {
      const msg = await err?.json?.().then((j: any) => j.message).catch(() => "Failed to update");
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const currentDiscordId = profile.data?.discordUserId;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <UserCircle className="h-8 w-8 text-primary" />
          My Profile
        </h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and integrations.</p>
      </div>

      {/* Account info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Username</span>
            <span className="font-mono font-semibold text-foreground" data-testid="text-username">{user?.username}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize font-semibold text-foreground">{user?.role}</span>
          </div>
        </CardContent>
      </Card>

      {/* Discord link */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#5865F2" }}>
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.033.052a19.9 19.9 0 0 0 5.993 3.03.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
            </svg>
            Discord Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentDiscordId ? (
            <div className="flex items-center justify-between rounded-lg bg-green-950/20 border border-green-800/30 p-3">
              <div>
                <p className="text-sm font-medium text-green-400 flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" /> Linked
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Discord ID: <span className="font-mono text-foreground" data-testid="text-discord-id">{currentDiscordId}</span></p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-400 hover:text-red-300 border-red-900/30 hover:bg-red-950/20"
                onClick={() => linkMutation.mutate(null)}
                disabled={linkMutation.isPending}
                data-testid="button-unlink-discord"
              >
                <Link2Off className="h-4 w-4" /> Unlink
              </Button>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/20 border border-border p-3 text-sm text-muted-foreground flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-400" />
              No Discord account linked. Enter your Discord User ID below to link it.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="discord-id-input" className="text-sm">
              {currentDiscordId ? "Replace Discord User ID" : "Discord User ID"}
            </Label>
            <div className="flex gap-2">
              <Input
                id="discord-id-input"
                placeholder="e.g. 123456789012345678"
                value={discordInput}
                onChange={(e) => setDiscordInput(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-discord-id"
              />
              <Button
                onClick={() => linkMutation.mutate(discordInput.trim() || null)}
                disabled={linkMutation.isPending || !discordInput.trim()}
                data-testid="button-link-discord"
              >
                {linkMutation.isPending ? "Saving…" : "Link"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              To find your Discord User ID: Enable Developer Mode in Discord (Settings → Advanced), then right-click your username and select "Copy User ID".
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
