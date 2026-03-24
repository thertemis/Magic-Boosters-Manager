import { motion } from "framer-motion";
import type { Card } from "@shared/schema";
import { cn } from "@/lib/utils";
import cardBackImage from "@/assets/mtg-card-back.png";

interface CardDisplayProps {
  card: Card;
  isFoil?: boolean;
  isAltArt?: boolean;
  isFlipped?: boolean;
  onFlip?: () => void;
  className?: string;
  animate?: boolean;
}

function getAltArtLabel(card: Card): string | null {
  const fe = (card.frameEffects as string[]) || [];
  if (fe.includes("showcase")) return "Showcase";
  if (fe.includes("extendedart")) return "Extended Art";
  if (card.borderColor === "borderless") return "Borderless";
  if (card.fullArt) return "Full Art";
  return null;
}

export function CardDisplay({ card, isFoil = false, isAltArt = false, isFlipped = true, onFlip, className, animate = true }: CardDisplayProps) {
  const imageUri = (card.imageUris as Record<string, string>)?.normal
    || (card.imageUris as Record<string, string>)?.large
    || (card.imageUris as Record<string, string>)?.png
    || "";

  const rarityColors: Record<string, string> = {
    common: "border-white/10 shadow-black/50",
    uncommon: "border-blue-400/30 shadow-blue-900/20",
    rare: "border-amber-400/40 shadow-amber-900/30",
    mythic: "border-orange-600/50 shadow-orange-900/40",
  };

  const rarityClass = rarityColors[card.rarity || "common"] || rarityColors.common;
  const altArtLabel = isAltArt ? getAltArtLabel(card) : null;

  return (
    <div 
      className={cn("relative w-full aspect-[2.5/3.5] perspective-1000", className)}
      onClick={onFlip}
      data-testid={`card-display-${card.id}`}
    >
      <motion.div
        className="w-full h-full relative transform-style-3d transition-all"
        initial={false}
        animate={{ rotateY: isFlipped ? 0 : 180 }}
        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* FRONT (The Card Art) */}
        <div 
          className={cn(
            "absolute inset-0 backface-hidden rounded-xl overflow-hidden border-2 shadow-xl bg-card",
            rarityClass,
            isFoil && "ring-2 ring-indigo-400/40"
          )}
        >
          {imageUri ? (
            <img 
              src={imageUri} 
              alt={card.name} 
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-zinc-900">
              <span className="font-display text-lg font-bold">{card.name}</span>
              <span className="text-xs text-muted-foreground mt-2">{card.typeLine}</span>
              <p className="text-xs mt-4 italic">{card.oracleText?.slice(0, 100)}...</p>
            </div>
          )}
          
          {/* Foil rainbow shimmer overlay */}
          {isFoil && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-pink-500/15 mix-blend-overlay" />
              <div className="absolute inset-0 bg-gradient-to-tr from-cyan-400/10 via-transparent to-amber-400/10 mix-blend-color-dodge animate-pulse" style={{ animationDuration: '3s' }} />
            </div>
          )}

          {/* Badges container */}
          <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 pointer-events-none">
            {isFoil && (
              <span 
                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg backdrop-blur-sm"
                data-testid={`badge-foil-${card.id}`}
              >
                FOIL
              </span>
            )}
            {altArtLabel && (
              <span 
                className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg backdrop-blur-sm"
                data-testid={`badge-altart-${card.id}`}
              >
                {altArtLabel.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* BACK (MTG Card Back) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl overflow-hidden border-2 border-amber-900/30 shadow-xl">
          <img 
            src={cardBackImage} 
            alt="MTG Card Back" 
            className="w-full h-full object-cover"
          />
        </div>
      </motion.div>
    </div>
  );
}
