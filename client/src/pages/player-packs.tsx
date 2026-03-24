import { usePlayerPacks } from "@/hooks/use-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PackageOpen, Sparkles, AlertCircle, Tag } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function PlayerPacksPage() {
  const { packs } = usePlayerPacks();
  const [, setLocation] = useLocation();

  const availablePacks = packs.data?.filter(p => p.status === 'available') || [];
  const openedPacks = packs.data?.filter(p => p.status === 'opened') || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">My Packs</h1>
          <p className="text-muted-foreground mt-1">Open your boosters to add cards to your collection.</p>
        </div>
        <div className="bg-card px-4 py-2 rounded-lg border border-white/10 text-sm">
          <span className="font-bold text-primary">{availablePacks.length}</span> Packs Available
        </div>
      </div>

      {packs.isLoading ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">Loading inventory...</div>
      ) : availablePacks.length === 0 ? (
        <Card className="border-dashed border-2 border-white/10 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <PackageOpen className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-semibold">No Packs Available</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              You don't have any unopened packs. Ask an admin to grant you some boosters!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {availablePacks.map((pack, i) => (
            <motion.div
              key={pack.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="group relative aspect-[3/4] bg-gradient-to-br from-gray-900 to-black rounded-xl border border-white/10 shadow-xl overflow-hidden cursor-pointer hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300 transform hover:-translate-y-2">
                {/* Pack Art Placeholder - Gradients based on set */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                
                {/* Set Icon as Background */}
                <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-20 transition-opacity">
                  {pack.set.iconSvgUri && (
                    <img src={pack.set.iconSvgUri} alt="" className="w-32 h-32 invert" />
                  )}
                </div>

                <div className="absolute inset-0 p-6 flex flex-col justify-between z-10">
                  <div className="text-center">
                    <span className="text-xs font-bold tracking-widest uppercase text-white/50 border border-white/10 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                      {pack.set.code}
                    </span>
                  </div>
                  
                  <div className="text-center space-y-1">
                    <h3 className="font-display font-bold text-xl leading-tight text-white drop-shadow-md">
                      {pack.set.name}
                    </h3>
                    <p className="text-xs text-primary font-semibold uppercase tracking-wider">
                      {pack.packType} Booster
                    </p>
                    {pack.tag && (
                      <div className="flex justify-center mt-1">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/60 border border-white/20 text-white/80 backdrop-blur-sm">
                          <Tag className="w-2.5 h-2.5" />
                          {pack.tag}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button 
                    className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white font-semibold shadow-lg group-hover:bg-primary group-hover:text-black group-hover:border-primary transition-colors"
                    onClick={() => setLocation(`/open/${pack.id}`)}
                  >
                    Open Pack
                  </Button>
                </div>
                
                {/* Foil Sheen Animation */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              </div>
            </motion.div>
          ))}
        </div>
      )}
      
      {openedPacks.length > 0 && (
        <div className="mt-12 opacity-60">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Previously Opened</h3>
          <div className="flex flex-wrap gap-2">
             {openedPacks.slice(0, 10).map(p => (
               <div key={p.id} className="text-xs bg-white/5 px-2 py-1 rounded-md border border-white/10 flex items-center gap-1">
                 {p.set.name} ({new Date(p.openedAt!).toLocaleDateString()})
                 {p.tag && (
                   <span className="inline-flex items-center gap-0.5 text-[10px] text-white/60">
                     <Tag className="w-2 h-2" /> {p.tag}
                   </span>
                 )}
               </div>
             ))}
             {openedPacks.length > 10 && <span className="text-xs py-1">+ {openedPacks.length - 10} more</span>}
          </div>
        </div>
      )}
    </div>
  );
}
