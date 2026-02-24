import { useRoute, useLocation } from "wouter";
import { usePlayerPacks } from "@/hooks/use-player";
import { CardDisplay } from "@/components/card-display";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sparkles, Layers, ExternalLink, X } from "lucide-react";
import type { Card } from "@shared/schema";
import confetti from "canvas-confetti";

type OpenedCard = { card: Card; isFoil: boolean; isAltArt: boolean };

export default function OpenPackPage() {
  const [, params] = useRoute("/open/:id");
  const [, setLocation] = useLocation();
  const { openPack } = usePlayerPacks();
  
  const packId = params ? parseInt(params.id) : 0;
  
  const [openedCards, setOpenedCards] = useState<OpenedCard[]>([]);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [stage, setStage] = useState<"intro" | "opening" | "revealing" | "summary">("intro");
  const [error, setError] = useState<string | null>(null);
  const [enlargedCard, setEnlargedCard] = useState<OpenedCard | null>(null);

  useEffect(() => {
    if (stage === "intro") {
      setStage("opening");
      openPack.mutateAsync(packId)
        .then((data) => {
          setOpenedCards(data.cards as OpenedCard[]);
          setStage("revealing");
        })
        .catch((err) => {
          setError(err.message);
        });
    }
  }, [packId]);

  const handleFlip = (index: number) => {
    if (revealedIndices.has(index)) return;
    
    const newRevealed = new Set(revealedIndices);
    newRevealed.add(index);
    setRevealedIndices(newRevealed);

    const { card, isFoil, isAltArt } = openedCards[index];
    if (card.rarity === 'mythic' || (isFoil && isAltArt)) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#ffaa00', '#ff0000', '#ffffff', '#c084fc']
      });
    } else if (card.rarity === 'rare' || isFoil) {
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#ffd700', '#ffffff']
      });
    } else if (isAltArt) {
      confetti({
        particleCount: 30,
        spread: 40,
        origin: { y: 0.6 },
        colors: ['#818cf8', '#c084fc', '#e879f9']
      });
    }

    if (newRevealed.size === openedCards.length) {
      setTimeout(() => setStage("summary"), 1500);
    }
  };

  const handleCardClick = (index: number) => {
    if (!revealedIndices.has(index)) {
      handleFlip(index);
    } else {
      setEnlargedCard(openedCards[index]);
    }
  };

  const revealAll = () => {
    const allIndices = new Set(openedCards.map((_, i) => i));
    setRevealedIndices(allIndices);
    setTimeout(() => setStage("summary"), 2000);
  };

  const openScryfall = (card: Card) => {
    const url = `https://scryfall.com/card/${card.set}/${card.collectorNumber}`;
    window.open(url, "_blank");
  };

  if (error) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-center p-8">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Failed to Open Pack</h2>
        <p className="text-muted-foreground mb-8">{error}</p>
        <Button onClick={() => setLocation("/")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  if (stage === "intro" || stage === "opening") {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center">
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
            filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"]
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative w-48 h-64 bg-gradient-to-br from-primary to-purple-900 rounded-xl shadow-[0_0_50px_rgba(168,85,247,0.4)] flex items-center justify-center border-4 border-white/20"
        >
          <Sparkles className="w-16 h-16 text-white animate-pulse" />
        </motion.div>
        <h2 className="mt-8 text-2xl font-display font-bold animate-pulse">Cracking Pack...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/10 p-4 mb-8 flex justify-between items-center">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Exit
        </Button>
        <h2 className="font-display font-bold text-xl">
          {revealedIndices.size} / {openedCards.length} Revealed
        </h2>
        {stage === "revealing" && (
          <Button size="sm" onClick={revealAll} disabled={revealedIndices.size === openedCards.length}>
            Reveal All
          </Button>
        )}
        {stage === "summary" && (
          <Button size="sm" onClick={() => setLocation("/collection")}>
            View Collection <Layers className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {stage === "revealing" && revealedIndices.size === 0 && (
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-muted-foreground mb-8"
          >
            Click cards to reveal them
          </motion.p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          <AnimatePresence>
            {openedCards.map((oc, i) => (
              <motion.div
                key={`${oc.card.id}-${i}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
              >
                <CardDisplay 
                  card={oc.card} 
                  isFoil={oc.isFoil}
                  isAltArt={oc.isAltArt}
                  isFlipped={revealedIndices.has(i)}
                  onFlip={() => handleCardClick(i)}
                  className="cursor-pointer hover:scale-105 transition-transform duration-300"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {stage === "summary" && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 text-center space-y-6 bg-card/50 p-12 rounded-2xl border border-white/10"
          >
            <h2 className="text-4xl font-display font-bold text-primary">Pack Opened!</h2>
            <p className="text-lg text-muted-foreground">These cards have been added to your collection.</p>
            <div className="flex justify-center gap-4">
              <Button size="lg" variant="outline" onClick={() => setLocation("/")}>
                Open Another
              </Button>
              <Button size="lg" onClick={() => setLocation("/collection")}>
                Go to Collection
              </Button>
            </div>
          </motion.div>
        )}
      </div>

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
