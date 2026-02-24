import { useAdminSets } from "@/hooks/use-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Search } from "lucide-react";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function AdminSetsPage() {
  const { sets, syncSet } = useAdminSets();
  const [setCode, setSetCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setCode) return;
    await syncSet.mutateAsync({ setCode });
    setSetCode("");
  };

  const filteredSets = sets.data?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Set Management</h1>
        <p className="text-muted-foreground mt-1">Import and synchronize card sets from Scryfall.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Sync Form */}
        <Card className="md:col-span-1 h-fit border-white/10 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Sync New Set
            </CardTitle>
            <CardDescription>Enter a set code (e.g. 'khm', 'neo')</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSync} className="space-y-4">
              <Input 
                placeholder="Set Code (e.g. mom)" 
                value={setCode} 
                onChange={(e) => setSetCode(e.target.value.toLowerCase())}
                className="font-mono"
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={syncSet.isPending || !setCode}
              >
                {syncSet.isPending ? <Loader2 className="animate-spin mr-2" /> : "Start Sync"}
                {syncSet.isPending ? "Syncing..." : "Sync from Scryfall"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                This process may take a few seconds as it downloads card data.
              </p>
            </form>
          </CardContent>
        </Card>

        {/* Sets List */}
        <Card className="md:col-span-2 border-white/10 bg-card/50 flex flex-col h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Installed Sets</CardTitle>
              <CardDescription>
                {sets.data?.length || 0} sets available in database
              </CardDescription>
            </div>
            <div className="relative w-48">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search sets..." 
                className="pl-8 h-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="grid grid-cols-1 divide-y divide-white/5">
                {sets.isLoading ? (
                  <div className="p-8 text-center text-muted-foreground">Loading sets...</div>
                ) : filteredSets?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No sets found. Sync one to get started!</div>
                ) : (
                  filteredSets?.map((set) => (
                    <div key={set.code} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black rounded-full border border-white/10 flex items-center justify-center p-2">
                          {set.iconSvgUri ? (
                            <img src={set.iconSvgUri} alt={set.code} className="w-full h-full opacity-80 invert" />
                          ) : (
                            <Database className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold">{set.name}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono uppercase text-primary">{set.code}</span>
                            <span>•</span>
                            <span>{set.releaseDate}</span>
                            <span>•</span>
                            <span>{set.cardCount} cards</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-green-500/20 text-green-400 bg-green-500/10">
                        Active
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
