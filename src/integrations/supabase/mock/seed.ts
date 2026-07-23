// Deterministic, sanitized, production-scale fixture data for the mock
// backend. Nothing here is real: names/photos/emails are synthesized from
// fixed word lists, photos are `picsum.photos` seeded placeholders, and
// emails are `@example.test` (a reserved, non-routable TLD per RFC 2606).
//
// Determinism: every random choice goes through the mulberry32 PRNG in
// prng.ts, seeded with a fixed constant, and is always drawn in the same
// order — so two runs produce identical row content (ids, names, relations,
// counts). Only absolute timestamps are anchored to the real "now" at seed
// time (so "expired 2 days ago" is still expired whenever you happen to run
// it); the *offsets* used to compute them are deterministic.
import { db } from './state';
import { seedAccount, makeUser } from './auth';
import { fillInsertDefaults } from './query';
import { mulberry32, randInt, randFloat, chance, pick, pickMany, shuffle, seededUuid, RNG } from './prng';

export const TEST_ACCOUNT_EMAIL = 'test@example.test';
export const TEST_ACCOUNT_PASSWORD = 'TestPass123!';
const TEST_USER_ID = '00000000-0000-4000-8000-000000000001';

const SEED = 20260720;

// ---------------------------------------------------------------------------
// fixed word lists (no real PII)
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Jamie', 'Avery', 'Quinn', 'Rowan',
  'Sasha', 'Drew', 'Skyler', 'Reese', 'Emerson', 'Dakota', 'Finley', 'Harper', 'Kendall', 'Peyton',
  'Blake', 'Cameron', 'Charlie', 'Eden', 'Frankie', 'Gray', 'Hayden', 'Indigo', 'Jules', 'Kai',
  'Lane', 'Micah', 'Noor', 'Oakley', 'Parker', 'Remy', 'Sage', 'Toby', 'Wren', 'Zion',
  'Amara', 'Bodhi', 'Carmen', 'Delphine', 'Elio', 'Farrah', 'Gideon', 'Hana', 'Ines', 'Jasper',
  'Kiran', 'Leilani', 'Mateo', 'Nadia', 'Oren', 'Priya', 'Quentin', 'Rafael', 'Soren', 'Talia',
  'Uma', 'Viggo', 'Willa', 'Xiomara', 'Yusuf', 'Zara', 'Ansel', 'Briar', 'Cleo', 'Dax',
  'Elowen', 'Fenn', 'Greer', 'Hollis', 'Ida', 'Jonas', 'Kestrel', 'Luca', 'Maren', 'Nico',
] as const;

const GENDERS = ['male', 'female', 'non_binary', 'prefer_not_to_say'] as const;

const INTERESTS = [
  'Sports', 'Music', 'Art', 'Technology', 'Travel', 'Food', 'Books', 'Movies',
  'Gaming', 'Fitness', 'Photography', 'Cooking', 'Dancing', 'Hiking', 'Yoga',
  'Business', 'Science', 'Fashion', 'Nature', 'Volunteering',
] as const;

const BUBBLE_EXTRA_TAGS = ['Coffee', 'Nightlife', 'Board Games', 'Running Club', 'Study Group', 'Foodies'];
const BUBBLE_NOUNS = ['Crew', 'Squad', 'Collective', 'Circle', 'Society', 'Club', 'Meetup', 'League'];

const CITIES = [
  { name: 'Fernbridge', lat: 40.7128, lng: -74.006 },
  { name: 'Bay Hollow', lat: 37.7749, lng: -122.4194 },
  { name: 'Cedar Flats', lat: 30.2672, lng: -97.7431 },
  { name: 'Highridge', lat: 39.7392, lng: -104.9903 },
  { name: 'Millbrook', lat: 51.5074, lng: -0.1278 },
];

const BIO_TEMPLATES = (name: string, i1: string, i2: string) => [
  `${name} here — into ${i1} and ${i2}. Always up for meeting new people nearby!`,
  `Big fan of ${i1}. Also dabble in ${i2} on weekends.`,
  `${i1} enthusiast, ${i2} hobbyist. Say hi if you're around!`,
  `Exploring the city one ${i1.toLowerCase()} spot at a time.`,
  `${i2} kept me sane this year. Let's talk ${i1} sometime.`,
];

const DM_LINES = [
  'Hey! How\'s it going?', 'Are you free this weekend?', 'That was such a fun bubble meetup 😄',
  'Did you see the new dead drop near the park?', 'lol yes exactly', 'omg no way',
  'Let\'s grab coffee sometime', 'On my way!', 'Running 10 mins late, sorry!', 'That show was amazing',
  'Check out this spot I found', 'Miss hanging out, we should link up', 'Happy birthday! 🎉',
  'Good luck today!', 'Thanks for the recommendation', 'Can\'t wait for the trip', 'lol same',
  'Sent you the photos', 'You around this evening?', 'That bubble is so much fun',
];

const BUBBLE_LINES = [
  'Anyone up for a meetup this week?', 'Just posted a new story, check it out!',
  'Who\'s coming to the event Saturday?', 'This bubble is the best 🙌', 'Welcome new members!',
  'Great turnout last time, let\'s do it again', 'Dropping a pin for the next hangout',
  'Anyone know a good spot nearby?', 'GM everyone ☀️', 'Lets keep the energy going!',
  'Reminder: meetup starts at 6pm', 'So glad I joined this bubble', 'Who else is nearby right now?',
];

const NOTIFICATION_TEMPLATES: { type: string; title: string; body: (n: string) => string }[] = [
  { type: 'friend_request', title: 'New friend request', body: (n) => `${n} sent you a friend request` },
  { type: 'bubble_join', title: 'New member joined!', body: (n) => `${n} joined your bubble` },
  { type: 'missed_call', title: 'Missed call', body: (n) => `From ${n} • audio` },
  { type: 'message', title: 'New message', body: (n) => `${n} sent you a message` },
  { type: 'bubble_message', title: 'New bubble message', body: (n) => `${n} posted in your bubble` },
];

const DEAD_DROP_TITLES = ['Hidden gem', 'Secret spot', 'Found this!', 'Check this out', 'Local tip', 'Photo op'];
const DEAD_DROP_TEXT = [
  'Best coffee in the area, tell them I sent you.', 'Amazing sunset view from here.',
  'Great street art around the corner.', 'Quiet bench, perfect for reading.',
  'This bakery is underrated.', 'Free parking spot most days.',
];

const BADGE_DEFS = [
  { name: 'Early Adopter', description: 'Joined during the early days', icon: '🌱' },
  { name: 'Social Butterfly', description: 'Made 10+ friends', icon: '🦋' },
  { name: 'Explorer', description: 'Visited 5+ bubbles', icon: '🧭' },
  { name: 'Night Owl', description: 'Active after midnight 10 times', icon: '🦉' },
  { name: 'Bubble Creator', description: 'Created a bubble', icon: '🫧' },
  { name: 'Streak Master', description: '30-day snap streak', icon: '🔥' },
  { name: 'Story Teller', description: 'Posted 20+ stories', icon: '📖' },
  { name: 'Dead Drop Hunter', description: 'Found 10+ dead drops', icon: '🗺️' },
  { name: 'Meetup Regular', description: 'RSVP\'d to 5+ meetups', icon: '🤝' },
  { name: 'Verified', description: 'Verified profile', icon: '✅' },
  { name: 'Trendsetter', description: 'Started a viral bubble', icon: '📈' },
  { name: 'Globe Trotter', description: 'Checked in from 3+ cities', icon: '🌍' },
];

const AR_PIN_NOTES = [
  'Cool mural over here!', 'Free wifi at this cafe', 'Watch out, uneven pavement',
  'Great photo spot', 'Live music tonight', 'Farmers market every Saturday',
];

const AVATAR_ICONS = ['🐱', '🐶', '🦊', '🐼', '🦁', '🐨', '🐸', '🦄', '🐙', '🦉'];
const AVATAR_COLORS = ['#F87171', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#38BDF8', '#FB923C'];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

let seeded = false;

export function seedMockBackend(): void {
  if (seeded) return;
  seeded = true;

  const rng: RNG = mulberry32(SEED);
  const NOW = Date.now();
  const hoursAgo = (h: number) => iso(NOW - h * 3600_000);
  const hoursFromNow = (h: number) => iso(NOW + h * 3600_000);
  const daysAgo = (d: number) => hoursAgo(d * 24);
  const daysFromNow = (d: number) => hoursFromNow(d * 24);

  const put = (table: string, row: Record<string, any>) => db.putRaw(table, fillInsertDefaults(table, row), { silent: true });

  // -- profiles --------------------------------------------------------------
  const PROFILE_COUNT = 300;
  const profiles: Record<string, any>[] = [];

  function makeProfile(id: string, opts: { firstName?: string } = {}): Record<string, any> {
    const city = pick(rng, CITIES);
    const firstName = opts.firstName ?? pick(rng, FIRST_NAMES);
    const myInterests = pickMany(rng, INTERESTS, randInt(rng, 2, 5));
    const ghost = chance(rng, 0.15);
    const hasReferralCode = chance(rng, 0.3);
    return {
      id,
      first_name: firstName,
      age: randInt(rng, 18, 45),
      bio: BIO_TEMPLATES(firstName, myInterests[0] ?? 'Music', myInterests[1] ?? 'Travel')[randInt(rng, 0, 4)],
      gender: pick(rng, GENDERS),
      ghost_mode: ghost,
      interests: myInterests,
      latitude: city.lat + randFloat(rng, -0.05, 0.05),
      longitude: city.lng + randFloat(rng, -0.05, 0.05),
      location_updated_at: hoursAgo(randInt(rng, 0, 48)),
      profile_photo_url: `https://picsum.photos/seed/profile-${id.slice(0, 8)}/200/200`,
      referral_code: hasReferralCode ? seededUuid(rng).slice(0, 8).toUpperCase() : null,
      created_at: daysAgo(randInt(rng, 5, 400)),
      updated_at: hoursAgo(randInt(rng, 0, 72)),
    };
  }

  // Test account profile — rich and fully populated, always discoverable.
  const testProfile = makeProfile(TEST_USER_ID, { firstName: 'Riley' });
  testProfile.bio = 'QA test account — fully populated so you can explore every screen right away. 🎉';
  testProfile.ghost_mode = false;
  testProfile.interests = ['Music', 'Hiking', 'Photography', 'Gaming'];
  testProfile.latitude = CITIES[0].lat + 0.01;
  testProfile.longitude = CITIES[0].lng + 0.01;
  testProfile.profile_photo_url = 'https://picsum.photos/seed/test-account/200/200';
  testProfile.referral_code = 'TESTQA01';
  profiles.push(testProfile);

  for (let i = 1; i < PROFILE_COUNT; i++) {
    profiles.push(makeProfile(seededUuid(rng)));
  }
  for (const p of profiles) put('profiles', p);

  const otherProfiles = profiles.slice(1); // excludes test user, for convenience below

  // Register the auth account for the test user + a couple of throwaway ones
  // (not required by the spec, but harmless and occasionally useful for manual testing).
  seedAccount(
    TEST_ACCOUNT_EMAIL,
    TEST_ACCOUNT_PASSWORD,
    makeUser(TEST_ACCOUNT_EMAIL, { full_name: testProfile.first_name }, TEST_USER_ID)
  );

  // -- bubbles + memberships --------------------------------------------------
  const BUBBLE_COUNT = 60;
  const bubbleTagPool = [...INTERESTS, ...BUBBLE_EXTRA_TAGS];
  const bubbles: Record<string, any>[] = [];
  const membershipsByBubble = new Map<string, Record<string, any>[]>();

  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const city = pick(rng, CITIES);
    const tag = pick(rng, bubbleTagPool);
    const creator = i < 2 ? testProfile : pick(rng, otherProfiles);
    const id = seededUuid(rng);
    bubbles.push({
      id,
      name: `${city.name} ${tag} ${pick(rng, BUBBLE_NOUNS)}`,
      description: `A local bubble for people who love ${tag.toLowerCase()}.`,
      interest_tag: tag,
      is_private: chance(rng, 0.2),
      creator_id: creator.id,
      latitude: city.lat + randFloat(rng, -0.02, 0.02),
      longitude: city.lng + randFloat(rng, -0.02, 0.02),
      member_count: 0, // finalized below
      created_at: daysAgo(randInt(rng, 3, 300)),
      updated_at: hoursAgo(randInt(rng, 0, 48)),
    });
  }

  for (const bubble of bubbles) {
    const targetSize = randInt(rng, 4, 45);
    const members = pickMany(rng, otherProfiles, Math.min(targetSize, otherProfiles.length));
    const memberships: Record<string, any>[] = [];
    const seenUserIds = new Set<string>();

    const addMembership = (userId: string, role: string) => {
      if (seenUserIds.has(userId)) return;
      seenUserIds.add(userId);
      memberships.push({
        id: seededUuid(rng),
        bubble_id: bubble.id,
        user_id: userId,
        role,
        created_at: daysAgo(randInt(rng, 0, 200)),
      });
    };

    addMembership(bubble.creator_id, 'admin');
    for (const m of members) addMembership(m.id, 'member');
    membershipsByBubble.set(bubble.id, memberships);
    bubble.member_count = memberships.length;
  }

  // Guarantee the test user is a member of several bubbles beyond the two they created.
  const testUserExtraBubbles = pickMany(rng, bubbles.slice(2), 4);
  for (const bubble of testUserExtraBubbles) {
    const memberships = membershipsByBubble.get(bubble.id)!;
    if (!memberships.some((m) => m.user_id === TEST_USER_ID)) {
      memberships.push({
        id: seededUuid(rng),
        bubble_id: bubble.id,
        user_id: TEST_USER_ID,
        role: 'member',
        created_at: daysAgo(randInt(rng, 0, 60)),
      });
      bubble.member_count = memberships.length;
    }
  }

  for (const bubble of bubbles) put('bubbles', bubble);
  for (const memberships of membershipsByBubble.values()) {
    for (const m of memberships) put('bubble_memberships', m);
  }

  // -- friend requests + friendships ------------------------------------------
  const pairKey = (a: string, b: string) => [a, b].sort().join('|');
  const seenPairs = new Set<string>();
  const acceptedFriendsByUser = new Map<string, Set<string>>();

  const addFriendPair = (a: string, b: string) => {
    if (!acceptedFriendsByUser.has(a)) acceptedFriendsByUser.set(a, new Set());
    if (!acceptedFriendsByUser.has(b)) acceptedFriendsByUser.set(b, new Set());
    acceptedFriendsByUser.get(a)!.add(b);
    acceptedFriendsByUser.get(b)!.add(a);
  };

  function createFriendRequest(sender: string, receiver: string, status: 'pending' | 'accepted' | 'declined') {
    const key = pairKey(sender, receiver);
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    put('friend_requests', {
      id: seededUuid(rng),
      sender_id: sender,
      receiver_id: receiver,
      status,
      created_at: daysAgo(randInt(rng, 1, 250)),
      updated_at: daysAgo(randInt(rng, 0, 200)),
    });
    if (status === 'accepted') {
      put('friendships', { id: seededUuid(rng), user_id_1: sender, user_id_2: receiver, created_at: daysAgo(randInt(rng, 0, 200)) });
      addFriendPair(sender, receiver);
    }
  }

  // Bulk social graph across the general population.
  for (const profile of otherProfiles) {
    const requestCount = randInt(rng, 0, 4);
    for (let i = 0; i < requestCount; i++) {
      const target = pick(rng, otherProfiles);
      if (target.id === profile.id) continue;
      const roll = rng();
      const status = roll < 0.7 ? 'accepted' : roll < 0.85 ? 'pending' : 'declined';
      createFriendRequest(profile.id, target.id, status);
    }
  }

  // Guarantee the test user's social graph is rich and includes every status.
  const candidateFriends = shuffle(rng, otherProfiles).slice(0, 30);
  let testAccepted = 0;
  for (const candidate of candidateFriends) {
    if (testAccepted >= 18) break;
    const key = pairKey(TEST_USER_ID, candidate.id);
    if (seenPairs.has(key)) continue;
    createFriendRequest(TEST_USER_ID, candidate.id, 'accepted');
    testAccepted++;
  }
  const pendingIncoming = shuffle(rng, otherProfiles).find((p) => !seenPairs.has(pairKey(TEST_USER_ID, p.id)));
  if (pendingIncoming) createFriendRequest(pendingIncoming.id, TEST_USER_ID, 'pending');
  const pendingIncoming2 = shuffle(rng, otherProfiles).find((p) => !seenPairs.has(pairKey(TEST_USER_ID, p.id)));
  if (pendingIncoming2) createFriendRequest(pendingIncoming2.id, TEST_USER_ID, 'pending');
  const pendingOutgoing = shuffle(rng, otherProfiles).find((p) => !seenPairs.has(pairKey(TEST_USER_ID, p.id)));
  if (pendingOutgoing) createFriendRequest(TEST_USER_ID, pendingOutgoing.id, 'pending');
  const declined = shuffle(rng, otherProfiles).find((p) => !seenPairs.has(pairKey(TEST_USER_ID, p.id)));
  if (declined) createFriendRequest(TEST_USER_ID, declined.id, 'declined');

  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // -- messages -----------------------------------------------------------
  for (const [userId, friends] of acceptedFriendsByUser) {
    for (const friendId of friends) {
      if (userId > friendId) continue; // only generate each pair once
      const count = randInt(rng, 1, 8);
      for (let i = 0; i < count; i++) {
        const fromUser = chance(rng, 0.5);
        const sender = fromUser ? userId : friendId;
        const recipient = fromUser ? friendId : userId;
        put('messages', {
          id: seededUuid(rng),
          sender_id: sender,
          recipient_id: recipient,
          bubble_id: null,
          content: pick(rng, DM_LINES),
          message_type: 'text',
          is_disappearing: false,
          viewed_at: chance(rng, 0.7) ? daysAgo(randInt(rng, 0, 5)) : null,
          created_at: daysAgo(randInt(rng, 0, 60) + i * 0.01),
        });
      }
    }
  }

  for (const bubble of bubbles) {
    const memberships = membershipsByBubble.get(bubble.id)!;
    const count = randInt(rng, 3, 15);
    for (let i = 0; i < count; i++) {
      const sender = pick(rng, memberships);
      put('messages', {
        id: seededUuid(rng),
        sender_id: sender.user_id,
        recipient_id: null,
        bubble_id: bubble.id,
        content: pick(rng, BUBBLE_LINES),
        message_type: 'text',
        is_disappearing: false,
        viewed_at: null,
        created_at: daysAgo(randInt(rng, 0, 90) + i * 0.01),
      });
    }
  }

  // -- notifications -----------------------------------------------------
  const NOTIFICATION_COUNT = 260;
  for (let i = 0; i < NOTIFICATION_COUNT; i++) {
    const recipient = pick(rng, profiles);
    const actor = pick(rng, profiles);
    const template = pick(rng, NOTIFICATION_TEMPLATES);
    put('notifications', {
      id: seededUuid(rng),
      user_id: recipient.id,
      type: template.type,
      title: template.title,
      body: template.body(actor.first_name),
      read: chance(rng, 0.4),
      data: { actorId: actor.id },
      created_at: daysAgo(randInt(rng, 0, 45)),
      updated_at: daysAgo(randInt(rng, 0, 45)),
    });
  }
  // Ensure the test user has several guaranteed-unread notifications to see immediately.
  for (let i = 0; i < 6; i++) {
    const actor = pick(rng, otherProfiles);
    const template = pick(rng, NOTIFICATION_TEMPLATES);
    put('notifications', {
      id: seededUuid(rng),
      user_id: TEST_USER_ID,
      type: template.type,
      title: template.title,
      body: template.body(actor.first_name),
      read: false,
      data: { actorId: actor.id },
      created_at: hoursAgo(randInt(rng, 1, 72)),
      updated_at: hoursAgo(randInt(rng, 1, 72)),
    });
  }

  // -- call logs -----------------------------------------------------------
  const CALL_LOG_COUNT = 150;
  const friendPairs: [string, string][] = [];
  for (const [userId, friends] of acceptedFriendsByUser) {
    for (const friendId of friends) if (userId < friendId) friendPairs.push([userId, friendId]);
  }
  for (let i = 0; i < CALL_LOG_COUNT && friendPairs.length; i++) {
    const [a, b] = pick(rng, friendPairs);
    const caller = chance(rng, 0.5) ? a : b;
    const receiver = caller === a ? b : a;
    const statusRoll = rng();
    const status = statusRoll < 0.6 ? 'completed' : statusRoll < 0.85 ? 'missed' : 'declined';
    const callType = chance(rng, 0.5) ? 'audio' : 'video';
    const startedAt = daysAgo(randInt(rng, 0, 90));
    const duration = status === 'completed' ? randInt(rng, 10, 1800) : null;
    put('call_logs', {
      id: seededUuid(rng),
      caller_id: caller,
      receiver_id: receiver,
      bubble_id: null,
      call_type: callType,
      status,
      started_at: startedAt,
      ended_at: status === 'completed' ? startedAt : startedAt,
      duration_seconds: duration,
      created_at: startedAt,
    });
  }

  // -- location stories + reactions + views --------------------------------
  const STORY_COUNT = 150;
  const stories: Record<string, any>[] = [];
  for (let i = 0; i < STORY_COUNT; i++) {
    const author = pick(rng, profiles);
    const createdHoursAgo = randInt(rng, 0, 72); // some >24h old => already expired
    const story = {
      id: seededUuid(rng),
      user_id: author.id,
      latitude: author.latitude,
      longitude: author.longitude,
      text_content: chance(rng, 0.5) ? pick(rng, DEAD_DROP_TEXT) : null,
      image_url: chance(rng, 0.6) ? `https://picsum.photos/seed/story-${i}/400/600` : null,
      visibility_radius: randInt(rng, 500, 5000),
      created_at: hoursAgo(createdHoursAgo),
      updated_at: hoursAgo(createdHoursAgo),
      expires_at: iso(NOW - createdHoursAgo * 3600_000 + 24 * 3600_000),
    };
    stories.push(story);
    put('location_stories', story);
  }
  const REACTION_COUNT = 400;
  for (let i = 0; i < REACTION_COUNT; i++) {
    const story = pick(rng, stories);
    const reactor = pick(rng, profiles);
    put('story_reactions', {
      id: seededUuid(rng),
      story_id: story.id,
      user_id: reactor.id,
      reaction_type: pick(rng, ['❤️', '😂', '🔥', '😮', '👍']),
      created_at: hoursAgo(randInt(rng, 0, 70)),
    });
  }
  const VIEW_COUNT = 500;
  for (let i = 0; i < VIEW_COUNT; i++) {
    const story = pick(rng, stories);
    const viewer = pick(rng, profiles);
    if (viewer.id === story.user_id) continue;
    put('story_views', {
      id: seededUuid(rng),
      story_id: story.id,
      viewer_id: viewer.id,
      viewed_at: hoursAgo(randInt(rng, 0, 70)),
    });
  }

  // -- dead drops -----------------------------------------------------------
  const DEAD_DROP_COUNT = 80;
  for (let i = 0; i < DEAD_DROP_COUNT; i++) {
    const author = pick(rng, profiles);
    const expired = chance(rng, 0.35);
    const viewers = pickMany(rng, profiles, randInt(rng, 0, 6)).map((p) => p.id);
    put('dead_drops', {
      id: seededUuid(rng),
      title: pick(rng, DEAD_DROP_TITLES),
      content: pick(rng, DEAD_DROP_TEXT),
      type: pick(rng, ['text', 'image', 'voice']),
      latitude: author.latitude + randFloat(rng, -0.01, 0.01),
      longitude: author.longitude + randFloat(rng, -0.01, 0.01),
      radius: randInt(rng, 50, 1000),
      created_by: author.id,
      max_views: chance(rng, 0.5) ? randInt(rng, 5, 50) : null,
      viewed_by: viewers,
      expires_at: expired ? daysAgo(randInt(rng, 1, 30)) : daysFromNow(randInt(rng, 1, 30)),
      created_at: daysAgo(randInt(rng, 1, 60)),
    });
  }

  // -- snap scores + streaks -------------------------------------------------
  for (const p of profiles) {
    const sent = randInt(rng, 0, 500);
    const received = randInt(rng, 0, 500);
    const stories_posted = randInt(rng, 0, 20);
    put('snap_scores', {
      id: seededUuid(rng),
      user_id: p.id,
      snaps_sent: sent,
      snaps_received: received,
      stories_posted,
      total_score: sent + received * 2 + stories_posted * 5,
      created_at: p.created_at,
      updated_at: hoursAgo(randInt(rng, 0, 48)),
    });
  }
  const streakPairs = pickMany(rng, friendPairs, Math.min(80, friendPairs.length));
  for (const [a, b] of streakPairs) {
    const started = daysAgo(randInt(rng, 5, 120));
    put('snap_streaks', {
      id: seededUuid(rng),
      user_id_1: a,
      user_id_2: b,
      streak_count: randInt(rng, 1, 60),
      last_snap_by: chance(rng, 0.5) ? a : b,
      started_at: started,
      last_snap_at: hoursAgo(randInt(rng, 0, 30)),
      created_at: started,
      updated_at: hoursAgo(randInt(rng, 0, 30)),
    });
  }

  // -- trips -----------------------------------------------------------------
  const TRIP_COUNT = 40;
  for (let i = 0; i < TRIP_COUNT; i++) {
    const owner = i < 2 ? testProfile : pick(rng, profiles);
    const friends = Array.from(acceptedFriendsByUser.get(owner.id) ?? []);
    const shared = pickMany(rng, friends, Math.min(randInt(rng, 0, 3), friends.length));
    const originCity = pick(rng, CITIES);
    const destCity = pick(rng, CITIES);
    const status = pick(rng, ['pending', 'active', 'completed', 'cancelled'] as const);
    put('trips', {
      id: seededUuid(rng),
      created_by: owner.id,
      name: `Trip to ${destCity.name}`,
      origin_lat: originCity.lat,
      origin_lng: originCity.lng,
      destination_lat: destCity.lat,
      destination_lng: destCity.lng,
      current_lat: status === 'active' ? (originCity.lat + destCity.lat) / 2 : null,
      current_lng: status === 'active' ? (originCity.lng + destCity.lng) / 2 : null,
      eta: status === 'active' || status === 'pending' ? hoursFromNow(randInt(rng, 1, 12)) : null,
      route: null,
      shared_with: shared,
      status,
      created_at: daysAgo(randInt(rng, 0, 40)),
      updated_at: hoursAgo(randInt(rng, 0, 24)),
    });
  }

  // -- meetups + rsvps ---------------------------------------------------------
  const MEETUP_COUNT = 40;
  for (let i = 0; i < MEETUP_COUNT; i++) {
    const bubble = pick(rng, bubbles);
    const memberships = membershipsByBubble.get(bubble.id)!;
    const organizer = pick(rng, memberships);
    const future = chance(rng, 0.5);
    const dateTime = future ? daysFromNow(randInt(rng, 1, 20)) : daysAgo(randInt(rng, 1, 20));
    const status = future ? pick(rng, ['upcoming', 'ongoing'] as const) : pick(rng, ['completed', 'cancelled'] as const);
    const meetup = {
      id: seededUuid(rng),
      bubble_id: bubble.id,
      organizer_id: organizer.user_id,
      title: `${bubble.interest_tag} Meetup`,
      description: `Join fellow ${bubble.interest_tag.toLowerCase()} fans for a get-together.`,
      date_time: dateTime,
      location_name: `${pick(rng, CITIES).name} Park`,
      latitude: bubble.latitude + randFloat(rng, -0.01, 0.01),
      longitude: bubble.longitude + randFloat(rng, -0.01, 0.01),
      status,
      created_at: daysAgo(randInt(rng, 1, 30)),
      updated_at: daysAgo(randInt(rng, 0, 20)),
    };
    put('meetups', meetup);

    const attendees = pickMany(rng, memberships, Math.min(randInt(rng, 2, memberships.length), memberships.length));
    for (const attendee of attendees) {
      put('meetup_rsvps', {
        id: seededUuid(rng),
        meetup_id: meetup.id,
        user_id: attendee.user_id,
        status: pick(rng, ['going', 'maybe', 'not_going'] as const),
        created_at: daysAgo(randInt(rng, 0, 20)),
        updated_at: daysAgo(randInt(rng, 0, 20)),
      });
    }
  }

  // -- badges + user_badges ---------------------------------------------------
  const badgeRows = BADGE_DEFS.map((b) => ({ id: seededUuid(rng), ...b, created_at: daysAgo(400) }));
  for (const b of badgeRows) put('badges', b);
  for (const p of profiles) {
    const earned = pickMany(rng, badgeRows, randInt(rng, 0, 4));
    for (const badge of earned) {
      put('user_badges', {
        id: seededUuid(rng),
        user_id: p.id,
        badge_id: badge.id,
        earned_at: daysAgo(randInt(rng, 0, 300)),
      });
    }
  }
  // Guarantee the test user has a couple of badges to show off.
  for (const badge of badgeRows.slice(0, 3)) {
    put('user_badges', { id: seededUuid(rng), user_id: TEST_USER_ID, badge_id: badge.id, earned_at: daysAgo(randInt(rng, 5, 100)) });
  }

  // -- AR pins ------------------------------------------------------------
  const AR_PIN_COUNT = 100;
  for (let i = 0; i < AR_PIN_COUNT; i++) {
    const author = pick(rng, profiles);
    put('ar_pins', {
      id: seededUuid(rng),
      user_id: author.id,
      note: pick(rng, AR_PIN_NOTES),
      latitude: author.latitude + randFloat(rng, -0.01, 0.01),
      longitude: author.longitude + randFloat(rng, -0.01, 0.01),
      created_at: daysAgo(randInt(rng, 0, 60)),
    });
  }

  // -- emergency shares ---------------------------------------------------
  const EMERGENCY_SHARE_COUNT = 20;
  for (let i = 0; i < EMERGENCY_SHARE_COUNT; i++) {
    const author = pick(rng, profiles);
    put('emergency_shares', {
      id: seededUuid(rng),
      user_id: author.id,
      latitude: author.latitude,
      longitude: author.longitude,
      shared_at: daysAgo(randInt(rng, 0, 30)),
    });
  }

  // -- user blocks ----------------------------------------------------------
  const USER_BLOCK_COUNT = 30;
  for (let i = 0; i < USER_BLOCK_COUNT; i++) {
    const blocker = pick(rng, profiles);
    const blocked = pick(rng, profiles);
    if (blocker.id === blocked.id) continue;
    put('user_blocks', {
      id: seededUuid(rng),
      blocker_id: blocker.id,
      blocked_id: blocked.id,
      created_at: daysAgo(randInt(rng, 0, 60)),
    });
  }

  // -- voice messages ---------------------------------------------------------
  const VOICE_MESSAGE_COUNT = 100;
  for (let i = 0; i < VOICE_MESSAGE_COUNT && friendPairs.length; i++) {
    const [a, b] = pick(rng, friendPairs);
    const sender = chance(rng, 0.5) ? a : b;
    const chatId = `dm-${[a, b].sort().join('-')}`;
    const ts = Date.now() - randInt(rng, 0, 60) * 3600_000;
    put('voice_messages', {
      id: seededUuid(rng),
      chat_id: chatId,
      sender_id: sender,
      url: `${sender}/${chatId}/${ts}.webm`,
      duration: randInt(rng, 3, 60),
      is_played: chance(rng, 0.6),
      created_at: iso(ts),
    });
  }

  // -- light extras: presence + avatars (cheap, improve QA realism) -----------
  for (const p of profiles) {
    put('user_presence', {
      id: seededUuid(rng),
      user_id: p.id,
      status: pick(rng, ['online', 'away', 'offline'] as const),
      last_seen: hoursAgo(randInt(rng, 0, 96)),
      created_at: p.created_at,
      updated_at: hoursAgo(randInt(rng, 0, 96)),
    });
  }
  const avatarProfiles = pickMany(rng, profiles, 150);
  for (const p of avatarProfiles) {
    put('user_avatars', {
      user_id: p.id,
      icon: pick(rng, AVATAR_ICONS),
      color: pick(rng, AVATAR_COLORS),
      custom_image_url: null,
      created_at: p.created_at,
      updated_at: hoursAgo(randInt(rng, 0, 96)),
    });
  }

  console.info(
    `[mock-backend] Seeded ${profiles.length} profiles, ${bubbles.length} bubbles, ` +
      `${stories.length} stories, ${friendPairs.length} friendships, and related data. ` +
      `Test account: ${TEST_ACCOUNT_EMAIL} / ${TEST_ACCOUNT_PASSWORD}`
  );
}
