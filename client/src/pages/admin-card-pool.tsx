import { useState, useMemo } from "react";
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
import { Button } from "@/components/ui/button";
import { Search, Layers, Eye, EyeOff, Loader2, X, ExternalLink, Filter, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { filterCards } from "@shared/scryfall-filter";

const rarityColors: Record<string, string> = {
  common: "bg-zinc-500/20 text-zinc-300",
  uncommon: "bg-blue-500/20 text-blue-300",
  rare: "bg-amber-500/20 text-amber-300",
  mythic: "bg-orange-500/20 text-orange-300",
};

export default function AdminCardPoolPage() {
  const [selectedSet, setSelectedSet] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [useScryfallFilter, setUseScryfallFilter] = useState(false);
  const [enlargedCard, setEnlargedCard] = useState<MtgCard | null>(null);
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

  const isAllSets = selectedSet === "__all__";
  const cardsPath = isAllSets ? "/api/admin/cards/all" : buildUrl(api.admin.sets.cards.path, { code: selectedSet });

  const cards = useQuery<MtgCard[]>({
    queryKey: isAllSets ? ["/api/admin/cards/all"] : [api.admin.sets.cards.path, selectedSet],
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
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkToggle = useMutation({
    mutationFn: async ({ cardIds, disabled }: { cardIds: string[]; disabled: boolean }) => {
      if (isAllSets) {
        await apiRequest("POST", `/api/admin/cards/bulk-toggle`, { cardIds, disabled });
      } else {
        await apiRequest("POST", `/api/admin/sets/${selectedSet}/cards/bulk-toggle`, { cardIds, disabled });
      }
    },
    onSuccess: (_, vars) => {
      if (isAllSets) queryClient.invalidateQueries({ queryKey: ["/api/admin/cards/all"] });
      else queryClient.invalidateQueries({ queryKey: [api.admin.sets.cards.path, selectedSet] });
      toast({ title: `${vars.cardIds.length} cards ${vars.disabled ? "disabled" : "enabled"}` });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredCards = useMemo(() => {
    if (!cards.data) return [];
    if (!searchTerm.trim()) return cards.data;

    if (useScryfallFilter) {
      return filterCards(cards.data, searchTerm);
    }

    const lower = searchTerm.toLowerCase();
    return cards.data.filter(c =>
      c.name.toLowerCase().includes(lower) ||
      (c.rarity || "").toLowerCase().includes(lower) ||
      (c.collectorNumber || "").includes(lower) ||
      (c.typeLine || "").toLowerCase().includes(lower)
    );
  }, [cards.data, searchTerm, useScryfallFilter]);

  const enabledCount = filteredCards.filter(c => !c.disabled).length;
  const disabledCount = filteredCards.filter(c => c.disabled).length;
  const filteredIds = filteredCards.map(c => c.id);

  function bulkEnableFiltered() {
    if (!filteredIds.length) return;
    bulkToggle.mutate({ cardIds: filteredIds, disabled: false });
  }

  function bulkDisableFiltered() {
    if (!filteredIds.length) return;
    bulkToggle.mutate({ cardIds: filteredIds, disabled: true });
  }

  const openScryfall = (card: MtgCard) => {
    window.open(`https://scryfall.com/card/${card.set}/${card.collectorNumber}`, "_blank");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Card Pool Editor</h1>
        <p className="text-muted-foreground mt-1">Toggle individual cards on or off within each set. Use Scryfall syntax for advanced filtering.</p>
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
                <SelectItem value="__all__" data-testid="select-set-option-all">
                  ★ All Installed Sets
                </SelectItem>
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
          <CardHeader className="flex flex-col gap-4 pb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Cards</CardTitle>
                <CardDescription>{filteredCards.length ?? 0} cards shown</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Bulk toggle buttons */}
                {filteredCards.length > 0 && (
                  <>
                    <Button
                      data-testid="button-bulk-enable"
                      size="sm" variant="outline"
                      className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                      onClick={bulkEnableFiltered}
                      disabled={bulkToggle.isPending}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Enable All ({filteredCards.length})
                    </Button>
                    <Button
                      data-testid="button-bulk-disable"
                      size="sm" variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      onClick={bulkDisableFiltered}
                      disabled={bulkToggle.isPending}
                    >
                      <EyeOff className="h-3 w-3 mr-1" />
                      Disable All ({filteredCards.length})
                    </Button>
                  </>
                )}
              </div>
            </div>
            {/* Search bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                {useScryfallFilter
                  ? <Filter className="absolute left-2 top-2.5 h-4 w-4 text-primary" />
                  : <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />}
                <Input
                  placeholder={useScryfallFilter ? "Scryfall syntax: r:rare t:creature c:g..." : "Search by name, rarity, type..."}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search-cards"
                />
                {searchTerm && (
                  <button className="absolute right-2 top-2.5" onClick={() => setSearchTerm("")}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              <Button
                data-testid="button-toggle-scryfall-filter"
                variant={useScryfallFilter ? "default" : "outline"}
                size="sm"
                onClick={() => { setUseScryfallFilter(v => !v); setSearchTerm(""); }}
                className={useScryfallFilter ? "bg-primary" : "border-white/10"}
              >
                <Filter className="h-4 w-4 mr-1" />
                Scryfall
              </Button>
            </div>
            {useScryfallFilter && (
              <p className="text-xs text-muted-foreground">
                Supports: <code>r:rare</code>, <code>t:creature</code>, <code>c:g</code>, <code>o:flying</code>, <code>cmc:3</code>, <code>is:fullart</code>, AND/OR/NOT
              </p>
            )}
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              {cards.isLoading ? (
                <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading cards...
                </div>
              ) : filteredCards.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No cards found.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
                  {filteredCards.map((card) => {
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
                        <div
                          className="w-14 h-20 rounded-md overflow-hidden flex-shrink-0 bg-zinc-900 border border-white/10 cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => setEnlargedCard(card)}
                          data-testid={`card-image-${card.id}`}
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
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
                          <p className="text-xs text-muted-foreground truncate">{card.typeLine}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 ${rarityColors[card.rarity || "common"] || rarityColors.common}`}
                              data-testid={`card-rarity-${card.id}`}
                            >
                              {(card.rarity || "common").toUpperCase()}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">#{card.collectorNumber}</span>
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

      {/* Card Image Modal */}
      <AnimatePresence>
        {enlargedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEnlargedCard(null)}
            data-testid="card-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="relative max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-12 right-0 text-white hover:bg-white/10"
                onClick={() => setEnlargedCard(null)}
                data-testid="button-close-modal"
              >
                <X className="w-6 h-6" />
              </Button>
              {(() => {
                const imgUrl = (enlargedCard.imageUris as any)?.large || (enlargedCard.imageUris as any)?.normal;
                return imgUrl
                  ? <img src={imgUrl} alt={enlargedCard.name} className="w-full rounded-xl shadow-2xl" />
                  : <div className="w-full aspect-[2/3] bg-card rounded-xl flex items-center justify-center text-muted-foreground">{enlargedCard.name}</div>;
              })()}
              <div className="mt-4 text-center space-y-2">
                <h3 className="text-xl font-display font-bold text-white">{enlargedCard.name}</h3>
                <p className="text-sm text-muted-foreground">{enlargedCard.typeLine}</p>
                <div className="flex gap-2 justify-center">
                  <Badge className={rarityColors[enlargedCard.rarity || "common"]}>{enlargedCard.rarity}</Badge>
                  <Badge variant="outline" className="border-white/10">#{enlargedCard.collectorNumber}</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 mt-2"
                  onClick={() => openScryfall(enlargedCard)}
                  data-testid="button-open-scryfall"
                >
                  <ExternalLink className="w-4 h-4" /> View on Scryfall
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
