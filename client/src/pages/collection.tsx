import { usePlayerCollection } from "@/hooks/use-player";
import { CardDisplay } from "@/components/card-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Search, Loader2, Tag, FileSpreadsheet, ExternalLink, X, Wand2, Store, Sparkles, Coins, ChevronLeft, ArrowUpDown } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { Card } from "@shared/schema";
import { filterCards } from "@shared/scryfall-filter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function isCardAltArt(card: Card): boolean {
  const fe = (card.frameEffects as string[]) || [];
  return (
    card.borderColor === "borderless" ||
    card.fullArt === true ||
    fe.includes("showcase") ||
    fe.includes("extendedart")
  );
}

interface EconomySettings {
  currencyName: string;
  currencySymbol: string;
  economyEnabled: boolean;
  marketplaceEnabled: boolean;
  packStoreEnabled: boolean;
  userTradingEnabled: boolean;
  cardSellEnabled: boolean;
  sellRateMultiplier: number;
}

interface CollectionItem {
  id: number;
  cardId: string;
  quantity: number;
  isFoil: boolean;
  card: Card;
}

export default function CollectionPage() {
  const { collection, tags, exportCollection, exportByTag, exportCsv, exportCsvByTag } = usePlayerCollection();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [scryfallMode, setScryfallMode] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [enlargedItem, setEnlargedItem] = useState<CollectionItem | null>(null);

  const sets = useQuery<{ code: string; name: string; releaseDate: string | null }[]>({
    queryKey: ["/api/sets"],
    staleTime: 300000,
  });

  // Economy action state — inline inside the modal
  const [sellQty, setSellQty] = useState(1);
  const [showListPanel, setShowListPanel] = useState(false);
  const [listQty, setListQty] = useState(1);
  const [listPrice, setListPrice] = useState(10);

  const balance = useQuery<{ balance: number; settings: EconomySettings | null }>({
    queryKey: ["/api/player/balance"],
    staleTime: 30000,
  });

  const econ = balance.data?.settings;
  const economyActive = !!econ?.economyEnabled;
  const currencyName = econ?.currencyName || "Gold";
  const currencySymbol = econ?.currencySymbol || "G";
  const sellRate = econ?.sellRateMultiplier ?? 0.5;

  const openScryfall = (card: Card) => {
    window.open(`https://scryfall.com/card/${card.set}/${card.collectorNumber}`, "_blank");
  };

  const getCardSellValue = (item: CollectionItem, qty: number) => {
    const prices = (item.card.prices as any) || {};
    const priceUsd = item.isFoil
      ? parseFloat(prices.usd_foil || prices.usd || "0")
      : parseFloat(prices.usd || "0");
    return Math.floor(priceUsd * sellRate * qty * 100);
  };

  const sellToStore = useMutation({
    mutationFn: async ({ item, qty }: { item: CollectionItem; qty: number }) => {
      const res = await apiRequest("POST", "/api/player/collection/sell", {
        items: [{ cardId: item.cardId, isFoil: item.isFoil, quantity: qty }],
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/player/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player/collection"] });
      setEnlargedItem(null);
      toast({ title: `Sold for ${data.totalEarned} ${data.currencyName}!` });
    },
    onError: (err: any) => toast({ title: err.message || "Sell failed", variant: "destructive" }),
  });

  const createListing = useMutation({
    mutationFn: async ({ item, qty, price }: { item: CollectionItem; qty: number; price: number }) =>
      apiRequest("POST", "/api/market/cards/list", {
        cardId: item.cardId,
        isFoil: item.isFoil,
        quantity: qty,
        price,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/cards/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player/collection"] });
      setShowListPanel(false);
      setEnlargedItem(null);
      toast({ title: "Card listed for trade!" });
    },
    onError: (err: any) => toast({ title: err.message || "Listing failed", variant: "destructive" }),
  });

  const ownedByName = useMemo(() => {
    if (!collection.data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const item of collection.data) {
      map.set(item.card.name, (map.get(item.card.name) || 0) + item.quantity);
    }
    return map;
  }, [collection.data]);

  const setReleaseDateMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sets.data || []) {
      if (s.releaseDate) map.set(s.code, s.releaseDate);
    }
    return map;
  }, [sets.data]);

  const filteredCollection = useMemo(() => {
    if (!collection.data) return [];
    const filtered = collection.data.filter(item => {
      if (scryfallMode) {
        if (!search.trim()) return true;
        return filterCards([item.card], search).length > 0;
      }
      const matchesSearch =
        item.card.name.toLowerCase().includes(search.toLowerCase()) ||
        item.card.typeLine?.toLowerCase().includes(search.toLowerCase());
      const matchesRarity = rarityFilter === "all" || item.card.rarity === rarityFilter;
      const cardColors = (item.card.colors as string[] | null) || [];
      const matchesColor =
        colorFilter === "all" ||
        (colorFilter === "colorless" && cardColors.length === 0) ||
        cardColors.includes(colorFilter.toUpperCase());
      const matchesTag =
        tagFilter === "all" ||
        (tagFilter === "untagged" && !(item as any).tag) ||
        (item as any).tag === tagFilter;
      return matchesSearch && matchesRarity && matchesColor && matchesTag;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.card.name.localeCompare(b.card.name);
        case "owned":
          return (ownedByName.get(b.card.name) || 0) - (ownedByName.get(a.card.name) || 0);
        case "price": {
          const pa = (a.card.prices as any) || {};
          const pb = (b.card.prices as any) || {};
          const priceA = parseFloat(pa.usd || pa.usd_foil || "0");
          const priceB = parseFloat(pb.usd || pb.usd_foil || "0");
          return priceB - priceA;
        }
        case "date": {
          const da = setReleaseDateMap.get(a.card.set || "") || "";
          const db = setReleaseDateMap.get(b.card.set || "") || "";
          return db.localeCompare(da);
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [collection.data, search, scryfallMode, rarityFilter, colorFilter, tagFilter, sortBy, ownedByName, setReleaseDateMap]);

  const enlargedItemTag = (enlargedItem as any)?.tag as string | null | undefined;
  const enlargedIsEventTagged = !!enlargedItemTag && enlargedItemTag !== "marketplace";

  const openEnlarged = (item: CollectionItem) => {
    setEnlargedItem(item);
    setSellQty(1);
    setListQty(1);
    setListPrice(10);
    setShowListPanel(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">My Collection</h1>
          <p className="text-muted-foreground mt-1">
            {collection.data?.length || 0} unique cards collected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tagFilter !== "all" && tagFilter !== "untagged" && (
            <>
              <Button onClick={() => exportByTag(tagFilter)} variant="outline" className="gap-2" data-testid="button-export-tag">
                <Tag className="w-4 h-4" /> Export "{tagFilter}"
              </Button>
              <Button onClick={() => exportCsvByTag(tagFilter)} variant="outline" className="gap-2" data-testid="button-export-csv-tag">
                <FileSpreadsheet className="w-4 h-4" /> CSV "{tagFilter}"
              </Button>
            </>
          )}
          <Button onClick={exportCollection} variant="outline" className="gap-2" data-testid="button-export-all">
            <Download className="w-4 h-4" /> Export All
          </Button>
          <Button onClick={exportCsv} variant="outline" className="gap-2" data-testid="button-export-csv">
            <FileSpreadsheet className="w-4 h-4" /> Moxfield CSV
          </Button>
        </div>
      </div>

      {tags.data && tags.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Event tags:</span>
          <Badge variant={tagFilter === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setTagFilter("all")} data-testid="tag-filter-all">All</Badge>
          {tags.data.map(t => (
            <Badge key={t} variant={tagFilter === t ? "default" : "outline"} className="cursor-pointer" onClick={() => setTagFilter(t)} data-testid={`tag-filter-${t}`}>{t}</Badge>
          ))}
          <Badge variant={tagFilter === "untagged" ? "default" : "outline"} className="cursor-pointer" onClick={() => setTagFilter("untagged")} data-testid="tag-filter-untagged">Untagged</Badge>
        </div>
      )}

      <div className="bg-card/50 p-4 rounded-md border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            {scryfallMode
              ? <Wand2 className="absolute left-3 top-2.5 h-4 w-4 text-primary" />
              : <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />}
            <Input
              placeholder={scryfallMode ? "r:rare t:creature c:g cmc:3 is:fullart …" : "Search by name or type..."}
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Button
            variant={scryfallMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setScryfallMode(!scryfallMode); setSearch(""); }}
            className="gap-2 shrink-0"
            data-testid="button-toggle-scryfall"
          >
            <Wand2 className="h-4 w-4" />
            {scryfallMode ? "Scryfall ON" : "Scryfall"}
          </Button>
        </div>

        {!scryfallMode && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Select value={rarityFilter} onValueChange={setRarityFilter}>
              <SelectTrigger data-testid="select-rarity"><SelectValue placeholder="Rarity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rarities</SelectItem>
                <SelectItem value="mythic" className="text-orange-500">Mythic</SelectItem>
                <SelectItem value="rare" className="text-yellow-500">Rare</SelectItem>
                <SelectItem value="uncommon" className="text-blue-400">Uncommon</SelectItem>
                <SelectItem value="common" className="text-white">Common</SelectItem>
              </SelectContent>
            </Select>
            <Select value={colorFilter} onValueChange={setColorFilter}>
              <SelectTrigger data-testid="select-color"><SelectValue placeholder="Color" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Colors</SelectItem>
                <SelectItem value="w">White</SelectItem>
                <SelectItem value="u">Blue</SelectItem>
                <SelectItem value="b">Black</SelectItem>
                <SelectItem value="r">Red</SelectItem>
                <SelectItem value="g">Green</SelectItem>
                <SelectItem value="colorless">Colorless</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger data-testid="select-sort"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Sort: Name</SelectItem>
                <SelectItem value="owned">Sort: Owned Count</SelectItem>
                <SelectItem value="price">Sort: Price (High→Low)</SelectItem>
                <SelectItem value="date">Sort: Print Date (Newest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {scryfallMode && (
          <p className="text-xs text-muted-foreground">
            Supported: <code className="text-primary">r:rare</code> <code className="text-primary">t:creature</code> <code className="text-primary">c:g</code> <code className="text-primary">o:flying</code> <code className="text-primary">cmc:3</code> <code className="text-primary">is:fullart</code> <code className="text-primary">s:neo</code> <code className="text-primary">pow:&gt;=4</code> · AND/OR/NOT supported
          </p>
        )}
      </div>

      {collection.isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredCollection.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card/20 rounded-md border-dashed border-2 border-white/5">
          <p>No cards found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredCollection.map((item) => (
            <div key={item.id} className="relative group" data-testid={`card-item-${item.id}`}>
              <div
                className="cursor-pointer"
                onClick={() => openEnlarged(item as CollectionItem)}
                data-testid={`card-click-enlarge-${item.id}`}
              >
                <CardDisplay
                  card={item.card}
                  isFoil={!!item.isFoil}
                  isAltArt={isCardAltArt(item.card)}
                  isFlipped={true}
                  animate={false}
                  className="hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="absolute top-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20 shadow-lg">
                x{item.quantity}
              </div>
              {(item as any).tag && (
                <div className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-white/20 shadow-lg flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {(item as any).tag}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Enlarged Card Modal — everything inside here stays at z-[100] */}
      <AnimatePresence>
        {enlargedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEnlargedItem(null)}
            data-testid="card-enlarge-overlay"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="relative flex flex-col md:flex-row gap-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-12 right-0 text-white hover:bg-white/10"
                onClick={() => setEnlargedItem(null)}
                data-testid="button-close-enlarge"
              >
                <X className="w-6 h-6" />
              </Button>

              {/* Card image + info */}
              <div className="flex flex-col items-center gap-3 max-w-xs w-full mx-auto md:mx-0 shrink-0">
                <div
                  className="cursor-pointer w-full"
                  onClick={() => openScryfall(enlargedItem.card)}
                  data-testid="card-enlarged-click-scryfall"
                >
                  <CardDisplay
                    card={enlargedItem.card}
                    isFoil={!!enlargedItem.isFoil}
                    isAltArt={isCardAltArt(enlargedItem.card)}
                    isFlipped={true}
                    animate={false}
                  />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-display font-bold text-white">{enlargedItem.card.name}</h3>
                  <p className="text-sm text-muted-foreground">{enlargedItem.card.typeLine}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <Badge variant="outline" className="capitalize text-xs">{enlargedItem.card.rarity}</Badge>
                    {enlargedItem.isFoil && <Badge className="bg-purple-500/20 text-purple-300 text-xs border-purple-500/30">Foil</Badge>}
                    <Badge variant="outline" className="text-xs">×{enlargedItem.quantity}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 mt-3"
                    onClick={() => openScryfall(enlargedItem.card)}
                    data-testid="button-open-scryfall"
                  >
                    <ExternalLink className="w-4 h-4" /> View on Scryfall
                  </Button>
                </div>
              </div>

              {/* Economy actions panel — inline, no separate Dialog */}
              {economyActive && (
                <div className="flex-1 space-y-4 min-w-0">
                  {/* List-for-trade form — slides in inline */}
                  {enlargedIsEventTagged ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <p className="text-xs text-amber-400 flex items-center gap-1.5">
                        <Tag className="h-3 w-3 shrink-0" />
                        This card has the event tag <strong>"{enlargedItemTag}"</strong> and cannot be sold or listed on the marketplace.
                      </p>
                    </div>
                  ) : showListPanel ? (
                    <div className="bg-black/60 rounded-xl border border-white/10 p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setShowListPanel(false)}
                          data-testid="button-back-from-list"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <h4 className="font-semibold text-white">List for Trade</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Listing <strong className="text-white">{enlargedItem.card.name}</strong>
                        {enlargedItem.isFoil ? " (Foil)" : ""} on the marketplace.
                      </p>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Quantity (you own {enlargedItem.quantity})</Label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setListQty(q => Math.max(1, q - 1))}>−</Button>
                          <Input
                            type="number"
                            min={1}
                            max={enlargedItem.quantity}
                            value={listQty}
                            onChange={e => setListQty(Math.max(1, Math.min(enlargedItem.quantity, parseInt(e.target.value) || 1)))}
                            className="w-20 text-center"
                            data-testid="input-list-qty"
                          />
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setListQty(q => Math.min(enlargedItem.quantity, q + 1))}>+</Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Price per card ({currencyName})</Label>
                        <Input
                          type="number"
                          min={1}
                          value={listPrice}
                          onChange={e => setListPrice(Math.max(1, parseInt(e.target.value) || 1))}
                          data-testid="input-list-price"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total listing value:{" "}
                        <span className="text-amber-400 font-bold">{listQty * listPrice} {currencySymbol}</span>
                      </p>
                      <div className="flex gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => setShowListPanel(false)}>Cancel</Button>
                        <Button
                          className="flex-1 bg-blue-600 hover:bg-blue-500"
                          onClick={() => createListing.mutate({ item: enlargedItem, qty: listQty, price: listPrice })}
                          disabled={createListing.isPending}
                          data-testid="button-confirm-listing"
                        >
                          {createListing.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                          List for Trade
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h4 className="font-semibold text-white flex items-center gap-2">
                        <Coins className="h-4 w-4 text-amber-400" />
                        Economy Actions
                      </h4>

                      {/* Quantity selector */}
                      {enlargedItem.quantity > 1 && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantity to use</Label>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setSellQty(q => Math.max(1, q - 1))}>−</Button>
                            <span className="w-8 text-center font-mono text-sm">{sellQty}</span>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setSellQty(q => Math.min(enlargedItem.quantity, q + 1))}>+</Button>
                            <span className="text-xs text-muted-foreground">/ {enlargedItem.quantity}</span>
                          </div>
                        </div>
                      )}

                      {/* Sell to Store */}
                      {econ?.cardSellEnabled && (
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-medium text-white">Sell to Store</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            You'll receive{" "}
                            <span className="text-amber-400 font-bold">
                              {getCardSellValue(enlargedItem, sellQty)} {currencySymbol}
                            </span>
                            {" "}for {sellQty}×
                          </p>
                          <Button
                            size="sm"
                            className="bg-amber-600 hover:bg-amber-500 w-full"
                            onClick={() => sellToStore.mutate({ item: enlargedItem, qty: sellQty })}
                            disabled={sellToStore.isPending}
                            data-testid="button-sell-to-store"
                          >
                            {sellToStore.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Store className="h-4 w-4 mr-2" />}
                            Sell {sellQty}× for {getCardSellValue(enlargedItem, sellQty)} {currencySymbol}
                          </Button>
                        </div>
                      )}

                      {/* List for Trade */}
                      {econ?.userTradingEnabled && (
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-400" />
                            <span className="text-sm font-medium text-white">List for Trade</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Put this card up for sale in the marketplace for other players to buy.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-950/20"
                            onClick={() => { setListQty(sellQty); setShowListPanel(true); }}
                            data-testid="button-list-for-trade"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            List {enlargedItem.quantity > 1 ? `${sellQty}×` : ""} for Trade
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
