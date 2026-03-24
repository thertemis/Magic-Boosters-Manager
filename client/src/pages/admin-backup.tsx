import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card as CardUI, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Upload,
  Loader2,
  Database,
  AlertTriangle,
  Users,
  FileJson,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

export default function AdminBackupPage() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [collectionExporting, setCollectionExporting] = useState(false);
  const [collectionImporting, setCollectionImporting] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [confirmFullImport, setConfirmFullImport] = useState(false);

  const fullImportRef = useRef<HTMLInputElement>(null);
  const collectionImportRef = useRef<HTMLInputElement>(null);

  const usersQuery = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const handleFullExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/backup/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mtg-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export Complete", description: "Full backup downloaded successfully." });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleFullImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await apiRequest("POST", "/api/admin/backup/import", data);
      const result = await res.json();
      setImportResult(result);
      setConfirmFullImport(false);
      toast({ title: "Import Complete", description: result.message });
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handlePlayerCollectionExport = async (userId: string) => {
    setCollectionExporting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/collection/export`, { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const user = usersQuery.data?.find(u => u.id === parseInt(userId));
      a.download = `${user?.username || "player"}-collection.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Collection Exported", description: `${user?.username}'s collection downloaded.` });
    } catch (err: any) {
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    } finally {
      setCollectionExporting(false);
    }
  };

  const handlePlayerCollectionImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUserId) return;

    setCollectionImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let items: any[];
      if (data.items && Array.isArray(data.items)) {
        items = data.items;
      } else if (Array.isArray(data)) {
        items = data;
      } else {
        throw new Error("Invalid format. JSON should contain an 'items' array or be an array directly.");
      }

      const res = await apiRequest("POST", `/api/admin/users/${selectedUserId}/collection/import`, { items });
      const result = await res.json();
      const user = usersQuery.data?.find(u => u.id === parseInt(selectedUserId));
      toast({ title: "Collection Imported", description: `${result.count} cards added to ${user?.username}'s collection.` });
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    } finally {
      setCollectionImporting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-8" data-testid="page-admin-backup">
      <div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Backup & Restore</h1>
        <p className="text-muted-foreground mt-1">
          Export or import the full database, or manage individual player collections.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CardUI className="border-white/10 bg-card/50" data-testid="card-full-export">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-green-400" />
              Full Database Export
            </CardTitle>
            <CardDescription>
              Download a complete backup of everything: users, sets, cards, collections, packs, templates, tags, and settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline"><Users className="w-3 h-3 mr-1" /> Users</Badge>
                <Badge variant="outline"><Database className="w-3 h-3 mr-1" /> Sets & Cards</Badge>
                <Badge variant="outline">Collections</Badge>
                <Badge variant="outline">Packs</Badge>
                <Badge variant="outline">Templates</Badge>
                <Badge variant="outline">Invitation Codes</Badge>
              </div>
              <Button
                onClick={handleFullExport}
                className="w-full gap-2"
                disabled={exporting}
                data-testid="button-full-export"
              >
                {exporting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
                ) : (
                  <><Download className="w-4 h-4" /> Download Full Backup</>
                )}
              </Button>
            </div>
          </CardContent>
        </CardUI>

        <CardUI className="border-white/10 bg-card/50" data-testid="card-full-import">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-400" />
              Full Database Import
            </CardTitle>
            <CardDescription>
              Restore from a previously exported backup file. This will replace ALL current data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="bg-red-950/30 border border-red-500/30 rounded-md p-3 flex items-start gap-2" data-testid="text-import-warning">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">
                  This will delete all existing data and replace it with the backup. Make sure to export first!
                </p>
              </div>

              {!confirmFullImport ? (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setConfirmFullImport(true)}
                  disabled={importing}
                  data-testid="button-confirm-import"
                >
                  <ShieldAlert className="w-4 h-4" /> I Understand, Import Backup
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-yellow-400 font-medium text-center">
                    Select a backup file to proceed:
                  </p>
                  <input
                    ref={fullImportRef}
                    type="file"
                    accept=".json"
                    onChange={handleFullImport}
                    disabled={importing}
                    className="hidden"
                    data-testid="input-import-file"
                  />
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    disabled={importing}
                    onClick={() => fullImportRef.current?.click()}
                    data-testid="button-choose-backup-file"
                  >
                    {importing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Choose Backup File</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setConfirmFullImport(false)}
                    data-testid="button-cancel-import"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {importResult && (
                <div className="bg-green-950/30 border border-green-500/30 rounded-md p-3 space-y-1" data-testid="text-import-result">
                  <p className="text-sm text-green-300 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {importResult.message}
                  </p>
                  {importResult.imported && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(importResult.imported).map(([key, count]) => (
                        <Badge key={key} variant="outline" className="text-xs" data-testid={`badge-import-count-${key}`}>
                          {key}: {count as number}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CardUI>
      </div>

      <CardUI className="border-white/10 bg-card/50" data-testid="card-player-collection">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="w-5 h-5 text-blue-400" />
            Player Collection Export / Import
          </CardTitle>
          <CardDescription>
            Export or re-import a specific player's collection. Useful if a collection was accidentally deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Player</Label>
              {usersQuery.isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger data-testid="select-player">
                    <SelectValue placeholder="Choose a player..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersQuery.data?.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()} data-testid={`select-player-${user.id}`}>
                        {user.username} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedUserId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => handlePlayerCollectionExport(selectedUserId)}
                  disabled={collectionExporting}
                  data-testid="button-export-player-collection"
                >
                  {collectionExporting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
                  ) : (
                    <><Download className="w-4 h-4" /> Export Collection</>
                  )}
                </Button>

                <div>
                  <input
                    ref={collectionImportRef}
                    type="file"
                    accept=".json"
                    onChange={handlePlayerCollectionImport}
                    disabled={collectionImporting}
                    className="hidden"
                    data-testid="input-collection-import-file"
                  />
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    disabled={collectionImporting}
                    onClick={() => collectionImportRef.current?.click()}
                    data-testid="button-import-player-collection"
                  >
                    {collectionImporting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Import Collection</>
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="bg-card border border-white/10 rounded-md p-3 text-sm text-muted-foreground space-y-1" data-testid="text-import-format-help">
              <p className="font-medium text-foreground">Collection Import Format (JSON):</p>
              <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto">{`{
  "items": [
    { "cardId": "scryfall-uuid", "quantity": 1, "isFoil": false, "tag": "event-name" },
    { "cardId": "scryfall-uuid", "quantity": 2, "isFoil": true }
  ]
}`}</pre>
              <p className="text-xs mt-1">
                You can also re-import a previously exported collection file — the format is compatible.
              </p>
            </div>
          </div>
        </CardContent>
      </CardUI>
    </div>
  );
}
