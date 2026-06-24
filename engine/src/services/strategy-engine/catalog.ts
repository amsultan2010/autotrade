/**
 * Strategy catalog — one flat, UI-friendly list of EVERY strategy (legacy +
 * stock + crypto) with a plain-English description and grouping, so a settings
 * screen can let the user enable/disable each one and understand what it does.
 *
 * Pair this with the config's enabledStrategies / disabledStrategies lists to
 * actually turn strategies on or off.
 */
import { ALL_STRATEGIES } from './registry';
import { regimeLabel, type AssetType, type StrategySource } from './types';

export interface StrategyCatalogEntry {
  id: string; // internalName — use in enabled/disabled lists
  displayName: string;
  description: string;
  source: StrategySource; // legacy | new | experimental | crypto_new
  assetType: AssetType;
  category: 'stock' | 'crypto'; // top-level grouping for the UI
  isOverlay: boolean; // overlay/filter (on by default; disable via disabledStrategies)
  isExperimental: boolean; // needs an external data feed to do anything
  bestRegimes: string[]; // human labels
  requiredInputs: string[];
  indicators: string[];
}

export function getStrategyCatalog(): StrategyCatalogEntry[] {
  return ALL_STRATEGIES.map((s) => {
    const assetType = s.assetType ?? 'stock';
    const isCrypto = s.source === 'crypto_new' || assetType.startsWith('crypto');
    return {
      id: s.internalName,
      displayName: s.displayName,
      description: s.description,
      source: s.source,
      assetType,
      category: isCrypto ? 'crypto' : 'stock',
      isOverlay: Boolean(s.overlay),
      isExperimental: s.source === 'experimental',
      bestRegimes: s.bestRegimes.map(regimeLabel),
      requiredInputs: s.requiredInputs,
      indicators: s.indicators,
    };
  });
}

/** Catalog grouped by category → source, for a tidy settings screen. */
export function getGroupedCatalog(): Record<'stock' | 'crypto', StrategyCatalogEntry[]> {
  const all = getStrategyCatalog();
  return {
    stock: all.filter((e) => e.category === 'stock'),
    crypto: all.filter((e) => e.category === 'crypto'),
  };
}
