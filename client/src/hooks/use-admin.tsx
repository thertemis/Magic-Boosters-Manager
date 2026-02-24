import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateUserInput, type GrantPackInput, type SyncSetInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useAdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const users = useQuery({
    queryKey: [api.admin.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.admin.users.list.path);
      if (!res.ok) throw new Error("Failed to fetch users");
      return api.admin.users.list.responses[200].parse(await res.json());
    },
  });

  const createUser = useMutation({
    mutationFn: async (data: CreateUserInput) => {
      const res = await fetch(api.admin.users.create.path, {
        method: api.admin.users.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create user");
      return api.admin.users.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.list.path] });
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { users, createUser };
}

export function useAdminSets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sets = useQuery({
    queryKey: [api.admin.sets.list.path],
    queryFn: async () => {
      const res = await fetch(api.admin.sets.list.path);
      if (!res.ok) throw new Error("Failed to fetch sets");
      return api.admin.sets.list.responses[200].parse(await res.json());
    },
  });

  const syncSet = useMutation({
    mutationFn: async (data: SyncSetInput) => {
      const res = await fetch(api.admin.sets.sync.path, {
        method: api.admin.sets.sync.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to sync set");
      return api.admin.sets.sync.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.admin.sets.list.path] });
      toast({ title: "Sync Complete", description: `${data.message} (${data.addedCards} cards)` });
    },
    onError: (err) => {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    },
  });

  return { sets, syncSet };
}

export function useAdminPacks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const grantPack = useMutation({
    mutationFn: async (data: GrantPackInput) => {
      const res = await fetch(api.admin.packs.grant.path, {
        method: api.admin.packs.grant.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to grant packs");
      return api.admin.packs.grant.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.admin.users.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.packs.list.path] });
      toast({ title: "Packs Granted", description: data.message });
    },
    onError: (err) => {
      toast({ title: "Grant Failed", description: err.message, variant: "destructive" });
    },
  });

  const deletePack = useMutation({
    mutationFn: async (packId: number) => {
      const res = await fetch(`/api/admin/packs/${packId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete pack");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Success", description: "Pack deleted successfully" });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { grantPack, deletePack };
}

export function useAdminTags() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const tags = useQuery({
    queryKey: [api.admin.tags.list.path],
    queryFn: async () => {
      const res = await fetch(api.admin.tags.list.path);
      if (!res.ok) throw new Error("Failed to fetch tags");
      return api.admin.tags.list.responses[200].parse(await res.json());
    },
  });

  const removeTag = useMutation({
    mutationFn: async (tag: string) => {
      const url = buildUrl(api.admin.tags.remove.path, { tag });
      const res = await fetch(url, { method: api.admin.tags.remove.method });
      if (!res.ok) throw new Error("Failed to remove tag");
      return api.admin.tags.remove.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.admin.tags.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.collection.tags.path] });
      toast({ title: "Tag Removed", description: data.message });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { tags, removeTag };
}
