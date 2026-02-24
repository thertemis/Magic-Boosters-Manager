import { usePlayerCollection } from "@/hooks/use-player";
import { CardDisplay } from "@/components/card-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Loader2, Tag, FileSpreadsheet, ExternalLink, X } from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { Card } from "@shared/schema";

function isCardAltArt(card: Card): boolean {
  const fe = (card.frameEffects as string[]) || [];
  return (
    card.borderColor === "borderless" ||
    card.fullArt === true ||
    fe.includes("showcase") ||
    fe.includes("extendedart")
  );
}

export default function CollectionPage() {
  const { collection, tags, exportCollection, exportByTag, exportCsv, exportCsvByTag } = usePlayerCollection();
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [colorFilter, setColorFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [enlargedCard, setEnlargedCard] = useState<{ card: Card; isFoil: boolean; isAltArt: boolean } | null>(null);

  const openScryfall = (card: Card) => {
    const url = `https://scryfall.com/card/${card.set}/${card.collectorNumber}`;
    window.open(url, "_blank");
  };

  const filteredCollection = useMemo(() => {
    if (!collection.data) return [];

    return collection.data.filter(item => {
      const matchesSearch = item.card.name.toLowerCase().includes(search.toLowerCase()) || 
                            item.card.typeLine?.toLowerCase().includes(search.toLowerCase());
      
      const matchesRarity = rarityFilter === "all" || item.card.rarity === rarityFilter;
      
      const matchesColor = colorFilter === "all" || 
                           (colorFilter === "colorless" && (!item.card.colors || item.card.colors.length === 0)) ||
                           (item.card.colors as string[])?.includes(colorFilter.toUpperCase());

      const matchesTag = tagFilter === "all" || 
                         (tagFilter === "untagged" && !(item as any).tag) ||
                         (item as any).tag === tagFilter;

      return matchesSearch && matchesRarity && matchesColor && matchesTag;
    });
  }, [collection.data, search, rarityFilter, colorFilter, tagFilter]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">My Collection</h1>
          <p className="text-muted-foreground mt-1">
            {collection.data?.length || 0} unique cards collected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tagFilter !== "all" && tagFilter !== "untagged" && (
            <>
              <Button 
                onClick={() => exportByTag(tagFilter)} 
                variant="outline" 
                className="gap-2"
                data-testid="button-export-tag"
              >
                <Tag className="w-4 h-4" /> Export "{tagFilter}"
              </Button>
              <Button 
                onClick={() => exportCsvByTag(tagFilter)} 
                variant="outline" 
                className="gap-2"
                data-testid="button-export-csv-tag"
              >
                <FileSpreadsheet className="w-4 h-4" /> CSV "{tagFilter}"
              </Button>
            </>
          )}
          <Button onClick={exportCollection} variant="outline" className="gap-2" data-testid="button-export-all">
            <Download className="w-4 h-4" /> Export All
          </Button>
          <Button onClick={exportCsv} variant="outline" className="gap-2" data-testid="button-export-csv">
            <FileSpreadsheet className="w-4 h-4" /> Moxfield CSV
          </Button>
        </div>
      </div>

      {tags.data && tags.data.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground mr-1">Event tags:</span>
          <Badge
            variant={tagFilter === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setTagFilter("all")}
            data-testid="tag-filter-all"
          >
            All
          </Badge>
          {tags.data.map(t => (
            <Badge
              key={t}
              variant={tagFilter === t ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTagFilter(t)}
              data-testid={`tag-filter-${t}`}
            >
              {t}
            </Badge>
          ))}
          <Badge
            variant={tagFilter === "untagged" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setTagFilter("untagged")}
            data-testid="tag-filter-untagged"
          >
            Untagged
          </Badge>
        </div>
      )}

      <div className="bg-card/50 p-4 rounded-md border border-white/10 grid md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or type..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={rarityFilter} onValueChange={setRarityFilter}>
          <SelectTrigger data-testid="select-rarity">
            <SelectValue placeholder="Rarity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Rarities</SelectItem>
            <SelectItem value="mythic" className="text-orange-500">Mythic</SelectItem>
            <SelectItem value="rare" className="text-yellow-500">Rare</SelectItem>
            <SelectItem value="uncommon" className="text-blue-400">Uncommon</SelectItem>
            <SelectItem value="common" className="text-white">Common</SelectItem>
          </SelectContent>
        </Select>
        <Select value={colorFilter} onValueChange={setColorFilter}>
          <SelectTrigger data-testid="select-color">
            <SelectValue placeholder="Color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colors</SelectItem>
            <SelectItem value="w">White</SelectItem>
            <SelectItem value="u">Blue</SelectItem>
            <SelectItem value="b">Black</SelectItem>
            <SelectItem value="r">Red</SelectItem>
            <SelectItem value="g">Green</SelectItem>
            <SelectItem value="colorless">Colorless</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {collection.isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredCollection.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card/20 rounded-md border-dashed border-2 border-white/5">
          <p>No cards found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredCollection.map((item) => (
            <div key={item.id} className="relative group" data-testid={`card-item-${item.id}`}>
              <div
                className="cursor-pointer"
                onClick={() => setEnlargedCard({ card: item.card, isFoil: !!item.isFoil, isAltArt: isCardAltArt(item.card) })}
                data-testid={`card-click-enlarge-${item.id}`}
              >
                <CardDisplay 
                  card={item.card} 
                  isFoil={!!item.isFoil}
                  isAltArt={isCardAltArt(item.card)}
                  isFlipped={true} 
                  animate={false} 
                  className="hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="absolute top-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-md border border-white/20 shadow-lg">
                x{item.quantity}
              </div>
              {(item as any).tag && (
                <div className="absolute bottom-2 left-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-white/20 shadow-lg flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {(item as any).tag}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {enlargedCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEnlargedCard(null)}
            data-testid="card-enlarge-overlay"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              className="relative max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-12 right-0 text-white hover:bg-white/10"
                onClick={() => setEnlargedCard(null)}
                data-testid="button-close-enlarge"
              >
                <X className="w-6 h-6" />
              </Button>
              <div
                className="cursor-pointer"
                onClick={() => openScryfall(enlargedCard.card)}
                data-testid="card-enlarged-click-scryfall"
              >
                <CardDisplay
                  card={enlargedCard.card}
                  isFoil={enlargedCard.isFoil}
                  isAltArt={enlargedCard.isAltArt}
                  isFlipped={true}
                  animate={false}
                />
              </div>
              <div className="mt-4 text-center space-y-2">
                <h3 className="text-xl font-display font-bold text-white">{enlargedCard.card.name}</h3>
                <p className="text-sm text-muted-foreground">{enlargedCard.card.typeLine}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 mt-2"
                  onClick={() => openScryfall(enlargedCard.card)}
                  data-testid="button-open-scryfall"
                >
                  <ExternalLink className="w-4 h-4" /> View on Scryfall
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
