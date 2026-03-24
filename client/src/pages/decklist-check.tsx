import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Copy, ClipboardCheck, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

interface DecklistResult {
  line: string;
  cardName: string;
  requested: number;
  owned: number;
  status: "owned" | "partial" | "missing";
}

interface DecklistResponse {
  results: DecklistResult[];
  totalCards: number;
  owned: number;
  partial: number;
  missing: number;
}

export default function DecklistCheckPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [decklist, setDecklist] = useState("");
  const [response, setResponse] = useState<DecklistResponse | null>(null);

  const checkMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/player/decklist-check", { decklist: text });
      return res.json() as Promise<DecklistResponse>;
    },
    onSuccess: (data) => setResponse(data),
    onError: (err: any) => toast({ title: err.message || "Error", variant: "destructive" }),
  });

  const handleCheck = () => {
    if (!decklist.trim()) return;
    checkMutation.mutate(decklist);
  };

  const handleCopy = () => {
    if (!response) return;
    const lines = [
      `Decklist Check — ${response.owned}/${response.totalCards} owned`,
      `Owned: ${response.owned}  Partial: ${response.partial}  Missing: ${response.missing}`,
      "",
      ...response.results.map(r => {
        const icon = r.status === "owned" ? "✓" : r.status === "partial" ? "~" : "✗";
        return `${icon} ${r.requested}x ${r.cardName} (have ${r.owned})`;
      }),
    ].join("\n");
    navigator.clipboard.writeText(lines);
    toast({ title: t("decklist.copied") });
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">{t("decklist.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("decklist.subtitle")}</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">{t("decklist.title")}</CardTitle>
          <CardDescription>{t("decklist.format")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            data-testid="input-decklist"
            value={decklist}
            onChange={(e) => setDecklist(e.target.value)}
            placeholder={t("decklist.placeholder")}
            rows={10}
            className="font-mono text-sm"
          />
          <div className="flex gap-2">
            <Button
              data-testid="button-check-decklist"
              onClick={handleCheck}
              disabled={!decklist.trim() || checkMutation.isPending}
            >
              {checkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              {t("decklist.check")}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setDecklist(""); setResponse(null); }}
              data-testid="button-clear-decklist"
            >
              {t("decklist.clear")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {response && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
                <span className="text-muted-foreground text-sm">{t("decklist.total")}:</span>
                <span className="font-bold text-foreground">{response.totalCards}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-950/30 border border-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="font-bold text-green-400">{response.owned} {t("decklist.owned")}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-950/30 border border-yellow-800">
                <AlertCircle className="h-4 w-4 text-yellow-400" />
                <span className="font-bold text-yellow-400">{response.partial} {t("decklist.partial")}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-800">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="font-bold text-red-400">{response.missing} {t("decklist.missing")}</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-results">
              <Copy className="h-4 w-4 mr-2" />
              {t("decklist.copy")}
            </Button>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="divide-y divide-border">
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
                        <span className="text-xs text-muted-foreground">{result.owned}/{result.requested}</span>
                      )}
                      {result.status === "owned" && (
                        <Badge variant="outline" className="border-green-700 text-green-400 text-xs">
                          {result.owned >= result.requested ? `${result.owned} owned` : `${result.owned}/${result.requested}`}
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
          <p>{t("decklist.noResults")}</p>
        </div>
      )}
    </div>
  );
}
