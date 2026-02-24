import { useAdminUsers, useAdminPacks } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { Plus, UserPlus, ShieldAlert, ShieldCheck, Settings, Package, Layers, UserCog, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { CardDisplay } from "@/components/card-display";

export default function AdminUsersPage() {
  const { users, createUser } = useAdminUsers();
  const { deletePack } = useAdminPacks();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "", role: "player" as "admin" | "player" });

  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"packs" | "collection" | "edit" | null>(null);

  const [editData, setEditData] = useState({ username: "", password: "", role: "player" as "admin" | "player" });

  const { data: userPacks, isLoading: isLoadingPacks } = useQuery({
    queryKey: ["/api/admin/users", selectedUser?.id, "packs"],
    enabled: !!selectedUser && (viewMode === "packs" || viewMode === "collection"),
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/packs`);
      if (!res.ok) throw new Error("Failed to fetch packs");
      return res.json();
    }
  }) as { data: any[] | undefined, isLoading: boolean };

  const { data: userCollection, isLoading: isLoadingCollection } = useQuery({
    queryKey: ["/api/admin/users", selectedUser?.id, "collection"],
    enabled: !!selectedUser && viewMode === "collection",
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/collection`);
      if (!res.ok) throw new Error("Failed to fetch collection");
      return res.json();
    }
  }) as { data: any[] | undefined, isLoading: boolean };

  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${selectedUser.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setViewMode(null);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/users/${selectedUser.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setViewMode(null);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createUser.mutateAsync(formData);
    setIsCreateOpen(false);
    setFormData({ username: "", password: "", role: "player" });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { username: editData.username, role: editData.role };
    if (editData.password) data.password = editData.password;
    await updateUserMutation.mutateAsync(data);
  };

  const exportPlayerCollection = () => {
    if (!userCollection) return;
    const lines = userCollection.map((item: any) => {
      return `${item.quantity} ${item.card.name} (${item.card.code.toUpperCase()}) ${item.card.collectorNumber} ${item.isFoil ? "Foil" : ""}`.trim();
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedUser.username}_collection.txt`;
    a.click();
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage access to the simulator.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" /> Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new account for a player or admin.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input 
                  value={formData.username} 
                  onChange={(e) => setFormData({...formData, username: e.target.value})} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input 
                  type="password"
                  value={formData.password} 
                  onChange={(e) => setFormData({...formData, password: e.target.value})} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(val: "admin" | "player") => setFormData({...formData, role: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="player">Player</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={createUser.isPending}>
                {createUser.isPending ? "Creating..." : "Create Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-white/10 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">Loading users...</TableCell>
                </TableRow>
              ) : users.data?.map((user) => (
                <TableRow key={user.id} className="border-white/10 hover:bg-white/5">
                  <TableCell className="font-medium flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center border border-white/10">
                      <span className="text-xs font-bold">{user.username[0].toUpperCase()}</span>
                    </div>
                    {user.username}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={user.role === 'admin' ? "border-primary text-primary" : "border-gray-500 text-gray-400"}>
                      {user.role === 'admin' ? <ShieldAlert className="w-3 h-3 mr-1" /> : <ShieldCheck className="w-3 h-3 mr-1" />}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card border-white/10">
                        <DropdownMenuLabel>Manage User</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem onClick={() => { setSelectedUser(user); setViewMode("packs"); }} className="cursor-pointer">
                          <Package className="mr-2 h-4 w-4" /> See Unopened Packs
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedUser(user); setViewMode("collection"); }} className="cursor-pointer">
                          <Layers className="mr-2 h-4 w-4" /> See Collection
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedUser(user); setEditData({ username: user.username, password: "", role: user.role }); setViewMode("edit"); }} className="cursor-pointer">
                          <UserCog className="mr-2 h-4 w-4" /> Edit Account
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Packs Dialog */}
      <Dialog open={viewMode === "packs"} onOpenChange={(open) => !open && setViewMode(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-card border-white/10">
          <DialogHeader>
            <DialogTitle>Unopened Packs for {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          {isLoadingPacks ? (
             <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : userPacks?.filter((p: any) => p.status === "available").length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No unopened packs.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {userPacks?.filter((p: any) => p.status === "available").map((pack: any) => (
                <div key={pack.id} className="relative p-4 border rounded-lg border-white/10 bg-white/5 flex flex-col justify-between">
                  <div className="text-center">
                    <span className="text-[10px] font-bold uppercase text-white/40">{pack.set.code}</span>
                    <h4 className="font-bold text-sm leading-tight mt-1">{pack.set.name}</h4>
                    <p className="text-[10px] text-primary uppercase mt-1">{pack.packType}</p>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="mt-4 h-7 text-[10px]" 
                    onClick={() => deletePack.mutate(pack.id)}
                    disabled={deletePack.isPending}
                  >
                    Remove Pack
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Collection Dialog */}
      <Dialog open={viewMode === "collection"} onOpenChange={(open) => !open && setViewMode(null)}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto bg-card border-white/10">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>{selectedUser?.username}'s Collection</DialogTitle>
            <Button size="sm" variant="outline" onClick={exportPlayerCollection} disabled={!userCollection || userCollection.length === 0}>
              <Layers className="mr-2 h-4 w-4" /> Export for Moxfield
            </Button>
          </DialogHeader>
          {isLoadingCollection ? (
            <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : userCollection?.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">Collection is empty.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-4">
              {userCollection?.map((item: any) => (
                <div key={item.id} className="relative">
                  <CardDisplay card={item.card} isFoil={!!item.isFoil} isFlipped={true} animate={false} />
                  <div className="absolute top-1 right-1 bg-black/80 text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/10">
                    x{item.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={viewMode === "edit"} onOpenChange={(open) => !open && setViewMode(null)}>
        <DialogContent className="bg-card border-white/10">
          <DialogHeader>
            <DialogTitle>Edit Account: {selectedUser?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input 
                value={editData.username} 
                onChange={(e) => setEditData({...editData, username: e.target.value})} 
                required
              />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input 
                type="password"
                value={editData.password} 
                onChange={(e) => setEditData({...editData, password: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select 
                value={editData.role} 
                onValueChange={(val: "admin" | "player") => setEditData({...editData, role: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="player">Player</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <Button type="submit" className="flex-1" disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? "Updating..." : "Update Account"}
              </Button>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => {
                  if (confirm("Are you sure you want to delete this user? All their collection and packs will be permanently removed.")) {
                    deleteUserMutation.mutate();
                  }
                }}
                disabled={deleteUserMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
