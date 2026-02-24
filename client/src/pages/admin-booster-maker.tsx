import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Card, BoosterTemplate } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card as CardUI, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Check, FlaskConical, Save, Pencil, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminBoosterMakerPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [testSetCode, setTestSetCode] = useState("");
  const [testResults, setTestResults] = useState<Array<{ card: Card; isFoil: boolean; isAltArt: boolean }> | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; slots: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const templates = useQuery<BoosterTemplate[]>({
    queryKey: [api.admin.boosterTemplates.list.path],
  });

  const sets = useQuery({
    queryKey: [api.admin.sets.list.path],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; definition: string }) => {
      const res = await apiRequest("POST", api.admin.boosterTemplates.create.path, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.boosterTemplates.list.path] });
      toast({ title: "Template Created", description: "Booster template saved successfully." });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; definition?: string } }) => {
      const url = buildUrl(api.admin.boosterTemplates.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.boosterTemplates.list.path] });
      toast({ title: "Template Updated", description: "Booster template updated successfully." });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.admin.boosterTemplates.delete.path, { id });
      const res = await apiRequest("DELETE", url);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.boosterTemplates.list.path] });
      toast({ title: "Template Deleted", description: "Booster template removed." });
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (def: string) => {
      const res = await apiRequest("POST", api.admin.boosterTemplates.validate.path, { definition: def });
      return await res.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      if (data.valid) {
        toast({ title: "Valid", description: `Definition is valid with ${data.slots} slot(s).` });
      } else {
        toast({ title: "Invalid", description: data.errors.join(", "), variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Validation Error", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (data: { definition: string; setCode: string }) => {
      const res = await apiRequest("POST", api.admin.boosterTemplates.testGenerate.path, data);
      return await res.json();
    },
    onSuccess: (data) => {
      setTestResults(data.cards);
      toast({ title: "Test Complete", description: `Generated ${data.cards.length} card(s).` });
    },
    onError: (err: Error) => {
      toast({ title: "Test Failed", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setEditingId(null);
    setName("");
    setDefinition("");
    setTestResults(null);
    setValidationResult(null);
  }

  function startEdit(template: BoosterTemplate) {
    setEditingId(template.id);
    setName(template.name);
    setDefinition(template.definition);
    setTestResults(null);
    setValidationResult(null);
  }

  function handleSave() {
    if (!name.trim() || !definition.trim()) return;
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { name: name.trim(), definition: definition.trim() } });
    } else {
      createMutation.mutate({ name: name.trim(), definition: definition.trim() });
    }
  }

  function handleDelete(id: number) {
    if (confirmDeleteId === id) {
      deleteMutation.mutate(id);
    } else {
      setConfirmDeleteId(id);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">Custom Booster Maker</h1>
        <p className="text-muted-foreground mt-1">Create and manage custom booster pack templates using the DSL syntax.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <CardUI className="border-white/10 bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {editingId ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
                {editingId ? "Edit Template" : "New Template"}
              </CardTitle>
              <CardDescription>
                {editingId ? "Modify the template definition and save changes." : "Define a new booster pack template using the DSL syntax."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  data-testid="input-template-name"
                  placeholder="e.g. Standard Play Booster"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Definition (DSL)</Label>
                <Textarea
                  data-testid="input-template-definition"
                  placeholder="{r,75,m,25;u,100;c,100;c,100;c,100}"
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  className="font-mono text-sm min-h-[100px]"
                />
              </div>

              {validationResult && (
                <div
                  data-testid="text-validation-result"
                  className={`p-3 rounded-md text-sm ${
                    validationResult.valid
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}
                >
                  {validationResult.valid ? (
                    <span className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      Valid definition with {validationResult.slots} slot(s)
                    </span>
                  ) : (
                    <div className="space-y-1">
                      {validationResult.errors.map((err, i) => (
                        <p key={i}>{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="button-validate"
                  variant="outline"
                  onClick={() => validateMutation.mutate(definition)}
                  disabled={!definition.trim() || validateMutation.isPending}
                >
                  {validateMutation.isPending ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Check className="mr-2 w-4 h-4" />}
                  Validate
                </Button>

                <Button
                  data-testid="button-save"
                  onClick={handleSave}
                  disabled={!name.trim() || !definition.trim() || isSaving}
                >
                  {isSaving ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Save className="mr-2 w-4 h-4" />}
                  {editingId ? "Update" : "Save"}
                </Button>

                {editingId && (
                  <Button
                    data-testid="button-cancel-edit"
                    variant="ghost"
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="border-t border-white/10 pt-4 space-y-3">
                <Label>Test Generate</Label>
                <div className="flex flex-wrap gap-2">
                  <div className="w-48">
                    <Select value={testSetCode} onValueChange={setTestSetCode}>
                      <SelectTrigger data-testid="select-test-set">
                        <SelectValue placeholder="Select a set" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sets.data as Array<{ code: string; name: string }> || []).map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            <span className="font-mono uppercase text-xs mr-2">{s.code}</span>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    data-testid="button-test"
                    variant="outline"
                    onClick={() => testMutation.mutate({ definition, setCode: testSetCode })}
                    disabled={!definition.trim() || !testSetCode || testMutation.isPending}
                  >
                    {testMutation.isPending ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <FlaskConical className="mr-2 w-4 h-4" />}
                    Test
                  </Button>
                </div>
              </div>

              {testResults && testResults.length > 0 && (
                <div className="space-y-2" data-testid="test-results">
                  <Label>Generated Cards ({testResults.length})</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {testResults.map((result, i) => {
                      const imageUri =
                        (result.card.imageUris as Record<string, string>)?.small ||
                        (result.card.imageUris as Record<string, string>)?.normal ||
                        "";
                      return (
                        <div key={i} className="relative group" data-testid={`card-preview-${i}`}>
                          {imageUri ? (
                            <img
                              src={imageUri}
                              alt={result.card.name}
                              className="w-full rounded-md border border-white/10"
                            />
                          ) : (
                            <div className="w-full aspect-[2.5/3.5] bg-muted rounded-md border border-white/10 flex items-center justify-center text-xs text-muted-foreground p-1 text-center">
                              {result.card.name}
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-[10px] p-1 rounded-b-md truncate invisible group-hover:visible">
                            {result.card.name}
                            {result.isFoil && <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">Foil</Badge>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </CardUI>
        </div>

        <div className="space-y-6">
          <CardUI className="border-white/10 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Templates</CardTitle>
                <CardDescription>{templates.data?.length || 0} template(s)</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {templates.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="animate-spin h-5 w-5" />
                </div>
              ) : !templates.data || templates.data.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-templates">
                  No templates yet. Create one to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {templates.data.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 bg-background/50 rounded-md border border-white/5 space-y-2"
                      data-testid={`template-item-${t.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{t.name}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => startEdit(t)}
                            data-testid={`button-edit-template-${t.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant={confirmDeleteId === t.id ? "destructive" : "ghost"}
                            onClick={() => handleDelete(t.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-template-${t.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <code className="text-xs text-muted-foreground block truncate font-mono">
                        {t.definition}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CardUI>

          <CardUI className="border-white/10 bg-card/50">
            <CardHeader
              className="cursor-pointer"
              onClick={() => setShowHelp(!showHelp)}
            >
              <CardTitle className="flex items-center gap-2 text-sm">
                <HelpCircle className="w-4 h-4 text-primary" />
                DSL Syntax Reference
                {showHelp ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
              </CardTitle>
            </CardHeader>
            {showHelp && (
              <CardContent className="text-xs text-muted-foreground space-y-3" data-testid="text-dsl-help">
                <div>
                  <p className="font-semibold text-foreground mb-1">Format</p>
                  <p>Wrap in curly braces. Slots separated by semicolons (<code className="text-primary">;</code>). Each slot has entries separated by commas (<code className="text-primary">,</code>).</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Rarity Codes</p>
                  <div className="grid grid-cols-2 gap-1">
                    <span><code className="text-primary">c</code> = Common</span>
                    <span><code className="text-primary">u</code> = Uncommon</span>
                    <span><code className="text-primary">r</code> = Rare</span>
                    <span><code className="text-primary">m</code> = Mythic</span>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Entry Format</p>
                  <p>Each entry: <code className="text-primary">rarity,probability</code></p>
                  <p>With set prefix: <code className="text-primary">setcode:rarity,probability</code></p>
                  <p>Probabilities in each slot must sum to 100.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Example</p>
                  <code className="block bg-background/50 p-2 rounded-md text-primary">
                    {"{r,75,m,25;u,100;c,100;c,100;c,100}"}
                  </code>
                  <p className="mt-1">= 1 rare/mythic slot + 1 uncommon + 3 commons</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">Cross-set Example</p>
                  <code className="block bg-background/50 p-2 rounded-md text-primary">
                    {"neo:r,75,neo:m,25"}
                  </code>
                  <p className="mt-1">Pulls rare/mythic cards specifically from the NEO set.</p>
                </div>
              </CardContent>
            )}
          </CardUI>
        </div>
      </div>
    </div>
  );
}
