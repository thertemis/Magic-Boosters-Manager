import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import type { EconomySettings, User } from "@shared/schema";
import { Coins, Users, TrendingUp, Gift, Settings, ArrowUpCircle, ArrowDownCircle, Globe, Pencil, Check, X, RefreshCw } from "lucide-react";
import { formatInTz, COMMON_TIMEZONES } from "@/lib/timezone";

interface UserBalance {
  userId: number;
  balance: number;
  lastDailyClaimAt: string | null;
  user: User;
}

interface Transaction {
  id: number;
  userId: number;
  amount: number;
  type: string;
  description: string | null;
  createdAt: string;
  user: User;
}

const TYPE_LABELS: Record<string, string> = {
  daily_grant: "Daily Grant",
  admin_grant: "Admin Grant",
  admin_set: "Balance Set",
  card_sale: "Card Sale",
  card_purchase: "Card Purchase",
  pack_purchase: "Pack Purchase",
  listing_sale: "Listing Sale",
};

export default function AdminEconomyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const settings = useQuery<EconomySettings | null>({ queryKey: ["/api/admin/economy"] });
  const balances = useQuery<UserBalance[]>({ queryKey: ["/api/admin/economy/balances"] });
  const transactions = useQuery<Transaction[]>({ queryKey: ["/api/admin/economy/transactions"] });

  const [form, setForm] = useState<Partial<EconomySettings>>({});
  const [grantUserId, setGrantUserId] = useState("");
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDesc, setGrantDesc] = useState("");
  const [editingBalance, setEditingBalance] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  const updateSettings = useMutation({
    mutationFn: async (data: Partial<EconomySettings>) =>
      apiRequest("PUT", "/api/admin/economy", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/economy"] });
      toast({ title: "Economy settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const grantCurrency = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/admin/economy/grant", {
        userId: parseInt(grantUserId),
        amount: parseInt(grantAmount),
        description: grantDesc || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/economy/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/economy/transactions"] });
      toast({ title: "Currency granted!" });
      setGrantUserId("");
      setGrantAmount("");
      setGrantDesc("");
    },
    onError: () => toast({ title: "Failed to grant currency", variant: "destructive" }),
  });

  const setBalance = useMutation({
    mutationFn: async ({ userId, balance }: { userId: number; balance: number }) =>
      apiRequest("PUT", `/api/admin/economy/balances/${userId}`, { balance }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/economy/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/economy/transactions"] });
      toast({ title: "Balance updated!" });
      setEditingBalance(null);
      setEditingValue("");
    },
    onError: () => toast({ title: "Failed to update balance", variant: "destructive" }),
  });

  const refreshPrices = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/economy/refresh-prices", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Prices refreshed for ${data.updated} cards.` });
    },
    onError: () => toast({ title: "Failed to refresh prices", variant: "destructive" }),
  });

  const s = settings.data;
  const merged = { ...s, ...form };

  function setField(key: keyof EconomySettings, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    updateSettings.mutate(merged as Partial<EconomySettings>);
  }

  const currencyName = s?.currencyName || "Gold";
  const currencySymbol = s?.currencySymbol || "G";

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-display font-bold text-primary">Economy Settings</h1>
        <p className="text-muted-foreground mt-1">Configure the currency system and marketplace features.</p>
      </div>

      <Tabs defaultValue="settings">
        <TabsList className="bg-card border border-white/10">
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Settings</TabsTrigger>
          <TabsTrigger value="balances"><Users className="h-4 w-4 mr-2" />Balances</TabsTrigger>
          <TabsTrigger value="transactions"><TrendingUp className="h-4 w-4 mr-2" />Transactions</TabsTrigger>
          <TabsTrigger value="grant"><Gift className="h-4 w-4 mr-2" />Grant Currency</TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card className="bg-card border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Coins className="h-5 w-5 text-amber-400" /> Currency System</CardTitle>
              <CardDescription>Configure the in-game currency name and behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white font-medium">Enable Economy</Label>
                  <p className="text-sm text-muted-foreground">Master switch for all economy features</p>
                </div>
                <Switch
                  data-testid="switch-economy-enabled"
                  checked={!!merged.economyEnabled}
                  onCheckedChange={v => setField("economyEnabled", v)}
                />
              </div>
              <Separator className="bg-white/5" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency Name</Label>
                  <Input
                    data-testid="input-currency-name"
                    value={merged.currencyName ?? "Gold"}
                    onChange={e => setField("currencyName", e.target.value)}
                    placeholder="Gold"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency Symbol</Label>
                  <Input
                    data-testid="input-currency-symbol"
                    value={merged.currencySymbol ?? "G"}
                    onChange={e => setField("currencySymbol", e.target.value)}
                    placeholder="G"
                  />
                </div>
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-4">
                <h4 className="font-medium text-white">Feature Toggles</h4>

                {[
                  { key: "marketplaceEnabled" as const, label: "Marketplace", desc: "Enable the marketplace section for players" },
                  { key: "packStoreEnabled" as const, label: "Pack Store", desc: "Players can buy packs with currency" },
                  { key: "userTradingEnabled" as const, label: "Card Trading", desc: "Players can buy/sell cards with each other" },
                  { key: "cardSellEnabled" as const, label: "Sell to Store", desc: "Players can sell cards to the store for currency" },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label className="text-white">{label}</Label>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      data-testid={`switch-${key}`}
                      checked={!!merged[key]}
                      onCheckedChange={v => setField(key, v)}
                    />
                  </div>
                ))}
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-4">
                <h4 className="font-medium text-white">Daily Currency Grant</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-white">Enable Daily Grant</Label>
                    <p className="text-sm text-muted-foreground">Automatically grant currency to players each day at midnight UTC</p>
                  </div>
                  <Switch
                    data-testid="switch-daily-currency"
                    checked={!!merged.dailyCurrencyEnabled}
                    onCheckedChange={v => setField("dailyCurrencyEnabled", v)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily Amount ({currencyName})</Label>
                  <Input
                    data-testid="input-daily-amount"
                    type="number"
                    min={1}
                    value={merged.dailyCurrencyAmount ?? 100}
                    onChange={e => setField("dailyCurrencyAmount", parseInt(e.target.value))}
                  />
                </div>
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-2">
                <Label>Card Sell Rate Multiplier</Label>
                <p className="text-sm text-muted-foreground">
                  Multiply the Scryfall USD price by this value to get the {currencyName} amount when players sell cards.
                  Example: $2.00 card × 50 = 100 {currencyName}
                </p>
                <Input
                  data-testid="input-sell-rate"
                  type="number"
                  min={0}
                  step={1}
                  value={merged.sellRateMultiplier ?? 50}
                  onChange={e => setField("sellRateMultiplier", parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Rate is: price (USD) × multiplier = {currencyName} earned</p>
              </div>

              <Separator className="bg-white/5" />

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> Admin Timezone</Label>
                <p className="text-sm text-muted-foreground">
                  All schedule times and transaction timestamps will be displayed in this timezone.
                </p>
                <Select
                  value={merged.adminTimezone ?? "UTC"}
                  onValueChange={v => setField("adminTimezone", v)}
                >
                  <SelectTrigger data-testid="select-admin-timezone">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {COMMON_TIMEZONES.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                data-testid="button-save-economy"
                onClick={handleSave}
                disabled={updateSettings.isPending}
                className="bg-primary hover:bg-primary/90"
              >
                {updateSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-blue-400" /> Card Prices</CardTitle>
              <CardDescription>
                Refresh card sell prices from Scryfall. Cards with a $0 USD price will fall back to foil price, then EUR price, then MTGO price.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                data-testid="button-refresh-prices"
                variant="outline"
                className="border-blue-500/30 text-blue-400 hover:bg-blue-950/20 gap-2"
                onClick={() => refreshPrices.mutate()}
                disabled={refreshPrices.isPending}
              >
                <RefreshCw className={`h-4 w-4 ${refreshPrices.isPending ? "animate-spin" : ""}`} />
                {refreshPrices.isPending ? "Refreshing prices…" : "Refresh Prices"}
              </Button>
              {refreshPrices.isPending && (
                <p className="text-xs text-muted-foreground mt-2">This may take a minute for large card pools…</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances Tab */}
        <TabsContent value="balances" className="mt-6">
          <Card className="bg-card border-white/10">
            <CardHeader>
              <CardTitle>Player Balances</CardTitle>
              <CardDescription>Current {currencyName} balances for all players.</CardDescription>
            </CardHeader>
            <CardContent>
              {balances.isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : !balances.data?.length ? (
                <p className="text-muted-foreground text-sm">No player accounts found. Create player accounts first.</p>
              ) : (
                <div className="space-y-2">
                  {[...( balances.data || [])].sort((a, b) => b.balance - a.balance).map(bal => (
                    <div key={bal.userId} data-testid={`row-balance-${bal.userId}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                      <div>
                        <p className="font-medium text-white">{bal.user.username}</p>
                        <p className="text-xs text-muted-foreground">
                          {bal.lastDailyClaimAt
                            ? `Last daily: ${formatInTz(bal.lastDailyClaimAt, s?.adminTimezone || "UTC", { dateStyle: "medium", timeStyle: undefined } as any)}`
                            : "No daily claim yet"}
                        </p>
                      </div>
                      {editingBalance === bal.userId ? (
                        <div className="flex items-center gap-2">
                          <Input
                            data-testid={`input-balance-${bal.userId}`}
                            type="number"
                            min="0"
                            className="w-32 h-8 text-sm"
                            value={editingValue}
                            onChange={e => setEditingValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") setBalance.mutate({ userId: bal.userId, balance: parseInt(editingValue) || 0 });
                              if (e.key === "Escape") { setEditingBalance(null); setEditingValue(""); }
                            }}
                            autoFocus
                          />
                          <span className="text-amber-300 text-sm">{currencySymbol}</span>
                          <Button
                            data-testid={`btn-balance-save-${bal.userId}`}
                            size="sm" variant="ghost" className="h-8 w-8 p-0 text-green-400 hover:text-green-300"
                            disabled={setBalance.isPending}
                            onClick={() => setBalance.mutate({ userId: bal.userId, balance: parseInt(editingValue) || 0 })}
                          ><Check className="h-4 w-4" /></Button>
                          <Button
                            data-testid={`btn-balance-cancel-${bal.userId}`}
                            size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
                            onClick={() => { setEditingBalance(null); setEditingValue(""); }}
                          ><X className="h-4 w-4" /></Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge className="bg-amber-500/20 text-amber-300 text-base px-3 py-1">
                            {bal.balance.toLocaleString()} {currencySymbol}
                          </Badge>
                          <Button
                            data-testid={`btn-balance-edit-${bal.userId}`}
                            size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
                            onClick={() => { setEditingBalance(bal.userId); setEditingValue(String(bal.balance)); }}
                          ><Pencil className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-6">
          <Card className="bg-card border-white/10">
            <CardHeader>
              <CardTitle>Transaction Log</CardTitle>
              <CardDescription>Last 100 currency transactions.</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.isLoading ? (
                <p className="text-muted-foreground text-sm">Loading...</p>
              ) : !transactions.data?.length ? (
                <p className="text-muted-foreground text-sm">No transactions yet.</p>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {transactions.data.map(tx => (
                    <div key={tx.id} data-testid={`row-tx-${tx.id}`}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-sm">
                      <div className="flex items-center gap-3">
                        {tx.amount > 0
                          ? <ArrowUpCircle className="h-4 w-4 text-green-400 shrink-0" />
                          : <ArrowDownCircle className="h-4 w-4 text-red-400 shrink-0" />}
                        <div>
                          <p className="text-white">{tx.user.username} — {TYPE_LABELS[tx.type] || tx.type}</p>
                          {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={tx.amount > 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                          {tx.amount > 0 ? "+" : ""}{tx.amount} {currencySymbol}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatInTz(tx.createdAt, s?.adminTimezone || "UTC")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grant Tab */}
        <TabsContent value="grant" className="mt-6">
          <Card className="bg-card border-white/10">
            <CardHeader>
              <CardTitle>Grant Currency</CardTitle>
              <CardDescription>Manually grant {currencyName} to a specific player.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Player</Label>
                <Select value={grantUserId} onValueChange={setGrantUserId}>
                  <SelectTrigger data-testid="input-grant-user">
                    <SelectValue placeholder="Select a player..." />
                  </SelectTrigger>
                  <SelectContent>
                    {balances.isLoading ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">Loading...</div>
                    ) : !balances.data?.length ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">No players found</div>
                    ) : balances.data.map(b => (
                      <SelectItem key={b.userId} value={String(b.userId)} data-testid={`option-player-${b.userId}`}>
                        {b.user.username} — {b.balance} {currencySymbol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount ({currencyName})</Label>
                <Input
                  data-testid="input-grant-amount"
                  type="number"
                  placeholder="100"
                  value={grantAmount}
                  onChange={e => setGrantAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  data-testid="input-grant-desc"
                  placeholder="Reason for grant..."
                  value={grantDesc}
                  onChange={e => setGrantDesc(e.target.value)}
                />
              </div>
              <Button
                data-testid="button-grant-currency"
                onClick={() => grantCurrency.mutate()}
                disabled={!grantUserId || !grantAmount || grantCurrency.isPending}
                className="bg-amber-600 hover:bg-amber-500"
              >
                <Coins className="h-4 w-4 mr-2" />
                {grantCurrency.isPending ? "Granting..." : `Grant ${grantAmount || "?"} ${currencyName}`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
