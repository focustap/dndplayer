export type CampaignRole = "OWNER" | "DM" | "PLAYER" | "SPECTATOR";
export type TokenType = "PLAYER" | "MONSTER" | "NPC";
export type GridType = "SQUARE" | "GRIDLESS";
export type OverlayKind = "PROP" | "EFFECT";
export type FogTool = "REVEAL_BRUSH" | "REVEAL_RECT" | "HIDE_BRUSH" | "HIDE_RECT";
export type AttackPreset = "MELEE" | "RANGED" | "SPELL";

export interface Campaign { id: string; name: string; joinCode: string; ownerId: string; role: CampaignRole; memberCount: number; updatedAt: string; }
export interface Scene { id: string; campaignId: string; mapId: string | null; name: string; mapUrl: string | null; width: number; height: number; gridType: GridType; gridSize: number; feetPerCell: number; gridColor: string; gridOpacity: number; fogEnabled: boolean; fogCovered: boolean; active: boolean; }
export interface SceneOverlay { id: string; sceneId: string; name: string; imageUrl: string; kind: OverlayKind; x: number; y: number; width: number; height: number; rotation: number; opacity: number; zIndex: number; visible: boolean; locked: boolean; }
export interface Token { id: string; sceneId: string; referenceId: string | null; ownerUserId: string | null; type: TokenType; displayName: string; imageUrl: string | null; imagePath?: string | null; x: number; y: number; size: number; rotation: number; visible: boolean; locked: boolean; conditions: string[]; }
export interface MonsterAction { name: string; description: string; attackBonus?: number; damageExpression?: string; damageType?: string; }
export interface AbilityScores { str: number; dex: number; con: number; int: number; wis: number; cha: number; }
export interface MonsterTemplate { id: string; campaignId: string; name: string; imageUrl: string | null; imagePath?: string | null; maxHp: number; ac: number; speed: number; abilities: AbilityScores; notes: string; traits: MonsterAction[]; actions: MonsterAction[]; bonusActions: MonsterAction[]; reactions: MonsterAction[]; }
export interface MonsterInstance { id: string; campaignId: string; templateId: string; customName: string; currentHp: number; maxHp: number; ac: number; conditions: string[]; visible: boolean; notes: string; dead: boolean; template?: MonsterTemplate; }
export interface Character { id: string; campaignId: string; ownerId: string; name: string; imageUrl: string | null; imagePath?: string | null; currentHp: number; maxHp: number; ac: number; speed: number; passivePerception: number; passiveInvestigation: number; passiveInsight: number; notes: string; conditions: string[]; }
export interface InitiativeEntry { id: string; combatSessionId: string; tokenId: string | null; monsterInstanceId: string | null; characterId: string | null; name: string; imageUrl: string | null; initiative: number; sortOrder: number; groupKey: string | null; groupCount: number; }
export interface CombatSession { id: string; campaignId: string; sceneId: string; active: boolean; round: number; currentIndex: number; entries: InitiativeEntry[]; }
export interface FogRegion { id: string; sceneId: string; mode: "REVEAL" | "HIDE"; shape: "RECT" | "BRUSH"; points: number[]; }
export interface Placement { kind: "CHARACTER" | "MONSTER"; referenceId: string; name: string; imageUrl: string | null; }
export interface AttackAnimationEvent { id: string; campaignId: string; attackerTokenId: string; targetTokenId: string; preset: AttackPreset; createdAt: string; }
export interface AttackSelection { attackerTokenId: string; preset: AttackPreset; }
export interface DiceRoll { id: string; campaignId: string; rollerUserId: string; rollerRole: CampaignRole; rollerDisplayName: string | null; sides: number; quantity: number; results: number[]; total: number; createdAt: string; }
export interface TabletopState { campaign: Campaign; role: CampaignRole; scene: Scene; overlays: SceneOverlay[]; tokens: Token[]; characters: Character[]; monsterTemplates: MonsterTemplate[]; monsterInstances: MonsterInstance[]; combat: CombatSession; fogRegions: FogRegion[]; diceRolls: DiceRoll[]; selectedTokenId: string | null; activeFogTool: FogTool | null; placement: Placement | null; attackSelection: AttackSelection | null; attackEvent: AttackAnimationEvent | null; previewPlayerView: boolean; shiftIntel: boolean; connected: boolean; }

export const CONDITION_OPTIONS = ["Poisoned","Prone","Restrained","Stunned","Blinded","Charmed","Frightened","Grappled","Incapacitated","Invisible"] as const;
export const isDmRole = (role: CampaignRole) => role === "OWNER" || role === "DM";
