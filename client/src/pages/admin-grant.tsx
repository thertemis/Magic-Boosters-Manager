import { useAdminUsers, useAdminSets, useAdminPacks, useAdminTags } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Gift, Loader2, Key, Plus, Tag, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export default function AdminGrantPage() {
  const users = useAdminUsers();
  const sets = useAdminSets();
  const { grantPack } = useAdminPacks();
  const { tags: adminTags, removeTag } = useAdminTags();
  const { toast } = useToast();

  const templates = useQuery({
    queryKey: [api.admin.boosterTemplates.list.path],
    queryFn: async () => {
      const res = await fetch(api.admin.boosterTemplates.list.path);
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedSet, setSelectedSet] = useState<string>("");
  const [packType, setPackType] = useState<string>("play");
  const [quantity, setQuantity] = useState<number>(3);
  const [tag, setTag] = useState<string>("");
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [confirmRemoveTag, setConfirmRemoveTag] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedSet) return;

    await grantPack.mutateAsync({
      userId: parseInt(selectedUser),
      setCode: selectedSet,
      packType,
      count: quantity,
      tag: tag.trim() || undefined,
    });
  };

  const generateInvitationCode = async () => {
    setIsGeneratingCode(true);
    try {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const res = await apiRequest("POST", "/api/admin/invitations", { code });
      if (res.ok) {
        navigator.clipboard.writeText(code);
        toast({ title: "Invitation Code Created", description: `Code ${code} copied to clipboard.` });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create invitation code.", variant: "destructive" });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleRemoveTag = async (tagName: string) => {
    if (confirmRemoveTag === tagName) {
      await removeTag.mutateAsync(tagName);
      setConfirmRemoveTag(null);
    } else {
      setConfirmRemoveTag(tagName);
    }
  };

  const isLoading = users.users.isLoading || sets.sets.isLoading;

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-display font-bold">Admin Tools</h1>
        <p className="text-muted-foreground mt-1">Manage packs, tags, and invitations.</p>
      </div>

      <div className="grid gap-8">
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Invitation Codes
            </CardTitle>
            <CardDescription>Generate a single-use code for new players to register.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={generateInvitationCode} 
              className="w-full" 
              variant="outline"
              disabled={isGeneratingCode}
            >
              {isGeneratingCode ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2 h-4 w-4" />}
              Generate & Copy New Code
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-accent" />
              Distribute Product
            </CardTitle>
            <CardDescription>Select a player and a product to add to their inventory.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Recipient</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a player" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.users.data?.map(u => (
                      <SelectItem key={u.id} value={u.id.toString()}>
                        {u.username} <span className="text-muted-foreground text-xs ml-2">({u.role})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Expansion Set</Label>
                <Select value={selectedSet} onValueChange={setSelectedSet}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a set" />
                  </SelectTrigger>
                  <SelectContent>
                    {sets.sets.data?.map(s => (
                      <SelectItem key={s.code} value={s.code}>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase w-8">{s.code}</span>
                          <span>{s.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Booster Type</Label>
                  <Select value={packType} onValueChange={setPackType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="play">Play Booster</SelectItem>
                      <SelectItem value="collector">Collector Booster</SelectItem>
                      <SelectItem value="draft">Draft Booster</SelectItem>
                      {templates.data?.map((t: any) => (
                        <SelectItem key={t.id} value={`template:${t.id}`}>
                          {t.name} (Custom)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={50} 
                    value={quantity} 
                    onChange={(e) => setQuantity(parseInt(e.target.value))} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Event Tag <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input 
                  placeholder="e.g. event-20-02-2026"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  data-testid="input-tag"
                />
                <p className="text-xs text-muted-foreground">
                  Cards opened from tagged packs can be exported separately as a limited event list.
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                disabled={grantPack.isPending || !selectedUser || !selectedSet}
              >
                {grantPack.isPending ? "Granting..." : "Grant Packs"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Event Tags
            </CardTitle>
            <CardDescription>Manage event tags. Removing a tag keeps cards in collections but removes the tag label.</CardDescription>
          </CardHeader>
          <CardContent>
            {adminTags.isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin h-5 w-5" /></div>
            ) : !adminTags.data || adminTags.data.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No event tags have been created yet.</p>
            ) : (
              <div className="space-y-2">
                {adminTags.data.map(t => (
                  <div key={t} className="flex items-center justify-between gap-2 p-3 bg-background/50 rounded-md border border-white/5">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t}</span>
                    </div>
                    <Button
                      size="sm"
                      variant={confirmRemoveTag === t ? "destructive" : "ghost"}
                      onClick={() => handleRemoveTag(t)}
                      disabled={removeTag.isPending}
                      data-testid={`button-remove-tag-${t}`}
                    >
                      {confirmRemoveTag === t ? (
                        <>Confirm Remove</>
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
