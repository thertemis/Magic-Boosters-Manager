import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Set } from "@shared/schema";
import { Plus, Pencil, Trash2, Package, ShoppingBag, Infinity } from "lucide-react";

interface MarketPackListing {
  id: number;
  name: string;
  description: string | null;
  setCode: string;
  packType: string;
  price: number;
  stock: number | null;
  isActive: boolean;
  createdAt: string;
  set: Set;
}

const PACK_TYPES = [
  { value: "play", label: "Play Booster" },
  { value: "collector", label: "Collector Booster" },
];

const emptyForm = {
  name: "",
  description: "",
  setCode: "",
  packType: "play",
  price: 100,
  stock: undefined as number | undefined,
  isActive: true,
};

export default function AdminMarketplacePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sets = useQuery<Set[]>({ queryKey: ["/api/admin/sets"] });
  const listings = useQuery<MarketPackListing[]>({ queryKey: ["/api/admin/market/packs"] });
  const economy = useQuery<any>({ queryKey: ["/api/admin/economy"] });

  const templates = useQuery<any[]>({ queryKey: ["/api/admin/booster-templates"] });

  const packTypeOptions = [
    ...PACK_TYPES,
    ...(templates.data || []).map((t: any) => ({ value: `template:${t.id}`, label: `Custom: ${t.name}` })),
  ];

  const createListing = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/market/packs", {
      ...form,
      stock: form.stock || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market/packs"] });
      toast({ title: "Listing created!" });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast({ title: "Failed to create listing", variant: "destructive" }),
  });

  const updateListing = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/admin/market/packs/${editId}`, {
      ...form,
      stock: form.stock || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market/packs"] });
      toast({ title: "Listing updated!" });
      setDialogOpen(false);
      setEditId(null);
    },
    onError: () => toast({ title: "Failed to update listing", variant: "destructive" }),
  });

  const deleteListing = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/market/packs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/market/packs"] });
      toast({ title: "Listing deleted" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/market/packs/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/market/packs"] }),
  });

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  }

  function openEdit(listing: MarketPackListing) {
    setForm({
      name: listing.name,
      description: listing.description || "",
      setCode: listing.setCode,
      packType: listing.packType,
      price: listing.price,
      stock: listing.stock ?? undefined,
      isActive: listing.isActive,
    });
    setEditId(listing.id);
    setDialogOpen(true);
  }

  const currencyName = economy.data?.currencyName || "Gold";
  const currencySymbol = economy.data?.currencySymbol || "G";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Pack Store</h1>
          <p className="text-muted-foreground mt-1">Manage packs available for purchase in the marketplace.</p>
        </div>
        <Button data-testid="button-create-listing" onClick={openCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Listing
        </Button>
      </div>

      {!economy.data?.economyEnabled && (
        <Card className="bg-amber-950/20 border-amber-500/30">
          <CardContent className="pt-4 pb-4">
            <p className="text-amber-300 text-sm">
              Economy is currently <strong>disabled</strong>. Enable it in Economy Settings for the marketplace to be visible to players.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {listings.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading listings...</p>
        ) : !listings.data?.length ? (
          <Card className="bg-card border-white/10">
            <CardContent className="py-12 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No pack listings yet. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          listings.data.map(listing => (
            <Card key={listing.id} data-testid={`card-listing-${listing.id}`}
              className="bg-card border-white/10">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Package className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{listing.name}</p>
                      <Badge variant={listing.isActive ? "default" : "secondary"}>
                        {listing.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {listing.description && (
                      <p className="text-sm text-muted-foreground">{listing.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{listing.set.name}</span>
                      <span>•</span>
                      <span>{listing.packType}</span>
                      <span>•</span>
                      {listing.stock === null
                        ? <span className="flex items-center gap-1"><Infinity className="h-3 w-3" /> Unlimited</span>
                        : <span>{listing.stock} left</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-amber-500/20 text-amber-300 text-base px-3">
                    {listing.price} {currencySymbol}
                  </Badge>
                  <Switch
                    data-testid={`switch-listing-${listing.id}`}
                    checked={listing.isActive}
                    onCheckedChange={v => toggleActive.mutate({ id: listing.id, isActive: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(listing)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300"
                    onClick={() => deleteListing.mutate(listing.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-white/10 max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Listing" : "Create Listing"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input data-testid="input-listing-name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Wilds of Eldraine Play Booster" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Great value pack for any collector..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Set</Label>
                <Select value={form.setCode} onValueChange={v => setForm(f => ({ ...f, setCode: v }))}>
                  <SelectTrigger data-testid="select-listing-set">
                    <SelectValue placeholder="Select set" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sets.data || []).map(s => (
                      <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pack Type</Label>
                <Select value={form.packType} onValueChange={v => setForm(f => ({ ...f, packType: v }))}>
                  <SelectTrigger data-testid="select-listing-pack-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {packTypeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ({currencyName})</Label>
                <Input data-testid="input-listing-price" type="number" min={1}
                  value={form.price} onChange={e => setForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Stock (leave empty for unlimited)</Label>
                <Input data-testid="input-listing-stock" type="number" min={1}
                  value={form.stock ?? ""}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder="∞" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active immediately</Label>
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              data-testid="button-save-listing"
              onClick={() => editId ? updateListing.mutate() : createListing.mutate()}
              disabled={!form.name || !form.setCode || createListing.isPending || updateListing.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {editId ? "Save Changes" : "Create Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
