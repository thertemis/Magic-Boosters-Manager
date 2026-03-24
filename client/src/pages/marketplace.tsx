import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import type { Card as MtgCard } from "@shared/schema";
import {
  ShoppingBag, Package, Coins, Search,
  X, Loader2, Star, Sparkles, Tag, Store, CheckSquare,
} from "lucide-react";

interface EconomySettings {
  currencyName: string;
  currencySymbol: string;
  economyEnabled: boolean;
  marketplaceEnabled: boolean;
  packStoreEnabled: boolean;
  userTradingEnabled: boolean;
  cardSellEnabled: boolean;
  dailyCurrencyEnabled: boolean;
  dailyCurrencyAmount: number;
  sellRateMultiplier: number;
}

interface BalanceData {
  balance: number;
  lastDailyClaimAt: string | null;
  settings: EconomySettings | null;
}

interface PackListing {
  id: number;
  name: string;
  description: string | null;
  setCode: string;
  packType: string;
  price: number;
  stock: number | null;
  set: { name: string; iconSvgUri: string | null };
}

interface CardListing {
  id: number;
  sellerId: number;
  cardId: string;
  isFoil: boolean;
  quantity: number;
  price: number;
  card: MtgCard;
  seller: { id: number; username: string };
}

interface MyListing {
  id: number;
  cardId: string;
  isFoil: boolean;
  quantity: number;
  price: number;
  isActive: boolean;
  createdAt: string;
  card: MtgCard;
}

interface CollectionItem {
  id: number;
  cardId: string;
  quantity: number;
  isFoil: boolean;
  card: MtgCard;
}

type SellToStoreSelection = Record<string, { item: CollectionItem; qty: number }>;

export default function MarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<CollectionItem | null>(null);
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState(10);
  const [buyQty, setBuyQty] = useState<Record<number, number>>({});
  const [sellToStoreSelection, setSellToStoreSelection] = useState<SellToStoreSelection>({});

  const balance = useQuery<BalanceData>({ queryKey: ["/api/player/balance"], staleTime: 30000 });
  const packListings = useQuery<PackListing[]>({ queryKey: ["/api/market/packs"] });
  const cardListings = useQuery<CardListing[]>({ queryKey: ["/api/market/cards"] });
  const myListings = useQuery<MyListing[]>({ queryKey: ["/api/market/cards/mine"] });
  const myCollection = useQuery<CollectionItem[]>({ queryKey: ["/api/player/collection"] });

  const econ = balance.data?.settings;
  const currencyName = econ?.currencyName || "Gold";
  const currencySymbol = econ?.currencySymbol || "G";
  const currentBalance = balance.data?.balance ?? 0;
  const sellRate = econ?.sellRateMultiplier ?? 0.5;

  const claimDaily = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/player/balance/claim-daily");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/player/balance"] });
      toast({ title: `Claimed ${data.claimed} ${currencyName}!` });
    },
    onError: (err: any) => toast({ title: err.message || "Already claimed today", variant: "destructive" }),
  });

  const buyPack = useMutation({
    mutationFn: async (listingId: number) => apiRequest("POST", `/api/market/packs/${listingId}/buy`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/player/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/packs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player/packs"] });
      toast({ title: "Pack purchased! Check your pack inventory." });
    },
    onError: (err: any) => toast({ title: err.message || "Purchase failed", variant: "destructive" }),
  });

  const buyCard = useMutation({
    mutationFn: async ({ listingId, quantity }: { listingId: number; quantity: number }) =>
      apiRequest("POST", `/api/market/cards/${listingId}/buy`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/player/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player/collection"] });
      toast({ title: "Card purchased! Check your collection." });
    },
    onError: (err: any) => toast({ title: err.message || "Purchase failed", variant: "destructive" }),
  });

  const cancelListing = useMutation({
    mutationFn: async (listingId: number) => apiRequest("DELETE", `/api/market/cards/${listingId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/cards/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player/collection"] });
      toast({ title: "Listing cancelled, card returned to collection" });
    },
  });

  const createListing = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/market/cards/list", {
      cardId: selectedCard!.cardId,
      isFoil: selectedCard!.isFoil,
      quantity: sellQty,
      price: sellPrice,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/cards/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/market/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player/collection"] });
      setSellDialogOpen(false);
      setSelectedCard(null);
      toast({ title: "Card listed for sale!" });
    },
    onError: (err: any) => toast({ title: err.message || "Failed to list card", variant: "destructive" }),
  });

  const sellToStore = useMutation({
    mutationFn: async () => {
      const items = Object.values(sellToStoreSelection).map(s => ({
        cardId: s.item.cardId,
        isFoil: s.item.isFoil,
        quantity: s.qty,
      }));
      const res = await apiRequest("POST", "/api/player/collection/sell", { items });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/player/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/player/collection"] });
      setSellToStoreSelection({});
      toast({ title: `Sold for ${data.totalEarned} ${data.currencyName}!` });
    },
    onError: (err: any) => toast({ title: err.message || "Sell failed", variant: "destructive" }),
  });

  // All hooks/derived values must come before early returns (React rules)
  const filteredCardListings = useMemo(() =>
    (cardListings.data || []).filter(l =>
      l.card.name.toLowerCase().includes(search.toLowerCase())
    ), [cardListings.data, search]);

  const filteredCollectionForStore = useMemo(() => {
    return (myCollection.data || []).filter(item =>
      item.card.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      item.card.setName?.toLowerCase().includes(storeSearch.toLowerCase())
    );
  }, [myCollection.data, storeSearch]);

  const canClaimDaily = econ?.dailyCurrencyEnabled && (() => {
    if (!balance.data?.lastDailyClaimAt) return true;
    const last = new Date(balance.data.lastDailyClaimAt);
    const now = new Date();
    return last.getUTCDate() !== now.getUTCDate() ||
      last.getUTCMonth() !== now.getUTCMonth() ||
      last.getUTCFullYear() !== now.getUTCFullYear();
  })();

  const getCardSellValue = (item: CollectionItem, qty: number) => {
    const prices = (item.card.prices as any) || {};
    const priceUsd = item.isFoil
      ? parseFloat(prices.usd_foil || prices.usd || "0")
      : parseFloat(prices.usd || "0");
    return Math.floor(priceUsd * sellRate * qty * 100);
  };

  const totalSellToStoreValue = Object.values(sellToStoreSelection).reduce(
    (sum, s) => sum + getCardSellValue(s.item, s.qty), 0
  );

  const toggleSellToStoreItem = (item: CollectionItem) => {
    const key = `${item.cardId}|${item.isFoil}`;
    setSellToStoreSelection(prev => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { item, qty: 1 } };
    });
  };

  const updateSellToStoreQty = (item: CollectionItem, qty: number) => {
    const key = `${item.cardId}|${item.isFoil}`;
    setSellToStoreSelection(prev => ({
      ...prev,
      [key]: { item, qty: Math.max(1, Math.min(item.quantity, qty)) },
    }));
  };

  const selectedCount = Object.keys(sellToStoreSelection).length;

  if (balance.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading marketplace...</p>
      </div>
    );
  }

  if (!econ?.economyEnabled || econ?.marketplaceEnabled === false) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <ShoppingBag className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-display font-bold text-muted-foreground">Marketplace Unavailable</h2>
        <p className="text-muted-foreground">The economy system is not enabled yet. Ask an admin to enable it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header / Balance */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Marketplace</h1>
          <p className="text-muted-foreground mt-1">Buy packs, trade cards, and sell to the store.</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {econ?.dailyCurrencyEnabled && (
            <Button
              data-testid="button-claim-daily"
              variant="outline"
              onClick={() => claimDaily.mutate()}
              disabled={!canClaimDaily || claimDaily.isPending}
              className="border-amber-500/30 text-amber-400 hover:bg-amber-950/20"
            >
              <Coins className="h-4 w-4 mr-2" />
              {canClaimDaily ? `Claim ${econ.dailyCurrencyAmount} ${currencyName}` : "Claimed Today"}
            </Button>
          )}
          <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-500/30 rounded-lg px-4 py-2">
            <Coins className="h-5 w-5 text-amber-400" />
            <span className="font-bold text-amber-300 text-lg">{currentBalance.toLocaleString()}</span>
            <span className="text-amber-400/70 text-sm">{currencyName}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue={econ.packStoreEnabled ? "packs" : econ.userTradingEnabled ? "cards" : "sell-store"}>
        <TabsList className="bg-card border border-white/10 flex-wrap h-auto">
          {econ.packStoreEnabled && <TabsTrigger value="packs"><Package className="h-4 w-4 mr-2" />Pack Store</TabsTrigger>}
          {econ.userTradingEnabled && <TabsTrigger value="cards"><Star className="h-4 w-4 mr-2" />Card Market</TabsTrigger>}
          {econ.userTradingEnabled && <TabsTrigger value="mine"><Tag className="h-4 w-4 mr-2" />My Listings</TabsTrigger>}
          {econ.userTradingEnabled && <TabsTrigger value="list-card"><Sparkles className="h-4 w-4 mr-2" />List Card</TabsTrigger>}
          {econ.cardSellEnabled && <TabsTrigger value="sell-store" data-testid="tab-sell-to-store"><Store className="h-4 w-4 mr-2" />Sell to Store</TabsTrigger>}
        </TabsList>

        {/* Pack Store */}
        {econ.packStoreEnabled && (
          <TabsContent value="packs" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {packListings.isLoading ? (
                <div className="col-span-3 flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !packListings.data?.length ? (
                <div className="col-span-3 text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No packs available for purchase right now.</p>
                </div>
              ) : (
                packListings.data.map(listing => (
                  <Card key={listing.id} data-testid={`card-pack-${listing.id}`}
                    className="bg-card border-white/10 flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{listing.name}</CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">{listing.set.name}</p>
                        </div>
                        {listing.set.iconSvgUri && (
                          <img src={listing.set.iconSvgUri} className="h-8 w-8 opacity-60" alt="" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 flex-1">
                      {listing.description && (
                        <p className="text-sm text-muted-foreground">{listing.description}</p>
                      )}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{listing.packType}</span>
                        {listing.stock !== null && <span>{listing.stock} left</span>}
                      </div>
                      <div className="flex items-center justify-between mt-auto">
                        <Badge className="bg-amber-500/20 text-amber-300 text-sm px-3">
                          {listing.price} {currencySymbol}
                        </Badge>
                        <Button
                          data-testid={`button-buy-pack-${listing.id}`}
                          size="sm"
                          onClick={() => buyPack.mutate(listing.id)}
                          disabled={currentBalance < listing.price || buyPack.isPending}
                        >
                          <ShoppingBag className="h-3 w-3 mr-1" />Buy
                        </Button>
                      </div>
                      {currentBalance < listing.price && (
                        <p className="text-xs text-red-400">Need {listing.price - currentBalance} more {currencyName}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}

        {/* Card Market — browse and buy */}
        {econ.userTradingEnabled && (
          <TabsContent value="cards" className="mt-6">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-market-search"
                  className="pl-10"
                  placeholder="Search cards..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {cardListings.isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : !filteredCardListings.length ? (
                <div className="text-center py-12">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No cards listed for sale.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCardListings.map(listing => {
                    const isOwnListing = listing.sellerId === (user as any)?.id;
                    const img = (listing.card.imageUris as any)?.small;
                    const qty = buyQty[listing.id] ?? 1;
                    return (
                      <Card key={listing.id} data-testid={`card-listing-${listing.id}`}
                        className="bg-card border-white/10">
                        <CardContent className="flex items-center gap-4 p-4">
                          {img && <img src={img} className="h-16 w-11 rounded object-cover shrink-0" alt={listing.card.name} />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white truncate">{listing.card.name}</p>
                            <p className="text-xs text-muted-foreground">{listing.card.setName} • by {listing.seller.username}</p>
                            <div className="flex gap-1 mt-1">
                              {listing.isFoil && <Badge className="text-xs bg-purple-500/20 text-purple-300">FOIL</Badge>}
                              <Badge variant="outline" className="text-xs">{listing.card.rarity}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="font-bold text-amber-300">{listing.price} {currencySymbol}</p>
                              <p className="text-xs text-muted-foreground">×{listing.quantity} available</p>
                            </div>
                            {!isOwnListing && (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number" min={1} max={listing.quantity}
                                  value={qty}
                                  onChange={e => setBuyQty(prev => ({ ...prev, [listing.id]: Math.min(listing.quantity, Math.max(1, parseInt(e.target.value) || 1)) }))}
                                  className="w-16 text-center"
                                  data-testid={`input-buy-qty-${listing.id}`}
                                />
                                <Button
                                  size="sm"
                                  data-testid={`button-buy-card-${listing.id}`}
                                  onClick={() => buyCard.mutate({ listingId: listing.id, quantity: qty })}
                                  disabled={currentBalance < listing.price * qty || buyCard.isPending}
                                >
                                  Buy
                                </Button>
                              </div>
                            )}
                            {isOwnListing && <Badge variant="outline" className="text-xs text-muted-foreground">Your listing</Badge>}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* My Listings */}
        {econ.userTradingEnabled && (
          <TabsContent value="mine" className="mt-6">
            <div className="space-y-2">
              {myListings.isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : !myListings.data?.length ? (
                <div className="text-center py-12">
                  <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">You have no active listings.</p>
                </div>
              ) : (
                myListings.data.map(listing => {
                  const img = (listing.card.imageUris as any)?.small;
                  return (
                    <Card key={listing.id} data-testid={`my-listing-${listing.id}`}
                      className="bg-card border-white/10">
                      <CardContent className="flex items-center gap-4 p-4">
                        {img && <img src={img} className="h-16 w-11 rounded object-cover shrink-0" alt={listing.card.name} />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{listing.card.name}</p>
                          <p className="text-xs text-muted-foreground">{listing.card.setName}</p>
                          {listing.isFoil && <Badge className="text-xs bg-purple-500/20 text-purple-300">FOIL</Badge>}
                        </div>
                        <div className="text-right mr-4">
                          <p className="font-bold text-amber-300">{listing.price} {currencySymbol}</p>
                          <p className="text-xs text-muted-foreground">×{listing.quantity}</p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          data-testid={`button-cancel-listing-${listing.id}`}
                          onClick={() => cancelListing.mutate(listing.id)}
                          disabled={cancelListing.isPending}
                        >
                          Cancel
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        )}

        {/* List Card for User-to-User Sale */}
        {econ.userTradingEnabled && (
          <TabsContent value="list-card" className="mt-6">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select a card from your collection to list for sale to other players.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[600px] overflow-y-auto">
                {(myCollection.data || []).map(item => {
                  const img = (item.card.imageUris as any)?.small || (item.card.imageUris as any)?.normal;
                  return (
                    <div
                      key={item.id}
                      data-testid={`card-list-item-${item.id}`}
                      className="cursor-pointer rounded-lg overflow-hidden border border-white/10 hover:border-primary/50 transition-colors relative"
                      onClick={() => { setSelectedCard(item); setSellQty(1); setSellPrice(10); setSellDialogOpen(true); }}
                    >
                      {img
                        ? <img src={img} alt={item.card.name} className="w-full aspect-[2/3] object-cover" />
                        : <div className="w-full aspect-[2/3] bg-white/5 flex items-center justify-center"><p className="text-xs text-center p-1">{item.card.name}</p></div>
                      }
                      <div className="absolute top-1 right-1 flex flex-col gap-1">
                        {item.isFoil && <Badge className="text-xs bg-purple-500/80">F</Badge>}
                        <Badge className="text-xs bg-black/70">×{item.quantity}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>
        )}

        {/* Sell to Store */}
        {econ.cardSellEnabled && (
          <TabsContent value="sell-store" className="mt-6">
            <div className="space-y-4">
              <div className="rounded-lg bg-blue-950/30 border border-blue-800 p-3 text-sm text-blue-300">
                Cards are valued at their Scryfall market price × {(sellRate * 100).toFixed(0)}% = {currencyName}.
                Rate: $1.00 USD ≈ {Math.floor(sellRate * 100)} {currencySymbol}.
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="Search your collection..."
                    value={storeSearch}
                    onChange={e => setStoreSearch(e.target.value)}
                    data-testid="input-store-search"
                  />
                </div>
                {selectedCount > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{selectedCount} selected · {totalSellToStoreValue} {currencySymbol} total</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSellToStoreSelection({})}
                    >
                      Clear
                    </Button>
                    <Button
                      data-testid="button-sell-to-store"
                      onClick={() => sellToStore.mutate()}
                      disabled={selectedCount === 0 || sellToStore.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {sellToStore.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Store className="h-4 w-4 mr-2" />}
                      Sell Selected ({totalSellToStoreValue} {currencySymbol})
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {myCollection.isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : !filteredCollectionForStore.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Store className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Your collection is empty or no matches found.</p>
                  </div>
                ) : (
                  filteredCollectionForStore.map(item => {
                    const key = `${item.cardId}|${item.isFoil}`;
                    const sel = sellToStoreSelection[key];
                    const prices = (item.card.prices as any) || {};
                    const priceUsd = item.isFoil
                      ? parseFloat(prices.usd_foil || prices.usd || "0")
                      : parseFloat(prices.usd || "0");
                    const qty = sel?.qty ?? 1;
                    const estimatedValue = getCardSellValue(item, qty);
                    const img = (item.card.imageUris as any)?.small;
                    return (
                      <div
                        key={key}
                        data-testid={`row-store-sell-${item.id}`}
                        className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${sel ? "border-amber-500/50 bg-amber-950/20" : "border-white/10 bg-card"}`}
                      >
                        <Checkbox
                          checked={!!sel}
                          onCheckedChange={() => toggleSellToStoreItem(item)}
                          data-testid={`check-store-sell-${item.id}`}
                        />
                        {img && <img src={img} className="h-12 w-9 rounded object-cover shrink-0" alt={item.card.name} />}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{item.card.name}</p>
                          <p className="text-xs text-muted-foreground">{item.card.setName} · {item.card.rarity}</p>
                          <div className="flex gap-1 mt-0.5">
                            {item.isFoil && <Badge className="text-xs bg-purple-500/20 text-purple-300">FOIL</Badge>}
                            {priceUsd > 0 ? (
                              <span className="text-xs text-muted-foreground">${priceUsd.toFixed(2)} USD</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">No price data</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {sel && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">Qty:</Label>
                              <Input
                                type="number"
                                min={1}
                                max={item.quantity}
                                value={sel.qty}
                                onChange={e => updateSellToStoreQty(item, parseInt(e.target.value) || 1)}
                                className="w-16 text-center h-8"
                                data-testid={`input-store-qty-${item.id}`}
                              />
                            </div>
                          )}
                          <div className="text-right min-w-[80px]">
                            <p className="text-xs text-muted-foreground">×{item.quantity} owned</p>
                            {priceUsd > 0 && (
                              <p className={`text-sm font-bold ${sel ? "text-amber-300" : "text-muted-foreground"}`}>
                                {estimatedValue} {currencySymbol}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* List Card Dialog */}
      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogContent className="bg-card border-white/10">
          <DialogHeader>
            <DialogTitle>List Card for Sale</DialogTitle>
          </DialogHeader>
          {selectedCard && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                {(selectedCard.card.imageUris as any)?.small && (
                  <img src={(selectedCard.card.imageUris as any).small}
                    className="w-16 rounded object-cover" alt={selectedCard.card.name} />
                )}
                <div>
                  <p className="font-medium text-white">{selectedCard.card.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedCard.card.setName}</p>
                  {selectedCard.isFoil && <Badge className="text-xs bg-purple-500/20 text-purple-300">FOIL</Badge>}
                  <p className="text-xs text-muted-foreground mt-1">You own: {selectedCard.quantity}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    data-testid="input-sell-qty"
                    type="number" min={1} max={selectedCard.quantity}
                    value={sellQty}
                    onChange={e => setSellQty(Math.min(selectedCard.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price per card ({currencyName})</Label>
                  <Input
                    data-testid="input-sell-price"
                    type="number" min={1}
                    value={sellPrice}
                    onChange={e => setSellPrice(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Total listing value: <strong className="text-amber-300">{sellQty * sellPrice} {currencyName}</strong>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSellDialogOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-confirm-sell"
              onClick={() => createListing.mutate()}
              disabled={createListing.isPending}
            >
              {createListing.isPending ? "Listing..." : "List for Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
