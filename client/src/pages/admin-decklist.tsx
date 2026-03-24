import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Copy, ClipboardCheck, Search, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

interface DecklistResult {
  line: string;
  cardName: string;
  requested: number;
  owned: number;
  status: "owned" | "partial" | "missing";
}

interface DecklistResponse {
  player: { id: number; username: string };
  results: DecklistResult[];
  totalCards: number;
  owned: number;
  partial: number;
  missing: number;
}

export default function AdminDecklistPage() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [decklist, setDecklist] = useState("");
  const [response, setResponse] = useState<DecklistResponse | null>(null);

  const users = useQuery<User[]>({ queryKey: ["/api/admin/users"] });

  const checkMutation = useMutation({
    mutationFn: async ({ userId, decklist }: { userId: number; decklist: string }) => {
      const res = await apiRequest("POST", "/api/admin/decklist-check", { userId, decklist });
      return res.json() as Promise<DecklistResponse>;
    },
    onSuccess: (data) => setResponse(data),
    onError: (err: any) => toast({ title: err.message || "Error", variant: "destructive" }),
  });

  const handleCheck = () => {
    if (!selectedUserId || !decklist.trim()) return;
    checkMutation.mutate({ userId: parseInt(selectedUserId), decklist });
  };

  const handleCopy = () => {
    if (!response) return;
    const lines = [
      `Decklist Check — ${response.player.username} — ${response.owned}/${response.totalCards} owned`,
      `Owned: ${response.owned}  Partial: ${response.partial}  Missing: ${response.missing}`,
      "",
      ...response.results.map(r => {
        const icon = r.status === "owned" ? "✓" : r.status === "partial" ? "~" : "✗";
        return `${icon} ${r.requested}x ${r.cardName} (have ${r.owned})`;
      }),
    ].join("\n");
    navigator.clipboard.writeText(lines);
    toast({ title: "Results copied to clipboard" });
  };

  const statusColor = (status: DecklistResult["status"]) => {
    if (status === "owned") return "text-green-400 bg-green-950/40 border-green-800";
    if (status === "partial") return "text-yellow-400 bg-yellow-950/40 border-yellow-800";
    return "text-red-400 bg-red-950/40 border-red-800";
  };

  const statusIcon = (status: DecklistResult["status"]) => {
    if (status === "owned") return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (status === "partial") return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  const players = (users.data || []).filter(u => u.role === "player");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary flex items-center gap-3">
          <ShieldCheck className="h-8 w-8" />
          Decklist Legality Check
        </h1>
        <p className="text-muted-foreground mt-1">
          Verify that a player's decklist only contains cards they actually own in their collection.
        </p>
      </div>

      <Card className="bg-card border-white/10">
        <CardHeader>
          <CardTitle>Check Player Decklist</CardTitle>
          <CardDescription>Select a player and paste their decklist to verify ownership.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Player</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger data-testid="select-player">
                <SelectValue placeholder="Select a player..." />
              </SelectTrigger>
              <SelectContent>
                {users.isLoading ? (
                  <div className="flex items-center justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : players.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">No players found</div>
                ) : players.map(u => (
                  <SelectItem key={u.id} value={String(u.id)} data-testid={`option-player-${u.id}`}>
                    {u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Decklist</Label>
            <Textarea
              data-testid="input-decklist"
              value={decklist}
              onChange={(e) => setDecklist(e.target.value)}
              placeholder={"4 Lightning Bolt\n4 Counterspell\n20 Island\n// Comments are ignored"}
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Format: <code>N Card Name</code> per line. Lines starting with <code>//</code> or <code>#</code> are ignored.</p>
          </div>

          <div className="flex gap-2">
            <Button
              data-testid="button-check-decklist"
              onClick={handleCheck}
              disabled={!selectedUserId || !decklist.trim() || checkMutation.isPending}
            >
              {checkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Check Decklist
            </Button>
            <Button
              variant="outline"
              onClick={() => { setDecklist(""); setResponse(null); }}
              data-testid="button-clear-decklist"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {response && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="font-semibold text-white">
                Checking <span className="text-primary">{response.player.username}</span>'s collection
              </span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-sm">Total:</span>
                <span className="font-bold text-foreground">{response.totalCards}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-950/30 border border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="font-bold text-green-400">{response.owned} owned</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-950/30 border border-yellow-800">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <span className="font-bold text-yellow-400">{response.partial} partial</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-800">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="font-bold text-red-400">{response.missing} missing</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-results">
              <Copy className="h-4 w-4 mr-2" />
              Copy Report
            </Button>
          </div>

          {response.missing > 0 && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-300 text-sm flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>
                <strong>Potential cheat detected:</strong> {response.player.username} is missing{" "}
                {response.missing} card type{response.missing > 1 ? "s" : ""} from their collection.
              </span>
            </div>
          )}

          {response.missing === 0 && response.partial === 0 && (
            <div className="p-3 rounded-lg bg-green-950/30 border border-green-800 text-green-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span><strong>All clear:</strong> {response.player.username} owns all cards in this decklist.</span>
            </div>
          )}

          <Card className="bg-card border-white/10">
            <CardContent className="p-0">
              <div className="divide-y divide-white/5">
                {response.results.map((result, i) => (
                  <div
                    key={i}
                    data-testid={`row-decklist-${i}`}
                    className={`flex items-center justify-between px-4 py-3 border-l-4 ${statusColor(result.status)}`}
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon(result.status)}
                      <div>
                        <span className="font-medium text-foreground">{result.cardName}</span>
                        {result.requested > 1 && (
                          <span className="text-muted-foreground text-sm ml-2">×{result.requested}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {result.status === "partial" && (
                        <Badge variant="outline" className="border-yellow-700 text-yellow-400 text-xs">
                          {result.owned}/{result.requested} owned
                        </Badge>
                      )}
                      {result.status === "owned" && (
                        <Badge variant="outline" className="border-green-700 text-green-400 text-xs">
                          {result.owned} owned
                        </Badge>
                      )}
                      {result.status === "missing" && (
                        <Badge variant="outline" className="border-red-700 text-red-400 text-xs">
                          0/{result.requested}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {!response && !checkMutation.isPending && (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Select a player and paste their decklist to begin checking.</p>
        </div>
      )}
    </div>
  );
}
