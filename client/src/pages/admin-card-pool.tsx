import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Card as MtgCard, Set } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Layers, Eye, EyeOff, Loader2 } from "lucide-react";

const rarityColors: Record<string, string> = {
  common: "bg-zinc-500/20 text-zinc-300",
  uncommon: "bg-blue-500/20 text-blue-300",
  rare: "bg-amber-500/20 text-amber-300",
  mythic: "bg-orange-500/20 text-orange-300",
};

export default function AdminCardPoolPage() {
  const [selectedSet, setSelectedSet] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sets = useQuery<Set[]>({
    queryKey: [api.admin.sets.list.path],
    queryFn: async () => {
      const res = await fetch(api.admin.sets.list.path);
      if (!res.ok) throw new Error("Failed to fetch sets");
      return res.json();
    },
  });

  const cardsPath = buildUrl(api.admin.sets.cards.path, { code: selectedSet });

  const cards = useQuery<MtgCard[]>({
    queryKey: [api.admin.sets.cards.path, selectedSet],
    queryFn: async () => {
      const res = await fetch(cardsPath);
      if (!res.ok) throw new Error("Failed to fetch cards");
      return res.json();
    },
    enabled: !!selectedSet,
  });

  const toggleCard = useMutation({
    mutationFn: async ({ id, disabled }: { id: string; disabled: boolean }) => {
      const url = buildUrl(api.admin.sets.toggleCard.path, { id });
      await apiRequest(api.admin.sets.toggleCard.method, url, { disabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.sets.cards.path, selectedSet] });
      toast({ title: "Updated", description: "Card status updated" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredCards = cards.data?.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.rarity || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.collectorNumber || "").includes(searchTerm)
  );

  const enabledCount = filteredCards?.filter((c) => !c.disabled).length ?? 0;
  const disabledCount = filteredCards?.filter((c) => c.disabled).length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Card Pool Editor</h1>
        <p className="text-muted-foreground mt-1">Toggle individual cards on or off within each set.</p>
      </div>

      <Card className="border-white/10 bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <CardTitle>Select Set</CardTitle>
            </div>
            <Select value={selectedSet} onValueChange={(v) => { setSelectedSet(v); setSearchTerm(""); }} data-testid="select-set">
              <SelectTrigger className="w-64" data-testid="select-set-trigger">
                <SelectValue placeholder="Choose a set..." />
              </SelectTrigger>
              <SelectContent>
                {sets.data?.map((s) => (
                  <SelectItem key={s.code} value={s.code} data-testid={`select-set-option-${s.code}`}>
                    {s.name} ({s.code.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSet && filteredCards && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-green-500/20 text-green-400 bg-green-500/10" data-testid="badge-enabled-count">
                <Eye className="w-3 h-3 mr-1" />
                {enabledCount} enabled
              </Badge>
              <Badge variant="outline" className="border-red-500/20 text-red-400 bg-red-500/10" data-testid="badge-disabled-count">
                <EyeOff className="w-3 h-3 mr-1" />
                {disabledCount} disabled
              </Badge>
            </div>
          )}
        </CardHeader>
      </Card>

      {selectedSet && (
        <Card className="border-white/10 bg-card/50 flex flex-col h-[700px]">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <div>
              <CardTitle>Cards</CardTitle>
              <CardDescription>
                {filteredCards?.length ?? 0} cards shown
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, rarity..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-cards"
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {cards.isLoading ? (
                <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading cards...
                </div>
              ) : filteredCards?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No cards found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                  {filteredCards?.map((card) => {
                    const imageUrl = (card.imageUris as Record<string, string>)?.small
                      || (card.imageUris as Record<string, string>)?.normal
                      || "";
                    return (
                      <div
                        key={card.id}
                        className={`flex items-center gap-3 p-3 rounded-md border transition-colors ${
                          card.disabled
                            ? "border-red-500/20 bg-red-500/5 opacity-60"
                            : "border-white/10 bg-white/5"
                        }`}
                        data-testid={`card-pool-item-${card.id}`}
                      >
                        <div className="w-14 h-20 rounded-md overflow-hidden flex-shrink-0 bg-zinc-900 border border-white/10">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={card.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                              No img
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate" data-testid={`card-name-${card.id}`}>
                            {card.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${rarityColors[card.rarity || "common"] || rarityColors.common}`}
                              data-testid={`card-rarity-${card.id}`}
                            >
                              {(card.rarity || "common").toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              #{card.collectorNumber}
                            </span>
                          </div>
                        </div>
                        <Switch
                          checked={!card.disabled}
                          onCheckedChange={(checked) => {
                            toggleCard.mutate({ id: card.id, disabled: !checked });
                          }}
                          data-testid={`switch-toggle-card-${card.id}`}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
