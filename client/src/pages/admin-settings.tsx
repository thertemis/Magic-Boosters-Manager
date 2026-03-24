import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings2, ImagePlus, Trash2, Save, RefreshCw } from "lucide-react";

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settings = useQuery<{ appName: string; hasFavicon: boolean }>({
    queryKey: ["/api/app/settings"],
    staleTime: 30000,
  });

  const [appName, setAppName] = useState<string>("");
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconData, setFaviconData] = useState<string | null | undefined>(undefined);

  const currentName = appName !== "" ? appName : (settings.data?.appName ?? "MTG Pack Simulator");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: { appName?: string; faviconData?: string | null } = {};
      if (appName.trim()) body.appName = appName.trim();
      if (faviconData !== undefined) body.faviconData = faviconData;
      return apiRequest("PATCH", "/api/admin/app/settings", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app/settings"] });
      setAppName("");
      setFaviconData(undefined);
      setFaviconPreview(null);
      toast({ title: "App settings saved!" });
    },
    onError: () => toast({ title: "Error", description: "Could not save settings", variant: "destructive" }),
  });

  const removeFaviconMutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/admin/app/settings", { faviconData: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app/settings"] });
      setFaviconPreview(null);
      setFaviconData(undefined);
      toast({ title: "Favicon removed" });
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Unsupported format", description: "Use PNG, JPG, GIF, SVG, or ICO", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setFaviconPreview(dataUrl);
      setFaviconData(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  const hasChanges = appName.trim() !== "" || faviconData !== undefined;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Settings2 className="h-8 w-8 text-primary" />
          App Settings
        </h1>
        <p className="text-muted-foreground mt-1">Customize the application name and favicon shown to all users.</p>
      </div>

      {/* App Name */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Application Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This name appears in the sidebar, browser tab, and across the app.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="app-name-input">Name</Label>
            <Input
              id="app-name-input"
              placeholder={settings.data?.appName ?? "MTG Pack Simulator"}
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="max-w-sm"
              data-testid="input-app-name"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Preview: <span className="font-semibold text-primary">{currentName}</span>
          </div>
        </CardContent>
      </Card>

      {/* Favicon */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Favicon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload an icon to replace the default favicon shown in browser tabs. Recommended: 32×32 or 64×64 PNG or ICO.
          </p>

          <div className="flex items-center gap-6">
            {/* Current favicon */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-lg border-2 border-border bg-muted/20 flex items-center justify-center overflow-hidden">
                {faviconPreview ? (
                  <img src={faviconPreview} alt="New favicon" className="w-12 h-12 object-contain" />
                ) : settings.data?.hasFavicon ? (
                  <img src={`/api/app/favicon?t=${Date.now()}`} alt="Current favicon" className="w-12 h-12 object-contain" />
                ) : (
                  <ImagePlus className="h-7 w-7 text-muted-foreground" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {faviconPreview ? "New" : settings.data?.hasFavicon ? "Current" : "Default"}
              </span>
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-favicon-file"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-upload-favicon"
              >
                <ImagePlus className="h-4 w-4" />
                {settings.data?.hasFavicon || faviconPreview ? "Replace Image" : "Upload Image"}
              </Button>

              {(settings.data?.hasFavicon || faviconPreview) && !faviconData?.startsWith("data:") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-red-400 hover:text-red-300"
                  onClick={() => removeFaviconMutation.mutate()}
                  disabled={removeFaviconMutation.isPending}
                  data-testid="button-remove-favicon"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasChanges}
          className="gap-2"
          data-testid="button-save-app-settings"
        >
          {saveMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
        {!hasChanges && <span className="text-xs text-muted-foreground">No pending changes.</span>}
      </div>
    </div>
  );
}
