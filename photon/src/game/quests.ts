export interface QuestTemplate {
  id: string;
  version: number;
  title: string;
  description: string;
  instructions: string;
  photoRequirement: string;
  retryHint: string;
  rubric: string[];
  xp: number;
  collectibleId: string;
  collectibleName: string;
  social: "solo" | "social";
  duration: string;
  difficulty: string;
  accessibility: string;
  origin: "template";
  replay: "once";
}

export interface PlaceOption {
  label: string;
  precision: "city" | "neighborhood" | "landmark" | "user";
  source: "demo" | "user";
}

export interface SelectedPlace extends PlaceOption {
  /** Typed places are not GPS. Coordinates stay unset unless a real place provider resolved them. */
  coordinates?: undefined;
}

const QUESTS: QuestTemplate[] = [
  {
    id: "hidden-detail",
    version: 1,
    title: "Hidden Detail",
    description: "Notice one public detail most people walk past.",
    instructions: "Find a small architectural or structural detail you can see from a public path.",
    photoRequirement: "One clear photo of that detail. No faces and no personal documents.",
    retryHint: "Step closer, or change the angle, so the detail fills more of the frame.",
    rubric: ["A specific architectural or structural detail is visible", "The detail is the subject of the photo"],
    xp: 60,
    collectibleId: "pin-hidden-detail",
    collectibleName: "Hidden Detail pin",
    social: "solo",
    duration: "15 minutes",
    difficulty: "easy",
    accessibility: "Any detail you can see from where you already are is enough. Do not cross a street just for the photo.",
    origin: "template",
    replay: "once",
  },
  {
    id: "nature-nearby",
    version: 1,
    title: "Nature Nearby",
    description: "Find a plant in a public green space.",
    instructions: "Look for a plant, tree, or patch of green in a public park, sidewalk planter, or square.",
    photoRequirement: "One photo of the plant. Leave it where it is, and do not include other people's faces.",
    retryHint: "Include enough of the leaves or trunk that the plant is obvious.",
    rubric: ["A plant or tree is visible", "The setting looks like a public outdoor place"],
    xp: 60,
    collectibleId: "pin-nature-nearby",
    collectibleName: "Nature Nearby pin",
    social: "solo",
    duration: "15 minutes",
    difficulty: "easy",
    accessibility: "A street tree or planter you can see without leaving the sidewalk counts.",
    origin: "template",
    replay: "once",
  },
  {
    id: "shared-perspective",
    version: 1,
    title: "Shared Perspective",
    description: "Notice the same public place from two viewpoints.",
    instructions:
      "If a friend wants to join, each of you picks one thing you notice. If you are on your own, pick two viewpoints yourself. This quest is complete either way.",
    photoRequirement: "One photo that shows the place and one thing you noticed. Only include another person if they agreed.",
    retryHint: "Show the place itself, not only a close-up that could be anywhere.",
    rubric: ["A public place is recognizable", "Something specific in that place is visible"],
    xp: 90,
    collectibleId: "pin-shared-perspective",
    collectibleName: "Shared Perspective pin",
    social: "social",
    duration: "20 minutes",
    difficulty: "medium",
    accessibility: "You can finish this alone. You never have to approach a stranger.",
    origin: "template",
    replay: "once",
  },
];

const AMBIGUOUS: Record<string, PlaceOption[]> = {
  springfield: [
    { label: "Springfield town square", precision: "neighborhood", source: "demo" },
    { label: "Springfield public library", precision: "landmark", source: "demo" },
  ],
};

export function listQuests(): QuestTemplate[] {
  return QUESTS;
}

export function getQuest(id: string, version = 1): QuestTemplate | undefined {
  return QUESTS.find((quest) => quest.id === id && quest.version === version);
}

export type PlaceResolution =
  | { kind: "empty" }
  | { kind: "ambiguous"; options: PlaceOption[] }
  | { kind: "selected"; place: SelectedPlace };

/**
 * A typed place is an exploration area, not measured GPS.
 * Known demo names can be ambiguous. Everything else is stored as the player's own words.
 */
export function resolvePlace(text: string): PlaceResolution {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return { kind: "empty" };
  const key = trimmed.toLocaleLowerCase();
  const ambiguous = AMBIGUOUS[key];
  if (ambiguous) return { kind: "ambiguous", options: ambiguous };
  return {
    kind: "selected",
    place: {
      label: trimmed,
      precision: "user",
      source: "user",
    },
  };
}

export function levelForXp(xp: number): number {
  return 1 + Math.floor(Math.max(0, xp) / 100);
}

export function xpUntilNextLevel(xp: number): number {
  const level = levelForXp(xp);
  return level * 100 - xp;
}
