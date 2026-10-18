/**
 * Translation-ready UI strings. Only English ships today – we don't claim other
 * languages until real translations exist. Generated quest content is kept
 * separate from these UI strings (it lives on the Quest objects).
 *
 * To add a language: copy `en`, translate values, register it in `catalogs`.
 */
const en = {
  appName: 'Thaw',
  tagline: 'The world gets warmer when you show up.',
  'tabs.explore': 'Explore',
  'tabs.party': 'Party',
  'tabs.collection': 'Collection',
  'tabs.leaderboard': 'Ranks',
  'tabs.profile': 'You',

  'onboard.title': 'Your city is a game board.',
  'onboard.body': 'Find quests at real public places, team up with other explorers, and collect a pin for every spot you discover.',
  'onboard.useLocation': 'Use my location',
  'onboard.locationNote': 'Approximate location only, while the app is open.',
  'onboard.sample': 'Explore a sample city',

  'explore.nearby': 'Nearby quests',
  'explore.loading': 'Warming up the map…',
  'explore.empty': 'No quests in range yet.',
  'explore.emptyHint': 'Try another region, or long-press the map to choose a public meeting spot.',
  'explore.sampleLocation': 'Sample location',
  'explore.simulated': 'Simulated position',
  'explore.gps': 'Your location',
  'explore.manual': 'Chosen spot',
  'explore.attribution': '© OpenStreetMap contributors',

  'quest.accept': 'Accept quest',
  'quest.continue': 'Continue quest',
  'quest.completed': 'Completed',
  'quest.playSolo': 'Play the solo version',
  'quest.needsParty': 'This quest needs a party of {min}–{max}.',
  'quest.findParty': 'Find a party',
  'quest.abandon': 'Drop quest',

  'active.checkIn': 'Check in here',
  'active.tooFar': 'You’re {distance} away. Get within {radius} to check in.',
  'active.simWalk': 'Simulate walking there (demo)',
  'active.addEvidence': 'Add photo evidence',

  'verify.title': 'Show what you found',
  'verify.camera': 'Take photo',
  'verify.library': 'Choose photo',
  'verify.retake': 'Retake',
  'verify.submit': 'Submit evidence',
  'verify.checking': 'Checking your evidence…',
  'verify.checkingLive': 'Asking Gemini to look at your photo.',
  'verify.checkingDemo': 'Running the simulated demo check.',
  'verify.demoNote': 'Demo mode: verification is simulated. Your photo stays on this device and is not analysed.',
  'verify.liveNote': 'Your photo is sent to Gemini for verification and isn’t stored by Thaw.',
  'verify.rejected': 'Not quite!',
  'verify.retry': 'Try again',

  'reward.title': 'Quest complete!',
  'reward.levelUp': 'Level up! You’re now level {level}.',
  'reward.newPin': 'New pin unlocked',
  'reward.collection': 'View collection',
  'reward.ranks': 'See rankings',
  'reward.done': 'Explore nearby',

  'party.title': 'Party',
  'party.create': 'Start a party',
  'party.leave': 'Leave party',
  'party.ready': 'I’m ready',
  'party.notReady': 'Not ready',
  'party.spots': '{n} spots left',
  'party.spot1': '1 spot left',
  'party.full': 'Party full',
  'party.chatPlaceholder': 'Say hi…',
  'party.send': 'Send',
  'party.nearby': 'Explorers around you',
  'party.demoLabel': 'Demo participant',
  'party.share': 'Share invite',
  'party.safety': 'Meet only in public places. Never share your address or contact details. You can leave any time.',

  'collection.title': 'Collection',
  'collection.locked': 'Locked',
  'collection.empty': 'Complete a quest to earn your first pin.',

  'ranks.title': 'Leaderboards',
  'ranks.local': 'Local demo rankings: your progress vs. demo explorers on this device. Not a global leaderboard.',
  'ranks.daily': 'Today',
  'ranks.allTime': 'All time',
  'ranks.quests': 'Quests',
  'ranks.landmarks': 'Places',

  'profile.level': 'Level {level}',
  'profile.streak': '{n}-day streak',
  'profile.reset': 'Reset demo',
  'profile.resetConfirm': 'This reloads Seattle and clears the saved map cache. Your score stays.',

  'demo.badge': 'Demo mode',
  'common.cancel': 'Cancel',
  'common.ok': 'OK',
  'common.retry': 'Retry',
} as const;

export type StringKey = keyof typeof en;
type Catalog = Record<StringKey, string>;

const catalogs: Record<string, Catalog> = { en };
let active: Catalog = en;

export function setLanguage(tag: string): void {
  const base = tag.split('-')[0] ?? 'en';
  active = catalogs[tag] ?? catalogs[base] ?? en;
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  const template = active[key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
