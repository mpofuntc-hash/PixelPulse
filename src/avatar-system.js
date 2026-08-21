// PixelPulse Avatar & Banner System
// 14 unique pixel-art avatars + banner system
// All avatars are SVG-based with pixel-art aesthetic unique to PixelPulse

const AVATARS = [
  // === DEFAULT (Free) ===
  {
    id: 'male_default',
    name: 'Pixel Warrior',
    tier: 'default',
    category: 'default',
    cost: 0,
    unlockCondition: 'default',
    rarity: 'common',
    description: 'The standard PixelPulse warrior. Every journey starts here.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="10" y="4" width="12" height="3" fill="#4a3728"/>
      <rect x="9" y="7" width="14" height="2" fill="#4a3728"/>
      <rect x="10" y="9" width="12" height="5" fill="#f0c090"/>
      <rect x="12" y="11" width="2" height="2" fill="#1a1a2e"/>
      <rect x="18" y="11" width="2" height="2" fill="#1a1a2e"/>
      <rect x="13" y="14" width="6" height="1" fill="#8b4513"/>
      <rect x="8" y="14" width="16" height="6" fill="#2a4d6e"/>
      <rect x="12" y="16" width="8" height="2" fill="#e50914"/>
      <rect x="6" y="20" width="20" height="8" fill="#1a1a2e"/>
      <rect x="10" y="20" width="4" height="6" fill="#2a4d6e"/>
      <rect x="18" y="20" width="4" height="6" fill="#2a4d6e"/>
      <rect x="8" y="28" width="6" height="3" fill="#3a3a4e"/>
      <rect x="18" y="28" width="6" height="3" fill="#3a3a4e"/>
    </svg>`
  },
  {
    id: 'female_default',
    name: 'Pixel Maiden',
    tier: 'default',
    category: 'default',
    cost: 0,
    unlockCondition: 'default',
    rarity: 'common',
    description: 'The standard PixelPulse maiden. Every journey starts here.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="9" y="4" width="14" height="4" fill="#8b4513"/>
      <rect x="8" y="8" width="16" height="3" fill="#a0522d"/>
      <rect x="10" y="10" width="12" height="5" fill="#f0c090"/>
      <rect x="12" y="11" width="2" height="2" fill="#1a1a2e"/>
      <rect x="18" y="11" width="2" height="2" fill="#1a1a2e"/>
      <rect x="13" y="14" width="6" height="1" fill="#d4a0a0"/>
      <rect x="8" y="14" width="16" height="7" fill="#9b1b3a"/>
      <rect x="12" y="16" width="8" height="2" fill="#e50914"/>
      <rect x="6" y="21" width="20" height="7" fill="#1a1a2e"/>
      <rect x="10" y="21" width="4" height="5" fill="#9b1b3a"/>
      <rect x="18" y="21" width="4" height="5" fill="#9b1b3a"/>
      <rect x="8" y="28" width="6" height="3" fill="#3a3a4e"/>
      <rect x="18" y="28" width="6" height="3" fill="#3a3a4e"/>
    </svg>`
  },

  // === BUYABLE NOBILITY (Site Points) ===
  {
    id: 'peasant',
    name: 'Humble Peasant',
    tier: 'nobility',
    category: 'buyable',
    cost: 500,
    unlockCondition: 'purchase',
    rarity: 'uncommon',
    description: 'A humble beginning in the PixelPulse kingdom. Simple but sturdy.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="11" y="5" width="10" height="3" fill="#5a4a3a"/>
      <rect x="10" y="8" width="12" height="2" fill="#5a4a3a"/>
      <rect x="10" y="10" width="12" height="5" fill="#d4a878"/>
      <rect x="12" y="11" width="2" height="2" fill="#2a4d2a"/>
      <rect x="18" y="11" width="2" height="2" fill="#2a4d2a"/>
      <rect x="13" y="14" width="6" height="1" fill="#6b4a2a"/>
      <rect x="8" y="15" width="16" height="6" fill="#6b5d3a"/>
      <rect x="12" y="17" width="8" height="1" fill="#8b7d5a"/>
      <rect x="6" y="21" width="20" height="7" fill="#3a3a2a"/>
      <rect x="10" y="21" width="3" height="5" fill="#6b5d3a"/>
      <rect x="19" y="21" width="3" height="5" fill="#6b5d3a"/>
      <rect x="8" y="28" width="6" height="3" fill="#2a2a1a"/>
      <rect x="18" y="28" width="6" height="3" fill="#2a2a1a"/>
      <rect x="4" y="16" width="3" height="8" fill="#8b7d5a"/>
      <rect x="25" y="16" width="3" height="8" fill="#8b7d5a"/>
    </svg>`
  },
  {
    id: 'joker',
    name: 'Trickster Joker',
    tier: 'nobility',
    category: 'buyable',
    cost: 1500,
    unlockCondition: 'purchase',
    rarity: 'uncommon',
    description: 'A mischievous soul who thrives on chaos. The house always laughs last.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="8" y="3" width="3" height="3" fill="#e50914"/>
      <rect x="21" y="3" width="3" height="3" fill="#e50914"/>
      <rect x="9" y="6" width="14" height="3" fill="#8b1a3a"/>
      <rect x="10" y="9" width="12" height="2" fill="#8b1a3a"/>
      <rect x="10" y="11" width="12" height="5" fill="#f0d0a0"/>
      <rect x="11" y="11" width="2" height="2" fill="#e50914"/>
      <rect x="19" y="11" width="2" height="2" fill="#e50914"/>
      <rect x="12" y="14" width="8" height="1" fill="#e50914"/>
      <rect x="11" y="15" width="2" height="2" fill="#f0d0a0"/>
      <rect x="19" y="15" width="2" height="2" fill="#f0d0a0"/>
      <rect x="7" y="16" width="18" height="6" fill="#8b1a3a"/>
      <rect x="12" y="18" width="8" height="2" fill="#e50914"/>
      <rect x="5" y="22" width="22" height="6" fill="#1a1a2e"/>
      <rect x="10" y="22" width="3" height="4" fill="#8b1a3a"/>
      <rect x="19" y="22" width="3" height="4" fill="#8b1a3a"/>
      <rect x="8" y="28" width="6" height="3" fill="#0a0a1e"/>
      <rect x="18" y="28" width="6" height="3" fill="#0a0a1e"/>
      <rect x="3" y="10" width="4" height="3" fill="#8b1a3a"/>
      <rect x="25" y="10" width="4" height="3" fill="#8b1a3a"/>
    </svg>`
  },
  {
    id: 'assassin',
    name: 'Shadow Assassin',
    tier: 'nobility',
    category: 'buyable',
    cost: 3000,
    unlockCondition: 'purchase',
    rarity: 'rare',
    description: 'A silent blade in the night. Strikes without warning, vanishes without trace.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="9" y="4" width="14" height="5" fill="#1a1a2e"/>
      <rect x="8" y="9" width="16" height="2" fill="#1a1a2e"/>
      <rect x="10" y="11" width="12" height="5" fill="#2a2a3e"/>
      <rect x="12" y="12" width="3" height="1" fill="#ff0040"/>
      <rect x="17" y="12" width="3" height="1" fill="#ff0040"/>
      <rect x="13" y="14" width="6" height="1" fill="#1a1a2e"/>
      <rect x="8" y="16" width="16" height="6" fill="#0a0a1e"/>
      <rect x="12" y="18" width="8" height="1" fill="#ff0040"/>
      <rect x="6" y="22" width="20" height="6" fill="#1a1a2e"/>
      <rect x="10" y="22" width="3" height="4" fill="#0a0a1e"/>
      <rect x="19" y="22" width="3" height="4" fill="#0a0a1e"/>
      <rect x="8" y="28" width="6" height="3" fill="#000"/>
      <rect x="18" y="28" width="6" height="3" fill="#000"/>
      <rect x="2" y="12" width="3" height="10" fill="#4a4a6e"/>
      <rect x="27" y="12" width="3" height="10" fill="#4a4a6e"/>
      <rect x="1" y="10" width="2" height="2" fill="#ff0040"/>
    </svg>`
  },
  {
    id: 'major',
    name: 'Battle Major',
    tier: 'nobility',
    category: 'buyable',
    cost: 6000,
    unlockCondition: 'purchase',
    rarity: 'rare',
    description: 'A decorated officer who has seen countless battles. Commands respect.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="10" y="3" width="12" height="2" fill="#c0a040"/>
      <rect x="9" y="5" width="14" height="3" fill="#3a4d2a"/>
      <rect x="10" y="8" width="12" height="2" fill="#3a4d2a"/>
      <rect x="10" y="10" width="12" height="5" fill="#d4b890"/>
      <rect x="12" y="11" width="2" height="2" fill="#2a3a1a"/>
      <rect x="18" y="11" width="2" height="2" fill="#2a3a1a"/>
      <rect x="13" y="14" width="6" height="1" fill="#5a4a2a"/>
      <rect x="14" y="12" width="4" height="1" fill="#c0a040"/>
      <rect x="8" y="15" width="16" height="7" fill="#2a3a1a"/>
      <rect x="12" y="17" width="8" height="2" fill="#c0a040"/>
      <rect x="13" y="17" width="1" height="2" fill="#e50914"/>
      <rect x="18" y="17" width="1" height="2" fill="#e50914"/>
      <rect x="6" y="22" width="20" height="6" fill="#1a2a0a"/>
      <rect x="10" y="22" width="3" height="4" fill="#2a3a1a"/>
      <rect x="19" y="22" width="3" height="4" fill="#2a3a1a"/>
      <rect x="8" y="28" width="6" height="3" fill="#0a1a00"/>
      <rect x="18" y="28" width="6" height="3" fill="#0a1a00"/>
      <rect x="5" y="17" width="3" height="6" fill="#c0a040"/>
      <rect x="24" y="17" width="3" height="6" fill="#c0a040"/>
    </svg>`
  },

  // === ROYALTY (Streak Unlocks — Non-purchasable) ===
  {
    id: 'prince',
    name: 'Crown Prince',
    tier: 'royalty',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_25',
    rarity: 'epic',
    description: 'Royalty earned through 25 weeks of dedication. The crown is yours.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="10" y="2" width="2" height="3" fill="#c0a040"/>
      <rect x="15" y="2" width="2" height="3" fill="#c0a040"/>
      <rect x="20" y="2" width="2" height="3" fill="#c0a040"/>
      <rect x="9" y="5" width="14" height="3" fill="#ffd700"/>
      <rect x="11" y="5" width="1" height="3" fill="#1a1a2e"/>
      <rect x="16" y="5" width="1" height="3" fill="#1a1a2e"/>
      <rect x="21" y="5" width="1" height="3" fill="#1a1a2e"/>
      <rect x="9" y="8" width="14" height="2" fill="#c0a040"/>
      <rect x="10" y="10" width="12" height="5" fill="#f0d0a0"/>
      <rect x="12" y="11" width="2" height="2" fill="#1a3a5a"/>
      <rect x="18" y="11" width="2" height="2" fill="#1a3a5a"/>
      <rect x="13" y="14" width="6" height="1" fill="#8b4513"/>
      <rect x="8" y="15" width="16" height="7" fill="#1a3a5a"/>
      <rect x="12" y="17" width="8" height="2" fill="#ffd700"/>
      <rect x="14" y="17" width="1" height="2" fill="#e50914"/>
      <rect x="17" y="17" width="1" height="2" fill="#e50914"/>
      <rect x="6" y="22" width="20" height="6" fill="#0a1a3a"/>
      <rect x="10" y="22" width="3" height="4" fill="#1a3a5a"/>
      <rect x="19" y="22" width="3" height="4" fill="#1a3a5a"/>
      <rect x="8" y="28" width="6" height="3" fill="#000510"/>
      <rect x="18" y="28" width="6" height="3" fill="#000510"/>
    </svg>`
  },
  {
    id: 'princess',
    name: 'Crystal Princess',
    tier: 'royalty',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_25',
    rarity: 'epic',
    description: 'Royalty earned through 25 weeks of dedication. The crystal crown is yours.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="11" y="2" width="2" height="3" fill="#ff69b4"/>
      <rect x="15" y="2" width="2" height="3" fill="#ff69b4"/>
      <rect x="19" y="2" width="2" height="3" fill="#ff69b4"/>
      <rect x="9" y="5" width="14" height="3" fill="#e04080"/>
      <rect x="11" y="5" width="1" height="3" fill="#fff"/>
      <rect x="16" y="5" width="1" height="3" fill="#fff"/>
      <rect x="21" y="5" width="1" height="3" fill="#fff"/>
      <rect x="9" y="8" width="14" height="2" fill="#ff69b4"/>
      <rect x="10" y="10" width="12" height="5" fill="#f0d0d0"/>
      <rect x="12" y="11" width="2" height="2" fill="#5a1a3a"/>
      <rect x="18" y="11" width="2" height="2" fill="#5a1a3a"/>
      <rect x="13" y="14" width="6" height="1" fill="#d44080"/>
      <rect x="8" y="15" width="16" height="7" fill="#9b1b5a"/>
      <rect x="12" y="17" width="8" height="2" fill="#ff69b4"/>
      <rect x="14" y="17" width="1" height="2" fill="#fff"/>
      <rect x="17" y="17" width="1" height="2" fill="#fff"/>
      <rect x="6" y="22" width="20" height="6" fill="#3a0a2a"/>
      <rect x="10" y="22" width="3" height="4" fill="#9b1b5a"/>
      <rect x="19" y="22" width="3" height="4" fill="#9b1b5a"/>
      <rect x="8" y="28" width="6" height="3" fill="#1a0510"/>
      <rect x="18" y="28" width="6" height="3" fill="#1a0510"/>
    </svg>`
  },
  {
    id: 'king',
    name: 'Sovereign King',
    tier: 'royalty',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_50',
    rarity: 'legendary',
    description: 'The ultimate ruler. 50 weeks of unwavering dedication. The throne belongs to you.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="9" y="1" width="2" height="4" fill="#ffd700"/>
      <rect x="15" y="1" width="2" height="4" fill="#ffd700"/>
      <rect x="21" y="1" width="2" height="4" fill="#ffd700"/>
      <rect x="8" y="5" width="16" height="3" fill="#ffd700"/>
      <rect x="10" y="5" width="1" height="3" fill="#e50914"/>
      <rect x="15" y="5" width="2" height="3" fill="#e50914"/>
      <rect x="21" y="5" width="1" height="3" fill="#e50914"/>
      <rect x="8" y="8" width="16" height="2" fill="#c0a040"/>
      <rect x="10" y="10" width="12" height="5" fill="#f0d0a0"/>
      <rect x="12" y="11" width="2" height="2" fill="#1a1a2e"/>
      <rect x="18" y="11" width="2" height="2" fill="#1a1a2e"/>
      <rect x="13" y="14" width="6" height="1" fill="#8b4513"/>
      <rect x="14" y="12" width="4" height="1" fill="#ffd700"/>
      <rect x="8" y="15" width="16" height="7" fill="#2a1a4a"/>
      <rect x="12" y="17" width="8" height="2" fill="#ffd700"/>
      <rect x="13" y="17" width="2" height="2" fill="#e50914"/>
      <rect x="17" y="17" width="2" height="2" fill="#e50914"/>
      <rect x="6" y="22" width="20" height="6" fill="#1a0a3a"/>
      <rect x="10" y="22" width="3" height="4" fill="#2a1a4a"/>
      <rect x="19" y="22" width="3" height="4" fill="#2a1a4a"/>
      <rect x="8" y="28" width="6" height="3" fill="#0a0010"/>
      <rect x="18" y="28" width="6" height="3" fill="#0a0010"/>
      <rect x="4" y="15" width="3" height="8" fill="#ffd700"/>
      <rect x="25" y="15" width="3" height="8" fill="#ffd700"/>
    </svg>`
  },
  {
    id: 'queen',
    name: 'Eternal Queen',
    tier: 'royalty',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_50',
    rarity: 'legendary',
    description: 'The ultimate sovereign. 50 weeks of unwavering dedication. The realm bows to you.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="10" y="1" width="3" height="3" fill="#ff69b4"/>
      <rect x="14" y="1" width="4" height="3" fill="#ffd700"/>
      <rect x="19" y="1" width="3" height="3" fill="#ff69b4"/>
      <rect x="8" y="4" width="16" height="4" fill="#ffd700"/>
      <rect x="10" y="4" width="1" height="4" fill="#ff69b4"/>
      <rect x="15" y="4" width="2" height="4" fill="#e50914"/>
      <rect x="21" y="4" width="1" height="4" fill="#ff69b4"/>
      <rect x="8" y="8" width="16" height="2" fill="#c04080"/>
      <rect x="10" y="10" width="12" height="5" fill="#f0d0d0"/>
      <rect x="12" y="11" width="2" height="2" fill="#3a1a4a"/>
      <rect x="18" y="11" width="2" height="2" fill="#3a1a4a"/>
      <rect x="13" y="14" width="6" height="1" fill="#d44080"/>
      <rect x="14" y="12" width="4" height="1" fill="#ffd700"/>
      <rect x="8" y="15" width="16" height="7" fill="#5a1a4a"/>
      <rect x="12" y="17" width="8" height="2" fill="#ffd700"/>
      <rect x="13" y="17" width="2" height="2" fill="#ff69b4"/>
      <rect x="17" y="17" width="2" height="2" fill="#ff69b4"/>
      <rect x="6" y="22" width="20" height="6" fill="#2a0a3a"/>
      <rect x="10" y="22" width="3" height="4" fill="#5a1a4a"/>
      <rect x="19" y="22" width="3" height="4" fill="#5a1a4a"/>
      <rect x="8" y="28" width="6" height="3" fill="#150520"/>
      <rect x="18" y="28" width="6" height="3" fill="#150520"/>
    </svg>`
  },

  // === DRAGONS (Linked to Nobility Tiers) ===
  {
    id: 'wind_dragon',
    name: 'Wind Dragon',
    tier: 'dragon',
    category: 'buyable',
    cost: 2000,
    unlockCondition: 'purchase',
    rarity: 'rare',
    linkedNobility: 'joker',
    description: 'A swift dragon that rides the gales. Pairs with the Trickster Joker.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="4" y="12" width="6" height="3" fill="#a0e0d0"/>
      <rect x="3" y="15" width="8" height="3" fill="#80c0b0"/>
      <rect x="4" y="18" width="6" height="2" fill="#a0e0d0"/>
      <rect x="10" y="8" width="10" height="3" fill="#80c0b0"/>
      <rect x="10" y="11" width="14" height="5" fill="#a0e0d0"/>
      <rect x="12" y="12" width="2" height="2" fill="#1a4a3a"/>
      <rect x="16" y="12" width="2" height="2" fill="#1a4a3a"/>
      <rect x="20" y="11" width="4" height="3" fill="#80c0b0"/>
      <rect x="22" y="10" width="3" height="2" fill="#a0e0d0"/>
      <rect x="24" y="9" width="2" height="3" fill="#80c0b0"/>
      <rect x="10" y="16" width="12" height="4" fill="#80c0b0"/>
      <rect x="12" y="20" width="3" height="4" fill="#a0e0d0"/>
      <rect x="17" y="20" width="3" height="4" fill="#a0e0d0"/>
      <rect x="22" y="16" width="4" height="6" fill="#a0e0d0"/>
      <rect x="26" y="14" width="3" height="8" fill="#80c0b0"/>
      <rect x="28" y="12" width="2" height="6" fill="#a0e0d0"/>
      <rect x="6" y="10" width="2" height="2" fill="#fff"/>
      <rect x="14" y="16" width="1" height="2" fill="#1a4a3a"/>
    </svg>`
  },
  {
    id: 'shadow_dragon',
    name: 'Shadow Dragon',
    tier: 'dragon',
    category: 'buyable',
    cost: 4000,
    unlockCondition: 'purchase',
    rarity: 'rare',
    linkedNobility: 'assassin',
    description: 'A dragon born from darkness itself. Pairs with the Shadow Assassin.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="4" y="12" width="6" height="3" fill="#2a2a4e"/>
      <rect x="3" y="15" width="8" height="3" fill="#1a1a2e"/>
      <rect x="4" y="18" width="6" height="2" fill="#2a2a4e"/>
      <rect x="10" y="8" width="10" height="3" fill="#1a1a2e"/>
      <rect x="10" y="11" width="14" height="5" fill="#2a2a4e"/>
      <rect x="12" y="12" width="2" height="2" fill="#ff0040"/>
      <rect x="16" y="12" width="2" height="2" fill="#ff0040"/>
      <rect x="20" y="11" width="4" height="3" fill="#1a1a2e"/>
      <rect x="22" y="10" width="3" height="2" fill="#2a2a4e"/>
      <rect x="24" y="9" width="2" height="3" fill="#1a1a2e"/>
      <rect x="10" y="16" width="12" height="4" fill="#1a1a2e"/>
      <rect x="12" y="20" width="3" height="4" fill="#2a2a4e"/>
      <rect x="17" y="20" width="3" height="4" fill="#2a2a4e"/>
      <rect x="22" y="16" width="4" height="6" fill="#2a2a4e"/>
      <rect x="26" y="14" width="3" height="8" fill="#1a1a2e"/>
      <rect x="28" y="12" width="2" height="6" fill="#2a2a4e"/>
      <rect x="6" y="10" width="2" height="2" fill="#4a4a6e"/>
      <rect x="14" y="16" width="1" height="2" fill="#ff0040"/>
      <rect x="19" y="16" width="1" height="2" fill="#ff0040"/>
    </svg>`
  },
  {
    id: 'storm_dragon',
    name: 'Storm Dragon',
    tier: 'dragon',
    category: 'buyable',
    cost: 8000,
    unlockCondition: 'purchase',
    rarity: 'epic',
    linkedNobility: 'major',
    description: 'A dragon crackling with lightning. Pairs with the Battle Major.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="4" y="12" width="6" height="3" fill="#4a4a8e"/>
      <rect x="3" y="15" width="8" height="3" fill="#2a2a6e"/>
      <rect x="4" y="18" width="6" height="2" fill="#4a4a8e"/>
      <rect x="10" y="8" width="10" height="3" fill="#2a2a6e"/>
      <rect x="10" y="11" width="14" height="5" fill="#4a4a8e"/>
      <rect x="12" y="12" width="2" height="2" fill="#ffff00"/>
      <rect x="16" y="12" width="2" height="2" fill="#ffff00"/>
      <rect x="20" y="11" width="4" height="3" fill="#2a2a6e"/>
      <rect x="22" y="10" width="3" height="2" fill="#4a4a8e"/>
      <rect x="24" y="9" width="2" height="3" fill="#2a2a6e"/>
      <rect x="10" y="16" width="12" height="4" fill="#2a2a6e"/>
      <rect x="12" y="20" width="3" height="4" fill="#4a4a8e"/>
      <rect x="17" y="20" width="3" height="4" fill="#4a4a8e"/>
      <rect x="22" y="16" width="4" height="6" fill="#4a4a8e"/>
      <rect x="26" y="14" width="3" height="8" fill="#2a2a6e"/>
      <rect x="28" y="12" width="2" height="6" fill="#4a4a8e"/>
      <rect x="6" y="10" width="2" height="2" fill="#ffff00"/>
      <rect x="14" y="16" width="1" height="3" fill="#ffff00"/>
      <rect x="19" y="16" width="1" height="3" fill="#ffff00"/>
      <rect x="5" y="22" width="2" height="4" fill="#ffff00"/>
      <rect x="25" y="22" width="2" height="4" fill="#ffff00"/>
    </svg>`
  },
  {
    id: 'royal_dragon',
    name: 'Royal Dragon',
    tier: 'dragon',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_25',
    rarity: 'epic',
    linkedNobility: 'prince',
    description: 'A noble dragon with golden scales. Earned alongside royalty at 25 weeks.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="4" y="12" width="6" height="3" fill="#c0a040"/>
      <rect x="3" y="15" width="8" height="3" fill="#ffd700"/>
      <rect x="4" y="18" width="6" height="2" fill="#c0a040"/>
      <rect x="10" y="8" width="10" height="3" fill="#ffd700"/>
      <rect x="10" y="11" width="14" height="5" fill="#c0a040"/>
      <rect x="12" y="12" width="2" height="2" fill="#1a3a5a"/>
      <rect x="16" y="12" width="2" height="2" fill="#1a3a5a"/>
      <rect x="20" y="11" width="4" height="3" fill="#ffd700"/>
      <rect x="22" y="10" width="3" height="2" fill="#c0a040"/>
      <rect x="24" y="9" width="2" height="3" fill="#ffd700"/>
      <rect x="10" y="16" width="12" height="4" fill="#ffd700"/>
      <rect x="12" y="20" width="3" height="4" fill="#c0a040"/>
      <rect x="17" y="20" width="3" height="4" fill="#c0a040"/>
      <rect x="22" y="16" width="4" height="6" fill="#c0a040"/>
      <rect x="26" y="14" width="3" height="8" fill="#ffd700"/>
      <rect x="28" y="12" width="2" height="6" fill="#c0a040"/>
      <rect x="6" y="10" width="2" height="2" fill="#fff"/>
      <rect x="14" y="16" width="1" height="2" fill="#e50914"/>
      <rect x="19" y="16" width="1" height="2" fill="#e50914"/>
    </svg>`
  },
  {
    id: 'celestial_dragon',
    name: 'Celestial Dragon',
    tier: 'dragon',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_50',
    rarity: 'legendary',
    linkedNobility: 'king',
    description: 'A dragon of the cosmos, shimmering with starlight. The ultimate companion at 50 weeks.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="4" y="12" width="6" height="3" fill="#4a8aff"/>
      <rect x="3" y="15" width="8" height="3" fill="#2a6aff"/>
      <rect x="4" y="18" width="6" height="2" fill="#4a8aff"/>
      <rect x="10" y="8" width="10" height="3" fill="#2a6aff"/>
      <rect x="10" y="11" width="14" height="5" fill="#4a8aff"/>
      <rect x="12" y="12" width="2" height="2" fill="#ffff80"/>
      <rect x="16" y="12" width="2" height="2" fill="#ffff80"/>
      <rect x="20" y="11" width="4" height="3" fill="#2a6aff"/>
      <rect x="22" y="10" width="3" height="2" fill="#4a8aff"/>
      <rect x="24" y="9" width="2" height="3" fill="#2a6aff"/>
      <rect x="10" y="16" width="12" height="4" fill="#2a6aff"/>
      <rect x="12" y="20" width="3" height="4" fill="#4a8aff"/>
      <rect x="17" y="20" width="3" height="4" fill="#4a8aff"/>
      <rect x="22" y="16" width="4" height="6" fill="#4a8aff"/>
      <rect x="26" y="14" width="3" height="8" fill="#2a6aff"/>
      <rect x="28" y="12" width="2" height="6" fill="#4a8aff"/>
      <rect x="6" y="10" width="2" height="2" fill="#fff"/>
      <rect x="14" y="16" width="1" height="2" fill="#ffd700"/>
      <rect x="19" y="16" width="1" height="2" fill="#ffd700"/>
      <rect x="5" y="22" width="1" height="1" fill="#fff"/>
      <rect x="26" y="22" width="1" height="1" fill="#fff"/>
      <rect x="13" y="7" width="1" height="1" fill="#fff"/>
      <rect x="22" y="7" width="1" height="1" fill="#fff"/>
    </svg>`
  },
  {
    id: 'fire_dragon',
    name: 'Fire Dragon',
    tier: 'dragon',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_50',
    rarity: 'legendary',
    linkedNobility: 'queen',
    description: 'A dragon wreathed in eternal flame. Burns brightest at 50 weeks of dedication.',
    svg: `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect x="4" y="12" width="6" height="3" fill="#ff4020"/>
      <rect x="3" y="15" width="8" height="3" fill="#e50914"/>
      <rect x="4" y="18" width="6" height="2" fill="#ff4020"/>
      <rect x="10" y="8" width="10" height="3" fill="#e50914"/>
      <rect x="10" y="11" width="14" height="5" fill="#ff4020"/>
      <rect x="12" y="12" width="2" height="2" fill="#ffff00"/>
      <rect x="16" y="12" width="2" height="2" fill="#ffff00"/>
      <rect x="20" y="11" width="4" height="3" fill="#e50914"/>
      <rect x="22" y="10" width="3" height="2" fill="#ff4020"/>
      <rect x="24" y="9" width="2" height="3" fill="#e50914"/>
      <rect x="10" y="16" width="12" height="4" fill="#e50914"/>
      <rect x="12" y="20" width="3" height="4" fill="#ff4020"/>
      <rect x="17" y="20" width="3" height="4" fill="#ff4020"/>
      <rect x="22" y="16" width="4" height="6" fill="#ff4020"/>
      <rect x="26" y="14" width="3" height="8" fill="#e50914"/>
      <rect x="28" y="12" width="2" height="6" fill="#ff4020"/>
      <rect x="6" y="10" width="2" height="2" fill="#ffff00"/>
      <rect x="14" y="16" width="1" height="2" fill="#ffff00"/>
      <rect x="19" y="16" width="1" height="2" fill="#ffff00"/>
      <rect x="5" y="22" width="2" height="3" fill="#ff8040"/>
      <rect x="25" y="22" width="2" height="3" fill="#ff8040"/>
      <rect x="12" y="6" width="2" height="2" fill="#ff8040"/>
      <rect x="18" y="6" width="2" height="2" fill="#ff8040"/>
    </svg>`
  }
];

const BANNERS = [
  // === PROFILE BANNERS (Tied to Nobility Tiers) ===
  {
    id: 'bronze_cloth',
    name: 'Bronze Cloth',
    tier: 'profile',
    category: 'default',
    cost: 0,
    unlockCondition: 'default',
    rarity: 'common',
    description: 'A simple bronze banner. The starting banner for all PixelPulse users.',
    linkedTier: 'peasant',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#3a2a1a"/>
      <rect x="0" y="0" width="64" height="2" fill="#5a4a3a"/>
      <rect x="0" y="14" width="64" height="2" fill="#2a1a0a"/>
      <rect x="4" y="4" width="8" height="8" fill="#8b6a3a" opacity="0.6"/>
      <rect x="52" y="4" width="8" height="8" fill="#8b6a3a" opacity="0.6"/>
      <rect x="28" y="6" width="8" height="4" fill="#8b6a3a" opacity="0.4"/>
    </svg>`
  },
  {
    id: 'emerald_silk',
    name: 'Emerald Silk',
    tier: 'profile',
    category: 'buyable',
    cost: 2000,
    unlockCondition: 'purchase',
    rarity: 'uncommon',
    description: 'A rich emerald banner. Worn by those who have proven their worth.',
    linkedTier: 'assassin',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#1a4a2a"/>
      <rect x="0" y="0" width="64" height="2" fill="#2a6a4a"/>
      <rect x="0" y="14" width="64" height="2" fill="#0a3a1a"/>
      <rect x="4" y="4" width="8" height="8" fill="#2a8a5a" opacity="0.5"/>
      <rect x="52" y="4" width="8" height="8" fill="#2a8a5a" opacity="0.5"/>
      <rect x="28" y="4" width="8" height="8" fill="#2a8a5a" opacity="0.3"/>
      <rect x="30" y="6" width="4" height="4" fill="#4ac080" opacity="0.4"/>
    </svg>`
  },
  {
    id: 'sapphire_crest',
    name: 'Sapphire Crest',
    tier: 'profile',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_25',
    rarity: 'epic',
    description: 'A royal sapphire banner. Earned at 25 weeks of dedication.',
    linkedTier: 'prince',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#1a2a6a"/>
      <rect x="0" y="0" width="64" height="2" fill="#3a5aaa"/>
      <rect x="0" y="14" width="64" height="2" fill="#0a1a4a"/>
      <rect x="4" y="3" width="10" height="10" fill="#3a6add" opacity="0.5"/>
      <rect x="50" y="3" width="10" height="10" fill="#3a6add" opacity="0.5"/>
      <rect x="26" y="3" width="12" height="10" fill="#3a6add" opacity="0.3"/>
      <rect x="29" y="5" width="6" height="6" fill="#6aa0ff" opacity="0.5"/>
      <rect x="30" y="6" width="4" height="4" fill="#aac0ff" opacity="0.3"/>
    </svg>`
  },
  {
    id: 'golden_tapestry',
    name: 'Golden Tapestry',
    tier: 'profile',
    category: 'streak',
    cost: 0,
    unlockCondition: 'streak_50',
    rarity: 'legendary',
    description: 'The ultimate golden banner. Only the most dedicated earn this at 50 weeks.',
    linkedTier: 'king',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#8b6914"/>
      <rect x="0" y="0" width="64" height="2" fill="#ffd700"/>
      <rect x="0" y="14" width="64" height="2" fill="#5a4509"/>
      <rect x="4" y="3" width="10" height="10" fill="#c0a040" opacity="0.6"/>
      <rect x="50" y="3" width="10" height="10" fill="#c0a040" opacity="0.6"/>
      <rect x="26" y="3" width="12" height="10" fill="#ffd700" opacity="0.4"/>
      <rect x="29" y="5" width="6" height="6" fill="#ffe040" opacity="0.5"/>
      <rect x="30" y="6" width="4" height="4" fill="#ffff80" opacity="0.3"/>
      <rect x="0" y="7" width="64" height="1" fill="#ffd700" opacity="0.3"/>
    </svg>`
  },

  // === BUYABLE BANNERS (Dragon-themed) ===
  {
    id: 'fire_banner',
    name: 'Fire Banner',
    tier: 'achievement',
    category: 'buyable',
    cost: 5000,
    unlockCondition: 'purchase',
    rarity: 'epic',
    description: 'A blazing banner themed around the Fire Dragon.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#2a0a0a"/>
      <rect x="0" y="0" width="64" height="2" fill="#ff4020"/>
      <rect x="0" y="14" width="64" height="2" fill="#1a0500"/>
      <rect x="8" y="4" width="4" height="8" fill="#e50914" opacity="0.5"/>
      <rect x="52" y="4" width="4" height="8" fill="#e50914" opacity="0.5"/>
      <rect x="28" y="3" width="8" height="10" fill="#ff4020" opacity="0.4"/>
      <rect x="30" y="5" width="4" height="6" fill="#ff8040" opacity="0.5"/>
      <rect x="31" y="6" width="2" height="4" fill="#ffff00" opacity="0.3"/>
    </svg>`
  },
  {
    id: 'shadow_banner',
    name: 'Shadow Banner',
    tier: 'achievement',
    category: 'buyable',
    cost: 5000,
    unlockCondition: 'purchase',
    rarity: 'epic',
    description: 'A dark banner themed around the Shadow Dragon.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#0a0a1e"/>
      <rect x="0" y="0" width="64" height="2" fill="#2a2a4e"/>
      <rect x="0" y="14" width="64" height="2" fill="#000"/>
      <rect x="8" y="4" width="4" height="8" fill="#1a1a2e" opacity="0.6"/>
      <rect x="52" y="4" width="4" height="8" fill="#1a1a2e" opacity="0.6"/>
      <rect x="28" y="3" width="8" height="10" fill="#2a2a4e" opacity="0.5"/>
      <rect x="30" y="5" width="4" height="6" fill="#4a4a6e" opacity="0.4"/>
      <rect x="31" y="6" width="2" height="4" fill="#ff0040" opacity="0.3"/>
    </svg>`
  },
  {
    id: 'storm_banner',
    name: 'Storm Banner',
    tier: 'achievement',
    category: 'buyable',
    cost: 5000,
    unlockCondition: 'purchase',
    rarity: 'epic',
    description: 'An electric banner themed around the Storm Dragon.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#0a0a2e"/>
      <rect x="0" y="0" width="64" height="2" fill="#4a4a8e"/>
      <rect x="0" y="14" width="64" height="2" fill="#000510"/>
      <rect x="8" y="4" width="4" height="8" fill="#2a2a6e" opacity="0.5"/>
      <rect x="52" y="4" width="4" height="8" fill="#2a2a6e" opacity="0.5"/>
      <rect x="28" y="3" width="8" height="10" fill="#4a4a8e" opacity="0.4"/>
      <rect x="30" y="5" width="4" height="6" fill="#ffff00" opacity="0.3"/>
      <rect x="31" y="4" width="2" height="2" fill="#ffff80" opacity="0.5"/>
    </svg>`
  },
  {
    id: 'celestial_banner',
    name: 'Celestial Banner',
    tier: 'achievement',
    category: 'buyable',
    cost: 8000,
    unlockCondition: 'purchase',
    rarity: 'legendary',
    description: 'A cosmic banner themed around the Celestial Dragon.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#0a0a4a"/>
      <rect x="0" y="0" width="64" height="2" fill="#4a8aff"/>
      <rect x="0" y="14" width="64" height="2" fill="#02021a"/>
      <rect x="8" y="4" width="4" height="8" fill="#2a6aff" opacity="0.5"/>
      <rect x="52" y="4" width="4" height="8" fill="#2a6aff" opacity="0.5"/>
      <rect x="28" y="3" width="8" height="10" fill="#4a8aff" opacity="0.4"/>
      <rect x="30" y="5" width="4" height="6" fill="#aac0ff" opacity="0.5"/>
      <rect x="10" y="6" width="1" height="1" fill="#fff"/>
      <rect x="54" y="8" width="1" height="1" fill="#fff"/>
      <rect x="31" y="7" width="1" height="1" fill="#fff"/>
      <rect x="20" y="5" width="1" height="1" fill="#fff" opacity="0.5"/>
      <rect x="44" y="9" width="1" height="1" fill="#fff" opacity="0.5"/>
    </svg>`
  },
  {
    id: 'wind_banner',
    name: 'Wind Banner',
    tier: 'achievement',
    category: 'buyable',
    cost: 3000,
    unlockCondition: 'purchase',
    rarity: 'rare',
    description: 'A swift banner themed around the Wind Dragon.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#0a2a2a"/>
      <rect x="0" y="0" width="64" height="2" fill="#a0e0d0"/>
      <rect x="0" y="14" width="64" height="2" fill="#021a1a"/>
      <rect x="8" y="4" width="4" height="8" fill="#80c0b0" opacity="0.5"/>
      <rect x="52" y="4" width="4" height="8" fill="#80c0b0" opacity="0.5"/>
      <rect x="28" y="3" width="8" height="10" fill="#a0e0d0" opacity="0.4"/>
      <rect x="30" y="5" width="4" height="6" fill="#c0f0e0" opacity="0.3"/>
    </svg>`
  },

  // === ACHIEVEMENT BANNERS (Earned through contests/streaks) ===
  {
    id: 'sword_emblem',
    name: 'Sword Emblem',
    tier: 'achievement',
    category: 'earned',
    cost: 0,
    unlockCondition: 'clip_win_1',
    rarity: 'uncommon',
    description: 'Earned by winning your first weekly clip contest.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#1a1a2e"/>
      <rect x="0" y="0" width="64" height="1" fill="#3a3a5e"/>
      <rect x="0" y="15" width="64" height="1" fill="#0a0a1e"/>
      <rect x="30" y="2" width="4" height="1" fill="#c0c0c0"/>
      <rect x="31" y="3" width="2" height="8" fill="#c0c0c0"/>
      <rect x="29" y="11" width="6" height="1" fill="#8b4513"/>
      <rect x="30" y="12" width="4" height="2" fill="#c0a040"/>
    </svg>`
  },
  {
    id: 'crown_emblem',
    name: 'Crown Emblem',
    tier: 'achievement',
    category: 'earned',
    cost: 0,
    unlockCondition: 'streak_10',
    rarity: 'rare',
    description: 'Earned at 10 weeks of streak. The crown begins to glow.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#1a1a2e"/>
      <rect x="0" y="0" width="64" height="1" fill="#ffd700" opacity="0.5"/>
      <rect x="0" y="15" width="64" height="1" fill="#0a0a1e"/>
      <rect x="28" y="3" width="2" height="2" fill="#ffd700"/>
      <rect x="31" y="2" width="2" height="3" fill="#ffd700"/>
      <rect x="34" y="3" width="2" height="2" fill="#ffd700"/>
      <rect x="27" y="5" width="10" height="2" fill="#ffd700"/>
      <rect x="29" y="5" width="1" height="2" fill="#e50914"/>
      <rect x="32" y="5" width="2" height="2" fill="#e50914"/>
      <rect x="35" y="5" width="1" height="2" fill="#e50914"/>
      <rect x="27" y="7" width="10" height="4" fill="#c0a040"/>
    </svg>`
  },
  {
    id: 'dragon_emblem',
    name: 'Dragon Emblem',
    tier: 'achievement',
    category: 'earned',
    cost: 0,
    unlockCondition: 'streak_50',
    rarity: 'legendary',
    description: 'The legendary dragon emblem. Only earned at 50 weeks of dedication.',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#0a0a2e"/>
      <rect x="0" y="0" width="64" height="1" fill="#4a8aff" opacity="0.5"/>
      <rect x="0" y="15" width="64" height="1" fill="#02021a"/>
      <rect x="26" y="4" width="4" height="2" fill="#4a8aff"/>
      <rect x="30" y="3" width="4" height="3" fill="#2a6aff"/>
      <rect x="34" y="4" width="4" height="2" fill="#4a8aff"/>
      <rect x="28" y="6" width="8" height="4" fill="#4a8aff"/>
      <rect x="30" y="7" width="1" height="1" fill="#ffff80"/>
      <rect x="33" y="7" width="1" height="1" fill="#ffff80"/>
      <rect x="29" y="10" width="6" height="2" fill="#2a6aff"/>
      <rect x="20" y="6" width="1" height="1" fill="#fff" opacity="0.5"/>
      <rect x="44" y="8" width="1" height="1" fill="#fff" opacity="0.5"/>
    </svg>`
  },

  // === EVENT BANNERS (Seasonal/Limited) ===
  {
    id: 'esports_champion',
    name: 'Esports Champion',
    tier: 'event',
    category: 'event',
    cost: 0,
    unlockCondition: 'event_esports_2026',
    rarity: 'rare',
    description: 'Limited edition banner for the 2026 Esports Championship event.',
    expiresAt: '2026-12-31',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#0a1a0a"/>
      <rect x="0" y="0" width="64" height="2" fill="#4caf50"/>
      <rect x="0" y="14" width="64" height="2" fill="#021a02"/>
      <rect x="28" y="3" width="8" height="10" fill="#4caf50" opacity="0.4"/>
      <rect x="30" y="5" width="4" height="6" fill="#8bc34a" opacity="0.5"/>
      <rect x="31" y="6" width="2" height="4" fill="#c8e6c9" opacity="0.3"/>
    </svg>`
  },
  {
    id: 'anime_collab',
    name: 'Anime Collab',
    tier: 'event',
    category: 'event',
    cost: 0,
    unlockCondition: 'event_anime_2026',
    rarity: 'rare',
    description: 'Limited edition banner for the Anime Collaboration event.',
    expiresAt: '2026-12-31',
    svg: `<svg viewBox="0 0 64 16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
      <rect width="64" height="16" fill="#2a0a2a"/>
      <rect x="0" y="0" width="64" height="2" fill="#e50914"/>
      <rect x="0" y="14" width="64" height="2" fill="#1a0210"/>
      <rect x="28" y="3" width="8" height="10" fill="#e50914" opacity="0.4"/>
      <rect x="30" y="5" width="4" height="6" fill="#ff4060" opacity="0.5"/>
      <rect x="31" y="6" width="2" height="4" fill="#ff80a0" opacity="0.3"/>
    </svg>`
  }
];

// Pixelation levels based on streak weeks
// 0 weeks = fully pixelated (blur 4px), 50+ weeks = full clarity (blur 0px)
function getPixelationLevel(weeklyStreak) {
  if (weeklyStreak >= 50) return 0;      // Full clarity
  if (weeklyStreak >= 40) return 1;      // Very slight blur
  if (weeklyStreak >= 30) return 2;      // Slight blur
  if (weeklyStreak >= 25) return 3;      // Minor blur
  if (weeklyStreak >= 20) return 4;      // Light pixelation
  if (weeklyStreak >= 15) return 5;      // Moderate pixelation
  if (weeklyStreak >= 10) return 6;      // Heavy pixelation
  if (weeklyStreak >= 5) return 7;       // Very heavy pixelation
  return 8;                               // Fully pixelated
}

function getBlurFromLevel(level) {
  const blurs = [0, 0.3, 0.5, 0.8, 1.2, 1.8, 2.5, 3.5, 5];
  return blurs[level] || 5;
}

function getPixelationCSS(level) {
  const blur = getBlurFromLevel(level);
  if (blur === 0) return '';
  return `filter: blur(${blur}px) contrast(0.8) saturate(0.7); image-rendering: pixelated;`;
}

// Check if user can unlock an avatar based on their stats
function canUnlockAvatar(avatar, userStats) {
  if (avatar.unlockCondition === 'default') return true;
  if (avatar.unlockCondition === 'purchase') return userStats.sitePoints >= avatar.cost;
  if (avatar.unlockCondition === 'streak_25') return userStats.weeklyStreak >= 25;
  if (avatar.unlockCondition === 'streak_50') return userStats.weeklyStreak >= 50;
  if (avatar.unlockCondition === 'streak_10') return userStats.weeklyStreak >= 10;
  if (avatar.unlockCondition === 'clip_win_1') return (userStats.clipWins || 0) >= 1;
  return false;
}

// Check if user can unlock a banner
function canUnlockBanner(banner, userStats) {
  if (banner.unlockCondition === 'default') return true;
  if (banner.unlockCondition === 'purchase') return userStats.sitePoints >= banner.cost;
  if (banner.unlockCondition === 'streak_25') return userStats.weeklyStreak >= 25;
  if (banner.unlockCondition === 'streak_50') return userStats.weeklyStreak >= 50;
  if (banner.unlockCondition === 'streak_10') return userStats.weeklyStreak >= 10;
  if (banner.unlockCondition === 'clip_win_1') return (userStats.clipWins || 0) >= 1;
  // Event banners — check if event is active
  if (banner.unlockCondition && banner.unlockCondition.startsWith('event_')) {
    if (banner.expiresAt) {
      return new Date(banner.expiresAt) > new Date();
    }
    return true;
  }
  return false;
}

module.exports = {
  AVATARS,
  BANNERS,
  getPixelationLevel,
  getBlurFromLevel,
  getPixelationCSS,
  canUnlockAvatar,
  canUnlockBanner
};
