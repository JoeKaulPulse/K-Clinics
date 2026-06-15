'use client';

import type { ReactElement } from 'react';
import { motion } from 'motion/react';

// Abstract, animated SVG illustrations for teach cards and inline questions.
// They illustrate a concept without giving away an answer, and get *vaguer* as a
// learner sees the topic again: `level` strips labels then detail, so early on
// the diagram guides, and later it's just a gentle visual cue.

export type IlloKey = 'skin-layers' | 'hair-cycle' | 'light-spectrum' | 'fitzpatrick' | 'collagen' | 'safety' | 'concept';
export type IlloLevel = 'full' | 'reduced' | 'minimal';

const gold = 'var(--color-gold)';
const ink = 'var(--color-porcelain)';

/** Pick an illustration for a chunk of text by keyword (used to auto-attach art
 *  to existing content). Returns null when nothing fits. */
export function matchIllustration(text: string): IlloKey | null {
  const t = text.toLowerCase();
  if (/(epidermis|dermis|hypodermis|skin layer|stratum|keratinocyte)/.test(t)) return 'skin-layers';
  if (/(hair|follicle|anagen|catagen|telogen|growth cycle)/.test(t)) return 'hair-cycle';
  if (/(wavelength|nanometre|nanometer|\bnm\b|laser|light|ipl|chromophore|spectrum|photo)/.test(t)) return 'light-spectrum';
  if (/(fitzpatrick|skin type|phototype|pigment)/.test(t)) return 'fitzpatrick';
  if (/(collagen|elastin|fibroblast|ageing|aging|wrinkle|remodel)/.test(t)) return 'collagen';
  if (/(consent|contraindicat|safety|risk|hygiene|infection|sharps|ppe)/.test(t)) return 'safety';
  return null;
}

function SkinLayers({ level }: { level: IlloLevel }) {
  const labels = level === 'full';
  const bands = [
    { y: 18, h: 22, label: 'Epidermis' },
    { y: 40, h: 34, label: 'Dermis' },
    { y: 74, h: 30, label: 'Hypodermis' },
  ];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      {bands.map((b, i) => (
        <g key={i}>
          <motion.rect x="16" y={b.y} width="168" height={b.h - 2} rx="3" fill={gold} initial={{ opacity: 0.18 }} animate={{ opacity: [0.16, 0.32, 0.16] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }} />
          {labels && <text x="100" y={b.y + b.h / 2 + 4} textAnchor="middle" fontSize="9" fill={ink} opacity="0.9">{b.label}</text>}
        </g>
      ))}
      {level !== 'minimal' && <line x1="16" y1="18" x2="16" y2="104" stroke={gold} strokeWidth="1.5" opacity="0.5" />}
    </svg>
  );
}

function HairCycle({ level }: { level: IlloLevel }) {
  const labels = level === 'full';
  const phases = ['Anagen', 'Catagen', 'Telogen'];
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      {[0, 1, 2].map((i) => {
        const cx = 50 + i * 50;
        return (
          <g key={i}>
            <motion.line x1={cx} y1={92} x2={cx} y2={92 - (level === 'minimal' ? 22 : 40 - i * 12)} stroke={gold} strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }} />
            <circle cx={cx} cy={96} r="4" fill={gold} opacity="0.6" />
            {labels && <text x={cx} y={110} textAnchor="middle" fontSize="8" fill={ink} opacity="0.85">{phases[i]}</text>}
          </g>
        );
      })}
      {level !== 'minimal' && <motion.path d="M30 60 Q100 40 170 60" fill="none" stroke={gold} strokeWidth="1" opacity="0.4" strokeDasharray="3 4" animate={{ strokeDashoffset: [0, -14] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />}
    </svg>
  );
}

function LightSpectrum({ level }: { level: IlloLevel }) {
  const labels = level === 'full';
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <motion.path d="M12 70 Q40 30 60 70 T108 70 T156 70 T200 70" fill="none" stroke={gold} strokeWidth="2.5" strokeLinecap="round" animate={{ x: [0, -24] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }} />
      {level !== 'minimal' && <line x1="12" y1="92" x2="188" y2="92" stroke={ink} strokeWidth="1" opacity="0.35" />}
      {labels && (
        <>
          <text x="20" y="106" fontSize="8" fill={ink} opacity="0.8">shorter λ</text>
          <text x="150" y="106" fontSize="8" fill={ink} opacity="0.8">longer λ</text>
        </>
      )}
    </svg>
  );
}

function Fitzpatrick({ level }: { level: IlloLevel }) {
  const n = level === 'minimal' ? 6 : 6;
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      {Array.from({ length: n }).map((_, i) => (
        <motion.rect key={i} x={20 + i * 27} y="40" width="22" height="40" rx="3" fill={gold} initial={{ opacity: 0 }} animate={{ opacity: 0.22 + i * 0.13 }} transition={{ duration: 0.6, delay: i * 0.12 }} />
      ))}
      {level === 'full' && <text x="100" y="98" textAnchor="middle" fontSize="9" fill={ink} opacity="0.85">Type I → VI</text>}
    </svg>
  );
}

function Collagen({ level }: { level: IlloLevel }) {
  const tight = level !== 'full';
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      {Array.from({ length: 5 }).map((_, r) => (
        <motion.path
          key={r}
          d={`M16 ${30 + r * 15} H184`}
          stroke={gold} strokeWidth="2" fill="none" opacity="0.5"
          initial={{ pathLength: 0.4 }}
          animate={{ d: tight ? `M16 ${30 + r * 15} H184` : `M16 ${30 + r * 15} Q100 ${24 + r * 15} 184 ${30 + r * 15}` }}
          transition={{ duration: 3, repeat: Infinity, repeatType: 'reverse', delay: r * 0.2 }}
        />
      ))}
    </svg>
  );
}

function Safety({ level }: { level: IlloLevel }) {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <motion.path d="M100 20 L150 36 V64 C150 88 128 100 100 108 C72 100 50 88 50 64 V36 Z" fill="none" stroke={gold} strokeWidth="2.5" animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 3, repeat: Infinity }} />
      {level !== 'minimal' && <motion.path d="M82 62 L96 76 L122 48" fill="none" stroke={gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 1.6 }} />}
    </svg>
  );
}

function Concept({ level }: { level: IlloLevel }) {
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full">
      <motion.circle cx="100" cy="60" r="30" fill="none" stroke={gold} strokeWidth="2" animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.9, 0.5] }} transition={{ duration: 3.5, repeat: Infinity }} style={{ transformOrigin: '100px 60px' }} />
      {level !== 'minimal' && <motion.circle cx="100" cy="60" r="6" fill={gold} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} />}
    </svg>
  );
}

const REGISTRY: Record<IlloKey, (p: { level: IlloLevel }) => ReactElement> = {
  'skin-layers': SkinLayers, 'hair-cycle': HairCycle, 'light-spectrum': LightSpectrum,
  'fitzpatrick': Fitzpatrick, 'collagen': Collagen, 'safety': Safety, 'concept': Concept,
};

export function Illustration({ name, level = 'full' }: { name: IlloKey; level?: IlloLevel }) {
  const C = REGISTRY[name] ?? Concept;
  // At minimal level the illustration fades right back — a faint cue, not a guide.
  return (
    <div className={`mx-auto w-full max-w-xs overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-white/5 ${level === 'minimal' ? 'opacity-40' : ''}`} style={{ aspectRatio: '200 / 120' }} aria-hidden>
      <C level={level} />
    </div>
  );
}
