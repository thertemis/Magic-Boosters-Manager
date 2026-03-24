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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Set, User, EconomySettings } from "@shared/schema";
import { Plus, Pencil, Trash2, Clock, Users, CalendarClock } from "lucide-react";
import { utcHourToLocal, localHourToUtc, tzAbbr, formatInTz } from "@/lib/timezone";

interface BoosterSchedule {
  id: number;
  name: string;
  userId: number | null;
  setCode: string;
  packType: string;
  tag: string | null;
  quantity: number;
  scheduleHour: number;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
  set: Set;
  user: User | null;
}

function buildHours(tz: string) {
  // Build 24 entries where the admin sees LOCAL hours
  // Value = local hour (what admin picks), stored UTC = localHourToUtc(localHour, tz)
  return Array.from({ length: 24 }, (_, localH) => {
    const utc = localHourToUtc(localH, tz);
    const abbr = tzAbbr(tz);
    return {
      localHour: localH,
      utcHour: utc,
      label: `${String(localH).padStart(2, "0")}:00 ${abbr} (= ${String(utc).padStart(2, "0")}:00 UTC)`,
    };
  });
}

const PACK_TYPES = [
  { value: "play", label: "Play Booster" },
  { value: "collector", label: "Collector Booster" },
];

const emptyForm = {
  name: "",
  userId: "" as string,
  setCode: "",
  packType: "play",
  tag: "",
  quantity: 1,
  scheduleHour: 8,
  isActive: true,
};

export default function AdminSchedulesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const sets = useQuery<Set[]>({ queryKey: ["/api/admin/sets"] });
  const users = useQuery<User[]>({ queryKey: ["/api/admin/users"] });
  const schedules = useQuery<BoosterSchedule[]>({ queryKey: ["/api/admin/schedules"] });
  const templates = useQuery<any[]>({ queryKey: ["/api/admin/booster-templates"] });
  const econSettings = useQuery<EconomySettings | null>({ queryKey: ["/api/admin/economy"] });

  const tz = econSettings.data?.adminTimezone || "UTC";
  const tzLabel = tzAbbr(tz);
  const hours = buildHours(tz);

  const packTypeOptions = [
    ...PACK_TYPES,
    ...(templates.data || []).map((t: any) => ({ value: `template:${t.id}`, label: `Custom: ${t.name}` })),
  ];

  const createSchedule = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/schedules", {
      ...form,
      scheduleHour: localHourToUtc(form.scheduleHour, tz),
      userId: form.userId ? parseInt(form.userId) : null,
      tag: form.tag || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      toast({ title: "Schedule created!" });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast({ title: "Failed to create schedule", variant: "destructive" }),
  });

  const updateSchedule = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/admin/schedules/${editId}`, {
      ...form,
      scheduleHour: localHourToUtc(form.scheduleHour, tz),
      userId: form.userId ? parseInt(form.userId) : null,
      tag: form.tag || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      toast({ title: "Schedule updated!" });
      setDialogOpen(false);
      setEditId(null);
    },
    onError: () => toast({ title: "Failed to update schedule", variant: "destructive" }),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/admin/schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] });
      toast({ title: "Schedule deleted" });
    },
  });

  const toggleSchedule = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/schedules/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/schedules"] }),
  });

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setDialogOpen(true);
  }

  function openEdit(s: BoosterSchedule) {
    setForm({
      name: s.name,
      userId: s.userId ? String(s.userId) : "",
      setCode: s.setCode,
      packType: s.packType,
      tag: s.tag || "",
      quantity: s.quantity,
      scheduleHour: utcHourToLocal(s.scheduleHour, tz), // convert UTC → local for display
      isActive: s.isActive,
    });
    setEditId(s.id);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-primary">Booster Schedules</h1>
          <p className="text-muted-foreground mt-1">Automatically grant booster packs to players on a daily schedule.</p>
        </div>
        <Button data-testid="button-create-schedule" onClick={openCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          New Schedule
        </Button>
      </div>

      <Card className="bg-blue-950/20 border-blue-500/30">
        <CardContent className="pt-4 pb-4">
          <p className="text-blue-300 text-sm">
            <strong>How it works:</strong> Schedules run once per day at the specified time. Times are shown in{" "}
            <strong>{tz}</strong> ({tzLabel}). The scheduler checks every minute.
            {tz !== "UTC" && " Configure your timezone in Economy Settings."}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {schedules.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading schedules...</p>
        ) : !schedules.data?.length ? (
          <Card className="bg-card border-white/10">
            <CardContent className="py-12 text-center">
              <CalendarClock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No schedules yet. Create one to automatically grant packs daily.</p>
            </CardContent>
          </Card>
        ) : (
          schedules.data.map(schedule => (
            <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}
              className="bg-card border-white/10">
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white">{schedule.name}</p>
                      <Badge variant={schedule.isActive ? "default" : "secondary"}>
                        {schedule.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {String(utcHourToLocal(schedule.scheduleHour, tz)).padStart(2, "0")}:00 {tzLabel} daily
                        <span className="text-muted-foreground/60">(= {String(schedule.scheduleHour).padStart(2, "0")}:00 UTC)</span>
                      </span>
                      <span>•</span>
                      <span>{schedule.quantity}× {schedule.packType}</span>
                      <span>•</span>
                      <span>{schedule.set.name}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {schedule.user ? schedule.user.username : "All Players"}
                      </span>
                      {schedule.tag && <><span>•</span><span>Tag: {schedule.tag}</span></>}
                    </div>
                    {schedule.lastRunAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last run: {formatInTz(schedule.lastRunAt, tz)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    data-testid={`switch-schedule-${schedule.id}`}
                    checked={schedule.isActive}
                    onCheckedChange={v => toggleSchedule.mutate({ id: schedule.id, isActive: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(schedule)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300"
                    onClick={() => deleteSchedule.mutate(schedule.id)}>
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
            <DialogTitle>{editId ? "Edit Schedule" : "Create Schedule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input data-testid="input-schedule-name"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Daily Draft Pack" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Set</Label>
                <Select value={form.setCode} onValueChange={v => setForm(f => ({ ...f, setCode: v }))}>
                  <SelectTrigger data-testid="select-schedule-set">
                    <SelectValue placeholder="Select set" />
                  </SelectTrigger>
                  <SelectContent>
                    {(sets.data || []).map(s => (
                      <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pack Type</Label>
                <Select value={form.packType} onValueChange={v => setForm(f => ({ ...f, packType: v }))}>
                  <SelectTrigger data-testid="select-schedule-pack-type">
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
                <Label>Target Player (leave empty for all)</Label>
                <Select value={form.userId || "all"} onValueChange={v => setForm(f => ({ ...f, userId: v === "all" ? "" : v }))}>
                  <SelectTrigger data-testid="select-schedule-user">
                    <SelectValue placeholder="All players" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Players</SelectItem>
                    {(users.data || []).filter(u => u.role === "player").map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Packs per Grant</Label>
                <Input data-testid="input-schedule-quantity" type="number" min={1}
                  value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Grant Time ({tzLabel})</Label>
                <Select value={String(form.scheduleHour)} onValueChange={v => setForm(f => ({ ...f, scheduleHour: parseInt(v) }))}>
                  <SelectTrigger data-testid="select-schedule-hour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.map(h => (
                      <SelectItem key={h.localHour} value={String(h.localHour)}>{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event Tag (optional)</Label>
                <Input data-testid="input-schedule-tag"
                  value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                  placeholder="Daily Draft" />
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
              data-testid="button-save-schedule"
              onClick={() => editId ? updateSchedule.mutate() : createSchedule.mutate()}
              disabled={!form.name || !form.setCode || createSchedule.isPending || updateSchedule.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {editId ? "Save Changes" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
