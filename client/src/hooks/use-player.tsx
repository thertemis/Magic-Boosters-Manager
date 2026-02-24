import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function usePlayerPacks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const packs = useQuery({
    queryKey: [api.player.packs.list.path],
    queryFn: async () => {
      const res = await fetch(api.player.packs.list.path);
      if (!res.ok) throw new Error("Failed to fetch packs");
      return api.player.packs.list.responses[200].parse(await res.json());
    },
  });

  const openPack = useMutation({
    mutationFn: async (packId: number) => {
      const url = buildUrl(api.player.packs.open.path, { id: packId });
      const res = await fetch(url, { method: api.player.packs.open.method });
      if (!res.ok) throw new Error("Failed to open pack");
      return api.player.packs.open.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.player.packs.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.collection.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.player.collection.tags.path] });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return { packs, openPack };
}

export function usePlayerCollection() {
  const collection = useQuery({
    queryKey: [api.player.collection.list.path],
    queryFn: async () => {
      const res = await fetch(api.player.collection.list.path);
      if (!res.ok) throw new Error("Failed to fetch collection");
      return api.player.collection.list.responses[200].parse(await res.json());
    },
  });

  const tags = useQuery({
    queryKey: [api.player.collection.tags.path],
    queryFn: async () => {
      const res = await fetch(api.player.collection.tags.path);
      if (!res.ok) throw new Error("Failed to fetch tags");
      return api.player.collection.tags.responses[200].parse(await res.json());
    },
  });

  const exportCollection = async () => {
    const res = await fetch(api.player.collection.export.path);
    if (!res.ok) throw new Error("Failed to export");
    const text = await res.text();
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-export-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportByTag = async (tag: string) => {
    const url = buildUrl(api.player.collection.exportByTag.path, { tag });
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to export");
    const text = await res.text();

    const blob = new Blob([text], { type: 'text/plain' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${tag}-export-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  const exportCsv = async () => {
    const res = await fetch(api.player.collection.exportCsv.path);
    if (!res.ok) throw new Error("Failed to export CSV");
    const text = await res.text();

    const blob = new Blob([text], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-moxfield-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportCsvByTag = async (tag: string) => {
    const url = buildUrl(api.player.collection.exportCsvByTag.path, { tag });
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to export CSV");
    const text = await res.text();

    const blob = new Blob([text], { type: 'text/csv' });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${tag}-moxfield-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(blobUrl);
  };

  return { collection, tags, exportCollection, exportByTag, exportCsv, exportCsvByTag };
}
