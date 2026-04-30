import { SessionInput, Scene, SceneType } from '../types';
import { generateDualHook } from '../lib/hook-generator';
import { injectOpenLoops } from '../lib/open-loops';
import type { AnimationCue, SfxTrigger } from '../types';
import { NARRATION_SPEEDS, SCENE_DEFAULTS, TIMING } from '../lib/constants';
import { renderMermaidToSvg } from './mermaid-renderer';
import { SyncTimeline } from '../lib/sync-engine';
import { computeVisualBeats } from '../lib/visual-beats';
import { getVisualTemplate } from '../lib/visual-templates';
import { generateQuizOptions } from '../lib/quiz-options';

// ---------------------------------------------------------------------------
// Per-Video Phrase Dedup Tracker
// Prevents repetitive template phrases from appearing more than once per video.
// Reset via resetPhraseTracker() at the start of each generateScript() call.
// ---------------------------------------------------------------------------
const _usedPhraseTemplates = new Set<string>();

function resetPhraseTracker(): void {
  _usedPhraseTemplates.clear();
}

/**
 * Returns the phrase only if it hasn't been used yet in this video.
 * Tracks by a template key (not the full string) so parameterised phrases
 * like "This is how {topic} works under the hood" still dedup.
 */
function oncePerVideo(templateKey: string, phrase: string): string {
  if (_usedPhraseTemplates.has(templateKey)) return '';
  _usedPhraseTemplates.add(templateKey);
  return phrase;
}

// ---------------------------------------------------------------------------
// ASCII Art Detection
// Detects box-drawing / ASCII diagram characters and replaces narration
// with a semantic description instead of reading "vertical bar, box drawing".
// ---------------------------------------------------------------------------
const ASCII_BOX_CHARS = /[│─┌┐└┘├┤┬┴┼┏┓┗┛┣┫┳┻╋║═╔╗╚╝╠╣╦╩╬]/g;

function containsAsciiArt(content: string): boolean {
  const matches = content.match(ASCII_BOX_CHARS);
  // Also check plain-ASCII box patterns: lines with 3+ of |, +, - used as drawing
  const plainBoxLines = content.split('\n').filter(line => {
    const stripped = line.replace(/\s/g, '');
    // A line is "box drawing" if it has 3+ box chars or is mostly made of +, -, |
    const boxChars = (stripped.match(/[|+\-]/g) || []).length;
    return boxChars >= 3 && boxChars / stripped.length > 0.4;
  });
  return (matches !== null && matches.length >= 3) || plainBoxLines.length >= 2;
}

function asciiArtNarration(heading?: string): string {
  if (heading) {
    return `Here's a diagram showing ${heading.toLowerCase()}. Let me walk you through it.`;
  }
  return "Here's a diagram showing how the components connect. Let me walk you through it.";
}

// ---------------------------------------------------------------------------
// Story Arc System — transforms flat content into 5-act narratives
// Every technical topic becomes: character → problem → failed fix →
// mentor insight → real mechanism → tradeoff revelation
// ---------------------------------------------------------------------------

type StoryAct = 'setup' | 'conflict' | 'rising' | 'climax' | 'resolution';

/** Indian-context analogy bank — relatable metaphors for each topic category */
const ANALOGY_BANK: Record<string, { character: string; world: string; problem: string; metaphor: string }> = {
  'message-queue': {
    character: 'Ravi, a village postmaster',
    world: 'a post office handling 200 letters daily',
    problem: 'letters pile up, get lost, arrive at wrong houses',
    metaphor: 'post office',
  },
  'load-balancing': {
    character: 'Priya, a chai shop owner on MG Road',
    world: 'a chai stall with one counter',
    problem: 'Diwali rush creates a line around the block',
    metaphor: 'chai shop',
  },
  'database': {
    character: 'Arjun, a school librarian',
    world: 'a library with 50,000 books and one register',
    problem: 'students wait 20 minutes to find a single book',
    metaphor: 'library',
  },
  'caching': {
    character: 'Meera, a street food vendor',
    world: 'a pani puri stall making everything from scratch',
    problem: 'regular customers wait just as long as new ones',
    metaphor: 'pani puri stall',
  },
  'streaming': {
    character: 'Deepak, a newspaper editor',
    world: 'a printing press batching all news into one edition',
    problem: 'breaking news at 2 PM reaches readers at 6 AM next day',
    metaphor: 'newspaper',
  },
  'replication': {
    character: 'Sunita, a recipe keeper',
    world: 'a family where only grandmother knows the recipes',
    problem: 'when grandmother falls ill, nobody can cook',
    metaphor: 'family recipe book',
  },
  'default': {
    character: 'Dev, a junior engineer at a Bangalore startup',
    world: 'a startup that just hit 1000 users',
    problem: 'the system that worked for 10 users is breaking at 1000',
    metaphor: 'startup',
  },
};

function getStoryAnalogy(topic: string): typeof ANALOGY_BANK['default'] {
  const lower = topic.toLowerCase();
  for (const [key, val] of Object.entries(ANALOGY_BANK)) {
    if (key !== 'default' && (lower.includes(key) || lower.includes(key.replace('-', ' ')))) return val;
  }
  if (lower.includes('kafka') || lower.includes('producer') || lower.includes('consumer')) return ANALOGY_BANK['message-queue'];
  if (lower.includes('cache') || lower.includes('redis')) return ANALOGY_BANK['caching'];
  return ANALOGY_BANK['default'];
}

/** Wrap narration in story framing based on the current act */
function storyFrameNarration(narration: string, act: StoryAct, topic: string, idx: number): string {
  const a = getStoryAnalogy(topic);
  const name = a.character.split(',')[0];
  switch (act) {
    case 'setup':
      return idx === 0
        ? `Let me tell you about ${a.character}. Imagine ${a.world}. The problem? ${a.problem}. ${narration}`
        : `In ${name}'s ${a.metaphor}, ${narration.charAt(0).toLowerCase()}${narration.slice(1)}`;
    case 'conflict':
      return idx === 0
        ? `Here's what happens when you try the obvious solution. ${narration} Sounds reasonable? Watch what breaks.`
        : `And that's exactly where things go wrong. ${narration}`;
    case 'rising':
      return idx === 0
        ? `Now here's the insight that changes everything. ${narration}`
        : `Think about it this way. ${narration}`;
    case 'climax':
      return idx === 0 ? `Now let me show you how this actually works. ${narration}` : narration;
    case 'resolution':
      return idx === 0
        ? `So what's the catch? Every solution has a cost. ${narration}`
        : `${narration} And that's the tradeoff — back in ${name}'s ${a.metaphor}, this is the moment they realized: there's no free lunch.`;
    default:
      return narration;
  }
}

/** Map flat sections into a 5-act story arc */
function storyArcMapper(sections: MarkdownSection[]): Array<{ act: StoryAct; section: MarkdownSection }> {
  const total = sections.length;
  if (total <= 2) return sections.map(s => ({ act: 'climax' as StoryAct, section: s }));

  return sections.map((section, i) => {
    const pct = i / total;
    let act: StoryAct;
    if (pct < 0.15) act = 'setup';
    else if (pct < 0.30) act = 'conflict';
    else if (pct < 0.45) act = 'rising';
    else if (pct < 0.85) act = 'climax';
    else act = 'resolution';
    return { act, section };
  });
}

// ---------------------------------------------------------------------------
// Code-Topic Relevance Check
// Ensures code content actually matches the video topic — prevents e.g.
// ConsistentHash code appearing in a Kafka video.
// ---------------------------------------------------------------------------
const TOPIC_CODE_KEYWORDS: Record<string, string[]> = {
  'kafka': ['kafka', 'producer', 'consumer', 'broker', 'partition', 'offset', 'topic', 'subscribe', 'publish', 'event stream', 'commit'],
  'caching': ['cache', 'redis', 'memcache', 'ttl', 'evict', 'lru', 'invalidat', 'hit', 'miss', 'expire'],
  'load balancing': ['load_balanc', 'loadbalanc', 'round_robin', 'roundrobin', 'health_check', 'healthcheck', 'server_pool', 'upstream', 'backend', 'weight'],
  'consistent hashing': ['hash_ring', 'consistent_hash', 'virtual_node', 'vnode', 'hash ring'],
  'api gateway': ['gateway', 'route', 'middleware', 'rate_limit', 'ratelimit', 'proxy', 'upstream'],
  'microservices': ['microservice', 'service_registry', 'discovery', 'circuit_breaker', 'sidecar'],
  'database': ['database', 'db_', 'query', 'schema', 'shard', 'replica', 'index', 'transaction', 'sql'],
  'message queue': ['queue', 'enqueue', 'dequeue', 'rabbitmq', 'amqp', 'message_broker'],
  'rate limiting': ['rate_limit', 'ratelimit', 'token_bucket', 'sliding_window', 'throttl'],
  'monitoring': ['metric', 'monitor', 'alert', 'prometheus', 'grafana', 'healthcheck', 'dashboard'],
};

function isCodeRelevantToTopic(code: string, topic: string): boolean {
  const lower = code.toLowerCase();
  const topicLower = topic.toLowerCase();

  // Find matching keyword list
  for (const [key, keywords] of Object.entries(TOPIC_CODE_KEYWORDS)) {
    if (topicLower.includes(key)) {
      // Check if code contains at least one keyword for this topic
      return keywords.some(kw => lower.includes(kw));
    }
  }

  // No keyword list for this topic — allow by default
  return true;
}

// ---------------------------------------------------------------------------
// Topic-Specific Examples — imported from shared module to avoid circular deps
// with hook-generator.ts (which also needs these).
// ---------------------------------------------------------------------------
import { TOPIC_EXAMPLES, getTopicExample } from '../lib/topic-examples';

interface ScriptOptions {
  language?: string; // 'python' | 'java' -- fallback language for non-fenced code; both Python & Java are always included
  maxScenes?: number;
  nextTopic?: string; // Optional: next session topic for end-of-video tease
  sessionNumber?: number; // Which session in the series (1-based)
  totalSessions?: number; // Total sessions in the series
  previousSessionSummary?: string[]; // Key takeaways from the previous session for recap
}

// ---------------------------------------------------------------------------
// Teaching Technique: Session-Aware Analogy Generator (Khan GS + 3Blue1Brown style)
// Each session gets a DIFFERENT analogy family to avoid repetition.
// Session 1: Restaurant, Session 2: Highway, Session 3: Hospital, Session 4+: Airport
// ---------------------------------------------------------------------------

/** Analogy sets per session tier — each session uses a DIFFERENT metaphor family */
const SESSION_ANALOGY_SETS: Record<string, string>[] = [
  // Session 1: Restaurant analogy (waiters = servers, host = load balancer)
  {
    'load balancing': 'Think of it like a restaurant with multiple chefs. Instead of one chef cooking everything and getting overwhelmed, a host distributes orders across all chefs equally.',
    'hash map': 'Imagine a library where instead of searching every shelf, you have a magic index card that tells you exactly which shelf your book is on.',
    'binary search': 'It is like finding a word in a dictionary. You don\'t start from page 1. You open the middle, then decide whether to go left or right.',
    'cache': 'Think of it like keeping your most-used apps on your phone\'s home screen instead of searching through all apps every time.',
    'queue': 'Like a line at a ticket counter. First person in line gets served first.',
    'stack': 'Like a stack of plates. You always take the top plate first.',
    'tree': 'Like a family tree. Each person can have children, and those children can have their own children.',
    'graph': 'Like a social network. People are connected to other people, and those connections can go in any direction.',
    'recursion': 'Like standing between two mirrors. You see yourself reflected infinitely, each reflection slightly smaller.',
    'api': 'Like a waiter in a restaurant. You tell the waiter what you want, the waiter goes to the kitchen, and brings back your food.',
    'database': 'Like a giant Excel spreadsheet that can handle millions of rows and multiple people reading and writing at the same time.',
    'microservices': 'Instead of one giant kitchen handling everything, imagine separate food stalls each specializing in one dish. Pizza stall, burger stall, drinks stall. Each works independently.',
    'linked list': 'Like a treasure hunt where each clue tells you where to find the next clue. You have to follow the chain.',
    'array': 'Like a row of lockers in a school hallway. Each locker has a number, and you can go directly to any locker if you know its number.',
    'dynamic programming': 'Like filling out a multiplication table. Each cell uses values you already calculated, so you never solve the same problem twice.',
    'sorting': 'Like organizing a messy bookshelf. You could do it slowly by checking every book, or smartly by dividing the shelf into sections first.',
    'http': 'Like sending a letter. You write a request, put it in an envelope with an address, send it, and wait for a reply.',
    'tcp': 'Like a phone call. Both sides confirm they can hear each other before the conversation starts.',
    'dns': 'Like a phone book for the internet. You look up a name and get a number back.',
    'docker': 'Like a shipping container. Everything your app needs is packed inside, and it works the same no matter where you ship it.',
    'kubernetes': 'Like an air traffic controller for shipping containers. It decides where each container goes, restarts them if they crash, and scales up when traffic increases.',
    'promise': 'Like ordering food at a counter. They give you a receipt number. You can go sit down, and they\'ll call your number when the food is ready.',
    'mutex': 'Like a bathroom key at a coffee shop. Only one person can use it at a time. Everyone else waits their turn.',
    'deadlock': 'Like two people in a narrow hallway, each waiting for the other to move first. Neither can make progress.',
    'big o': 'Like asking how long a road trip takes. You don\'t want the exact minutes. You want to know: is it a quick drive or a cross-country journey?',
  },
  // Session 2: Highway/traffic analogy (lanes = servers, toll booth = algorithm)
  {
    'load balancing': 'Think of a 10-lane highway during rush hour. Each lane is a server. The toll booth is the load balancing algorithm, routing each car to the lane with the fewest vehicles.',
    'hash map': 'Imagine a parking garage with numbered spots. Instead of driving around searching, you compute your spot number from your license plate and go directly there.',
    'binary search': 'Like navigating a highway exit system. You see "exits 1-50 left, 51-100 right." You never check every exit, you halve your search each time.',
    'cache': 'Like the fast lane on a toll road. Frequent travelers get an E-ZPass so they skip the long line every time.',
    'queue': 'Like cars waiting at a traffic light. First car through the intersection is the first one that arrived.',
    'stack': 'Like cars in a narrow dead-end alley. The last car in has to be the first car out.',
    'tree': 'Like a highway system branching from one interstate into state highways, then local roads, then driveways.',
    'graph': 'Like a city road network. Intersections are nodes, roads are edges, and you can often go both directions.',
    'recursion': 'Like GPS rerouting. Each detour calculates a new route, which might need another detour, which calculates another route.',
    'api': 'Like a drive-through window. You speak your order into the microphone, the kitchen processes it, and your food comes out the other side.',
    'database': 'Like a massive warehouse distribution center. Items are organized in aisles and shelves so any worker can find anything in seconds.',
    'microservices': 'Like specialized lanes on a highway. Bus lane, bike lane, carpool lane, truck lane. Each handles one type of traffic optimally.',
    'linked list': 'Like a chain of toll booths on a highway. Each booth only knows the location of the next booth ahead.',
    'array': 'Like mile markers on a highway. Marker 42 is always at mile 42. You can jump directly to any marker.',
    'dynamic programming': 'Like using traffic data from previous rush hours to predict today\'s best route. Past solutions inform future decisions.',
    'sorting': 'Like merging traffic from 4 on-ramps into one highway in speed order. The fastest cars end up in the fast lane.',
    'http': 'Like a postal delivery truck. It picks up a package at one address, follows a route, and delivers to another address.',
    'tcp': 'Like a walkie-talkie conversation. "Do you copy?" "I copy." Only then do you start talking.',
    'dns': 'Like a GPS system. You type in a name, and it gives you the exact coordinates to get there.',
    'docker': 'Like a moving truck. Everything in your apartment is packed into one truck, and it works the same at any destination.',
    'kubernetes': 'Like a fleet dispatcher for delivery trucks. Assigning routes, restarting broken-down trucks, adding more trucks during holidays.',
    'promise': 'Like a pizza delivery tracker. You order, get a tracking link, and can do other things until it shows "delivered."',
    'mutex': 'Like a single-lane bridge. Only one car can cross at a time. Everyone else queues up.',
    'deadlock': 'Like two trucks meeting head-on in a single-lane tunnel. Neither can back up, neither can go forward.',
    'big o': 'Like estimating drive time. You don\'t need the exact seconds. You want to know: is it a 10-minute drive or a 10-hour drive?',
  },
  // Session 3: Hospital/ER analogy (triage = routing, specialists = workers)
  {
    'load balancing': 'Think of an emergency room with multiple doctors. The triage nurse is the load balancer, routing patients to the right specialist based on severity and each doctor\'s current patient load.',
    'hash map': 'Like a hospital filing system. Each patient gets a unique ID, and that ID tells you exactly which cabinet holds their medical records.',
    'binary search': 'Like a doctor narrowing down a diagnosis. Temperature high or low? Blood pressure normal or abnormal? Each test eliminates half the possibilities.',
    'cache': 'Like a doctor keeping the most common prescriptions in their coat pocket instead of walking to the pharmacy every time.',
    'queue': 'Like patients in a waiting room. They are called in the order they signed in, unless it is an emergency.',
    'stack': 'Like a stack of patient charts on a doctor\'s desk. The most recent one on top gets attention first.',
    'tree': 'Like a diagnostic decision tree. Start with symptoms, branch into possible conditions, narrow down to the diagnosis.',
    'graph': 'Like a hospital referral network. Doctors refer to specialists who refer to other specialists. The connections form a web.',
    'recursion': 'Like a specialist referring you to another specialist, who refers you to yet another. Each level goes deeper into the problem.',
    'api': 'Like a nurse acting as intermediary. You tell the nurse your symptoms, the nurse relays them to the doctor, and brings back the prescription.',
    'database': 'Like a hospital\'s electronic health records system. Every patient, every visit, every test result, all searchable in seconds.',
    'microservices': 'Like hospital departments. Cardiology, radiology, oncology. Each department is independent but they collaborate on complex cases.',
    'linked list': 'Like a chain of medical referrals. Each doctor\'s note points you to the next specialist.',
    'array': 'Like numbered hospital rooms. Room 305 is always on the 3rd floor, 5th room. You go directly there.',
    'dynamic programming': 'Like a treatment plan that builds on previous test results. Each new decision uses all the data you\'ve already gathered.',
    'sorting': 'Like triaging patients by severity. Critical cases first, then urgent, then routine. Organizing for maximum impact.',
    'http': 'Like a lab test request. The doctor writes what they need, sends it to the lab, and waits for results to come back.',
    'tcp': 'Like a surgeon confirming the procedure. "We\'re operating on the left knee, correct?" "Correct." "Proceeding."',
    'dns': 'Like a hospital directory. You know the doctor\'s name, and the directory tells you which floor and room to find them.',
    'docker': 'Like a mobile surgery unit. Everything needed for the operation is packed inside, and it works the same at any hospital.',
    'kubernetes': 'Like a hospital administrator managing staff across multiple locations. Scheduling shifts, handling sick days, scaling up during flu season.',
    'promise': 'Like getting bloodwork done. They take the sample, give you a reference number, and tell you to come back tomorrow for results.',
    'mutex': 'Like a single operating room. Only one surgery at a time. The next surgery waits until the room is cleaned and ready.',
    'deadlock': 'Like two surgeons each waiting for the other\'s operating room to free up before they can start their procedure.',
    'big o': 'Like estimating recovery time. You don\'t need exact hours. You want to know: are we talking days or months?',
  },
  // Session 4+: Airport analogy (gates = servers, control tower = health checks)
  {
    'load balancing': 'Picture an airport control tower managing 50 gates. The tower assigns each incoming flight to the gate with the best availability, shortest taxiway, and right equipment. That\'s load balancing at expert level.',
    'hash map': 'Like an airport baggage system. Your bag gets a barcode tag, and that code tells the conveyor system exactly which carousel to send it to.',
    'binary search': 'Like a pilot scanning instruments. Altitude too high or too low? Adjust. Speed too fast or too slow? Adjust. Converging on the target with each check.',
    'cache': 'Like a frequent flyer lounge. The most valuable passengers get instant access instead of waiting in the general queue every time.',
    'queue': 'Like airplanes in a holding pattern. They circle in order and land when the runway is clear.',
    'stack': 'Like luggage loaded into a cargo hold. Last bags in are the first bags out.',
    'tree': 'Like an airline route map. The hub airport branches to regional airports, which branch to smaller cities.',
    'graph': 'Like a global flight network. Airports are nodes, flight routes are edges, and you can find paths between any two cities.',
    'recursion': 'Like a flight with connections. To get to your destination, you first need to get to the connecting city, which might require another connection.',
    'api': 'Like the check-in counter. You present your booking, the agent processes it through the airline system, and hands you a boarding pass.',
    'database': 'Like an airline reservation system. Millions of bookings, seat assignments, and flight statuses, all updated in real-time across the globe.',
    'microservices': 'Like airport operations. Baggage handling, security, catering, fueling, gate management. Each operates independently but coordinates for every flight.',
    'linked list': 'Like a chain of connecting flights. Each boarding pass tells you your next gate and departure time.',
    'array': 'Like seat numbers on a plane. Seat 14C is always in the same place. You find it directly.',
    'dynamic programming': 'Like optimizing flight schedules based on historical data. Past delays and patterns inform tomorrow\'s gate assignments.',
    'sorting': 'Like boarding a plane. First class, then business, then economy by row. Organized for maximum efficiency.',
    'http': 'Like sending a cargo shipment. Fill out the manifest, load it on a plane, and it arrives at the destination with a confirmation receipt.',
    'tcp': 'Like radio communication between pilot and control tower. "Tower, requesting clearance for takeoff." "Cleared for takeoff, runway 27." "Runway 27, roger."',
    'dns': 'Like an airport code system. You say "JFK" and everyone knows you mean John F. Kennedy International in New York.',
    'docker': 'Like a standardized shipping container on a cargo plane. It fits any aircraft, any route, any destination.',
    'kubernetes': 'Like an air traffic control system for an entire country. Managing hundreds of flights, rerouting around storms, handling emergencies, scaling with holiday traffic.',
    'promise': 'Like a flight booking confirmation. You get a PNR code, and you can check the status anytime without waiting at the counter.',
    'mutex': 'Like a single runway. Only one plane can take off or land at a time. All others hold their position.',
    'deadlock': 'Like two planes on intersecting taxiways, each waiting for the other to move first. The whole airport grinds to a halt.',
    'big o': 'Like flight time estimates. You don\'t need exact seconds. You want to know: is it a 1-hour hop or a 14-hour transatlantic journey?',
  },
];

// Backward-compatible export: Session 1 analogies (the original set)
const ANALOGIES: Record<string, string> = SESSION_ANALOGY_SETS[0];

/**
 * Find the best-matching analogy for a topic, using the appropriate
 * analogy set for the given session number.
 * Session 1: Restaurant, Session 2: Highway, Session 3: Hospital, Session 4+: Airport
 */
function getAnalogy(topic: string, sessionNumber: number = 1): string | null {
  const setIndex = Math.min(sessionNumber - 1, SESSION_ANALOGY_SETS.length - 1);
  const analogySet = SESSION_ANALOGY_SETS[Math.max(0, setIndex)];
  const lower = topic.toLowerCase();

  // Exact key match first
  if (analogySet[lower]) return analogySet[lower];
  // Partial match — analogy key is substring of topic
  for (const [key, analogy] of Object.entries(analogySet)) {
    if (lower.includes(key) || key.includes(lower)) return analogy;
  }
  // Word-level match — any word from the topic matches a key word
  const topicWords = lower.split(/\s+/);
  for (const [key, analogy] of Object.entries(analogySet)) {
    const keyWords = key.split(/\s+/);
    if (keyWords.some(kw => topicWords.includes(kw) && kw.length > 3)) return analogy;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Teaching Technique: Repetition (DISABLED — was causing word soup)
// Kept as no-op for API compatibility; previously restated concepts 3x.
// ---------------------------------------------------------------------------
function reinforceConcept(concept: string, _topic: string): string {
  return concept;
}

// ---------------------------------------------------------------------------
// Retention Technique: Mid-Scene Open Loops (re-engagement phrases)
// Injected every 60-90 seconds during the deep dive to keep viewers watching.
// ---------------------------------------------------------------------------
const OPEN_LOOP_PHRASES = [
  'But here\'s where it gets really interesting...',
  'Stay with me, because this next part is gold...',
  'Now THIS is what actually matters in interviews...',
  'Most people miss this completely...',
  'Here\'s the part that will blow your mind...',
  'Keep watching — this is the piece everyone skips...',
  'This next idea changes everything...',
  'Wait for it... this is the moment everything clicks...',
  'Don\'t skip this part. Seriously. This is interview gold...',
  'I saved the best insight for right here...',
  'This is the part that 99% of tutorials skip...',
  'Okay pay VERY close attention to this next bit...',
];

// ---------------------------------------------------------------------------
// Retention: Pattern Interrupt Tone Markers
// Injected at specific intervals to break monotony and re-engage viewers.
// These create pace changes in the narration — faster/slower/dramatic/quiet.
// ---------------------------------------------------------------------------
const PATTERN_INTERRUPTS = [
  // Speed-up (creates urgency)
  'Quick quick quick — let me rapid-fire through this.',
  'Okay speed round. Three things you MUST remember.',
  'Fast forward mode — here\'s the key takeaway in one sentence.',
  // Slow dramatic (creates emphasis)
  'Now... listen carefully. This. Is. The. Key.',
  'Slow down for a second. Let this sink in.',
  'Stop. Re-read that last sentence. It\'s THAT important.',
  // Direct address (breaks fourth wall)
  'Yes, YOU. The person watching at 2x speed. Slow down for this part.',
  'I know you\'re tempted to skip ahead. Don\'t. This is the part that gets asked in interviews.',
  'Real talk for a second. If you\'re just passively watching, pause and think about this.',
  // Challenge (activates viewer)
  'Before I show the answer, pause and try to guess.',
  'Can you spot the bug in this approach? Think about it...',
  'Predict what happens next. If you get it right, you\'re already thinking like a senior engineer.',
  // Enthusiasm spike
  'THIS. This right here is why I love teaching this topic.',
  'Okay I am genuinely excited about this next part.',
  'This is incredible once you see it.',
];

function getPatternInterrupt(seed: number): string {
  return PATTERN_INTERRUPTS[seed % PATTERN_INTERRUPTS.length];
}

// ---------------------------------------------------------------------------
// Retention: Completion Signal Avoidance
// YouTube analytics show viewers drop off when they hear "conclusion" signals.
// Strip these from ALL narration to avoid premature exits.
// ---------------------------------------------------------------------------
const COMPLETION_SIGNALS = [
  /\b(to wrap up|to summarize|in conclusion|in summary|finally|lastly|to conclude)\b/gi,
  /\b(that's (all|it|everything)|we're (almost )?(done|finished))\b/gi,
  /\b(before (we|I) (end|finish|close|wrap))\b/gi,
  /\b(as we come to the end)\b/gi,
];

function stripCompletionSignals(text: string): string {
  let cleaned = text;
  for (const pattern of COMPLETION_SIGNALS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Clean up double spaces left by removal
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Retention: Midpoint Retention Trap
// At exactly 50% of the video, plant a strong reason to keep watching.
// Uses the "unfinished business" psychological principle.
// ---------------------------------------------------------------------------
const MIDPOINT_TRAPS = [
  (topic: string) => `Okay quick recap. We covered the theory of ${topic}. Now comes the implementation — actual code you can use in production and explain in interviews.`,
  (topic: string) => `So far we have the building blocks of ${topic}. Now let me show you how they connect in a real system. This is where understanding beats memorization.`,
  (topic: string) => `Alright, theory done. Now the question every interviewer asks: "How would you actually implement ${topic}?" Let me show you.`,
  (topic: string) => `Quick checkpoint — you now understand the WHY of ${topic}. Next up is the HOW. Production code, failure modes, and the edge cases interviewers love.`,
  (topic: string) => `Good progress. You understand ${topic} conceptually. Now let me show you what it looks like in production — this is the part that gets you the offer.`,
  (topic: string) => `We are halfway through. Everything after this is implementation and interview strategy for ${topic}. This is where it gets practical.`,
];

function getMidpointTrap(topic: string, seed: number): string {
  return MIDPOINT_TRAPS[seed % MIDPOINT_TRAPS.length](topic);
}

// ---------------------------------------------------------------------------
// Retention: Cliffhanger Endings (series-aware)
// Strong unresolved tension that makes viewers click the NEXT video.
// ---------------------------------------------------------------------------
const CLIFFHANGER_ENDINGS = [
  (topic: string, nextTopic: string) => `But here's what nobody tells you about ${topic}... it completely BREAKS when you combine it with ${nextTopic}. I'll show you exactly how in the next video. Don't miss it.`,
  (topic: string, nextTopic: string) => `Everything we just learned has one critical weakness. And the solution? ${nextTopic}. Next video, I'll show you how these two concepts work together to build bulletproof systems.`,
  (topic: string, nextTopic: string) => `There's one scenario where ${topic} fails spectacularly. And it's EXACTLY the scenario interviewers love to ask about. The answer involves ${nextTopic}. Next video.`,
  (topic: string, _nextTopic: string) => `I left out one detail on purpose. The most dangerous edge case in ${topic}. If you want to know what it is... you know what to do. Next video drops soon.`,
  (topic: string, nextTopic: string) => `Here's a secret: the best engineers don't use ${topic} alone. They combine it with ${nextTopic} for 10x performance. That's our next video. Subscribe so you don't miss it.`,
];

function getOpenLoopPhrase(seed: number): string {
  return OPEN_LOOP_PHRASES[seed % OPEN_LOOP_PHRASES.length];
}

// ---------------------------------------------------------------------------
// Mid-Video Engagement Hooks — rotated to avoid "like and subscribe" fatigue
// ---------------------------------------------------------------------------
const ENGAGEMENT_HOOKS = [
  // Prediction prompts (research: highest retention impact)
  'Pause. What happens next? Got your guess? Let me show you.',
  'Stop. Before I reveal the answer — what would YOU do here? Think for 3 seconds.',
  // Competence affirmations
  'If you understood that, you\'re ahead of 90% of candidates. Not kidding.',
  'Most tutorials don\'t cover this part. You\'re already in the top tier.',
  // Comment drivers
  'Drop your approach in the comments. I want to see how you think about this.',
  'Hot take time. Agree or disagree? Tell me in the comments.',
  // Stakes reminders
  'This exact question showed up in Google interviews last month. Multiple candidates confirmed it.',
  'Screenshot this diagram. You WILL see a variation in your interview.',
  // Time anchors
  'You\'re already halfway. And you know more than most engineers with 3 years of experience.',
  // Challenge
  'Quick — can you explain what we just covered to an imaginary friend? Try it. Right now. 10 seconds.',
];

function getEngagementHook(seed: number): string {
  return ENGAGEMENT_HOOKS[seed % ENGAGEMENT_HOOKS.length];
}

// ---------------------------------------------------------------------------
// Series Connector Phrases — linking sessions together
// ---------------------------------------------------------------------------
function getSeriesConnector(sessionNumber: number, topic: string): string {
  if (sessionNumber <= 1) return '';
  const connectors = [
    `As we discussed in Session ${sessionNumber - 1}, the fundamentals of ${topic} gave us the foundation. Now we build on that.`,
    `Remember what we covered last time? That was the "what." Today is the "how."`,
    `Building on our previous session, where we laid the groundwork for ${topic}, let's go deeper.`,
    `If you watched the previous session, this is going to click immediately. If you didn't, I'd recommend going back first.`,
    `Last session we asked "why does ${topic} matter?" Today we answer "how do we actually implement it?"`,
  ];
  return connectors[(sessionNumber + topic.length) % connectors.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: "Aha Moment" Phrases (NeetCode style)
// ---------------------------------------------------------------------------
const AHA_PHRASES = [
  'And HERE is the key insight that changes everything...',
  'Now this is the part that separates good from GREAT engineers...',
  'Once you understand THIS, the whole concept clicks...',
  'This is the secret that most tutorials don\'t tell you...',
  'Pay attention to this next part. This is GOLD for interviews...',
  'THIS is the trick. Once you see it, you can\'t unsee it...',
  'Here is the moment everything comes together...',
];

function getAhaPhrase(seed: number): string {
  return AHA_PHRASES[seed % AHA_PHRASES.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: Emotional Encouragement (Khan GS style)
// ---------------------------------------------------------------------------
const ENCOURAGEMENT = [
  'You are doing amazing. Most people give up at this point, but not you.',
  'I know this is challenging. But trust me, it gets easier with practice.',
  'If you have made it this far, you are already ahead of 90% of candidates.',
  'Take a breath. You are learning something that will change your career.',
  'Remember, every expert was once a beginner. You have got this.',
  'Stick with me here. This is the part where real understanding happens.',
  'The fact that you are still watching puts you ahead of the pack.',
];

function getEncouragement(seed: number): string {
  return ENCOURAGEMENT[seed % ENCOURAGEMENT.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: Interview Reality Check (NeetCode + real-world style)
// ---------------------------------------------------------------------------
function generateInterviewReality(topic: string): string {
  const realities = [
    `When an interviewer asks about ${topic}, they are not testing your memory. They want to see HOW you think about the problem.`,
    `Here is what most candidates get wrong about ${topic} in interviews. They jump straight to the solution without discussing trade-offs.`,
    `A senior engineer once told me... the best answer about ${topic} starts with WHY, not HOW.`,
    `In real interviews at ${getTopicExample(topic).company} and other top companies, ${topic} questions are about your thought process, not the perfect answer.`,
    `The number one mistake with ${topic} in interviews? Not asking clarifying questions first. Always confirm the constraints.`,
  ];
  return realities[topic.length % realities.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: WHY Context — adds "why it matters" suffix to code descriptions
// Makes narration educational, not just descriptive.
// ---------------------------------------------------------------------------
function addWhyContext(description: string, code: string, topic: string): string {
  const trimmed = code.trim().toLowerCase();
  const desc = description.toLowerCase();
  const topicLower = topic.toLowerCase();

  // Loop + server/node → distributing work
  if ((trimmed.includes('for') || trimmed.includes('while') || desc.includes('loop')) &&
      (trimmed.includes('server') || trimmed.includes('node') || trimmed.includes('worker') ||
       topicLower.includes('load balancing') || topicLower.includes('distributed'))) {
    return `${description} — to distribute the work evenly`;
  }

  // If-check + null/error handling
  if ((desc.includes('check if') || desc.includes('if ')) &&
      (trimmed.includes('null') || trimmed.includes('none') || trimmed.includes('error') ||
       trimmed.includes('undefined') || trimmed.includes('empty') || trimmed.includes('nil'))) {
    return `${description} — to handle the edge case that trips up most developers`;
  }

  // Return + result
  if (desc.includes('return')) {
    return `${description} — and that's our answer, clean and efficient`;
  }

  // Hash/map → O(1) lookups
  if (trimmed.includes('hashmap') || trimmed.includes('hash_map') || trimmed.includes('dict(') ||
      trimmed.includes('map(') || trimmed.includes('{}') || desc.includes('hash map') ||
      desc.includes('dictionary') || desc.includes('map for')) {
    return `${description} — for O(1) constant time lookups. This is why hash maps are interview gold`;
  }

  // Try/catch → production resilience
  if (trimmed.startsWith('try') || trimmed.startsWith('catch') || trimmed.startsWith('except') ||
      desc.includes('try block') || desc.includes('catch')) {
    return `${description} — because in production, things WILL fail, and we need to handle it gracefully`;
  }

  // Class definition → encapsulation
  if (desc.includes('class') && (desc.includes('define') || desc.includes('create'))) {
    return `${description} — this encapsulates all the complexity in one clean interface`;
  }

  // Sort/compare → order matters
  if (trimmed.includes('.sort') || trimmed.includes('sorted') || trimmed.includes('arrays.sort') ||
      trimmed.includes('compare') || trimmed.includes('compareto') ||
      desc.includes('sort') || desc.includes('order')) {
    return `${description} — because the order matters for our algorithm to work correctly`;
  }

  // Default: no suffix, keep it clean
  return description;
}

// ---------------------------------------------------------------------------
// Teaching Technique: Line-by-Line Code Walkthrough (Fireship style)
// ---------------------------------------------------------------------------
function generateCodeWalkthrough(code: string, _language: string, topic: string = ''): string {
  const lines = code.split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';

  // Identify "important" lines — skip blank, comments-only, closing braces, pass
  const important: { line: string; desc: string }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip uninteresting lines
    if (
      trimmed === '}' || trimmed === '};' || trimmed === ')' || trimmed === ');' ||
      trimmed === 'pass' || trimmed === 'else:' || trimmed === 'else {' ||
      trimmed === '{' || trimmed === '' ||
      (trimmed.startsWith('#') && !trimmed.startsWith('#!')) ||
      (trimmed.startsWith('//') && !trimmed.startsWith('///'))
    ) continue;

    const desc = describeCodeLine(line);
    important.push({ line, desc });
  }

  if (important.length === 0) return '';

  // Pick up to 6 key lines spread across the code for a thorough walkthrough
  const maxLines = Math.min(important.length, 6);
  const selected: typeof important = [];

  if (important.length <= 6) {
    // If 6 or fewer important lines, use them all
    selected.push(...important);
  } else {
    // Spread evenly: always include first and last, fill between
    selected.push(important[0]);
    const step = (important.length - 1) / (maxLines - 1);
    for (let i = 1; i < maxLines - 1; i++) {
      selected.push(important[Math.round(i * step)]);
    }
    selected.push(important[important.length - 1]);
  }

  // Build natural narration with varied connectors and WHY context
  const connectors = ['First, we', 'Now we', 'Here we', 'At this point, we', 'This is where we', 'Finally, we'];
  const parts: string[] = [];
  for (let i = 0; i < selected.length; i++) {
    const connector = i === 0 ? connectors[0]
      : i === selected.length - 1 ? connectors[connectors.length - 1]
      : connectors[Math.min(i, connectors.length - 2)];
    // Add WHY context to make narration educational, not just descriptive
    const enrichedDesc = addWhyContext(selected[i].desc, selected[i].line, topic);
    parts.push(`${connector} ${enrichedDesc}`);
  }

  return parts.join('. ') + '.';
}

function describeCodeLine(line: string): string {
  const trimmed = line.trim();

  // --- Class / struct definitions ---
  const classMatch = trimmed.match(/^(?:public\s+|private\s+|abstract\s+|static\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(\w+))?/);
  if (classMatch) {
    let desc = `define our ${classMatch[1]} class`;
    if (classMatch[2]) desc += ` that extends ${classMatch[2]}`;
    if (classMatch[3]) desc += ` implementing ${classMatch[3]}`;
    return desc;
  }

  // --- Function / method definitions ---
  const pyFuncMatch = trimmed.match(/^def\s+(\w+)\s*\(([^)]*)\)/);
  if (pyFuncMatch) {
    const name = pyFuncMatch[1];
    const params = pyFuncMatch[2].replace(/self,?\s*/, '').trim();
    if (params) return `define the ${name} function that takes ${describeParams(params)}`;
    return `define the ${name} function`;
  }
  const jsFuncMatch = trimmed.match(/^(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
  if (jsFuncMatch) {
    const name = jsFuncMatch[1];
    const params = jsFuncMatch[2].trim();
    const asyncPrefix = trimmed.startsWith('async') ? 'async ' : '';
    if (params) return `define the ${asyncPrefix}${name} function that takes ${describeParams(params)}`;
    return `define the ${asyncPrefix}${name} function`;
  }
  // Arrow functions: const name = (...) => or const name = async (...) =>
  const arrowMatch = trimmed.match(/^(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?([^)=]*)\)?\s*=>/);
  if (arrowMatch) {
    const name = arrowMatch[1];
    const asyncPrefix = trimmed.includes('async') ? 'async ' : '';
    return `define the ${asyncPrefix}${name} arrow function`;
  }
  // Java / TypeScript methods: public void methodName(...) or private int calculate(...)
  const javaMethodMatch = trimmed.match(/^(?:public|private|protected)\s+(?:static\s+)?(?:async\s+)?(?:\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/);
  if (javaMethodMatch) {
    const name = javaMethodMatch[1];
    const params = javaMethodMatch[2].trim();
    if (params) return `define the ${name} method that takes ${describeParams(params)}`;
    return `define the ${name} method`;
  }

  // --- Constructor ---
  if (trimmed.match(/^def\s+__init__\s*\(/)) {
    return 'set up the constructor to initialize our object';
  }

  // --- Decorators ---
  if (trimmed.startsWith('@')) {
    const decoratorName = trimmed.slice(1).split('(')[0];
    return `apply the @${decoratorName} decorator`;
  }

  // --- Import statements ---
  const pyImportMatch = trimmed.match(/^from\s+([\w.]+)\s+import\s+(.+)/);
  if (pyImportMatch) return `import ${pyImportMatch[2].trim()} from the ${pyImportMatch[1]} module`;
  const importMatch = trimmed.match(/^import\s+(?:\{?\s*(.+?)\s*\}?\s+from\s+)?['"]([\w./@-]+)['"]/);
  if (importMatch) {
    if (importMatch[1]) return `import ${importMatch[1].trim()} from ${importMatch[2]}`;
    return `import the ${importMatch[2]} module`;
  }
  if (trimmed.startsWith('import ')) {
    const modName = trimmed.replace('import ', '').split(/[\s;]/)[0];
    return `import the ${modName} module`;
  }

  // --- Return statements ---
  const returnMatch = trimmed.match(/^return\s+(.+)/);
  if (returnMatch) {
    const val = returnMatch[1].replace(/;$/, '').trim();
    if (val.length < 40) return `return ${val}`;
    if (val.includes('?') && val.includes(':')) return 'return the result based on our condition';
    if (val.startsWith('new ')) {
      const typeName = val.match(/new\s+(\w+)/);
      return `return a new ${typeName ? typeName[1] : 'instance'}`;
    }
    return 'return the computed result';
  }

  // --- Try/catch/except/finally ---
  if (trimmed.startsWith('try')) return 'wrap this in a try block to handle errors gracefully';
  if (trimmed.match(/^(?:except|catch)\s*\(?\s*(\w+)?/)) {
    const errType = trimmed.match(/(?:except|catch)\s*\(?\s*(\w+)/);
    if (errType) return `catch any ${errType[1]} errors`;
    return 'catch any errors that might occur';
  }
  if (trimmed.startsWith('finally')) return 'run our cleanup in the finally block';

  // --- Throw / raise ---
  const throwMatch = trimmed.match(/^(?:throw|raise)\s+(?:new\s+)?(\w+)/);
  if (throwMatch) return `throw a ${throwMatch[1]} if something goes wrong`;

  // --- Async / await ---
  if (trimmed.match(/^await\s+/)) {
    const awaitCall = trimmed.match(/^await\s+(\w+(?:\.\w+)*)\s*\(/);
    if (awaitCall) return `await the ${awaitCall[1]} call to get the result`;
    return 'await the asynchronous operation';
  }

  // --- For loops (detailed) ---
  const pyForMatch = trimmed.match(/^for\s+(\w+)\s+in\s+(?:range\((.+)\)|(\w+))/);
  if (pyForMatch) {
    if (pyForMatch[2]) return `loop ${pyForMatch[2]} times using ${pyForMatch[1]} as our counter`;
    return `loop through each ${pyForMatch[1]} in ${pyForMatch[3]}`;
  }
  const jsForOfMatch = trimmed.match(/^for\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(\w+)/);
  if (jsForOfMatch) return `loop through each ${jsForOfMatch[1]} in ${jsForOfMatch[2]}`;
  const jsForMatch = trimmed.match(/^for\s*\(\s*(?:let|int|var)\s+(\w+)\s*=\s*(\d+)\s*;\s*\w+\s*[<>=!]+\s*(.+?)\s*;/);
  if (jsForMatch) return `loop from ${jsForMatch[2]} up to ${jsForMatch[3].replace(/;$/, '')} using ${jsForMatch[1]}`;
  if (trimmed.startsWith('for ') || trimmed.startsWith('for(')) return 'iterate through each element';

  // --- While loops ---
  const whileMatch = trimmed.match(/^while\s*\(?\s*(.+?)\s*\)?\s*[:{]?\s*$/);
  if (whileMatch) {
    const cond = whileMatch[1].replace(/[{:]$/, '').trim();
    if (cond === 'True' || cond === 'true') return 'keep looping until we explicitly break out';
    if (cond.length < 30) return `keep looping while ${cond}`;
    return 'keep looping as long as our condition holds';
  }

  // --- If / elif / else if (detailed) ---
  const ifMatch = trimmed.match(/^(?:if|elif|else\s+if)\s*\(?\s*(.+?)\s*\)?\s*[:{]?\s*$/);
  if (ifMatch) {
    const cond = ifMatch[1].replace(/[{:]$/, '').trim();
    const prefix = trimmed.startsWith('elif') || trimmed.startsWith('else if') ? 'otherwise, check if' : 'check if';
    if (cond.includes(' is None') || cond.includes(' == None') || cond.includes(' === null') || cond.includes(' == null'))
      return `${prefix} the value is null`;
    if (cond.includes(' not in ') || cond.includes('.includes(') || cond.includes(' in '))
      return `${prefix} the element exists in our collection`;
    if (cond.includes('.length') || cond.includes('len('))
      return `${prefix} the size meets our requirement`;
    if (cond.includes(' > ') || cond.includes(' < ') || cond.includes(' >= ') || cond.includes(' <= '))
      return `${prefix} ${cond.length < 35 ? cond : 'our boundary condition'}`;
    if (cond.includes(' == ') || cond.includes(' === ') || cond.includes(' != ') || cond.includes(' !== '))
      return `${prefix} ${cond.length < 35 ? cond : 'the values match'}`;
    if (cond.length < 30) return `${prefix} ${cond}`;
    return `${prefix} our condition is met`;
  }

  // --- Switch / case ---
  const switchMatch = trimmed.match(/^switch\s*\(\s*(\w+)\s*\)/);
  if (switchMatch) return `switch on the value of ${switchMatch[1]}`;
  const caseMatch = trimmed.match(/^case\s+(.+?):/);
  if (caseMatch) return `handle the case where it equals ${caseMatch[1]}`;
  if (trimmed.startsWith('default:')) return 'handle the default case';
  if (trimmed === 'break;' || trimmed === 'break') return 'break out of the current block';

  // --- Variable declarations with meaningful content ---
  const constAssignMatch = trimmed.match(/^(?:const|let|var|final)\s+(\w+)(?:\s*:\s*\w+(?:<[^>]+>)?)?\s*=\s*(.+)/);
  if (constAssignMatch) {
    const varName = constAssignMatch[1];
    const value = constAssignMatch[2].replace(/;$/, '').trim();
    if (value.startsWith('new ')) {
      const typeName = value.match(/new\s+(\w+)/);
      return `create a new ${typeName ? typeName[1] : 'instance'} called ${varName}`;
    }
    if (value.includes('.map(') || value.includes('.filter(') || value.includes('.reduce('))
      return `transform our data and store it in ${varName}`;
    if (value.match(/^\[/) || value.startsWith('Array')) return `initialize the ${varName} array`;
    if (value.match(/^\{/)) return `set up the ${varName} config object`;
    if (value.match(/^['"`]/)) return `set ${varName} to ${value.length < 25 ? value : 'our string value'}`;
    if (value.match(/^\d/)) return `set ${varName} to ${value}`;
    if (value.includes('(')) {
      const callName = value.match(/(\w+(?:\.\w+)*)\s*\(/);
      if (callName) return `call ${callName[1]} and store the result in ${varName}`;
    }
    return `initialize ${varName} with our value`;
  }

  // --- self.x / this.x assignments ---
  const selfAssign = trimmed.match(/^(?:self|this)\.(\w+)\s*=\s*(.+)/);
  if (selfAssign) {
    const prop = selfAssign[1];
    const val = selfAssign[2].replace(/;$/, '').trim();
    if (val.match(/^\[/) || val.includes('ArrayList') || val.includes('list(')) return `initialize the ${prop} collection on our instance`;
    if (val.match(/^\{/) || val.includes('HashMap') || val.includes('dict(')) return `set up the ${prop} map on our instance`;
    if (val.match(/^\d/)) return `set ${prop} to ${val}`;
    return `store ${prop} on our instance`;
  }

  // --- Python variable assignment: name = value ---
  const pyAssignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)/);
  if (pyAssignMatch && !trimmed.includes('==')) {
    const varName = pyAssignMatch[1];
    const value = pyAssignMatch[2].trim();
    if (value.startsWith('[') || value.startsWith('list(')) return `initialize the ${varName} list`;
    if (value.startsWith('{') || value.startsWith('dict(')) return `set up the ${varName} dictionary`;
    if (value.match(/^\d/)) return `set ${varName} to ${value}`;
    if (value.includes('(')) {
      const callName = value.match(/(\w+(?:\.\w+)*)\s*\(/);
      if (callName) return `call ${callName[1]} and store the result in ${varName}`;
    }
    return `assign ${value.length < 25 ? value : 'our value'} to ${varName}`;
  }

  // --- super() calls ---
  if (trimmed.match(/^super\s*\(/)) return 'call the parent class constructor with super()';
  if (trimmed.match(/^super\.\w+\(/)) {
    const superMethod = trimmed.match(/^super\.(\w+)\(/);
    return `call the parent's ${superMethod ? superMethod[1] : ''} method`;
  }

  // --- HashMap / ArrayList / data structure creation ---
  if (trimmed.includes('HashMap') || trimmed.includes('TreeMap') || trimmed.includes('LinkedHashMap'))
    return 'create a hash map for fast key-value lookups';
  if (trimmed.includes('ArrayList') || trimmed.includes('LinkedList'))
    return 'create a list to store our elements dynamically';
  if (trimmed.includes('HashSet') || trimmed.includes('TreeSet'))
    return 'create a set for fast uniqueness checks';
  if (trimmed.includes('PriorityQueue') || trimmed.includes('heapq'))
    return 'create a priority queue to always grab the best element first';
  if (trimmed.includes('Stack') || trimmed.includes('Deque') || trimmed.includes('deque'))
    return 'create a stack or deque for efficient push and pop';

  // --- Collection operations ---
  if (trimmed.includes('.append(') || trimmed.includes('.push(') || trimmed.includes('.add(')) {
    const argMatch = trimmed.match(/\.(?:append|push|add)\((.+?)\)/);
    if (argMatch && argMatch[1].length < 25) return `add ${argMatch[1]} to our collection`;
    return 'add the element to our collection';
  }
  if (trimmed.includes('.pop(')) return 'remove and grab the last element';
  if (trimmed.includes('.remove(')) return 'remove the element from our collection';
  if (trimmed.includes('.get(')) {
    const keyMatch = trimmed.match(/\.get\((.+?)(?:,|\))/);
    if (keyMatch && keyMatch[1].length < 20) return `look up ${keyMatch[1]} in our map`;
    return 'look up the value in our map';
  }
  if (trimmed.includes('.put(') || trimmed.includes('.set(')) return 'insert the key-value pair into our map';
  if (trimmed.includes('.sort(') || trimmed.includes('.sorted(') || trimmed.includes('Arrays.sort'))
    return 'sort the collection so we can process elements in order';
  if (trimmed.includes('.reverse(')) return 'reverse the order of our elements';

  // --- Map/filter/reduce chains ---
  if (trimmed.includes('.map(')) return 'transform each element using map';
  if (trimmed.includes('.filter(')) return 'filter down to only the elements we need';
  if (trimmed.includes('.reduce(')) return 'reduce our collection down to a single value';
  if (trimmed.includes('.forEach(') || trimmed.includes('.each(')) return 'process each element one by one';

  // --- Print / log statements ---
  if (trimmed.startsWith('print(') || trimmed.startsWith('print ')) {
    const argMatch = trimmed.match(/print\s*\(?\s*(.+?)\s*\)?\s*$/);
    if (argMatch && argMatch[1].length < 30) return `print ${argMatch[1]} to verify our result`;
    return 'print the output to verify it works';
  }
  if (trimmed.includes('console.log(') || trimmed.includes('System.out.print'))
    return 'log the output to verify it works';

  // --- List comprehensions / generator expressions ---
  if (trimmed.includes(' for ') && trimmed.includes(' in ') && (trimmed.includes('[') || trimmed.includes('(')))
    return 'build our result using a comprehension for clean, concise code';

  // --- Type annotations / interface ---
  if (trimmed.startsWith('interface ')) {
    const name = trimmed.match(/interface\s+(\w+)/);
    return `define the ${name ? name[1] : ''} interface`;
  }
  if (trimmed.startsWith('type ')) {
    const name = trimmed.match(/type\s+(\w+)/);
    return `define the ${name ? name[1] : ''} type`;
  }
  if (trimmed.startsWith('enum ')) {
    const name = trimmed.match(/enum\s+(\w+)/);
    return `define the ${name ? name[1] : ''} enum`;
  }

  // --- Yield ---
  if (trimmed.startsWith('yield ')) return 'yield the next value from our generator';

  // --- Assert ---
  if (trimmed.startsWith('assert ')) return 'assert that our assumption holds true';

  // --- Smart fallback: extract meaning from the line itself ---
  // Method call: something.method(...)
  const methodCallMatch = trimmed.match(/(?:(\w+)\.)?(\w+)\s*\(([^)]*)\)/);
  if (methodCallMatch) {
    const obj = methodCallMatch[1];
    const method = methodCallMatch[2];
    if (obj) return `call ${obj}.${method}() to process our data`;
    return `call ${method}() to handle the operation`;
  }

  // Assignment with operator: x += y, x -= y, etc.
  const compoundAssign = trimmed.match(/(\w+)\s*([+\-*/%])=\s*(.+)/);
  if (compoundAssign) {
    const ops: Record<string, string> = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'take modulo of' };
    const op = ops[compoundAssign[2]] || 'update';
    return `${op} ${compoundAssign[3].replace(/;$/, '').trim()} ${compoundAssign[2] === '+' ? 'to' : 'from'} ${compoundAssign[1]}`;
  }

  // Last resort: if line is short enough, describe it literally
  if (trimmed.length < 35) return `execute ${trimmed.replace(/;$/, '')}`;
  return `handle the ${trimmed.split(/[({=]/)[0].trim().slice(0, 30)} operation`;
}

/** Turn a parameter string like "servers, count: int" into readable text */
function describeParams(params: string): string {
  const paramList = params.split(',').map(p => p.trim().split(/[:\s]/)[0]).filter(Boolean);
  if (paramList.length === 0) return 'no parameters';
  if (paramList.length === 1) return paramList[0];
  if (paramList.length === 2) return `${paramList[0]} and ${paramList[1]}`;
  return paramList.slice(0, -1).join(', ') + ', and ' + paramList[paramList.length - 1];
}

// ---------------------------------------------------------------------------
// Storytelling Arc: THE PROBLEM — Set up tension
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Myth Buster Opening — topic-specific wrong facts + dramatic reveal
// Creates a "wait, WHAT?!" moment in the first 30 seconds
// ---------------------------------------------------------------------------
function generateTopicMyths(topic: string): { myths: string[]; mythBullets: string[]; reveal: string } {
  const ex = getTopicExample(topic);
  const lower = topic.toLowerCase();

  // Topic-specific myth sets — 3 wrong "facts" that sound believable
  const MYTH_SETS: Record<string, { myths: string[]; mythBullets: string[]; reveal: string }> = {
    'kafka': {
      myths: [
        `Fact number 1: Kafka is just a message queue, like RabbitMQ.`,
        `Fact number 2: Kafka guarantees exactly-once delivery out of the box.`,
        `Fact number 3: More partitions always means better performance.`,
      ],
      mythBullets: ['Kafka = Message Queue?', 'Exactly-once by default?', 'More partitions = faster?'],
      reveal: `Kafka is NOT a message queue. It's a distributed commit log. Exactly-once requires idempotent producers AND transactional consumers. And too many partitions actually HURT performance. Let me explain each one.`,
    },
    'caching': {
      myths: [
        `Fact number 1: Caching always makes your system faster.`,
        `Fact number 2: Redis is the only caching solution you need.`,
        `Fact number 3: Cache invalidation is just setting a TTL.`,
      ],
      mythBullets: ['Cache = Always faster?', 'Redis for everything?', 'TTL = Invalidation?'],
      reveal: `Caching can actually make your system SLOWER if you cache wrong data. Redis is great but sometimes an in-memory HashMap is better. And cache invalidation? It's one of the two hardest problems in computer science. Let me show you why.`,
    },
    'load balancing': {
      myths: [
        `Fact number 1: Round robin is the best load balancing algorithm.`,
        `Fact number 2: A load balancer eliminates all single points of failure.`,
        `Fact number 3: Load balancers only work at the network level.`,
      ],
      mythBullets: ['Round Robin = Best?', 'No single point of failure?', 'Network level only?'],
      reveal: `Round robin ignores server health completely. The load balancer ITSELF can be a single point of failure. And modern load balancing happens at Layer 4 AND Layer 7. Let me break this down properly.`,
    },
    'api gateway': {
      myths: [
        `Fact number 1: An API gateway is just a reverse proxy.`,
        `Fact number 2: You always need an API gateway in microservices.`,
        `Fact number 3: API gateways add latency and should be avoided.`,
      ],
      mythBullets: ['Just a reverse proxy?', 'Always needed?', 'Adds latency?'],
      reveal: `An API gateway does authentication, rate limiting, circuit breaking, and request transformation — way more than a reverse proxy. Sometimes you DON'T need one. And the latency argument? ${ex.company} routes ${ex.scale} through one. Let me show you the real picture.`,
    },
    'microservices': {
      myths: [
        `Fact number 1: Microservices are always better than monoliths.`,
        `Fact number 2: Each microservice should have its own database.`,
        `Fact number 3: If Netflix uses microservices, so should you.`,
      ],
      mythBullets: ['Always better than monolith?', 'Own database each?', 'Copy Netflix?'],
      reveal: `Most startups should START with a monolith. Shared databases are fine early on. And Netflix has 2000 engineers — you probably have 5. Copying their architecture will KILL your velocity. Let me show you when microservices actually make sense.`,
    },
    'database': {
      myths: [
        `Fact number 1: NoSQL is faster than SQL for everything.`,
        `Fact number 2: Indexes always speed up your queries.`,
        `Fact number 3: Normalization is always the right approach.`,
      ],
      mythBullets: ['NoSQL > SQL always?', 'Indexes = Always fast?', 'Always normalize?'],
      reveal: `SQL beats NoSQL for complex queries and ACID transactions. Too many indexes SLOW down writes. And denormalization is sometimes the right call for read-heavy systems. ${ex.company} uses BOTH SQL and NoSQL. Let me explain when to use which.`,
    },
  };

  // Find topic-specific myths
  for (const [key, myths] of Object.entries(MYTH_SETS)) {
    if (lower.includes(key)) return myths;
  }

  // Generic fallback — works for any topic
  return {
    myths: [
      `Fact number 1: ${topic} is simple once you read the documentation.`,
      `Fact number 2: There's one correct way to implement ${topic}.`,
      `Fact number 3: You only need to know ${topic} basics for interviews.`,
    ],
    mythBullets: ['Simple from docs?', 'One correct way?', 'Basics enough?'],
    reveal: `The documentation tells you WHAT, not WHY or WHEN. There are always multiple approaches with different trade-offs. And interviewers test ADVANCED ${topic} — basics won't cut it at ${ex.company}. Let me teach you the real deal.`,
  };
}

// ---------------------------------------------------------------------------
// Storytelling Arc: THE PROBLEM — Set up tension
// ---------------------------------------------------------------------------
function generateProblemSetup(topic: string): string {
  const ex = getTopicExample(topic);
  const problems = [
    `100 users. Fine. 10,000 users. Struggling. 10 million users. Dead. Your server crashes. Users see error pages. Boss is calling. This is what ${topic} prevents. Miss this, and you WILL face this nightmare.`,

    `${ex.company}. ${ex.scale}. Zero downtime. How? ${topic}. Without it, their system would collapse in minutes. Real companies die from this. Every single day.`,

    `Works in testing. Ships to production. Three months later, traffic grows 50x. Everything collapses. The missing piece? ${topic}. Every. Single. Time.`,

    `3 AM. Production outage. On-call engineer, stressed, tired, desperately googling ${topic}. Don't be that engineer. Learn this now.`,

    `System design interview. "Design for one billion requests per day." Brain goes blank? That's because you don't know ${topic} yet. You will in 7 minutes.`,

    `${ex.company} processes ${ex.scale}. Zero crashes. The secret? ${topic}. Most engineers have no idea how it actually works.`,
  ];

  const seed = topic.length % problems.length;
  return problems[seed];
}

// ---------------------------------------------------------------------------
// Storytelling Arc: WRONG ANSWER — Create contrast
// ---------------------------------------------------------------------------
function generateWrongAnswer(topic: string): string {
  const wrongAnswers = [
    `Most people answer ${topic} questions by reciting the textbook. Parrot mode. Interviewer learns nothing. Technically correct. Completely useless. Instant reject signal.`,

    `${topic} as a buzzword? Easy. ${topic} under pressure? People crumble. Push them on trade-offs. Push them on edge cases. They fall apart. Interviewers push. Hard.`,

    `Memorized the Wikipedia article? Cool. One follow-up question and that confidence crumbles. Memorization is not understanding.`,

    `They learn WHAT ${topic} does. Never WHY it exists. Never what happens when it fails. That gap? That's exactly where interviewers live. That's where offers are lost.`,

    `Used ${topic} once in a project? That's not understanding. Engineers with 10 years experience can't explain the trade-offs. Don't be that engineer.`,

    `One approach. One answer. Done, right? Wrong. ${topic} is ALL trade-offs. The right answer depends on context. Understanding THAT is what gets you hired.`,
  ];

  const seed = (topic.length * 3) % wrongAnswers.length;
  return wrongAnswers[seed];
}

// ---------------------------------------------------------------------------
// Storytelling Arc: THE REAL ANSWER — Transition into deep dive
// ---------------------------------------------------------------------------
function generateRealAnswer(topic: string): string {
  const realAnswers = [
    `Forget the textbook. First principles only. ${topic} solves ONE core problem. See that problem clearly, and everything clicks.`,

    `How ${topic} ACTUALLY works. Not the tutorial version. The real thing. What senior engineers at ${getTopicExample(topic).company} use daily. Made simple.`,

    `${topic}. One core problem. Once you see it, everything else is details. Three key ideas. Master those three, answer any interview question. Here they are.`,

    `The truth about ${topic}? It's not one solution. It's a family of trade-offs. Knowing WHICH to apply WHEN — that's the real skill. Breaking it down now.`,

    `Three ideas. That's it. Three ideas and you own ${topic}. Ready? Let's go.`,

    `Step by step. Code. Visuals. Real examples. ${topic} explained the way it should be taught. No fluff. Pure signal.`,
  ];

  const seed = (topic.length * 5) % realAnswers.length;
  return realAnswers[seed];
}

// ---------------------------------------------------------------------------
// Interview Secret (with guru-sishya.in reference)
// ---------------------------------------------------------------------------
function generateInterviewSecret(topic: string): string {
  const secrets = [
    `Here's the interview secret that most prep courses won't tell you. When they ask about ${topic}, they're not testing your memory. They want to see HOW you think. Start with the problem, walk through the trade-offs, and explain your reasoning out loud. That alone puts you in the top 10 percent. And you can practice this exact skill with interactive mock interviews on guru-sishya.in slash ${topic.toLowerCase().replace(/\s+/g, '-')}.`,

    `The number one thing interviewers look for in ${topic} questions is this: can you reason about failure modes? What happens when things go wrong? How do you detect it? How do you recover? If you can discuss the unhappy path fluently, you've already won. Practice this pattern on the ${topic} module at guru-sishya.in slash ${topic.toLowerCase().replace(/\s+/g, '-')}.`,

    `Want to know what ACTUALLY impresses interviewers? It's not reciting the textbook answer on ${topic}. It's asking clarifying questions first. "What's the expected scale? What are the consistency requirements? What's the latency budget?" These questions show senior-level thinking. You can drill this skill on guru-sishya.in slash ${topic.toLowerCase().replace(/\s+/g, '-')}.`,

    `Here's the insider trick for ${topic} interviews. Always tie your answer to real numbers. Don't say "it's faster." Say "it reduces P99 latency from 200 milliseconds to 15 milliseconds." Quantifying your answers makes you unforgettable. The quiz system on guru-sishya.in slash ${topic.toLowerCase().replace(/\s+/g, '-')} trains you to think exactly this way.`,

    `I'll let you in on a secret. The best answer to a ${topic} question starts with "it depends." Then you explain WHAT it depends on. This shows the interviewer you understand nuance, not just definitions. And that's the difference between an offer and a rejection. Practice weighing these trade-offs on guru-sishya.in slash ${topic.toLowerCase().replace(/\s+/g, '-')}.`,
  ];

  const seed = (topic.length * 11) % secrets.length;
  return secrets[seed];
}

// ---------------------------------------------------------------------------
// Practice Question Narration (with guru-sishya.in reference)
// ---------------------------------------------------------------------------
function generatePracticeNarration(question: string, topic: string): string {
  const intros = [
    `Okay, pop quiz time. Don't scroll ahead. Think about this for a second before I give you the answer.`,
    `Alright, let's test if you were really paying attention. Here's a question that comes up all the time in interviews.`,
    `Now I want you to pause this video for 10 seconds and think about this. Seriously. Pausing and thinking is how you actually learn.`,
    `Here's a question that trips up even experienced developers. See if you can get it right.`,
    `Before we wrap up, let me challenge you with this. If you can answer it, you truly understand ${topic}.`,
  ];

  const seed = question.length % intros.length;
  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');
  return `${intros[seed]} ${question} You can practice more questions like this with detailed explanations on guru-sishya.in slash ${topicSlug}.`;
}

// ---------------------------------------------------------------------------
// Clean Answer Generator — produces a concise visual answer for review questions
// The narration is for TTS (spoken), the clean answer is for on-screen display.
// ---------------------------------------------------------------------------
/**
 * Generate a clean, topic-specific answer for a review question.
 * Uses the session content to extract relevant information rather than
 * producing generic placeholder text.
 */
function generateCleanAnswer(question: string, topic: string, sessionContent?: string): string {
  const q = question.toLowerCase();
  const content = (sessionContent || '').toLowerCase();

  // ── Topic-specific answer databases ──
  // These provide concrete, interview-quality answers keyed by topic + question pattern.
  const TOPIC_ANSWERS: Record<string, Record<string, string>> = {
    'load balancing': {
      'hardware.*software|difference.*load balancer':
        'Hardware LBs (F5 BIG-IP, Citrix ADC): $20K-$100K+, millions conn/sec, firmware-limited\nSoftware LBs (Nginx, HAProxy, AWS ALB): free/usage-based, fully programmable, cloud-native\nModern standard: software LBs dominate cloud architectures',
      'least connections.*round robin|when.*least|when.*round':
        'Use Least Connections when requests have variable processing times (mix of fast API calls and slow DB queries)\nUse Round Robin only when all servers are identical AND all requests cost the same\nExample: API gateway with mixed read/write operations needs Least Connections',
      'health check|three types.*health|deep health':
        'Passive: detect failures from real traffic (5 consecutive 5xx errors)\nActive: periodic probe requests (GET /health every 5-10s, 3-failure threshold)\nDeep: verify dependencies (DB, cache, external APIs) are healthy too\nDeep checks catch "alive but broken" servers',
      'layer 4.*layer 7|l4.*l7':
        'Layer 4 (Transport): routes by IP+port, no packet inspection, fastest\nProducts: AWS NLB, HAProxy TCP mode\nLayer 7 (Application): inspects HTTP headers/URLs/cookies, SSL termination, content routing\nProducts: Nginx, AWS ALB, Envoy\nUse both: L4 in front distributing to multiple L7 LBs',
      'consistent hashing|minimize.*disruption|adding.*removing':
        'Consistent hashing uses a virtual ring where servers and keys are mapped to positions\nWhen adding/removing a server, only K/N keys need remapping (K=total keys, N=servers)\nVirtual nodes (150+) ensure even distribution\nUsed by Cassandra, DynamoDB, Memcached',
      'design.*100k|100.*thousand.*request|mixed.*capacity':
        'Two-tier: L4 LB at edge distributing to multiple L7 LBs\nAlgorithm: Weighted Least Connections (weights reflect server CPU/memory)\nHealth checks: active every 5s, 3-failure threshold\nSession: Redis-backed stores (stateless backends)\nCircuit breakers + auto-scaling based on p99 latency and error rate',
    },
    'system design': {
      'reshaded|framework|each step':
        'R-Requirements (3min): clarify functional + non-functional\nE-Estimation (3min): QPS, storage, bandwidth\nS-Storage (5min): SQL vs NoSQL, schema\nH-High-Level Design (5min): components + data flow\nA-API Design (3min): endpoints, request/response\nD-Detailed Design (10min): deep dive 2-3 components\nE-Evaluation (3min): tradeoffs, bottlenecks\nD-Deployment (3min): scaling, monitoring',
      'postgresql.*dynamodb|sql.*nosql|when.*choose':
        'PostgreSQL: structured data, complex JOINs, ACID transactions (banking, e-commerce orders)\nDynamoDB: flexible schema, horizontal scaling, key-value lookups (social feeds, IoT)\nInstagram runs on PostgreSQL. Discord moved from Cassandra to ScyllaDB\nAnswer depends on access patterns and consistency needs',
      'qps.*storage|calculate|50 million':
        'DAU 50M x 5 req/user = 250M daily requests\nAvg QPS: 250M / 86400 = 2,894 QPS\nPeak QPS: ~8,700 (3x average)\nStorage: 250M x 1KB = 250GB/day = 91TB/year\nBandwidth: 2,894 x 1KB x 8 = 23 Mbps',
      'consistent hashing|why.*better.*modulo':
        'Modulo sharding: adding 1 server remaps nearly ALL keys (N/(N+1) keys move)\nConsistent hashing: only K/N keys remapped (minimal disruption)\nVirtual nodes ensure even distribution across the ring\nUsed by Cassandra, DynamoDB, Memcached for data partitioning',
      'cache.*invalidation|three.*strategies':
        'Write-through: write to cache + DB simultaneously (consistent but slower)\nWrite-behind: write to cache, async DB write (fast but risk of data loss)\nCache-aside: app manages cache manually with TTL (most common)\nMost systems use cache-aside with TTL-based expiration',
      'url shortener|design.*url':
        'Base62 encoding of auto-increment ID or hash\nRead-heavy: cache popular URLs in Redis\nStorage: SQL for URL mapping, NoSQL for analytics\n301 redirect for SEO, 302 for tracking\nRate limiting to prevent abuse',
    },
    'hash map': {
      'three properties|good hash function':
        'Deterministic: same key always produces the same hash\nUniform: keys spread evenly across all buckets\nFast: computing the hash takes O(1) time\nReal-world: Python uses SipHash (security against collision attacks), Java uses key.hashCode() ^ (h >>> 16)',
      'chaining.*open addressing|separate.*open|when.*prefer':
        'Separate Chaining: linked list per bucket, extra memory, poor cache locality\nUsed by: Java HashMap, Go map\nOpen Addressing: all entries in-array, compact, excellent cache performance\nUsed by: Python dict, Rust HashMap\nPrefer chaining when load factor is high; open addressing when memory locality matters',
      'load factor|threshold|resizing':
        'Load factor = entries / buckets. Java threshold: 0.75, Python: ~0.66\nWhen exceeded: capacity doubles, ALL entries rehashed (O(n) operation)\nJava HashMap: 16 -> 32 -> 64 -> 128...\nAmortized insertion remains O(1)\nPre-size when entry count is known to avoid expensive resizes',
      'two sum|time.*space':
        'Use HashMap to store {value: index} as you iterate\nFor each number, check if (target - number) exists in the map\nTime: O(n) single pass, Space: O(n) for the map\nReplaces O(n^2) brute force nested loops',
      'red-black tree|treeif|8 entries|java.*convert':
        'When a bucket exceeds 8 entries, Java converts the linked list to a red-black tree\nImproves worst-case from O(n) to O(log n) per bucket\nPrevents hash collision DoS attacks from degrading performance\nConverts back to linked list when bucket drops below 6 entries',
      'python list.*key|mutable.*key|dictionary key':
        'Lists are mutable so their hash could change after insertion\nThis would make the key unfindable in the wrong bucket\nUse tuples instead (immutable, hashable)\nIn Java: modifying an object used as HashMap key causes the same problem',
    },
  };

  // Try to find a topic-specific answer
  const topicKey = topic.toLowerCase();
  const topicAnswers = TOPIC_ANSWERS[topicKey];
  if (topicAnswers) {
    for (const [pattern, answer] of Object.entries(topicAnswers)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(question)) {
        return answer;
      }
    }
  }

  // ── Content-aware fallback: extract relevant sentences from session content ──
  if (sessionContent) {
    const relevantAnswer = extractAnswerFromContent(question, sessionContent);
    if (relevantAnswer) return relevantAnswer;
  }

  // ── Pattern-based fallback (still topic-aware) ──
  if (q.includes('difference between')) {
    return `Key differences in ${topic}:\n- Different approaches serve different scale requirements\n- Performance characteristics vary under load\n- Choose based on your specific use case and constraints`;
  }

  if (q.includes('when would you') || q.includes('when should you')) {
    return `When to apply in ${topic}:\n- High throughput with predictable latency requirements\n- System needs horizontal scalability\n- Trade-offs favor this approach for your constraints`;
  }

  return `Key points about ${topic}:\n- Understand the core problem it solves\n- Know the main approaches and their trade-offs\n- Be ready to discuss real-world applications and failure modes`;
}

/**
 * Extract a relevant answer from the session content by finding sentences
 * that match keywords from the question.
 */
function extractAnswerFromContent(question: string, content: string): string | null {
  // Strip markdown formatting, code blocks, mermaid diagrams, ASCII art before extracting
  const cleanContent = content
    .replace(/```[\s\S]*?```/g, '')           // Remove fenced code blocks (including mermaid)
    .replace(/`[^`]+`/g, '')                  // Remove inline code
    .replace(/^#{1,6}\s+/gm, '')              // Remove heading markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove markdown links
    .replace(/[*_~]+/g, '')                   // Remove bold/italic/strikethrough
    .replace(/[┌┐└┘├┤┬┴┼─│╔╗╚╝║═]+/g, '')  // Remove ASCII art box characters
    .replace(/^\s*[-|]\s*/gm, '')             // Remove list markers and table pipes
    .replace(/\n{2,}/g, '\n');                // Collapse multiple newlines

  // Extract key nouns/phrases from the question (skip common words)
  const stopWords = new Set(['what', 'is', 'the', 'a', 'an', 'and', 'or', 'how', 'does', 'do',
    'when', 'would', 'you', 'your', 'give', 'name', 'explain', 'why', 'each', 'for',
    'of', 'in', 'to', 'with', 'between', 'are', 'can', 'be', 'it', 'its', 'that',
    'this', 'from', 'by', 'on', 'at', 'use', 'specific', 'concrete', 'scenario']);

  const keywords = question.toLowerCase()
    .replace(/[?.,!'"]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return null;

  // Split cleaned content into sentences
  const sentences = cleanContent.split(/[.!?]\s+/).filter(s => s.length > 20);

  // Score each sentence by keyword matches
  const scored = sentences.map(sentence => {
    const lower = sentence.toLowerCase();
    const score = keywords.reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0);
    return { sentence: sentence.trim(), score };
  });

  // Take top 3 most relevant sentences
  const top = scored
    .filter(s => s.score >= 2) // At least 2 keyword matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (top.length === 0) return null;

  return top.map(s => '- ' + s.sentence.replace(/^[-*]\s*/, '').slice(0, 120)).join('\n');
}

// ---------------------------------------------------------------------------
// Summary + CTA Narration (with guru-sishya.in reference)
// ---------------------------------------------------------------------------
function generateSummaryNarration(topic: string, objectives: string[], nextTopic?: string, sessionNumber: number = 1, totalSessions?: number): string {
  const topObjectives = objectives.slice(0, 3).join('. ');
  const closingEncouragement = getEncouragement(topic.length);

  // "You now know how to..." closing — specific skills from objectives
  const skill1 = objectives[0] ?? `understand ${topic}`;
  const skill2 = objectives[1] ?? `apply ${topic} in code`;
  const youLearnedClose = `You now know how to ${skill1.toLowerCase().replace(/^understand\s+/i, 'understand ')}, ${skill2.toLowerCase()}, and explain the trade-offs in an interview.`;

  // Cliffhanger ending — series-aware, stronger than simple "don't miss it"
  let nextEpisodeTease = '';
  if (nextTopic) {
    const cliffSeed = (topic.length + sessionNumber) % CLIFFHANGER_ENDINGS.length;
    nextEpisodeTease = ` ${CLIFFHANGER_ENDINGS[cliffSeed](topic, nextTopic)}`;
  } else if (totalSessions && sessionNumber < totalSessions) {
    nextEpisodeTease = ` But we're not done. Next session reveals the part about ${topic} that breaks at ${getTopicExample(topic).company} scale. The part interviewers LOVE to ask about. Subscribe. You don't want to miss it.`;
  } else if (totalSessions && sessionNumber === totalSessions) {
    nextEpisodeTease = ` You've completed the entire ${topic} series. You're now in the top 5% of candidates for this topic. Go crush that interview.`;
  }

  const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');

  // RETENTION FIX: Cliffhanger goes LAST, not buried before CTA.
  // The last sentence the viewer hears determines whether they click the next video.
  // Structure: quick recap -> skills gained -> cliffhanger (the final emotional hit)
  const summaries = [
    `Alright, quick recap. ${topObjectives}. ${youLearnedClose} ${closingEncouragement} Practice at guru-sishya.in slash ${topicSlug}. Drop a like if this clicked.${nextEpisodeTease}`,

    `Bottom line. ${topObjectives}. ${youLearnedClose} ${closingEncouragement} Structured path at guru-sishya.in slash ${topicSlug}.${nextEpisodeTease}`,

    `Here's what matters. ${youLearnedClose} ${closingEncouragement} Practice at guru-sishya.in slash ${topicSlug}.${nextEpisodeTease}`,
  ];

  const seed = topic.length % summaries.length;
  return summaries[seed];
}

// ---------------------------------------------------------------------------
// Conversational Tone (makeConversational)
// Transforms formal textbook prose into friendly, teacher-like narration.
// ---------------------------------------------------------------------------
// Anti-patterns that cause instant viewer drop-off (research-backed)
const ANTI_PATTERNS = [
  /\b(welcome to|in this video|let's begin|let's get started|before we begin)\b/gi,
  /\b(hey guys|what's up|don't forget to|without further ado)\b/gi,
  /\b(first things first|if you're new here|as always|I hope you're doing well)\b/gi,
  /\b(it is important to note that|it should be noted that|it is worth mentioning)\b/gi,
  /\b(as we all know|as you may know|as we discussed|as mentioned earlier)\b/gi,
  /\b(let me explain|let me tell you|I want to talk about|I'd like to discuss)\b/gi,
  /\b(bear with me|this is going to be a long one|I'll try to keep this short)\b/gi,
  /\b(make sure to watch until the end|stay tuned)\b/gi,
];

function makeConversational(text: string): string {
  let result = text
    // Fix academic phrasing
    .replace(/utilize/gi, 'use')
    .replace(/subsequently/gi, 'then')
    .replace(/functionality/gi, 'feature')
    .replace(/in order to/gi, 'to')
    .replace(/However,/g, "But")
    .replace(/Furthermore,/g, "Also,")
    .replace(/Therefore,/g, "So")
    .replace(/In addition,/g, "Plus,")
    .replace(/It is essential to/gi, "You need to")
    .replace(/One must/gi, "You should")
    .replace(/It can be observed that/gi, "Notice:")
    .replace(/This demonstrates/gi, "This shows");

  // Strip anti-patterns (research: cause instant drop-off)
  for (const pattern of ANTI_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Strip completion signals
  result = stripCompletionSignals(result);

  // Clean up double spaces and leading/trailing whitespace
  return result.replace(/\s{2,}/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Section-Specific Narration Generators
// ---------------------------------------------------------------------------
function generateDiagramNarration(heading?: string): string {
  if (heading) {
    return `Here's a diagram showing ${heading.toLowerCase()}. Notice how the components connect.`;
  }
  return 'This diagram shows how all the pieces fit together.';
}

function generateTableNarration(heading?: string): string {
  if (heading) {
    return `Here's a comparison of ${heading.toLowerCase()}. Pay attention to the trade-offs.`;
  }
  return 'Let\'s compare the approaches. Notice the key differences.';
}

function generateCalloutNarration(content: string): string {
  return `Here's an important point. ${content}`;
}

// ---------------------------------------------------------------------------
// Default Recap Points — generated when previousSessionSummary is not provided
// Gives a plausible recap based on typical session progression
// ---------------------------------------------------------------------------
function generateDefaultRecapPoints(topic: string, sessionNumber: number): string[] {
  if (sessionNumber === 2) {
    return [
      `What ${topic} is and why it matters at scale`,
      `The core problem it solves in production systems`,
      `Key terminology and foundational concepts`,
      `Why every FAANG company asks about it in interviews`,
    ];
  }
  if (sessionNumber === 3) {
    return [
      `The main algorithms and implementation patterns for ${topic}`,
      `Code implementations in Python and Java`,
      `How to compare different approaches and their trade-offs`,
      `Common interview questions and how to structure your answer`,
    ];
  }
  // Session 4+
  return [
    `Fundamentals, algorithms, and failure modes of ${topic}`,
    `Production-level implementation patterns`,
    `Trade-offs between different approaches at scale`,
    `Interview strategies and how top candidates answer ${topic} questions`,
  ];
}

// =========================================================================
// MAIN: generateScript — Khan GS / Fireship Storytelling Arc
// =========================================================================

/**
 * Generate a video script following the Khan GS / Fireship storytelling arc:
 *
 *  1. HOOK (5s)          — Dramatic opening that creates curiosity
 *  2. THE PROBLEM (15s)  — "Imagine you have 10 million users..."
 *  3. WRONG ANSWER (12s) — "Most people think the solution is... but that's wrong"
 *  4. THE REAL ANSWER (10s) — "The real solution is... let me show you"
 *  5. DEEP DIVE (2-3 min) — Code walkthrough, step by step
 *  6. VISUAL EXPLANATION (30s) — Diagram showing how it works
 *  7. COMPARISON (30s)   — Table comparing approaches
 *  8. INTERVIEW SECRET (20s) — "Here's what interviewers ACTUALLY want to hear..."
 *  9. PRACTICE (30s)     — Quiz question with answer
 * 10. SUMMARY + CTA (15s) — "Now go practice on guru-sishya.in"
 */
export function generateScript(session: SessionInput, options: ScriptOptions = {}): Scene[] {
  // Reset per-video phrase tracker so each video starts fresh
  resetPhraseTracker();

  const {
    language = 'python',
    maxScenes = 30,
    nextTopic,
    sessionNumber: optSessionNumber,
    totalSessions,
    previousSessionSummary,
  } = options;
  const scenes: Scene[] = [];
  let currentFrame = 0;

  // Session number: prefer explicit option, fall back to session.sessionNumber
  const sessionNum = optSessionNumber ?? session.sessionNumber;

  // ── 1. DUAL HOOK — bold text + spoken narration at frame 0 ──────────────
  // Note: We pass the existing scenes array to generateDualHook. At this point
  // in the function, 'scenes' is empty (title scene hasn't been pushed yet).
  // The hook generator gracefully handles empty arrays by using fallback text.
  // For fully content-aware hooks, we'd need to restructure generateScript to
  // generate content scenes first, but this would require significant refactoring.
  // The current approach is a pragmatic first iteration — hooks are still varied
  // via 7 formulas + deterministic seeding by topic + sessionNumber.
  const dualHook = generateDualHook(session.topic, sessionNum, scenes, session.title);
  // RETENTION FIX: Hook narration must be ONLY the hook — max 2 sentences, ~8 seconds.
  // Series info + analogy are moved to scene 2 so the first 3-5s are pure emotional punch.
  const hookNarration = dualHook.spokenHook;

  // Build series context for injection into scene 2 (NOT the hook)
  const analogy = getAnalogy(session.topic, sessionNum);
  const seriesInfo = totalSessions
    ? `This is session ${sessionNum} of ${totalSessions} in our complete ${session.topic} series.`
    : `This is session ${sessionNum} of our ${session.topic} series.`;
  const scene2Preamble = `${seriesInfo} Today's topic: ${session.title}.${analogy ? ` ${analogy}` : ''}`;

  const titleDuration = SCENE_DEFAULTS.titleDuration;
  scenes.push({
    type: 'title',
    content: session.title,
    narration: hookNarration,
    duration: titleDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(titleDuration)),
    bullets: session.objectives,
    heading: dualHook.textHook, // Text hook for HookSlide display
  });

  // ── 1b. RECAP SCENE — "Previously on..." for session 2+ ───────────────
  if (sessionNum >= 2) {
    const recapPoints = previousSessionSummary && previousSessionSummary.length > 0
      ? previousSessionSummary.slice(0, 4)
      : generateDefaultRecapPoints(session.topic, sessionNum);

    const recapBullets = recapPoints.map(p => p.replace(/^[-*]\s*/, ''));
    const recapNarration = `In our last session, we covered ${recapBullets.slice(0, 3).join(', ')}. Today we're building on that foundation and going deeper.`;

    const recapDuration = 7; // 5-8 seconds
    scenes.push({
      type: 'text',
      content: recapBullets.join('\n'),
      narration: recapNarration,
      duration: recapDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(recapDuration)),
      heading: `Previously on ${session.topic}...`,
      bullets: recapBullets,
    });
  }

  // ── 2-4. MYTH BUSTER OPENING vs CLASSIC PROBLEM/ANSWER ────────────────
  // Alternate between two opening structures per session for variety:
  // ODD sessions: "Myth Buster" — 3 wrong facts → dramatic reveal → real answer
  // EVEN sessions: Classic "Problem → Wrong Answer → Real Answer"
  const useMythBuster = sessionNum % 2 === 1;

  if (useMythBuster) {
    // ── MYTH BUSTER: Start with shocking wrong statements ──────────────
    const myths = generateTopicMyths(session.topic);
    const mythsNarration = `${scene2Preamble} Let me start with some facts you probably believe. ${myths.myths.join(' ')} All of that? COMPLETELY WRONG. Every single one. Let me show you why. ${myths.reveal}`;
    const mythsDuration = 18;
    scenes.push({
      type: 'text',
      content: mythsNarration,
      narration: mythsNarration,
      duration: mythsDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(mythsDuration)),
      heading: 'MYTH vs REALITY',
      bullets: myths.mythBullets,
    });

    // ── Real answer after myth bust ──────────────────────────────────
    const realAnswerNarration = `Here's what's actually true. ${generateRealAnswer(session.topic)}`;
    const realAnswerDuration = 10;
    scenes.push({
      type: 'text',
      content: realAnswerNarration,
      narration: realAnswerNarration,
      duration: realAnswerDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(realAnswerDuration)),
      heading: 'The REAL Answer',
      bullets: extractBulletsFromNarration(realAnswerNarration, 3),
    });
  } else {
    // ── CLASSIC: Problem → Wrong Answer → Real Answer ────────────────
    const problemNarrationBase = generateProblemSetup(session.topic);
    const problemNarration = `${scene2Preamble} ${problemNarrationBase}`;
    const problemDuration = 15;
    scenes.push({
      type: 'text',
      content: problemNarration,
      narration: problemNarration,
      duration: problemDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(problemDuration)),
      heading: 'The Problem',
      bullets: [
        `Why ${session.topic} exists`,
        'What happens without it',
        'The real-world impact',
      ],
    });

    const wrongAnswerNarration = generateWrongAnswer(session.topic);
    const wrongAnswerDuration = 12;
    scenes.push({
      type: 'text',
      content: wrongAnswerNarration,
      narration: wrongAnswerNarration,
      duration: wrongAnswerDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(wrongAnswerDuration)),
      heading: 'The Common Mistake',
      bullets: extractBulletsFromNarration(wrongAnswerNarration, 3),
    });

    const realAnswerNarration = generateRealAnswer(session.topic);
    const realAnswerDuration = 10;
    scenes.push({
      type: 'text',
      content: realAnswerNarration,
      narration: realAnswerNarration,
      duration: realAnswerDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(realAnswerDuration)),
      heading: 'The Real Answer',
      bullets: extractBulletsFromNarration(realAnswerNarration, 3),
    });
  }

  // ── 5-7. Parse content → DEEP DIVE via Story Arc ─────────────────────
  const rawSections = parseMarkdown(session.content);
  const arcSections = storyArcMapper(rawSections);
  // Backward-compat alias: sections = raw for any code that still references it
  const sections = rawSections;
  let sectionIndex = 0;
  let arcIndex = 0;
  let hasInterview = false;
  let openLoopCounter = 0;     // tracks elapsed deep-dive scenes for open-loop injection
  let halfwayInjected = false; // 50% midpoint retention trap guard
  let reHookInjected = false;  // 60% danger zone re-hook guard
  let patternInterruptCounter = 0; // pattern interrupts every ~4 scenes
  let interviewAnchor1Done = false; // 30% interview anchor
  let interviewAnchor2Done = false; // 60% interview anchor

  for (const section of sections) {
    // ── Story arc framing — wrap narration in character-driven context ─────
    const arcEntry = arcSections[arcIndex] || { act: 'climax' as StoryAct, section };
    const currentAct = arcEntry.act;
    arcIndex = Math.min(arcIndex + 1, arcSections.length - 1);

    // ── Interview Anchor #1 at ~30% of deep dive ──────────────────────────
    if (!interviewAnchor1Done && scenes.length >= Math.floor(maxScenes * 0.3)) {
      interviewAnchor1Done = true;
      const ex = getTopicExample(session.topic);
      const anchor1 = `If an interviewer asks you "What is ${session.topic}?" right now, here's your answer based on what we just covered. ${ex.company} uses this to ${ex.useCase}. But they won't stop there. They'll dig deeper. And that's exactly what we're about to do.`;
      scenes.push({
        type: 'interview' as SceneType,
        content: anchor1,
        narration: anchor1,
        duration: 8,
        startFrame: currentFrame,
        endFrame: (currentFrame += TIMING.secondsToFrames(8)),
        heading: 'Interview Check-In',
      });
      hasInterview = true;
    }

    // ── Interview Anchor #2 at ~60% of deep dive ──────────────────────────
    if (!interviewAnchor2Done && scenes.length >= Math.floor(maxScenes * 0.6)) {
      interviewAnchor2Done = true;
      const ex = getTopicExample(session.topic);
      const anchor2 = `The interviewer's follow-up: "What are the tradeoffs?" This is where ${ex.company}-level candidates shine. Here's the framework that separates a 15 LPA answer from a 45 LPA answer.`;
      scenes.push({
        type: 'interview' as SceneType,
        content: anchor2,
        narration: anchor2,
        duration: 8,
        startFrame: currentFrame,
        endFrame: (currentFrame += TIMING.secondsToFrames(8)),
        heading: 'Interview Deep Dive',
      });
      hasInterview = true;
    }
    if (scenes.length >= maxScenes - 3) break; // Reserve for interview + review + summary

    if (section.type === 'callout') hasInterview = true;

    // Include BOTH Python AND Java code blocks (dual-language mode).
    // Skip code blocks in other languages unless they're universal (TS, JS, bash, etc.)
    if (section.type === 'code' && section.language) {
      const sectionLang = section.language.toLowerCase();
      const allowedLangs = ['python', 'java', 'typescript', 'javascript', 'text', 'bash', 'shell', 'sql', 'json', 'yaml', 'html', 'css'];
      if (!allowedLangs.includes(sectionLang)) {
        continue;
      }
    }

    // ── 60% Danger Zone Re-Hook (session-aware) ─────────────────────────
    // RETENTION FIX: Moved from 60% to 70% — was only 2 scenes after the 50% midpoint trap,
    // creating back-to-back meta-commentary that breaks immersion and feels desperate.
    if (!reHookInjected && scenes.length === Math.floor(maxScenes * 0.7)) {
      reHookInjected = true;
      const seriesConnector = getSeriesConnector(sessionNum, session.topic);
      // BUG FIX: "separates" phrase gated by oncePerVideo to avoid repetition
      const separatesPhrase = oncePerVideo('separates-phrase',
        `This is what separates the good developers from the GREAT ones.`);
      const session1Hook = separatesPhrase
        ? `Okay, stay with me. You've already learned the fundamentals of ${session.topic}. But this next part? ${separatesPhrase} Don't leave now.`
        : `Okay, stay with me. You've already learned the fundamentals of ${session.topic}. But this next part is where it all clicks. Don't leave now.`;
      const reHookBase = sessionNum === 1
        ? session1Hook
        : sessionNum === 2
        ? `This is the part where session 2 really pays off. The concepts from session 1 are about to click in a whole new way. Stay with me.`
        : sessionNum === 3
        ? `We're deep into advanced territory now. This is the stuff that makes interviewers go "wow, this candidate REALLY knows ${session.topic}." Don't skip this.`
        : `This is expert-level ${session.topic}. The kind of knowledge that principal engineers have. You're almost there.`;
      const reHookNarration = seriesConnector ? `${seriesConnector} ${reHookBase}` : reHookBase;
      scenes.push({
        type: 'text',
        content: reHookNarration,
        narration: reHookNarration,
        duration: 8,
        startFrame: currentFrame,
        endFrame: (currentFrame += TIMING.secondsToFrames(8)),
        heading: 'The Key Insight',
        bullets: extractBulletsFromNarration(reHookNarration, 3),
      });
    }

    // ── 50% Midpoint Retention Trap ──
    // RETENTION FIX: Instead of a separate 6s "Stay With Me" filler scene (which breaks
    // immersion and adds dead air), inject the trap line INTO the next content scene's
    // narration. This keeps the viewer in the content flow while still planting the hook.
    if (!halfwayInjected && scenes.length >= Math.floor(maxScenes * 0.5)) {
      halfwayInjected = true;
      // Will be prepended to the next scene below (after sectionToScene)
    }

    const scene = sectionToScene(section, language, currentFrame, sectionIndex, session.topic);

    // ── Midpoint trap injection (into this scene's narration, not a separate scene) ──
    if (halfwayInjected && !reHookInjected && scenes.length === Math.floor(maxScenes * 0.5) + 1) {
      const trapLine = getMidpointTrap(session.topic, sessionNum + sectionIndex);
      scene.narration = `${trapLine} ${scene.narration}`;
    }

    // ── Mid-Scene Open Loop (every ~3 deep-dive scenes ≈ 60-90 seconds) ─
    // GUARD: Skip if injectOpenLoops() will also prepend to this scene.
    // Open loops target code/interview/review/summary scenes, so skip those.
    openLoopCounter++;
    const isOpenLoopTarget = scene.type === 'code' || scene.type === 'interview' || scene.type === 'review' || scene.type === 'summary';
    if (openLoopCounter % 3 === 0 && !isOpenLoopTarget) {
      const openLoop = getOpenLoopPhrase(openLoopCounter);
      scene.narration = `${openLoop} ${scene.narration}`;
    }

    // ── Pattern Interrupt (every ~4 scenes — pace change to break monotony) ─
    // GUARD: Don't stack on same scene as open loop
    patternInterruptCounter++;
    const alreadyHasOpenLoop = openLoopCounter % 3 === 0 && !isOpenLoopTarget;
    if (patternInterruptCounter % 4 === 0 && scene.type === 'text' && !alreadyHasOpenLoop) {
      const interrupt = getPatternInterrupt(sessionNum * 3 + patternInterruptCounter);
      scene.narration = `${interrupt} ${scene.narration}`;
    }

    // ── Apply story arc framing to narration ────────────────────────────
    if (scene.type === 'text' && scene.narration) {
      scene.narration = storyFrameNarration(scene.narration, currentAct, session.topic, sectionIndex);
    }

    const splitScenes = splitLongScene(scene, currentFrame);
    for (const s of splitScenes) {
      scenes.push(s);
      currentFrame = s.endFrame;
    }
    sectionIndex++;
  }

  // ── 7b. ENGAGEMENT CHECKPOINTS at 25%, 50%, 75% ───────────────────────
  // Insert mini-quiz scenes retroactively to boost retention and cuts/min
  {
    const checkpointPositions = [
      Math.floor(scenes.length * 0.25),
      Math.floor(scenes.length * 0.5),
      Math.floor(scenes.length * 0.75),
    ];
    const checkpointQuestions = [
      `Quick mental check. What does ${session.topic} actually do? Think about it. 3 seconds. Got it? Good.`,
      `Halfway challenge. If an interviewer asks you to explain ${session.topic} right now, what would you say? Pause and think.`,
      `Almost done. How would you explain the tradeoffs of ${session.topic} in an interview? This separates 15 LPA from 45 LPA answers.`,
    ];
    // Insert in reverse order so earlier indices stay valid
    for (let ci = checkpointPositions.length - 1; ci >= 0; ci--) {
      const pos = checkpointPositions[ci];
      if (pos <= 0 || pos >= scenes.length) continue;
      const checkpointDuration = 6; // was 4 — quiz needs more time
      const insertFrame = scenes[pos]?.startFrame ?? currentFrame;
      const checkpointScene: Scene = {
        type: 'review',  // was 'text' — triggers ReviewQuestion visual with game-show layout
        content: checkpointQuestions[ci],
        narration: checkpointQuestions[ci],
        duration: checkpointDuration,
        startFrame: insertFrame,
        endFrame: insertFrame + TIMING.secondsToFrames(checkpointDuration),
        heading: ci === 1 ? 'Halfway Challenge' : ci === 0 ? 'Quick Check' : 'Final Challenge',
        bullets: [],
      };
      scenes.splice(pos, 0, checkpointScene);
    }
    // Recompute frames after checkpoint insertions
    let recomputeFrame = scenes[0]?.startFrame ?? 0;
    for (const s of scenes) {
      s.startFrame = recomputeFrame;
      s.endFrame = recomputeFrame + TIMING.secondsToFrames(s.duration);
      recomputeFrame = s.endFrame;
    }
    currentFrame = recomputeFrame;
  }

  // ── 8. INTERVIEW SECRET — if not already covered by a callout ─────────
  if (!hasInterview && scenes.length < maxScenes - 2) {
    const secretNarration = generateInterviewSecret(session.topic);
    const secretDuration = SCENE_DEFAULTS.interviewDuration;
    scenes.push({
      type: 'interview',
      content: secretNarration,
      narration: secretNarration,
      duration: secretDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(secretDuration)),
      heading: 'Interview Secret',
    });
  }

  // Interview Reality Check scene (NeetCode style — what interviewers actually think)
  if (scenes.length < maxScenes - 1) {
    const realityNarration = generateInterviewReality(session.topic);
    const realityDuration = SCENE_DEFAULTS.interviewDuration;
    scenes.push({
      type: 'interview',
      content: realityNarration,
      narration: realityNarration,
      duration: realityDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(realityDuration)),
      heading: 'Interview Reality Check',
    });
  }

  // ── 9. PRACTICE — Review question with engaging framing ───────────────
  if (session.reviewQuestions.length > 0 && scenes.length < maxScenes - 1) {
    const question = session.reviewQuestions[0];
    const practiceNarration = generatePracticeNarration(question, session.topic);
    const cleanAnswer = generateCleanAnswer(question, session.topic, session.content);
    const duration = SCENE_DEFAULTS.reviewQuestionDuration;
    scenes.push({
      type: 'review',
      content: question,
      narration: practiceNarration,
      duration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(duration)),
      // Store the clean visual answer in heading field so it can be displayed on screen
      // (narration is for TTS only, not for visual display)
      heading: cleanAnswer,
    });
  }

  // ── 9b. COMPLETE INTERVIEW ANSWER — the payoff moment ────────────────
  // Blueprint: structured framework the viewer memorizes and takes to interviews
  if (scenes.length < maxScenes) {
    const ex = getTopicExample(session.topic);
    const topObjectives = session.objectives.slice(0, 3);
    const steps = topObjectives.map((obj, i) =>
      `Step ${i + 1}: ${obj.replace(/^(understand|learn|know|explain)\s+/i, 'Explain ')}`
    );
    const completeAnswerNarration = `Here's exactly how you answer a ${session.topic} question in an interview. ${steps.join('. ')}. Then you seal it with a real-world example: "${ex.company} uses this to handle ${ex.scale}." That's a 45 LPA answer. Practice saying it out loud right now. Seriously. Pause and say it.`;
    const completeAnswerDuration = 15;
    scenes.push({
      type: 'text' as SceneType,
      content: completeAnswerNarration,
      narration: completeAnswerNarration,
      duration: completeAnswerDuration,
      startFrame: currentFrame,
      endFrame: (currentFrame += TIMING.secondsToFrames(completeAnswerDuration)),
      heading: 'The Complete Interview Answer',
      bullets: [
        `1. Start with WHY ${session.topic} exists`,
        ...topObjectives.slice(0, 2).map((obj, i) => `${i + 2}. ${obj}`),
        `${Math.min(topObjectives.length, 2) + 2}. Close with ${ex.company} real-world example`,
      ],
    });
  }

  // ── 10. SUMMARY + CTA ────────────────────────────────────────────────
  const summaryNarration = generateSummaryNarration(session.topic, session.objectives, nextTopic, sessionNum, totalSessions);
  const summaryDuration = SCENE_DEFAULTS.summaryDuration + 4; // Extra time for CTA
  scenes.push({
    type: 'summary',
    content: 'Key Takeaways',
    narration: summaryNarration,
    duration: summaryDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(summaryDuration)),
    bullets: session.objectives.slice(0, 4),
  });

  // Speed reminders removed — voice is already 1.3x, no need to ask for 1.5x

  // ── Deduplicate narration text ─────────────────────────────────────────
  // BUG FIX: Sometimes narration contains doubled text e.g. "sentence A sentence B. sentence A sentence B."
  // Detect and remove the duplicate half.
  for (const scene of scenes) {
    if (scene.narration) {
      scene.narration = deduplicateNarration(scene.narration);
    }
  }

  // ── Strip completion signals from ALL scenes ──────────────────────────
  // Prevents YouTube viewer drop-off from hearing "to wrap up", "in conclusion"
  for (const scene of scenes) {
    if (scene.narration) {
      scene.narration = stripCompletionSignals(scene.narration);
    }
  }

  // ── Compute visual beats + template selection per scene ──────────────
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    // Visual beats from narration
    if (scene.narration && scene.wordTimestamps && scene.wordTimestamps.length > 0) {
      scene.visualBeats = computeVisualBeats(scene.narration, scene.wordTimestamps);
    }
    // Template selection
    if (scene.type !== 'title') {
      const tmpl = getVisualTemplate(session.topic, sessionNum, scene.heading || '', scene.type, scene.vizVariant);
      scene.templateId = tmpl.templateId;
      scene.templateVariant = tmpl.variant;
    }
    // Quiz options for review scenes
    if (scene.type === 'review' && scene.heading) {
      scene.quizOptions = generateQuizOptions(scene.heading, session.topic, sessionNum, i);
    }
  }

  // ── Personality injection — make narration viral and human ────────────
  const personalizedScenes = personalityInjector(scenes, sessionNum, session.topic);

  // ── Inject contradiction-based open loops ──────────────────────────────
  const withLoops = injectOpenLoops(personalizedScenes, session.topic, sessionNum);

  return addStoryTransitions(withLoops);
}

// ---------------------------------------------------------------------------
// VIRAL PERSONALITY INJECTOR
// Makes narration sound human, relatable, and memorable.
// Think Tanay Pratap / Striver / Harkirat Singh energy for Indian tech audience.
// ---------------------------------------------------------------------------

/** Surprise facts — injected every 3rd text scene to create "wait what?!" moments.
 *  Now topic-aware: uses getTopicExample() so Kafka videos mention Uber, not load balancers. */
function getTopicSurpriseFacts(topic: string): string[] {
  const ex = getTopicExample(topic);
  return [
    `Fun fact: ${ex.company} ${ex.useCase} — handling ${ex.scale}. Let that sink in.`,
    `Here's something wild: ${ex.company} once had a major outage because their ${topic.toLowerCase()} system failed. Cost them millions.`,
    "Plot twist: Most production implementations of this... are actually FREE and open source.",
    `Real talk: I've seen senior engineers at ${ex.company} get this wrong in interviews. Don't be that person.`,
    "Hot take: If you can explain this concept clearly, you're already ahead of 80% of interview candidates.",
    `Wild stat: ${ex.company} processes ${ex.scale}. And it all depends on concepts like this.`,
    "Here's something nobody tells you: most production bugs at FAANG aren't code bugs. They're system design bugs.",
    "Real talk: Flipkart's Big Billion Day crashed their servers THREE times before they got this right.",
    "Plot twist: ChatGPT uses the exact same concepts we're learning here to handle millions of concurrent users.",
    `Fun fact: ${ex.company}'s solution was ${ex.solution}. That's exactly what we're learning.`,
  ];
}

/** Audience callouts — direct viewer engagement at key moments */
const AUDIENCE_CALLOUTS = [
  "If you're watching this at 2 AM before your interview tomorrow... relax. I got you.",
  "For my DSA grinders out there, this one's for you.",
  "If you're from a tier-2 college like many of us, listen up. This is your equalizer.",
  "Comment 'UNDERSTOOD' if you made it this far. I read every single comment.",
  "To everyone grinding for placements right now... this pain is temporary. The package is permanent.",
  "If you're switching from service-based to product-based, THIS is the stuff you need to know.",
  "For everyone who's been told 'you need a CS degree to crack FAANG'... watch me prove them wrong.",
  "My non-CS branch engineers, this one's especially for you. Background doesn't matter, preparation does.",
  "Night owls watching at 2 AM — I see you. Let's make this study session count.",
  "If your friends aren't watching this, they're going to ask YOU to explain it after placements.",
  "Product companies pay 30+ LPA. Service companies pay 3.3 LPA. The difference? Exactly what we're learning.",
  "Everyone asks 'how to crack FAANG'. Nobody asks 'how to UNDERSTAND systems'. Be different.",
];

/** Emotional stakes — connect concepts to real career consequences */
const EMOTIONAL_STAKES = [
  "This is the difference between a 12 LPA offer and a 40 LPA offer. I'm not exaggerating.",
  "I know someone who got rejected from a top product company because they couldn't explain this. Don't let that be you.",
  "This one concept shows up in literally every system design interview at FAANG.",
  "Master this, and you're not just interview-ready. You're production-ready. That's rare.",
  "This is the kind of knowledge that makes your team lead go 'wait, how do you know that?'",
  "Three months from now, when you're holding that offer letter, you'll remember this video.",
  "This separates the developers who GET callbacks from the ones who don't. Simple as that.",
  "I watched a candidate explain this perfectly and get a 45 LPA offer at a top product company in Bangalore. Same concept, same interview room, same question.",
  "The last 5 people I mentored who understood this concept ALL cleared their system design rounds. All five.",
  "This is the concept that made me go from 'maybe I'll crack it' to 'I KNOW I'll crack it.'",
  "Your competition is watching this video too. The question is: will you actually practice it on guru-sishya.in? Link in the description.",
  "Three months of focused prep beats three years of unfocused coding. This video is focused prep.",
  "The interviewer has seen 500 candidates this month. 490 of them couldn't explain this. Be the other 10.",
];

/** Punchy openers — Fireship style, 2-4 words max */
const CONVERSATIONAL_OPENERS = [
  'Plot twist. ',
  'Quick fact. ',
  'Here\'s the catch. ',
  'Key insight: ',
  'Now. ',
  'But wait. ',
  'The trick? ',
  'Real talk. ',
  // Hindi-English code-switching openers (Edge TTS PrabhatNeural handles these naturally)
  'Dekho, ',           // "Look,"
  'Suno, yeh important hai. ', // "Listen, this is important."
  'Ab samjho. ',       // "Now understand."
  'Dhyan se. ',        // "Pay attention."
  'Ek second. ',       // "One second."
  'Yeh wala concept? Game changer. ', // "This concept? Game changer."
];

/** Punchy closers — tension builders, not filler */
const CONVERSATIONAL_CLOSERS = [
  ' And that changes everything.',
  ' Most people miss this.',
  ' That\'s the key.',
  ' Remember this.',
  ' This alone is worth the whole video.',
];

/** Brand catchphrase — appended to summary scenes */
const CATCHPHRASE = "Now go crush that interview.";

/** Guru mode transition — used when explaining the hard part */
const GURU_MODE_PHRASES = [
  "Guru mode activated. Let's break this down.",
  "This is where Sishya becomes Guru.",
  "Okay, Guru mode ON. Focus.",
];

/**
 * Inject viral personality into scenes.
 * Transforms sterile textbook narration into engaging, human content.
 *
 * Rules:
 * - Only modifies text scene narrations (code, table, diagram scenes stay clean)
 * - Adds surprise facts every 3rd text scene
 * - Makes narration conversational with fillers and contractions
 * - Adds audience callouts at ~25% and ~75% of the video
 * - Adds emotional stakes at ~40% and ~60%
 * - Injects guru-mode phrase at the deepest technical scene
 * - Appends catchphrase to the summary scene
 */
export function personalityInjector(scenes: Scene[], sessionNumber: number = 1, topic: string = ''): Scene[] {
  const totalScenes = scenes.length;
  let textSceneCount = 0;

  // Seed based on session number for variety across episodes
  const seed = sessionNumber * 7;

  // Pre-compute injection points (as scene indices)
  const callout25 = Math.floor(totalScenes * 0.25);
  const callout75 = Math.floor(totalScenes * 0.75);
  const stakes40 = Math.floor(totalScenes * 0.4);
  // stakes60 and guruModePoint removed — filler reduction (max 2 per video)

  // Track which injections have fired (one-shot guards)
  let callout25Done = false;
  let callout75Done = false;
  let stakes40Done = false;

  return scenes.map((scene, idx) => {
    // Skip non-text scenes — keep code, table, diagram narration clean
    if (scene.type === 'code' || scene.type === 'table' || scene.type === 'diagram') {
      return scene;
    }

    let narration = scene.narration;

    // ── Conversational tone: contractions ─────────────────────────
    narration = injectContractions(narration);

    // ── Summary scene: append catchphrase ─────────────────────────
    if (scene.type === 'summary') {
      narration = `${narration} ${CATCHPHRASE}`;
      return { ...scene, narration };
    }

    // Only inject personality elements into 'text' and 'interview' scenes
    if (scene.type !== 'text' && scene.type !== 'interview') {
      return { ...scene, narration };
    }

    // ── Surprise facts: every 5th text scene (reduced from 3rd to cut filler) ──
    if (scene.type === 'text') {
      textSceneCount++;
      if (textSceneCount > 0 && textSceneCount % 5 === 0) {
        const facts = getTopicSurpriseFacts(topic);
        const factIdx = (seed + textSceneCount) % facts.length;
        narration = `${narration} ${facts[factIdx]}`;
      }
    }

    // ── Conversational opener: add filler to first sentence ──────
    // GUARD: Only use Hindi openers on casual narration, English openers on formal.
    // Formal = contains academic words like "distributed", "architecture", "protocol"
    if (scene.type === 'text' && textSceneCount % 2 === 1) {
      // Only prepend if narration doesn't already start conversationally
      if (!/^(Okay|Here's|And |Look|So |Now |Alright|But )/i.test(narration)) {
        const isFormal = /\b(distributed|fault-tolerant|architecture|protocol|mechanism|implementation|monotonically|configuration|coordination)\b/i.test(narration.slice(0, 120));
        // Use only English openers (indices 0-7) for formal text, allow Hindi (8-13) for casual
        const openerPool = isFormal ? 8 : CONVERSATIONAL_OPENERS.length;
        const openerIdx = (seed + idx) % openerPool;
        narration = CONVERSATIONAL_OPENERS[openerIdx] + lowercaseFirst(narration);
      }
    }

    // ── Conversational closer: add after revelations ─────────────
    // Apply to scenes in the "real answer" / "deep dive" zone (scenes 4-8)
    if (scene.type === 'text' && idx >= 4 && idx <= 8 && textSceneCount % 4 === 0) {
      const closerIdx = (seed + idx) % CONVERSATIONAL_CLOSERS.length;
      narration = narration.replace(/\.\s*$/, '') + CONVERSATIONAL_CLOSERS[closerIdx];
    }

    // ── Audience callout at ~25% ─────────────────────────────────
    if (!callout25Done && idx >= callout25 && scene.type === 'text') {
      callout25Done = true;
      const calloutIdx = (seed) % AUDIENCE_CALLOUTS.length;
      narration = `${AUDIENCE_CALLOUTS[calloutIdx]} ${narration}`;
    }

    // ── Audience callout at ~75% ─────────────────────────────────
    if (!callout75Done && idx >= callout75 && scene.type === 'text') {
      callout75Done = true;
      const calloutIdx = (seed + 3) % AUDIENCE_CALLOUTS.length;
      narration = `${narration} ${AUDIENCE_CALLOUTS[calloutIdx]}`;
    }

    // ── Emotional stakes at ~40% ─────────────────────────────────
    if (!stakes40Done && idx >= stakes40 && scene.type === 'text') {
      stakes40Done = true;
      const stakesIdx = (seed) % EMOTIONAL_STAKES.length;
      narration = `${narration} ${EMOTIONAL_STAKES[stakesIdx]}`;
    }

    // ── Emotional stakes at ~60% — REMOVED (was stacking too much filler) ──
    // ── Guru mode at ~55% — REMOVED (reduces filler phrases to max 2/video) ──

    return { ...scene, narration };
  });
}

/** Replace formal phrasing with contractions for natural speech */
function injectContractions(text: string): string {
  return text
    .replace(/\bdo not\b/gi, "don't")
    .replace(/\bit is\b/gi, "it's")
    .replace(/\byou are\b/gi, "you're")
    .replace(/\bthey are\b/gi, "they're")
    .replace(/\bwe are\b/gi, "we're")
    .replace(/\bcannot\b/gi, "can't")
    .replace(/\bwill not\b/gi, "won't")
    .replace(/\bshould not\b/gi, "shouldn't")
    .replace(/\bwould not\b/gi, "wouldn't")
    .replace(/\bcould not\b/gi, "couldn't")
    .replace(/\bdoes not\b/gi, "doesn't")
    .replace(/\bhave not\b/gi, "haven't")
    .replace(/\bhas not\b/gi, "hasn't")
    .replace(/\bthat is\b/gi, "that's")
    .replace(/\bwhat is\b/gi, "what's")
    .replace(/\bthere is\b/gi, "there's")
    .replace(/\blet us\b/gi, "let's")
    .replace(/\bI am\b/gi, "I'm")
    .replace(/\bI have\b/gi, "I've")
    .replace(/\byou have\b/gi, "you've")
    .replace(/\bwe have\b/gi, "we've")
    .replace(/\bthey have\b/gi, "they've");
}

/**
 * Deduplicate narration that contains the same text repeated back-to-back.
 * Detects patterns like "A B C. A B C." where the second half is a copy of the first.
 * Also catches sentence-level repeats within the narration.
 */
function deduplicateNarration(text: string): string {
  if (!text || text.length < 20) return text;

  // Strategy 1: Exact-half duplication — "X X" where the string is just X repeated twice
  const trimmed = text.trim();
  const halfLen = Math.floor(trimmed.length / 2);
  // Check if first half equals second half (with some whitespace tolerance)
  for (let offset = -3; offset <= 3; offset++) {
    const splitPoint = halfLen + offset;
    if (splitPoint <= 0 || splitPoint >= trimmed.length) continue;
    const firstHalf = trimmed.slice(0, splitPoint).trim();
    const secondHalf = trimmed.slice(splitPoint).trim();
    if (firstHalf.length > 15 && firstHalf === secondHalf) {
      return firstHalf;
    }
  }

  // Strategy 2: Sentence-level dedup — remove consecutive duplicate sentences
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length > 10 && seen.has(normalized)) continue;
    seen.add(normalized);
    deduped.push(sentence);
  }

  return deduped.join(' ');
}

/** Lowercase the first character of a string (for prepending fillers) */
function lowercaseFirst(str: string): string {
  if (!str) return str;
  // Don't lowercase if it starts with an acronym or proper noun pattern (e.g., "AWS", "Google")
  if (/^[A-Z]{2,}/.test(str) || /^[A-Z][a-z]+\s[A-Z]/.test(str)) return str;
  return str[0].toLowerCase() + str.slice(1);
}

// ---------------------------------------------------------------------------
// Story-Aware Transitions (builds narrative tension)
// ---------------------------------------------------------------------------
function addStoryTransitions(scenes: Scene[]): Scene[] {
  // Transition phrases — one per type, used only on the FIRST occurrence
  const transitionsByType: Record<string, string> = {
    code: "Let me show you the code. ",
    diagram: "Let me show you this visually. ",
    table: "Let's compare the approaches side by side. ",
    interview: "Now for the interview insight. ",
    review: "Time to test yourself. ",
  };

  const usedTypes = new Set<string>();

  return scenes.map((scene, idx) => {
    // Skip story arc scenes (hook, problem, wrong answer, real answer) and bookend types
    if (idx <= 3 || scene.type === 'title' || scene.type === 'summary') return scene;

    // Only prepend a transition for the FIRST scene of each type
    if (!usedTypes.has(scene.type) && transitionsByType[scene.type]) {
      usedTypes.add(scene.type);
      return {
        ...scene,
        narration: transitionsByType[scene.type] + scene.narration,
      };
    }

    return scene;
  });
}

// ---------------------------------------------------------------------------
// Bullet Extraction — ensures every text scene has visible on-screen bullets
// Extracts key sentences from narration when bullets aren't explicitly provided
// ---------------------------------------------------------------------------
function extractBulletsFromNarration(narration: string, maxBullets: number = 3): string[] {
  const sentences = narration
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 120);

  if (sentences.length <= maxBullets) return sentences;

  // Pick evenly spaced sentences for visual distribution
  const step = Math.floor(sentences.length / maxBullets);
  const bullets: string[] = [];
  for (let i = 0; i < maxBullets; i++) {
    const idx = Math.min(i * step, sentences.length - 1);
    bullets.push(sentences[idx]);
  }
  return bullets;
}

// ---------------------------------------------------------------------------
// Hook Generation — Session-Aware (33 patterns for Session 1, unique for 2, 3, 4+)
// Session 1: Provocative ("Everything your CS professor taught you...")
// Session 2: Recap + Preview ("Last time we learned WHY. Today we go DEEP...")
// Session 3: Escalation ("You know the basics AND the algorithms. But...")
// Session 4+: Expert level ("We've covered [X]. Now the production stuff...")
// ---------------------------------------------------------------------------

/** Session 1 hooks — provocative, curiosity-driven, standalone */
const SESSION_1_HOOKS = [
  // ── Story openings (5) ──
  (topic: string) => `In 2023, a major tech company lost 14 million dollars in revenue because of ONE poorly implemented ${topic} system. Fourteen. Million. Dollars. Let me make sure that never happens to you.`,
  (topic: string) => `I once watched a senior engineer get rejected at ${getTopicExample(topic).company} because they couldn't explain ${topic} properly. They had 10 years of experience. Let me tell you what they got wrong.`,
  (topic: string) => `The engineer who built ${getTopicExample(topic).company}'s ${topic} system shared something in a blog post that changed how I think about software forever. Let me share it with you.`,
  (topic: string) => `Picture this. It's your final round interview at ${getTopicExample(topic).company}. The interviewer leans forward and says, "Tell me about ${topic}." Your next 5 minutes decide your career. Are you ready?`,
  (topic: string) => `A startup I advised went from 100 to 10 million users in 6 months. The ONLY reason they survived? They understood ${topic} deeply. Most companies don't.`,

  // ── Shocking questions (5) ──
  (topic: string) => `What happens when 10 million users hit your server at the exact same time? If you don't know the answer, you don't understand ${topic}. Let's fix that right now.`,
  (topic: string) => `Can you explain ${topic} in 30 seconds? Because that's exactly how long you get in an interview before they decide if you know your stuff.`,
  (topic: string) => `Why do 73 percent of candidates fail system design interviews? One word: ${topic}. They memorize the definition but miss the point entirely.`,
  (topic: string) => `If I asked you to design ${topic} from scratch on a whiteboard right now, could you do it? Be honest. By the end of this video, you absolutely can.`,
  (topic: string) => `What's the ONE concept that separates a 100K developer from a 300K developer? It's not algorithms. It's not LeetCode. It's understanding ${topic} at a deep level.`,

  // ── Shocking facts (4) ──
  (topic: string) => `Did you know? Every single request you make on the internet touches ${topic} at least three times before reaching its destination. And most developers have no idea how it works.`,
  (topic: string) => `Here's a stat that should terrify you. 89 percent of production outages at big tech companies trace back to ${topic} failures. 89 percent.`,
  (topic: string) => `${getTopicExample(topic).company} ${getTopicExample(topic).useCase}, processing ${getTopicExample(topic).scale}. The secret sauce behind all of it? ${topic}. And I'm going to teach it to you in under 5 minutes.`,
  (topic: string) => `The average tech interview lasts 45 minutes. ${topic} questions take up 15 of those minutes. That's one third of your interview riding on THIS topic.`,

  // ── Challenge hooks (4) ──
  (topic: string) => `I'm going to explain ${topic} so clearly that you will NEVER forget it. That's not a promise. That's a guarantee. Let's go.`,
  (topic: string) => `Give me 5 minutes. Just 5 minutes. And I'll teach you ${topic} better than any textbook, any course, any bootcamp ever could.`,
  (topic: string) => `By the end of this video, you'll understand ${topic} better than 90 percent of working developers. That sounds crazy, but stick with me.`,
  (topic: string) => `I challenge you to watch this entire video and NOT understand ${topic}. Seriously. Try. You can't. Let's go.`,

  // ── Pain point hooks (5) ──
  (topic: string) => `If your interviewer asks about ${topic} and you start with the textbook definition... you've already lost. Let me show you what to say instead.`,
  (topic: string) => `Stop memorizing ${topic}. Seriously, stop it. Memorization is why you keep forgetting it. Today I'm going to help you UNDERSTAND it.`,
  (topic: string) => `You've probably read 10 articles about ${topic} and still feel confused. That's not your fault. They explain it wrong. Let me show you the right way.`,
  (topic: string) => `The biggest lie in computer science education? That ${topic} is complicated. It's not. It's been taught badly. Let me prove it.`,
  (topic: string) => `Every time you open YouTube to learn ${topic}, you get a 45-minute lecture that puts you to sleep. Not today. Today you learn it in 5 minutes, and it sticks.`,

  // ── Contrarian hooks (4) ──
  (topic: string) => `Everything your CS professor taught you about ${topic} is technically correct and completely useless in the real world. Here's what actually matters.`,
  (topic: string) => `Hot take: most "senior" engineers don't actually understand ${topic}. They know the buzzwords, but ask them WHY it works, and they freeze. Don't be that engineer.`,
  (topic: string) => `I'm about to explain ${topic} in a way your textbook never did. No jargon. No fluff. Just the raw truth about how it actually works.`,
  (topic: string) => `${topic} is not what you think it is. I know that sounds dramatic, but hear me out. What they teach in school and what happens in production are two completely different things.`,

  // ── Authority hooks (4) ──
  (topic: string) => `${getTopicExample(topic).company}, Google, and other top companies all ask about ${topic} in their interviews. After studying hundreds of interview questions, I found the exact pattern they follow. Let me share it.`,
  (topic: string) => `I've reviewed over 500 technical interview recordings. The number one reason candidates get rejected? They can't explain ${topic} with clarity and confidence. Let's fix that.`,
  (topic: string) => `The top 1 percent of engineers all have one thing in common. They don't just USE ${topic}. They understand it deeply enough to TEACH it. That's what we're doing today.`,
  (topic: string) => `After helping over 1000 students crack FAANG interviews, I can tell you the exact moment most interviews are won or lost. It's the ${topic} question. And here's how to nail it.`,

  // ── Curiosity gap hooks (2) ──
  (topic: string) => `There's a reason ${topic} is asked in EVERY system design interview. And it's not the reason you think.`,
  (topic: string) => `What if I told you that ${topic} is actually about ONE simple idea? Just one. And once you see it, you can never unsee it.`,

  // ── Dramatic / clickbait-worthy hooks (10) ──
  (topic: string) => `DELETE this video if I can't explain ${topic} in under 5 minutes...`,
  (topic: string) => `I asked a senior engineer at ${getTopicExample(topic).company} to explain ${topic}. His answer shocked me.`,
  (topic: string) => `This one concept has appeared in EVERY FAANG interview this year.`,
  (topic: string) => `Most YouTube tutorials get ${topic} COMPLETELY wrong. Here's the truth.`,
  (topic: string) => `My friend failed his ${getTopicExample(topic).company} interview because of ${topic}. Don't make his mistake.`,
  (topic: string) => `I spent 200 hours researching ${topic}. Here's everything in one video.`,
  (topic: string) => `WARNING: Once you understand ${topic}, you can't unsee it in every system you use.`,
  (topic: string) => `The REAL reason tech companies pay 50 LPA... they need people who understand THIS.`,
  (topic: string) => `If I had to explain ${topic} to my younger self, this is exactly what I'd say.`,
  (topic: string) => `Your interviewer is PRAYING you don't know this about ${topic}...`,
];

/** Session 2 hooks — recap + preview, building on session 1 */
const SESSION_2_HOOKS = [
  (topic: string) => `Last time we learned WHY ${topic} matters and what problems it solves. Today we're going DEEP into the algorithms and implementations that make it actually work.`,
  (topic: string) => `In session 1, I showed you the big picture of ${topic}. You know the "what" and the "why." Now it's time for the "how." And this is where it gets really fun.`,
  (topic: string) => `If you watched session 1, you already understand ${topic} better than most junior developers. Today we level up to intermediate. Building on that foundation.`,
  (topic: string) => `Remember when I said ${topic} isn't complicated? I stand by that. But today's session goes deeper. We're moving from understanding to IMPLEMENTING. Big difference.`,
  (topic: string) => `You learned the fundamentals of ${topic} last time. Great start. But fundamentals alone don't get you hired. Today we cover the implementation details that interviewers actually ask about.`,
  (topic: string) => `Session 1 was the warm-up. You now know what ${topic} is and why every big tech company relies on it. Today? We roll up our sleeves and write the actual code.`,
  (topic: string) => `Last session I promised you'd understand ${topic}. Today I'm promising you'll be able to IMPLEMENT it. Let's pick up right where we left off.`,
  (topic: string) => `If session 1 was "Introduction to ${topic}", today is "Mastering ${topic}." We're going from theory to practice, from definitions to code, from concepts to interview answers.`,
];

/** Session 3 hooks — escalation, separating seniors from juniors */
const SESSION_3_HOOKS = [
  (topic: string) => `You now know the basics AND the algorithms of ${topic}. But here's the question that separates senior engineers from everyone else: what happens when it BREAKS in production?`,
  (topic: string) => `Two sessions in, and you already know more about ${topic} than most developers with years of experience. Today we tackle the advanced patterns that get you the senior-level offer.`,
  (topic: string) => `Sessions 1 and 2 made you dangerous. You can explain ${topic} and implement it. Session 3 makes you LETHAL. We're covering the edge cases, the failure modes, the stuff that breaks at 3 AM.`,
  (topic: string) => `Here's what's different about session 3. In sessions 1 and 2, I taught you how ${topic} works. Today I'm teaching you how it FAILS. And that's what really matters in production.`,
  (topic: string) => `You've built the foundation. You've written the code. Now comes the part that actually matters in senior-level interviews: the trade-offs, the edge cases, the real-world gotchas of ${topic}.`,
  (topic: string) => `Let me ask you something. You can now explain ${topic} and implement it from scratch. But can you debug it at scale? Can you design it for a billion users? That's what session 3 is about.`,
  (topic: string) => `This is the session that turns knowledge into expertise. We've covered what ${topic} is and how to build it. Now we learn how to make it bulletproof. This is senior engineer territory.`,
  (topic: string) => `A junior knows WHAT ${topic} is. A mid-level knows HOW to implement it. A senior knows WHEN it fails and WHAT to do about it. That's what session 3 is about.`,
];

/** Session 4+ hooks — expert level, production reality */
const SESSION_4_PLUS_HOOKS = [
  (topic: string) => `We've covered the fundamentals, the algorithms, and the failure modes of ${topic}. Now let's tackle the part that actually breaks in production and how ${getTopicExample(topic).company} handles it at ${getTopicExample(topic).scale}.`,
  (topic: string) => `Three sessions of ${topic} have made you more knowledgeable than most working engineers. But there's one more level. The level where you can ARCHITECT systems. Let's get there.`,
  (topic: string) => `If you've been following this series, you can already ace most ${topic} interview questions. Today we go beyond the interview. We're talking real production architecture at massive scale.`,
  (topic: string) => `This is the advanced ${topic} session that I wish existed when I was preparing for interviews. Everything we cover today comes from real production incidents at top tech companies.`,
  (topic: string) => `By now you're not just familiar with ${topic}. You're fluent. Today we become experts. We're covering the patterns that principal engineers use when designing systems for billions of users.`,
  (topic: string) => `We've built up ${topic} from zero to advanced. In this session, we're looking at the cutting edge. The newest patterns, the latest developments, and what the future holds.`,
];

function generateHook(topic: string, title: string, sessionNumber: number = 1, totalSessions?: number): string {
  let hook: string;

  if (sessionNumber === 1) {
    const seed = (topic.length * 7 + title.length * 13) % SESSION_1_HOOKS.length;
    hook = SESSION_1_HOOKS[seed](topic);
  } else if (sessionNumber === 2) {
    const seed = (topic.length * 7 + title.length * 13) % SESSION_2_HOOKS.length;
    hook = SESSION_2_HOOKS[seed](topic);
  } else if (sessionNumber === 3) {
    const seed = (topic.length * 7 + title.length * 13) % SESSION_3_HOOKS.length;
    hook = SESSION_3_HOOKS[seed](topic);
  } else {
    const seed = (topic.length * 7 + title.length * 13) % SESSION_4_PLUS_HOOKS.length;
    hook = SESSION_4_PLUS_HOOKS[seed](topic);
  }

  const seriesInfo = totalSessions
    ? ` This is session ${sessionNumber} of ${totalSessions} in our complete ${topic} series.`
    : ` This is session ${sessionNumber} of our ${topic} series.`;

  return `${hook}${seriesInfo} Today's topic: ${title}.`;
}

// ---------------------------------------------------------------------------
// Markdown Parsing
// ---------------------------------------------------------------------------
interface MarkdownSection {
  type: 'text' | 'code' | 'diagram' | 'table' | 'callout';
  heading?: string;
  content: string;
  language?: string;
  rows?: string[][];
}

function parseMarkdown(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const lines = markdown.split('\n');
  let i = 0;
  let currentHeading = '';

  while (i < lines.length) {
    const line = lines[i];

    // Headings (## through ######)
    if (/^#{2,6}\s/.test(line)) {
      currentHeading = line.replace(/^#+\s*/, '');
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith('```')) {
      const lang = line.replace('```', '').trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      sections.push({
        type: 'code',
        heading: currentHeading,
        content: codeLines.join('\n'),
        language: lang || 'typescript',
      });
      continue;
    }

    // Mermaid diagrams
    if (line.includes('mermaid') || line.includes('graph ') || line.includes('sequenceDiagram')) {
      const diagramLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')) {
        diagramLines.push(lines[i]);
        i++;
      }
      sections.push({
        type: 'diagram',
        heading: currentHeading,
        content: diagramLines.join('\n'),
      });
      continue;
    }

    // Tables (pipe-separated)
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        if (!lines[i].includes('---')) { // Skip separator row
          tableLines.push(lines[i]);
        }
        i++;
      }
      const rows = tableLines.map(l =>
        l.split('|').map(cell => cell.trim()).filter(Boolean)
      );
      sections.push({
        type: 'table',
        heading: currentHeading,
        content: tableLines.join('\n'),
        rows,
      });
      continue;
    }

    // Interview callouts
    if (line.includes('Interview') || line.includes('Pro Tip') || line.includes('Key Insight')) {
      const calloutLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#')) {
        calloutLines.push(lines[i]);
        i++;
      }
      sections.push({
        type: 'callout',
        heading: currentHeading,
        content: calloutLines.join(' ').replace(/[*_#>]/g, ''),
      });
      continue;
    }

    // Regular text paragraphs
    if (line.trim()) {
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('|')) {
        textLines.push(lines[i]);
        i++;
      }
      const text = textLines.join(' ').replace(/[*_]/g, '');
      if (text.length > 20) { // Skip very short fragments
        sections.push({
          type: 'text',
          heading: currentHeading,
          content: text,
        });
      }
      continue;
    }

    i++;
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Animation Cue + SFX Helpers
// ---------------------------------------------------------------------------
function generateCodeCues(narration: string, codeLineCount: number): AnimationCue[] {
  const phrases = SyncTimeline.computePhraseBoundaries(narration);
  const words = narration.split(/\s+/);
  const cues: AnimationCue[] = [];

  if (phrases.length === 0) {
    const wordsPerGroup = Math.max(1, Math.floor(words.length / codeLineCount));
    for (let line = 0; line < codeLineCount; line++) {
      cues.push({ wordIndex: line * wordsPerGroup, action: 'typeLine', target: line });
    }
  } else {
    const linesPerPhrase = Math.ceil(codeLineCount / (phrases.length + 1));
    let lineIndex = 0;
    cues.push({ wordIndex: 0, action: 'typeLine', target: 0 });
    lineIndex += linesPerPhrase;
    for (const boundary of phrases) {
      if (lineIndex >= codeLineCount) break;
      cues.push({ wordIndex: boundary + 1, action: 'typeLine', target: lineIndex });
      lineIndex += linesPerPhrase;
    }
  }

  return cues;
}

function generateTextCues(narration: string, bulletCount: number): AnimationCue[] {
  const phrases = SyncTimeline.computePhraseBoundaries(narration);
  const cues: AnimationCue[] = [
    { wordIndex: 0, action: 'revealBullet', target: 0 },
  ];

  for (let i = 0; i < Math.min(phrases.length, bulletCount - 1); i++) {
    cues.push({ wordIndex: phrases[i] + 1, action: 'revealBullet', target: i + 1 });
  }

  return cues;
}

function generateTableCues(narration: string, rowCount: number): AnimationCue[] {
  const words = narration.split(/\s+/);
  const wordsPerRow = Math.max(1, Math.floor(words.length / rowCount));
  return Array.from({ length: rowCount }, (_, i) => ({
    wordIndex: i * wordsPerRow,
    action: 'revealRow',
    target: i,
  }));
}

function generateSceneSfxTriggers(
  sceneIndex: number,
  sceneType: string,
  cues: AnimationCue[],
): SfxTrigger[] {
  const triggers: SfxTrigger[] = [];
  triggers.push({ sceneIndex, wordIndex: 0, effect: 'whoosh-in', volume: 0.4 });

  if (sceneType === 'table') {
    cues.filter(c => c.action === 'revealRow').forEach(c => {
      triggers.push({ sceneIndex, wordIndex: c.wordIndex, effect: 'ding', volume: 0.3 });
    });
  }

  return triggers;
}

// ---------------------------------------------------------------------------
// Long Scene Splitter — breaks text scenes >200 chars into 2 sub-scenes
// to increase cuts/min from ~2.3 to 6-8 (reduces avg scene duration)
// ---------------------------------------------------------------------------
/** Extract readable bullet points from a narration chunk */
function bulletsFromText(text: string, max: number = 4): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 120) // skip tiny fragments and huge blocks
    .slice(0, max);
}

function splitLongScene(scene: Scene, _currentFrame: number): Scene[] {
  // Split text scenes exceeding max duration or narration length
  const tooLong = scene.narration && scene.narration.length > 150;
  const tooSlow = scene.duration > 10; // aggressive: 10s max for any text scene
  if (scene.type !== 'text' || !scene.narration || (!tooLong && !tooSlow)) return [scene];

  const sentences = scene.narration.split(/(?<=[.!?])\s+/);
  if (sentences.length < 2) return [scene];

  // For very long scenes (>20s or >300 chars), split into 3 parts
  if ((scene.duration > 20 || scene.narration.length > 400) && sentences.length >= 3) {
    const third = Math.ceil(sentences.length / 3);
    const parts = [
      sentences.slice(0, third).join(' '),
      sentences.slice(third, third * 2).join(' '),
      sentences.slice(third * 2).join(' '),
    ];
    const totalLen = scene.narration.length;
    let frame = scene.startFrame;
    return parts.map((part, i) => {
      const dur = Math.max(4, Math.round((part.length / totalLen) * scene.duration));
      const start = frame;
      const end = start + TIMING.secondsToFrames(dur);
      frame = end;
      const suffix = i === 0 ? '' : i === 1 ? ' — Deep Dive' : ' — Key Insight';
      // KEY FIX: each sub-scene gets its OWN content + bullets derived from its narration chunk
      const partBullets = i === 0 && scene.bullets && scene.bullets.length > 0
        ? scene.bullets.slice(0, 3)
        : bulletsFromText(part);
      return { ...scene, narration: part, content: part, duration: dur, startFrame: start, endFrame: end, heading: (scene.heading || '') + suffix, bullets: partBullets };
    });
  }

  // Standard 2-way split
  const mid = Math.ceil(sentences.length / 2);
  const firstHalf = sentences.slice(0, mid).join(' ');
  const secondHalf = sentences.slice(mid).join(' ');
  const firstDuration = Math.max(4, Math.round((firstHalf.length / scene.narration.length) * scene.duration));
  const secondDuration = Math.max(4, scene.duration - firstDuration);

  const firstBullets = scene.bullets && scene.bullets.length > 0
    ? scene.bullets.slice(0, Math.ceil(scene.bullets.length / 2))
    : bulletsFromText(firstHalf);
  const secondBullets = scene.bullets && scene.bullets.length > 2
    ? scene.bullets.slice(Math.ceil(scene.bullets.length / 2))
    : bulletsFromText(secondHalf);

  return [
    { ...scene, narration: firstHalf, content: firstHalf, duration: firstDuration, endFrame: scene.startFrame + TIMING.secondsToFrames(firstDuration), bullets: firstBullets },
    { ...scene, narration: secondHalf, content: secondHalf, duration: secondDuration, startFrame: scene.startFrame + TIMING.secondsToFrames(firstDuration), endFrame: scene.endFrame, heading: (scene.heading || '') + ' — Key Insight', bullets: secondBullets },
  ];
}

// ---------------------------------------------------------------------------
// Scene Construction
// ---------------------------------------------------------------------------
function sectionToScene(
  section: MarkdownSection,
  language: string,
  currentFrame: number,
  sectionIndex: number = 0,
  topic: string = '',
): Scene {
  const type = mapSectionType(section.type);

  // BUG FIX: Skip topic-bridge and topic-specific narration for code that doesn't match the topic.
  // e.g., ConsistentHash code in a Kafka video should NOT say "This is how kafka works under the hood."
  let effectiveTopic = topic;
  if (type === 'code' && topic && !isCodeRelevantToTopic(section.content, topic)) {
    // Strip topic from narration generation so it won't produce misleading topic bridges
    effectiveTopic = '';
  }

  let narration = generateNarration(section, effectiveTopic);

  // No more stacking of aha phrases, encouragement, or repetition on every scene.
  // The narration from generateNarration() is already clean and complete.

  const speedKey = section.type === 'code' ? 'code' : section.type === 'callout' ? 'interview' : 'text';
  const wpm = NARRATION_SPEEDS[speedKey];
  const wordCount = narration.split(/\s+/).length;
  const duration = Math.max(5, Math.ceil((wordCount / wpm) * 60));
  const frames = TIMING.secondsToFrames(duration);

  // Convert mermaid diagrams to SVG
  let content = section.content;
  if (type === 'diagram') {
    try {
      content = renderMermaidToSvg(section.content);
    } catch {
      // Keep raw content if rendering fails
    }
  }

  const scene: Scene = {
    type,
    content,
    narration,
    duration,
    startFrame: currentFrame,
    endFrame: currentFrame + frames,
    heading: section.heading,
    language: section.language || language,
  };

  // Add bullets for text sections
  if (type === 'text') {
    scene.bullets = section.content
      .split(/[.!?]/)
      .map(s => s.trim())
      .filter(s => s.length > 10)
      .slice(0, 5);
  }

  // Generate animation cues based on scene type
  if (scene.type === 'code') {
    const lineCount = scene.content.split('\n').filter(l => l.trim()).length;
    scene.animationCues = generateCodeCues(scene.narration, lineCount);
  } else if (scene.type === 'text' && scene.bullets) {
    scene.animationCues = generateTextCues(scene.narration, scene.bullets.length);
  } else if (scene.type === 'table') {
    const rowCount = scene.content.split('\n').filter(l => l.includes('|')).length - 2;
    scene.animationCues = generateTableCues(scene.narration, Math.max(1, rowCount));
  }

  scene.sfxTriggers = generateSceneSfxTriggers(0, scene.type, scene.animationCues || []);

  return scene;
}

function mapSectionType(type: string): SceneType {
  const map: Record<string, SceneType> = {
    text: 'text',
    code: 'code',
    diagram: 'diagram',
    table: 'table',
    callout: 'interview',
  };
  return map[type] || 'text';
}

function generateNarration(section: MarkdownSection, topic: string = ''): string {
  // BUG FIX: ASCII art should NOT be read as narration — replace with semantic description
  if (containsAsciiArt(section.content)) {
    return asciiArtNarration(section.heading);
  }

  switch (section.type) {
    case 'code':
      return summarizeCode(section.content, section.language || 'typescript', topic);
    case 'diagram':
      return generateDiagramNarration(section.heading);
    case 'table':
      return generateTableNarration(section.heading);
    case 'callout':
      return generateCalloutNarration(section.content);
    case 'text':
    default: {
      // Clean markdown and make conversational
      const cleaned = section.content
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
        .replace(/[`*_#]/g, '') // Remove markdown formatting
        .slice(0, 500); // Cap length
      return makeConversational(cleaned);
    }
  }
}

/** Language-specific transition phrases for dual-language code scenes */
const LANG_TRANSITIONS: Record<string, string[]> = {
  python: [
    "Let's see this in Python first.",
    "Here's how this looks in Python.",
    "Starting with the Python implementation.",
    "First up, the Python version.",
  ],
  java: [
    "And here's the same logic in Java.",
    "Now let's see the Java version.",
    "Here's the equivalent Java implementation.",
    "And in Java, it looks like this.",
  ],
};

function getLanguageTransition(language: string, seed: number): string {
  const lang = language.toLowerCase();
  const phrases = LANG_TRANSITIONS[lang];
  if (!phrases) return '';
  return phrases[seed % phrases.length];
}

function summarizeCode(code: string, language: string, topic: string = ''): string {
  const lines = code.split('\n').filter(l => l.trim());
  const funcMatch = code.match(/(?:function|def|public\s+\w+)\s+(\w+)/);
  const classMatch = code.match(/class\s+(\w+)/);
  const lang = language.toLowerCase();

  // Add language transition for Python and Java dual-language mode
  const langTransition = (lang === 'python' || lang === 'java')
    ? getLanguageTransition(lang, (code.length + lines.length) % 4) + ' '
    : '';

  // Extract what the code actually DOES by analyzing its content
  const purposeHint = inferCodePurpose(code);
  const walkthrough = generateCodeWalkthrough(code, language, topic);

  // Connect the code to the TOPIC being taught — a real teacher says
  // "this matters for X because..." not just "here's a class in python"
  // BUG FIX: Use oncePerVideo so "works under the hood" only appears ONCE per video
  const topicBridge = topic
    ? oncePerVideo('topic-bridge', ` This is how ${topic.toLowerCase()} works under the hood.`)
    : '';

  if (classMatch && funcMatch) {
    const purpose = purposeHint ? ` that ${purposeHint}` : '';
    return `${langTransition}Let me walk you through the ${classMatch[1]} class${purpose}.${topicBridge} The key method here is ${funcMatch[1]}. ${walkthrough}`;
  }
  if (classMatch) {
    const purpose = purposeHint ? ` that ${purposeHint}` : '';
    return `${langTransition}Let me walk you through the ${classMatch[1]} class${purpose}.${topicBridge} ${walkthrough}`;
  }
  if (funcMatch) {
    const purpose = purposeHint ? ` — it ${purposeHint}` : '';
    // Extract params for context
    const paramMatch = code.match(new RegExp(`${funcMatch[1]}\\s*\\(([^)]*)\\)`));
    const params = paramMatch ? paramMatch[1].replace(/self,?\s*/, '').trim() : '';
    const paramDesc = params ? ` that takes ${describeParams(params)}` : '';
    return `${langTransition}This ${funcMatch[1]} function${paramDesc}${purpose}.${topicBridge} ${walkthrough}`;
  }
  const purpose = purposeHint ? ` This code ${purposeHint}.` : '';
  // BUG FIX: "Here is the implementation in X lines" only appears ONCE per video
  const implPhrase = oncePerVideo('impl-in-lines', `Here is the implementation in ${lines.length} lines.`);
  const implFallback = implPhrase || `Let's look at this ${lines.length}-line implementation.`;
  return `${langTransition}${implFallback}${purpose}${topicBridge} ${walkthrough}`;
}

/** Analyze code content to infer what it does — returns a verb phrase like "distributes traffic across servers" */
function inferCodePurpose(code: string): string {
  const lower = code.toLowerCase();

  // Check for common algorithm/data structure patterns
  if (lower.includes('sort') && (lower.includes('pivot') || lower.includes('partition')))
    return 'sorts elements using a partitioning strategy';
  if (lower.includes('binary') && lower.includes('search') || (lower.includes('mid') && lower.includes('low') && lower.includes('high')))
    return 'performs a binary search to find elements efficiently';
  if (lower.includes('bfs') || (lower.includes('queue') && lower.includes('visited')))
    return 'traverses the graph level by level using BFS';
  if (lower.includes('dfs') || (lower.includes('stack') && lower.includes('visited')) || (lower.includes('def dfs') || lower.includes('function dfs')))
    return 'explores the graph depth-first using DFS';
  if (lower.includes('dijkstra') || (lower.includes('priority') && lower.includes('distance')))
    return 'finds the shortest path using a priority queue';
  if (lower.includes('cache') && (lower.includes('get') && lower.includes('put')))
    return 'implements a cache with get and put operations';
  if (lower.includes('lru') || lower.includes('least recently'))
    return 'implements an LRU cache that evicts the least recently used entries';

  // Check for system design patterns
  if (lower.includes('round_robin') || lower.includes('roundrobin') || lower.includes('round robin'))
    return 'distributes requests across servers using round robin';
  if (lower.includes('load_balanc') || lower.includes('loadbalanc') || lower.includes('load balanc'))
    return 'balances load across multiple servers';
  if (lower.includes('hash_ring') || lower.includes('consistent_hash') || lower.includes('consistent hash'))
    return 'distributes data using consistent hashing';
  if (lower.includes('rate_limit') || lower.includes('ratelimit') || lower.includes('token_bucket') || lower.includes('tokenbucket'))
    return 'implements rate limiting to control request flow';
  if (lower.includes('circuit_breaker') || lower.includes('circuitbreaker'))
    return 'implements a circuit breaker to prevent cascading failures';
  if (lower.includes('retry') && (lower.includes('backoff') || lower.includes('attempt')))
    return 'retries failed operations with backoff';
  if (lower.includes('health_check') || lower.includes('healthcheck') || lower.includes('heartbeat'))
    return 'monitors server health with periodic checks';

  // Check for data structure operations
  if (lower.includes('enqueue') && lower.includes('dequeue'))
    return 'implements a queue with enqueue and dequeue operations';
  if ((lower.includes('.push') || lower.includes('.pop')) && lower.includes('stack'))
    return 'implements stack-based operations';
  if (lower.includes('insert') && lower.includes('node') && (lower.includes('left') || lower.includes('right')))
    return 'builds and manipulates a tree structure';
  if (lower.includes('linked') && lower.includes('node') && lower.includes('next'))
    return 'works with a linked list structure';
  if (lower.includes('hashmap') || lower.includes('hash_map') || lower.includes('dictionary'))
    return 'uses a hash map for efficient lookups';

  // Check for common operations by keywords
  if (lower.includes('distribute') && lower.includes('server'))
    return 'distributes work across multiple servers';
  if (lower.includes('connect') && (lower.includes('socket') || lower.includes('http') || lower.includes('tcp')))
    return 'establishes network connections';
  if (lower.includes('encrypt') || lower.includes('decrypt') || lower.includes('cipher'))
    return 'handles encryption and decryption';
  if (lower.includes('validate') || lower.includes('sanitize'))
    return 'validates and sanitizes the input data';
  if (lower.includes('serialize') || lower.includes('deserialize') || lower.includes('json'))
    return 'handles data serialization';
  if (lower.includes('thread') && (lower.includes('lock') || lower.includes('mutex') || lower.includes('synchronized')))
    return 'manages concurrent access with thread safety';

  // Check for return patterns to infer purpose
  const returnMatch = code.match(/return\s+(\w+)/g);
  if (returnMatch && returnMatch.length === 1) {
    const retVal = returnMatch[0].replace('return ', '');
    if (retVal === 'result' || retVal === 'output' || retVal === 'res') return 'computes and returns the result';
    if (retVal === 'count' || retVal === 'total' || retVal === 'sum') return 'calculates and returns a running total';
    if (retVal.includes('max') || retVal.includes('min')) return `finds the ${retVal} value`;
    if (retVal === 'True' || retVal === 'true' || retVal === 'False' || retVal === 'false') return 'checks a condition and returns a boolean';
  }

  // Fallback: check for loops + data structures to describe the pattern
  if ((lower.includes('for ') || lower.includes('while ')) && lower.includes('append'))
    return 'builds up a result by iterating and collecting elements';
  if ((lower.includes('for ') || lower.includes('while ')) && (lower.includes('max') || lower.includes('min')))
    return 'iterates to find the optimal value';

  return '';
}

// Add teaching pauses — only at major transition points, not after every sentence
function addTeachingPauses(text: string): string {
  // Only add a pause after questions (natural thinking moment)
  return text.replace(/\? /g, '? ... ');
}

// ---------------------------------------------------------------------------
// Viz Variant Auto-Assignment
// Analyzes scene narration, heading, and bullets to assign the best
// visualization variant so every scene shows a UNIQUE animation state.
// ---------------------------------------------------------------------------

/**
 * Keyword → variant mappings per visualization type (topic family).
 *
 * IMPORTANT: These keywords are matched against each scene's narration + heading
 * + bullets, NOT the topic name.  The variant must reflect what the narrator is
 * CURRENTLY SAYING so the right-side visualization matches the spoken content.
 *
 * Keywords are case-insensitive (the search blob is lowercased).
 * Phrase keywords (e.g. "single server") match as substrings, so they work in
 * natural sentences like "imagine a single server handling millions of requests".
 */
const VIZ_VARIANT_RULES: Record<string, Array<{ keywords: string[]; variant: string }>> = {
  // ── TrafficFlow variants ─────────────────────────────────────────────
  'traffic': [
    {
      keywords: [
        'overload', 'overwhelm', 'crash', 'single server', 'one server',
        'no load balancer', 'bottleneck', 'too many', 'million users', 'spike',
        'without load', 'without a load', 'imagine a server', 'gets overwhelmed',
        'goes down', 'too much traffic', 'one machine', 'single point',
        'can\'t handle', 'piling up', 'slow down', 'response time',
      ],
      variant: 'overload',
    },
    {
      keywords: [
        'round robin', 'distribute', 'even', 'equally', 'rotation', 'algorithm',
        'weighted', 'split traffic', 'multiple server', 'spread', 'balance',
        'across servers', 'among servers', 'each server gets',
        'evenly', 'fairly', 'least connection', 'ip hash',
      ],
      variant: 'distribute',
    },
    {
      keywords: [
        'health check', 'heartbeat', 'failover', 'detect', 'reroute', 'monitor',
        'server down', 'failure', 'recovery', 'backup', 'dead server',
        'unhealthy', 'remove from pool', 'mark as down', 'stop sending',
        'periodic check', 'ping', 'health endpoint', 'liveness',
      ],
      variant: 'healthcheck',
    },
    {
      keywords: [
        'sticky', 'session', 'affinity', 'cookie', 'same server', 'stateful',
        'persistence', 'session id', 'always go to', 'remember which',
        'client stays', 'bound to', 'pinned',
      ],
      variant: 'sticky',
    },
    {
      keywords: [
        'scale', 'horizontal', 'add server', 'auto-scale', 'elastic', 'grow',
        'new instance', 'capacity', 'spin up', 'launch more',
        'dynamically add', 'scale out', 'scale up', 'more servers',
        'cloud auto', 'demand increases', 'handle more',
      ],
      variant: 'scale',
    },
  ],

  // ── HashTableViz variants ────────────────────────────────────────────
  'hashtable': [
    { keywords: ['insert', 'add', 'put', 'store', 'create', 'new entry', 'first'], variant: 'insert' },
    { keywords: ['collision', 'chain', 'same bucket', 'linked list', 'open addressing', 'probe', 'conflict', 'same index', 'same slot'], variant: 'collision' },
    { keywords: ['resize', 'rehash', 'load factor', 'grow', 'double', 'capacity', 'threshold', 'expand', 'too full'], variant: 'resize' },
    { keywords: ['lookup', 'search', 'find', 'get', 'retrieve', 'access', 'query', 'O(1)', 'constant time', 'fetch'], variant: 'lookup' },
  ],

  // ── TreeViz variants ─────────────────────────────────────────────────
  'tree': [
    { keywords: ['insert', 'add', 'new node', 'place', 'create'], variant: 'insert' },
    { keywords: ['search', 'find', 'lookup', 'traverse', 'locate', 'path'], variant: 'search' },
    { keywords: ['delete', 'remove', 'predecessor', 'successor', 'restructure', 'reorganize'], variant: 'delete' },
    { keywords: ['balance', 'AVL', 'rotation', 'red-black', 'skew', 'height', 'rebalance', 'unbalanced'], variant: 'balance' },
  ],

  // ── SystemArchViz variants ───────────────────────────────────────────
  'sysarch': [
    { keywords: ['request', 'flow', 'architecture', 'layer', 'component', 'overview', 'structure', 'basic', 'how it works'], variant: 'request-flow' },
    { keywords: ['failure', 'circuit breaker', 'cascade', 'fallback', 'resilience', 'fault', 'outage', 'retry', 'timeout', 'graceful degradation'], variant: 'failure' },
    { keywords: ['scale', 'horizontal', 'replica', 'throughput', 'capacity', 'instances', 'auto-scale', 'grow', 'handle more'], variant: 'scale-up' },
    { keywords: ['cache', 'redis', 'memcached', 'latency', 'hit rate', 'miss', 'invalidation', 'TTL', 'warm', 'cold'], variant: 'caching' },
  ],

  // ── DatabaseViz variants ─────────────────────────────────────────────
  // CRITICAL: variant names must match the component switch in DatabaseViz.tsx
  // Available variants: (default/replication), 'sharding', 'failover'
  'database': [
    {
      keywords: [
        'replication', 'replica', 'read replica', 'master', 'slave', 'primary',
        'secondary', 'sync', 'lag', 'master-slave', 'primary-secondary',
        'read/write split', 'replicate', 'copy data', 'standby copy',
        'data sync', 'read traffic', 'write to primary',
      ],
      variant: 'replication',
    },
    {
      keywords: [
        'shard', 'partition', 'horizontal scaling', 'shard key', 'range',
        'hash partition', 'consistent hash', 'distribute data', 'split data',
        'data across', 'multiple databases', 'break up', 'subset of data',
        'user a through', 'user id mod', 'hash function',
      ],
      variant: 'sharding',
    },
    {
      keywords: [
        'failover', 'backup', 'disaster', 'standby', 'recovery', 'promote',
        'switchover', 'database down', 'database fails', 'high availability',
        'automatic failover', 'hot standby', 'warm standby',
        'database crash', 'promote standby', 'take over',
      ],
      variant: 'failover',
    },
    {
      // Default variant (replication viz) for general DB concepts — this is the
      // broadest bucket so it's listed LAST (scored after more-specific rules)
      keywords: [
        'database', 'table', 'schema', 'query', 'sql', 'normalize',
        'index', 'join', 'select', 'insert', 'transaction', 'acid',
        'single database', 'overwhelm', 'bottleneck', 'slow queries',
        'one database', 'relational', 'data model', 'store data',
        'b-tree', 'query optimization', 'indexing',
      ],
      variant: 'replication',  // default variant shows basic DB concepts
    },
  ],

  // ── CacheViz variants ────────────────────────────────────────────────
  'cache': [
    {
      keywords: [
        'hit', 'miss', 'cache hit', 'cache miss', 'lookup', 'check cache',
        'fast', 'read', 'get', 'fetch', 'retrieve', 'key-value',
        'in memory', 'hot data', 'frequently accessed', 'speed up',
      ],
      variant: 'lookup',
    },
    {
      keywords: [
        'evict', 'eviction', 'lru', 'lfu', 'ttl', 'expire', 'remove',
        'policy', 'capacity', 'full', 'overflow', 'replacement',
        'least recently', 'least frequently', 'time to live', 'stale',
      ],
      variant: 'eviction',
    },
    {
      keywords: [
        'layer', 'l1', 'l2', 'multi-level', 'distributed', 'local', 'global',
        'tier', 'hierarchy', 'cdn', 'edge', 'multi-layer', 'app cache',
        'browser cache', 'server cache', 'levels of cache',
      ],
      variant: 'layers',
    },
  ],

  // ── QueueViz variants ────────────────────────────────────────────────
  'queue': [
    {
      keywords: [
        'fifo', 'enqueue', 'dequeue', 'push', 'pop', 'order', 'first in',
        'sequential', 'simple queue', 'basic queue', 'message queue',
        'producer', 'consumer', 'send message', 'receive message',
        'process in order', 'one by one',
      ],
      variant: 'fifo',
    },
    {
      keywords: [
        'publish', 'subscribe', 'pub/sub', 'pub-sub', 'fan-out', 'broadcast',
        'consumer group', 'topic', 'event', 'multiple consumers',
        'all subscribers', 'notification', 'event-driven',
        'one-to-many', 'decouple',
      ],
      variant: 'pubsub',
    },
    {
      keywords: [
        'dead letter', 'dlq', 'retry', 'failed', 'poison', 'error queue',
        'backoff', 'failed message', 'reprocess', 'undeliverable',
        'max retries', 'error handling', 'poison pill',
      ],
      variant: 'deadletter',
    },
  ],

  // ── GraphViz variants ────────────────────────────────────────────────
  'graph': [
    { keywords: ['bfs', 'breadth', 'level order', 'queue-based', 'shortest', 'unweighted', 'layer by layer', 'level by level'], variant: 'bfs' },
    { keywords: ['dfs', 'depth', 'stack', 'backtrack', 'cycle', 'topological', 'recursive', 'explore deep'], variant: 'dfs' },
    { keywords: ['dijkstra', 'weight', 'shortest path', 'distance', 'bellman', 'priority', 'priority queue', 'greedy'], variant: 'dijkstra' },
  ],

  // ── SortingViz variants ──────────────────────────────────────────────
  'sorting': [
    { keywords: ['merge', 'divide', 'conquer', 'split', 'combine', 'merge sort'], variant: 'merge' },
    { keywords: ['quick', 'pivot', 'partition', 'quick sort', 'lomuto', 'hoare'], variant: 'quick' },
    { keywords: ['bubble', 'swap', 'adjacent', 'selection', 'insertion'], variant: 'bubble' },
    { keywords: ['binary search', 'search', 'find', 'mid', 'target', 'sorted'], variant: 'search' },
  ],
};

/** Determine which viz family a topic belongs to for variant assignment */
function getVizFamily(topic: string): string | null {
  const t = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Traffic/Network
  if (t.includes('load-balanc') || t.includes('cdn') || t.includes('api-gateway') ||
      t.includes('rate-limit') || t.includes('network') || t.includes('proxy') ||
      t.includes('dns') || t.includes('http') || t.includes('grpc') ||
      t.includes('websocket')) return 'traffic';

  // Hash Table
  if (t.includes('hash-table') || t.includes('hash-map') || t.includes('hashing') ||
      t.includes('consistent-hash')) return 'hashtable';

  // Tree
  if (t.includes('tree') || t.includes('bst') || t.includes('heap') ||
      t.includes('trie') || t.includes('avl') || t.includes('red-black') ||
      t.includes('priority-queue')) return 'tree';

  // Database
  if (t.includes('database') || t.includes('rdbms') || t.includes('sql') ||
      t.includes('nosql') || t.includes('mongo') || t.includes('postgres') ||
      t.includes('mysql') || t.includes('dynamo') || t.includes('cassandra') ||
      t.includes('sharding') || t.includes('replicat') ||
      t.includes('acid') || t.includes('cap-theorem')) return 'database';

  // Cache
  if (t.includes('cach') || t.includes('redis') || t.includes('memcache') ||
      t.includes('content-delivery')) return 'cache';

  // Queue/Messaging
  if (t.includes('queue') || t.includes('kafka') || t.includes('rabbitmq') ||
      t.includes('message') || t.includes('pub-sub') || t.includes('event-driven') ||
      t.includes('notification') || t.includes('scheduler') ||
      t.includes('sqs') || t.includes('sns')) return 'queue';

  // Graph
  if (t.includes('graph') || t.includes('distributed-system') ||
      t.includes('consensus') || t.includes('raft') || t.includes('paxos')) return 'graph';

  // Sorting/Arrays
  if (t.includes('sort') || t.includes('array') || t.includes('string') ||
      t.includes('two-pointer') || t.includes('sliding-window') ||
      t.includes('binary-search')) return 'sorting';

  // System Architecture (broadest — must be after more specific checks)
  if (t.includes('system-design') || t.includes('microservice') ||
      t.includes('design-') || t.includes('scalab') || t.includes('architect') ||
      t.includes('auth') || t.includes('security') || t.includes('ci-cd') ||
      t.includes('devops') || t.includes('monitor') || t.includes('observ')) return 'sysarch';

  return null;
}

/**
 * Assign a vizVariant to a scene based on its textual content.
 *
 * Deeply analyzes the scene's narration, heading, and bullet points to pick
 * the variant whose keywords best match what the narrator is CURRENTLY SAYING.
 * This ensures the right-side visualization reflects the spoken content, not
 * just a generic topic-level animation.
 *
 * Scoring: each keyword match adds 1 point; multi-word phrase matches add a
 * bonus (+1) because they're more specific/confident signals.
 */
function assignVizVariant(scene: Scene, topic: string, sceneIndex: number): string | undefined {
  // Only visual scenes (text, interview, code) get variants — diagram/table render differently
  if (scene.type !== 'text' && scene.type !== 'interview' && scene.type !== 'code') return undefined;

  const family = getVizFamily(topic);
  if (!family) return undefined;

  const rules = VIZ_VARIANT_RULES[family];
  if (!rules) return undefined;

  // Build a searchable text blob from ALL scene content (heading has highest
  // signal so include it twice for implicit weighting)
  const headingText = (scene.heading || '').toLowerCase();
  const searchBlob = [
    headingText,
    headingText, // double-weight heading
    (scene.narration || '').toLowerCase(),
    (scene.content || '').toLowerCase(),
    ...(scene.bullets || []).map(b => b.toLowerCase()),
  ].join(' ');

  // Score each variant by keyword match count
  // Multi-word phrase matches get a bonus because they are higher-confidence
  const variantScores: Array<{ variant: string; score: number; matches: string[] }> = [];

  for (const rule of rules) {
    let score = 0;
    const matches: string[] = [];

    for (const kw of rule.keywords) {
      const kwLower = kw.toLowerCase();
      if (searchBlob.includes(kwLower)) {
        score += 1;
        // Bonus for multi-word phrase matches (more specific = more confident)
        if (kwLower.includes(' ')) score += 1;
        matches.push(kw);
      }
    }

    variantScores.push({ variant: rule.variant, score, matches });
  }

  // Sort by score descending
  variantScores.sort((a, b) => b.score - a.score);

  const best = variantScores[0];

  // Log for debugging (visible when running render scripts)
  if (best && best.score > 0) {
    console.log(
      `  [VizVariant] Scene "${scene.heading}" → ${best.variant} (score=${best.score}, matches=[${best.matches.join(', ')}])`
    );
  }

  // Only assign if we have a genuine match (score > 0)
  // Do NOT fall back to cycling — showing a mismatched variant is worse than
  // showing the default variant for the family
  if (best && best.score > 0) {
    return best.variant;
  }

  // No keyword matches — return undefined so the viz component uses its
  // built-in default variant (which is usually the most generic/overview one)
  console.log(
    `  [VizVariant] Scene "${scene.heading}" → (default) — no keyword matches for family "${family}"`
  );
  return undefined;
}

/**
 * Post-process all scenes to assign vizVariant fields.
 * Call this after generateScript() to enrich scenes with per-scene variants.
 *
 * PRIORITY: narration-matching always wins over diversity.  If two scenes both
 * talk about "sharding", they should BOTH get the sharding variant — showing a
 * mismatched variant just for variety is the exact bug we're fixing.
 */
export function assignVizVariants(scenes: Scene[], topic: string): Scene[] {
  let vizSceneIdx = 0;

  console.log(`\n[VizVariant] Assigning variants for topic="${topic}" (${scenes.length} scenes)`);

  return scenes.map((scene) => {
    if (scene.type !== 'text' && scene.type !== 'interview' && scene.type !== 'code') return scene;

    const variant = assignVizVariant(scene, topic, vizSceneIdx);
    vizSceneIdx++;

    return { ...scene, vizVariant: variant };
  });
}

export {
  parseMarkdown,
  generateNarration,
  generateHook,
  addTeachingPauses,
  makeConversational,
  // Teaching technique exports
  getAnalogy,
  reinforceConcept,
  getAhaPhrase,
  getEncouragement,
  generateInterviewReality,
  generateCodeWalkthrough,
  describeCodeLine,
  generateProblemSetup,
  generateWrongAnswer,
  generateRealAnswer,
  generateInterviewSecret,
  generatePracticeNarration,
  generateCleanAnswer,
  generateSummaryNarration,
  getVizFamily,
  assignVizVariant,
  // Session-awareness exports
  getEngagementHook,
  getSeriesConnector,
  generateDefaultRecapPoints,
  ANALOGIES,
  SESSION_ANALOGY_SETS,
  AHA_PHRASES,
  ENCOURAGEMENT,
  ENGAGEMENT_HOOKS,
  // Personality exports
  getTopicSurpriseFacts,
  getTopicExample,
  TOPIC_EXAMPLES,
  AUDIENCE_CALLOUTS,
  EMOTIONAL_STAKES,
  CATCHPHRASE,
  GURU_MODE_PHRASES,
  injectContractions,
};
