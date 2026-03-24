import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, ShieldOff, Copy, Key, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface ApiKeyRecord {
  id: number;
  name: string;
  key: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function AdminApiKeysPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKey, setRevealedKey] = useState<{ id: number; key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: keys = [], isLoading } = useQuery<ApiKeyRecord[]>({
    queryKey: ["/api/admin/api-keys"],
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/admin/api-keys", { name });
      return res.json() as Promise<ApiKeyRecord>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      setNewKeyName("");
      setRevealedKey({ id: data.id, key: data.key, name: data.name });
    },
    onError: (err: any) => toast({ title: err.message || "Error", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/api-keys/${id}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "API key revoked" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/api-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/api-keys"] });
      toast({ title: "API key deleted" });
    },
  });

  const handleCopyKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (d: string | null) => {
    if (!d) return t("apikeys.never");
    return new Date(d).toLocaleString();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t("apikeys.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("apikeys.subtitle")}</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">{t("apikeys.create")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              data-testid="input-api-key-name"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("apikeys.namePlaceholder")}
              onKeyDown={(e) => { if (e.key === "Enter" && newKeyName.trim()) createMutation.mutate(newKeyName.trim()); }}
            />
            <Button
              data-testid="button-create-api-key"
              onClick={() => createMutation.mutate(newKeyName.trim())}
              disabled={!newKeyName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">{t("apikeys.create")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {keys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No API keys yet. Create one above.</p>
            </div>
          ) : (
            keys.map((k) => (
              <Card key={k.id} className={`bg-card border-border ${!k.isActive ? "opacity-60" : ""}`}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-foreground" data-testid={`text-apikey-name-${k.id}`}>{k.name}</span>
                      <Badge variant={k.isActive ? "outline" : "secondary"} className={k.isActive ? "border-green-700 text-green-400" : ""}>
                        {k.isActive ? t("apikeys.active") : t("apikeys.revoked")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{k.key}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("apikeys.lastUsed")}: {formatDate(k.lastUsedAt)} · Created: {new Date(k.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {k.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate(k.id)}
                        disabled={revokeMutation.isPending}
                        data-testid={`button-revoke-apikey-${k.id}`}
                      >
                        <ShieldOff className="h-4 w-4 mr-1" />
                        {t("apikeys.revoke")}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMutation.mutate(k.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-apikey-${k.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={!!revealedKey} onOpenChange={() => { setRevealedKey(null); setCopied(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              API Key Created: {revealedKey?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-yellow-400 bg-yellow-950/30 border border-yellow-800 rounded-lg p-3">
              ⚠️ {t("apikeys.copyKey")}
            </p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-black/40 border border-border rounded-lg p-3 break-all font-mono text-primary">
                {revealedKey?.key}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopyKey} data-testid="button-copy-api-key">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button className="w-full" onClick={() => { setRevealedKey(null); setCopied(false); }}>
              Done — I saved the key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
