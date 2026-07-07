import type { LucideIcon } from 'lucide-react';
import {
  Archive,
  BarChart3,
  Bitcoin,
  RefreshCw,
  Scale,
  Settings2,
  Shield,
  TrendingUp,
  Zap,
} from 'lucide-react';

export interface PresetTheme {
  icon: LucideIcon;
  accent: string;
  accentDim: string;
  border: string;
  glow: string;
}

export const PRESET_THEMES: Record<string, PresetTheme> = {
  balanced: {
    icon: Scale,
    accent: '#00c896',
    accentDim: 'rgba(0, 200, 150, 0.14)',
    border: 'rgba(0, 200, 150, 0.42)',
    glow: 'rgba(0, 200, 150, 0.16)',
  },
  conservative: {
    icon: Shield,
    accent: '#4da3ff',
    accentDim: 'rgba(77, 163, 255, 0.14)',
    border: 'rgba(77, 163, 255, 0.42)',
    glow: 'rgba(77, 163, 255, 0.16)',
  },
  aggressive: {
    icon: Zap,
    accent: '#ff6b4a',
    accentDim: 'rgba(255, 107, 74, 0.14)',
    border: 'rgba(255, 107, 74, 0.45)',
    glow: 'rgba(255, 107, 74, 0.18)',
  },
  trend_hunter: {
    icon: TrendingUp,
    accent: '#a78bfa',
    accentDim: 'rgba(167, 139, 250, 0.14)',
    border: 'rgba(167, 139, 250, 0.42)',
    glow: 'rgba(167, 139, 250, 0.16)',
  },
  mean_reversion: {
    icon: RefreshCw,
    accent: '#38bdf8',
    accentDim: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.42)',
    glow: 'rgba(56, 189, 248, 0.16)',
  },
  stocks_only: {
    icon: BarChart3,
    accent: '#f0a500',
    accentDim: 'rgba(240, 165, 0, 0.14)',
    border: 'rgba(240, 165, 0, 0.42)',
    glow: 'rgba(240, 165, 0, 0.16)',
  },
  crypto_only: {
    icon: Bitcoin,
    accent: '#fbbf24',
    accentDim: 'rgba(251, 191, 36, 0.14)',
    border: 'rgba(251, 191, 36, 0.42)',
    glow: 'rgba(251, 191, 36, 0.16)',
  },
  legacy: {
    icon: Archive,
    accent: '#94a3b8',
    accentDim: 'rgba(148, 163, 184, 0.14)',
    border: 'rgba(148, 163, 184, 0.38)',
    glow: 'rgba(148, 163, 184, 0.14)',
  },
  custom: {
    icon: Settings2,
    accent: '#8b9cb0',
    accentDim: 'rgba(139, 156, 176, 0.12)',
    border: 'rgba(139, 156, 176, 0.35)',
    glow: 'rgba(139, 156, 176, 0.12)',
  },
};

export function getPresetTheme(presetId: string): PresetTheme {
  return PRESET_THEMES[presetId] ?? PRESET_THEMES.custom;
}
