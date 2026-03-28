import { SessionInput, Scene, SceneType } from '../types';
import type { AnimationCue, SfxTrigger } from '../types';
import { NARRATION_SPEEDS, SCENE_DEFAULTS, TIMING } from '../lib/constants';
import { renderMermaidToSvg } from './mermaid-renderer';
import { SyncTimeline } from '../lib/sync-engine';

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
];

function getOpenLoopPhrase(seed: number): string {
  return OPEN_LOOP_PHRASES[seed % OPEN_LOOP_PHRASES.length];
}

// ---------------------------------------------------------------------------
// Mid-Video Engagement Hooks — rotated to avoid "like and subscribe" fatigue
// ---------------------------------------------------------------------------
const ENGAGEMENT_HOOKS = [
  'If you\'re finding this useful, drop a like. It genuinely helps more developers find this.',
  'Quick knowledge check before we continue. Can you predict what comes next?',
  'Pause the video and think about this for 10 seconds. Seriously. Active recall is how you learn.',
  'This is the part that trips up 90% of candidates. Pay close attention.',
  'Pro tip that most tutorials skip. Write this down.',
  'Here\'s something I wish someone told me when I was starting out.',
  'If you can explain this next part to a friend, you truly understand it.',
  'Bookmark this timestamp. You\'ll want to come back to this before your interview.',
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
    `In real interviews at Google and Amazon, ${topic} questions are about your thought process, not the perfect answer.`,
    `The number one mistake with ${topic} in interviews? Not asking clarifying questions first. Always confirm the constraints.`,
  ];
  return realities[topic.length % realities.length];
}

// ---------------------------------------------------------------------------
// Teaching Technique: Line-by-Line Code Walkthrough (Fireship style)
// ---------------------------------------------------------------------------
function generateCodeWalkthrough(code: string, _language: string): string {
  const lines = code.split('\n').filter(l => l.trim());
  if (lines.length === 0) return '';

  const parts: string[] = [];
  if (lines[0]) {
    parts.push(`We ${describeCodeLine(lines[0])}`);
  }
  if (lines.length > 2) {
    const midIdx = Math.floor(lines.length / 2);
    parts.push(`then ${describeCodeLine(lines[midIdx])}`);
  }
  if (lines.length > 1 && lines[lines.length - 1]) {
    parts.push(`and ${describeCodeLine(lines[lines.length - 1])}`);
  }

  return parts.join(', ') + '.';
}

function describeCodeLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith('class ')) return `define our ${trimmed.split(' ')[1]} class`;
  if (trimmed.startsWith('def ') || trimmed.startsWith('function ')) return 'create a function that handles the main logic';
  if (trimmed.startsWith('return ')) return 'return our result';
  if (trimmed.startsWith('for ') || trimmed.startsWith('while ')) return 'loop through each element';
  if (trimmed.startsWith('if ')) return 'check our condition';
  if (trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('var ')) return 'declare our variables';
  if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) return 'import the dependencies we need';
  if (trimmed.startsWith('print') || trimmed.startsWith('console.log')) return 'output the result to verify it works';
  if (trimmed.includes('= new ')) return 'instantiate our object';
  if (trimmed.includes('.append(') || trimmed.includes('.push(')) return 'add the element to our collection';
  if (trimmed.includes('.pop(')) return 'remove and grab the last element';
  return 'set up the next step';
}

// ---------------------------------------------------------------------------
// Storytelling Arc: THE PROBLEM — Set up tension
// ---------------------------------------------------------------------------
function generateProblemSetup(topic: string): string {
  const problems = [
    `Imagine this. You've built an amazing app. Users love it. Then one morning you wake up and your app is on the front page of Hacker News. Suddenly 10 million people are trying to use your app at the same time. Your server crashes. Your users see error pages. Your boss is calling. This is the exact problem that ${topic} solves. And if you don't understand it, you WILL face this nightmare.`,

    `Let me paint a picture for you. You're running a startup. Everything works great with 100 users. Then you get featured on Product Hunt. Traffic explodes. Without ${topic}, your entire system goes down in minutes. Real companies die because of this. Every. Single. Day. So let's make sure you never make this mistake.`,

    `Here's a scenario that happens more often than you'd think. A developer builds a system that works perfectly in testing. Ships it to production. Three months later, traffic grows 50x, and the whole thing collapses like a house of cards. The missing piece? ${topic}. Every time.`,

    `Think about this. Right now, somewhere in the world, a developer is debugging a production outage at 3 AM. They're stressed, they're tired, and they're desperately googling ${topic}. You do NOT want to be that developer. So let me teach you this now, while you have time to actually learn it properly.`,

    `Close your eyes and imagine you're in a system design interview. The interviewer says, "Design a system that handles one billion requests per day." If your brain just went blank, that's because you don't fully understand ${topic} yet. But you will in about 4 minutes.`,

    `Every second, the internet processes over 100,000 Google searches, 9,000 tweets, and 80,000 YouTube views. How does NONE of this crash? The answer starts with ${topic}. And most developers have no clue how it actually works under the hood.`,
  ];

  const seed = topic.length % problems.length;
  return problems[seed];
}

// ---------------------------------------------------------------------------
// Storytelling Arc: WRONG ANSWER — Create contrast
// ---------------------------------------------------------------------------
function generateWrongAnswer(topic: string): string {
  const wrongAnswers = [
    `Now, here's where most people go wrong. When someone asks about ${topic}, the typical answer is just the textbook definition. They recite it like a parrot. But that tells the interviewer NOTHING about your actual understanding. It's like saying a car is "a vehicle with four wheels." Technically correct. Completely useless.`,

    `The most common mistake I see is this. People learn ${topic} as a buzzword. They can name-drop it in conversation, but when you push them on the details, on the trade-offs, on the edge cases, they fall apart. And interviewers push. Hard.`,

    `Let me tell you what DOESN'T work. Memorizing the Wikipedia article on ${topic}. Watching a 2-hour lecture once and calling it done. These approaches give you a false sense of confidence that crumbles the moment someone asks a follow-up question.`,

    `Here's the trap most developers fall into. They learn the WHAT of ${topic} but never the WHY. They can tell you what it does but not why it exists, what problem it solves, or what happens when it fails. And that gap? That's exactly where interviewers live.`,

    `So many developers think they understand ${topic} because they've used it once or twice. But using something and understanding it are completely different. I've met engineers with 10 years of experience who can't explain the trade-offs. Don't be that person.`,

    `The biggest misconception about ${topic}? That there's one right answer. People learn one approach and think they're done. But in reality, ${topic} involves trade-offs. The right answer always depends on the context. And THAT understanding is what gets you hired.`,
  ];

  const seed = (topic.length * 3) % wrongAnswers.length;
  return wrongAnswers[seed];
}

// ---------------------------------------------------------------------------
// Storytelling Arc: THE REAL ANSWER — Transition into deep dive
// ---------------------------------------------------------------------------
function generateRealAnswer(topic: string): string {
  const realAnswers = [
    `Okay, so what IS the right way to think about ${topic}? Forget everything you've memorized. Let me rebuild this from first principles. And I promise, by the end, it will click so hard you'll wonder why it ever seemed confusing.`,

    `Now let me show you how ${topic} ACTUALLY works. Not the simplified version from tutorials. The real thing. The version that senior engineers at top companies use every day. And I'm going to make it simple.`,

    `Alright, here's the real answer. ${topic} is fundamentally about solving one core problem. And once you see that core problem clearly, everything else is just details. Let me show you.`,

    `So here's the truth about ${topic} that nobody tells beginners. It's not one thing. It's a family of solutions to a fundamental problem. And the magic is knowing which solution to apply when. Let me break it down.`,

    `Ready for the real explanation? ${topic} comes down to understanding three key ideas. Just three. Master these three ideas, and you can answer any interview question about ${topic} they throw at you. Here they are.`,

    `Okay, buckle up. This is where the actual learning happens. I'm going to explain ${topic} the way I wish someone had explained it to me. Step by step, with code, with visuals, with real examples. Let's go.`,
  ];

  const seed = (topic.length * 5) % realAnswers.length;
  return realAnswers[seed];
}

// ---------------------------------------------------------------------------
// Interview Secret (with guru-sishya.in reference)
// ---------------------------------------------------------------------------
function generateInterviewSecret(topic: string): string {
  const secrets = [
    `Here's the interview secret that most prep courses won't tell you. When they ask about ${topic}, they're not testing your memory. They want to see HOW you think. Start with the problem, walk through the trade-offs, and explain your reasoning out loud. That alone puts you in the top 10 percent. And you can practice this exact skill with interactive mock interviews on guru-sishya.in.`,

    `The number one thing interviewers look for in ${topic} questions is this: can you reason about failure modes? What happens when things go wrong? How do you detect it? How do you recover? If you can discuss the unhappy path fluently, you've already won. Practice this pattern on the ${topic} module at guru-sishya.in.`,

    `Want to know what ACTUALLY impresses interviewers? It's not reciting the textbook answer on ${topic}. It's asking clarifying questions first. "What's the expected scale? What are the consistency requirements? What's the latency budget?" These questions show senior-level thinking. You can drill this skill on guru-sishya.in.`,

    `Here's the insider trick for ${topic} interviews. Always tie your answer to real numbers. Don't say "it's faster." Say "it reduces P99 latency from 200 milliseconds to 15 milliseconds." Quantifying your answers makes you unforgettable. The quiz system on guru-sishya.in trains you to think exactly this way.`,

    `I'll let you in on a secret. The best answer to a ${topic} question starts with "it depends." Then you explain WHAT it depends on. This shows the interviewer you understand nuance, not just definitions. And that's the difference between an offer and a rejection.`,
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
  return `${intros[seed]} ${question} You can practice more questions like this with detailed explanations on guru-sishya.in.`;
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

  // Split content into sentences
  const sentences = content.split(/[.!?]\s+/).filter(s => s.length > 20);

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

  // Next episode tease — series-aware
  let nextEpisodeTease = '';
  if (nextTopic) {
    nextEpisodeTease = ` In the next video, we'll tackle ${nextTopic}. Don't miss it.`;
  } else if (totalSessions && sessionNumber < totalSessions) {
    nextEpisodeTease = ` Next session, we'll go even deeper into ${topic}. We'll see how this breaks at Netflix scale and what senior engineers do about it. Don't miss it.`;
  } else if (totalSessions && sessionNumber === totalSessions) {
    nextEpisodeTease = ` This was the final session in our ${topic} series. You now have a complete, interview-ready understanding. Go crush it.`;
  }

  const summaries = [
    `Alright, let's bring it all together. Today you learned ${topObjectives}. ${closingEncouragement} And here's the most important thing: don't just watch this and forget. Go practice. Build it in code. Explain it to someone else. That's how it sticks. If you want the complete ${topic} course with cheatsheets, interactive quizzes, and mock interview questions, head over to guru-sishya.in. It's all there waiting for you. Drop a like if this helped, and I'll see you in the next one. ${youLearnedClose}${nextEpisodeTease}`,

    `So here's the bottom line. ${topObjectives}. ${closingEncouragement} You now know more about ${topic} than 90 percent of developers who just skim blog posts. But knowledge without practice is worthless. Go build something with ${topic} today. And if you want a structured path with coding exercises and interview prep, check out guru-sishya.in. Hit subscribe so you don't miss the next topic. Let's go. ${youLearnedClose}${nextEpisodeTease}`,

    `Let me leave you with this. ${topic} is one of those topics that comes up again and again throughout your career. What you learned today gives you a massive advantage in interviews and in production. ${closingEncouragement} Now go cement it. The complete ${topic} module with practice problems, a cheatsheet, and a mock interview is waiting for you at guru-sishya.in. See you in the next video. ${youLearnedClose}${nextEpisodeTease}`,
  ];

  const seed = topic.length % summaries.length;
  return summaries[seed];
}

// ---------------------------------------------------------------------------
// Conversational Tone (makeConversational)
// Transforms formal textbook prose into friendly, teacher-like narration.
// ---------------------------------------------------------------------------
function makeConversational(text: string): string {
  return text
    // Only fix genuinely academic phrasing — keep everything else intact
    .replace(/utilize/gi, 'use')
    .replace(/subsequently/gi, 'then')
    .replace(/functionality/gi, 'feature')
    .replace(/in order to/gi, 'to')
    .replace(/However,/g, "But")
    .replace(/Furthermore,/g, "Also,")
    .replace(/Therefore,/g, "So");
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

  // ── 1. HOOK — Session-aware dramatic opening ────────────────────────────
  let hookNarration = generateHook(session.topic, session.title, sessionNum, totalSessions);

  // Inject analogy from the SESSION-SPECIFIC analogy set (different metaphor each session)
  const analogy = getAnalogy(session.topic, sessionNum);
  if (analogy) {
    hookNarration += ` ${analogy}`;
  }

  const titleDuration = SCENE_DEFAULTS.titleDuration;
  scenes.push({
    type: 'title',
    content: session.title,
    narration: hookNarration,
    duration: titleDuration,
    startFrame: currentFrame,
    endFrame: (currentFrame += TIMING.secondsToFrames(titleDuration)),
    bullets: session.objectives,
    heading: session.topic,
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

  // ── 2. THE PROBLEM — Set up tension ─────────────────────────────────────
  const problemNarration = generateProblemSetup(session.topic);
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

  // ── 3. WRONG ANSWER — Create contrast ──────────────────────────────────
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

  // ── 4. THE REAL ANSWER — Transition into deep dive ────────────────────
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

  // ── 5-7. Parse content → DEEP DIVE + VISUAL + COMPARISON ─────────────
  const sections = parseMarkdown(session.content);
  let sectionIndex = 0;
  let hasInterview = false;
  let openLoopCounter = 0;     // tracks elapsed deep-dive scenes for open-loop injection
  let halfwayInjected = false; // 50% engagement prompt guard
  let reHookInjected = false;  // 60% danger zone re-hook guard

  for (const section of sections) {
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
    if (!reHookInjected && scenes.length === Math.floor(maxScenes * 0.6)) {
      reHookInjected = true;
      const seriesConnector = getSeriesConnector(sessionNum, session.topic);
      const reHookBase = sessionNum === 1
        ? `Okay, stay with me. You've already learned the fundamentals of ${session.topic}. But this next part? This is what separates the good developers from the GREAT ones. Don't leave now.`
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

    // ── 50% Engagement Prompt (rotated per session to avoid repetition) ──
    if (!halfwayInjected && scenes.length >= Math.floor(maxScenes * 0.5)) {
      halfwayInjected = true;
      const engagementNarration = getEngagementHook(sessionNum + sectionIndex);
      scenes.push({
        type: 'text',
        content: engagementNarration,
        narration: engagementNarration,
        duration: 4,
        startFrame: currentFrame,
        endFrame: (currentFrame += TIMING.secondsToFrames(4)),
        heading: '',
        bullets: [],
      });
    }

    const scene = sectionToScene(section, language, currentFrame, sectionIndex, session.topic);

    // ── Mid-Scene Open Loop (every ~3 deep-dive scenes ≈ 60-90 seconds) ─
    openLoopCounter++;
    if (openLoopCounter % 3 === 0) {
      const openLoop = getOpenLoopPhrase(openLoopCounter);
      scene.narration = `${openLoop} ${scene.narration}`;
    }

    scenes.push(scene);
    currentFrame = scene.endFrame;
    sectionIndex++;
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

  // ── Personality injection — make narration viral and human ────────────
  const personalizedScenes = personalityInjector(scenes, sessionNum);

  return addStoryTransitions(personalizedScenes);
}

// ---------------------------------------------------------------------------
// VIRAL PERSONALITY INJECTOR
// Makes narration sound human, relatable, and memorable.
// Think Tanay Pratap / Striver / Harkirat Singh energy for Indian tech audience.
// ---------------------------------------------------------------------------

/** Surprise facts — injected every 3rd text scene to create "wait what?!" moments */
const SURPRISE_FACTS = [
  "Fun fact: Google's load balancer handles over 1 BILLION requests per second. Let that sink in.",
  "Here's something wild: Netflix's load balancer once failed and took down the ENTIRE internet for parts of the US.",
  "Plot twist: Most load balancers you'll use in production... are actually FREE and open source.",
  "Real talk: I've seen senior engineers at Amazon get this wrong in interviews. Don't be that person.",
  "Hot take: If you can explain this concept clearly, you're already ahead of 80% of interview candidates.",
  "Wild stat: AWS processes over 100 TRILLION events per day. And it all depends on concepts like this.",
  "Fun fact: The first ever load balancer was literally just a guy manually switching server cables. We've come a long way.",
  "Here's something nobody tells you: most production bugs at FAANG aren't code bugs. They're system design bugs.",
  "Real talk: Flipkart's Big Billion Day crashed their servers THREE times before they got this right.",
  "Plot twist: ChatGPT uses the exact same concepts we're learning here to handle millions of concurrent users.",
];

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
];

/** Emotional stakes — connect concepts to real career consequences */
const EMOTIONAL_STAKES = [
  "This is the difference between a 12 LPA offer and a 40 LPA offer. I'm not exaggerating.",
  "I know someone who got rejected from Google because they couldn't explain this. Don't let that be you.",
  "This one concept shows up in literally every system design interview at FAANG.",
  "Master this, and you're not just interview-ready. You're production-ready. That's rare.",
  "This is the kind of knowledge that makes your team lead go 'wait, how do you know that?'",
  "Three months from now, when you're holding that offer letter, you'll remember this video.",
  "This separates the developers who GET callbacks from the ones who don't. Simple as that.",
];

/** Conversational fillers — prepended to key sentences for natural speech flow */
const CONVERSATIONAL_OPENERS = [
  'Okay so... ',
  "Here's the thing... ",
  'And get this... ',
  'Now here is where it gets spicy... ',
  'Look, ',
  'So basically, ',
  'Alright, real talk... ',
  'Now pay attention here... ',
];

/** Conversational closers — appended after revelations */
const CONVERSATIONAL_CLOSERS = [
  ' ...which is pretty wild if you think about it.',
  " ...and that's what most people miss.",
  " ...and once you see it, you can't unsee it.",
  ' ...let that sink in for a second.',
  " ...and that changes everything.",
];

/** Brand catchphrase — appended to summary scenes */
const CATCHPHRASE = "Ab interview mein dhoom machao!";

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
export function personalityInjector(scenes: Scene[], sessionNumber: number = 1): Scene[] {
  const totalScenes = scenes.length;
  let textSceneCount = 0;

  // Seed based on session number for variety across episodes
  const seed = sessionNumber * 7;

  // Pre-compute injection points (as scene indices)
  const callout25 = Math.floor(totalScenes * 0.25);
  const callout75 = Math.floor(totalScenes * 0.75);
  const stakes40 = Math.floor(totalScenes * 0.4);
  const stakes60 = Math.floor(totalScenes * 0.6);
  const guruModePoint = Math.floor(totalScenes * 0.55); // deepest technical part

  // Track which injections have fired (one-shot guards)
  let callout25Done = false;
  let callout75Done = false;
  let stakes40Done = false;
  let stakes60Done = false;
  let guruModeDone = false;

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

    // ── Surprise facts: every 3rd text scene ─────────────────────
    if (scene.type === 'text') {
      textSceneCount++;
      if (textSceneCount > 0 && textSceneCount % 3 === 0) {
        const factIdx = (seed + textSceneCount) % SURPRISE_FACTS.length;
        narration = `${narration} ${SURPRISE_FACTS[factIdx]}`;
      }
    }

    // ── Conversational opener: add filler to first sentence ──────
    if (scene.type === 'text' && textSceneCount % 2 === 1) {
      const openerIdx = (seed + idx) % CONVERSATIONAL_OPENERS.length;
      // Only prepend if narration doesn't already start conversationally
      if (!/^(Okay|Here's|And |Look|So |Now |Alright|But )/i.test(narration)) {
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

    // ── Emotional stakes at ~60% ─────────────────────────────────
    if (!stakes60Done && idx >= stakes60 && scene.type === 'text') {
      stakes60Done = true;
      const stakesIdx = (seed + 2) % EMOTIONAL_STAKES.length;
      narration = `${narration} ${EMOTIONAL_STAKES[stakesIdx]}`;
    }

    // ── Guru mode at ~55% (the hard part) ────────────────────────
    if (!guruModeDone && idx >= guruModePoint && scene.type === 'text') {
      guruModeDone = true;
      const guruIdx = (seed) % GURU_MODE_PHRASES.length;
      narration = `${GURU_MODE_PHRASES[guruIdx]} ${narration}`;
    }

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
  (topic: string) => `I once watched a senior engineer get rejected at Google because they couldn't explain ${topic} properly. They had 10 years of experience. Let me tell you what they got wrong.`,
  (topic: string) => `The engineer who built Netflix's ${topic} system shared something in a blog post that changed how I think about software forever. Let me share it with you.`,
  (topic: string) => `Picture this. It's your final round interview at Amazon. The interviewer leans forward and says, "Tell me about ${topic}." Your next 5 minutes decide your career. Are you ready?`,
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
  (topic: string) => `Google processes 8.5 billion searches per day. Facebook handles 2.5 billion users. The secret sauce behind all of it? ${topic}. And I'm going to teach it to you in under 5 minutes.`,
  (topic: string) => `The average tech interview lasts 45 minutes. ${topic} questions take up 15 of those minutes. That's one third of your interview riding on THIS topic.`,

  // ── Challenge hooks (4) ──
  (topic: string) => `I'm going to explain ${topic} so clearly that you will NEVER forget it. That's not a promise. That's a guarantee. Let's go.`,
  (topic: string) => `Give me 5 minutes. Just 5 minutes. And I'll teach you ${topic} better than any textbook, any course, any bootcamp ever could.`,
  (topic: string) => `By the end of this video, you'll understand ${topic} better than 90 percent of working developers. That sounds crazy, but stick with me.`,
  (topic: string) => `I challenge you to watch this entire video and NOT understand ${topic}. Seriously. Try. You can't. Let's begin.`,

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
  (topic: string) => `Google, Amazon, Meta, and Netflix all ask about ${topic} in their interviews. After studying hundreds of interview questions, I found the exact pattern they follow. Let me share it.`,
  (topic: string) => `I've reviewed over 500 technical interview recordings. The number one reason candidates get rejected? They can't explain ${topic} with clarity and confidence. Let's fix that.`,
  (topic: string) => `The top 1 percent of engineers all have one thing in common. They don't just USE ${topic}. They understand it deeply enough to TEACH it. That's what we're doing today.`,
  (topic: string) => `After helping over 1000 students crack FAANG interviews, I can tell you the exact moment most interviews are won or lost. It's the ${topic} question. And here's how to nail it.`,

  // ── Curiosity gap hooks (2) ──
  (topic: string) => `There's a reason ${topic} is asked in EVERY system design interview. And it's not the reason you think.`,
  (topic: string) => `What if I told you that ${topic} is actually about ONE simple idea? Just one. And once you see it, you can never unsee it.`,
];

/** Session 2 hooks — recap + preview, building on session 1 */
const SESSION_2_HOOKS = [
  (topic: string) => `Last time we learned WHY ${topic} matters and what problems it solves. Today we're going DEEP into the algorithms and implementations that make it actually work.`,
  (topic: string) => `In session 1, I showed you the big picture of ${topic}. You know the "what" and the "why." Now it's time for the "how." And this is where it gets really fun.`,
  (topic: string) => `Welcome back. If you watched session 1, you already understand ${topic} better than most junior developers. Today we level up to intermediate. Let's build on that foundation.`,
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
  (topic: string) => `A junior knows WHAT ${topic} is. A mid-level knows HOW to implement it. A senior knows WHEN it fails and WHAT to do about it. Welcome to session 3.`,
];

/** Session 4+ hooks — expert level, production reality */
const SESSION_4_PLUS_HOOKS = [
  (topic: string) => `We've covered the fundamentals, the algorithms, and the failure modes of ${topic}. Now let's tackle the part that actually breaks in production and how Netflix, Google, and Uber handle it.`,
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
  let narration = generateNarration(section);

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

function generateNarration(section: MarkdownSection): string {
  switch (section.type) {
    case 'code':
      return summarizeCode(section.content, section.language || 'typescript');
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

function summarizeCode(code: string, language: string): string {
  const lines = code.split('\n').filter(l => l.trim());
  const funcMatch = code.match(/(?:function|def|public\s+\w+)\s+(\w+)/);
  const classMatch = code.match(/class\s+(\w+)/);
  const lang = language.toLowerCase();

  // Add language transition for Python and Java dual-language mode
  const langTransition = (lang === 'python' || lang === 'java')
    ? getLanguageTransition(lang, (code.length + lines.length) % 4) + ' '
    : '';

  // Brief, clear code description — no stacking of intro + walkthrough + CTA
  if (classMatch && funcMatch) {
    return `${langTransition}Here's a ${classMatch[1]} class in ${language}. The ${funcMatch[1]} method handles the core logic. ${generateCodeWalkthrough(code, language)}`;
  }
  if (classMatch) {
    return `${langTransition}Here's the ${classMatch[1]} class in ${language}. ${generateCodeWalkthrough(code, language)}`;
  }
  if (funcMatch) {
    return `${langTransition}This ${funcMatch[1]} function in ${language} does the heavy lifting. ${generateCodeWalkthrough(code, language)}`;
  }
  return `${langTransition}Here's the ${language} implementation in ${lines.length} lines. ${generateCodeWalkthrough(code, language)}`;
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

/** Keyword → variant mappings per visualization type (topic family) */
const VIZ_VARIANT_RULES: Record<string, Array<{ keywords: string[]; variant: string }>> = {
  // TrafficFlow variants (load-balanc, cdn, api-gateway topics)
  'traffic': [
    { keywords: ['overload', 'overwhelm', 'crash', 'single server', 'one server', 'no load balancer', 'bottleneck', 'too many', 'million users', 'spike'], variant: 'overload' },
    { keywords: ['round robin', 'distribute', 'even', 'equally', 'rotation', 'algorithm', 'weighted'], variant: 'distribute' },
    { keywords: ['health check', 'heartbeat', 'failover', 'detect', 'reroute', 'monitor', 'down', 'failure', 'recovery', 'backup'], variant: 'healthcheck' },
    { keywords: ['sticky', 'session', 'affinity', 'cookie', 'same server', 'stateful', 'persistence'], variant: 'sticky' },
    { keywords: ['scale', 'horizontal', 'add server', 'auto-scale', 'elastic', 'grow', 'replica', 'new instance', 'capacity'], variant: 'scale' },
  ],
  // HashTableViz variants (hash-map, hash-table, caching topics)
  'hashtable': [
    { keywords: ['insert', 'add', 'put', 'store', 'create', 'new entry', 'first'], variant: 'insert' },
    { keywords: ['collision', 'chain', 'same bucket', 'linked list', 'open addressing', 'probe', 'conflict'], variant: 'collision' },
    { keywords: ['resize', 'rehash', 'load factor', 'grow', 'double', 'capacity', 'threshold', 'expand'], variant: 'resize' },
    { keywords: ['lookup', 'search', 'find', 'get', 'retrieve', 'access', 'query', 'O(1)'], variant: 'lookup' },
  ],
  // TreeViz variants (binary-tree, bst, heap topics)
  'tree': [
    { keywords: ['insert', 'add', 'new node', 'place', 'create'], variant: 'insert' },
    { keywords: ['search', 'find', 'lookup', 'traverse', 'locate', 'path'], variant: 'search' },
    { keywords: ['delete', 'remove', 'predecessor', 'successor', 'restructure', 'reorganize'], variant: 'delete' },
    { keywords: ['balance', 'AVL', 'rotation', 'red-black', 'skew', 'height', 'rebalance', 'unbalanced'], variant: 'balance' },
  ],
  // SystemArchViz variants (system-design, microservice topics)
  'sysarch': [
    { keywords: ['request', 'flow', 'architecture', 'layer', 'component', 'overview', 'structure', 'basic'], variant: 'request-flow' },
    { keywords: ['failure', 'circuit breaker', 'cascade', 'fallback', 'resilience', 'fault', 'outage', 'retry', 'timeout'], variant: 'failure' },
    { keywords: ['scale', 'horizontal', 'replica', 'throughput', 'capacity', 'instances', 'auto-scale', 'grow'], variant: 'scale-up' },
    { keywords: ['cache', 'redis', 'memcached', 'latency', 'hit rate', 'miss', 'invalidation', 'TTL', 'warm', 'cold'], variant: 'caching' },
  ],
};

/** Determine which viz family a topic belongs to */
function getVizFamily(topic: string): string | null {
  const t = topic.toLowerCase().replace(/[^a-z0-9]/g, '-');
  if (t.includes('load-balanc') || t.includes('cdn') || t.includes('api-gateway')) return 'traffic';
  if (t.includes('hash') || t.includes('caching')) return 'hashtable';
  if (t.includes('tree') || t.includes('bst') || t.includes('heap')) return 'tree';
  if (t.includes('system-design') || t.includes('microservice')) return 'sysarch';
  return null;
}

/**
 * Assign a vizVariant to a scene based on its textual content.
 * Analyzes heading, narration, and bullets for keyword matches.
 */
function assignVizVariant(scene: Scene, topic: string, sceneIndex: number): string | undefined {
  // Only visual scenes (text, interview) get variants — code/diagram/table render differently
  if (scene.type !== 'text' && scene.type !== 'interview') return undefined;

  const family = getVizFamily(topic);
  if (!family) return undefined;

  const rules = VIZ_VARIANT_RULES[family];
  if (!rules) return undefined;

  // Build a searchable text blob from all scene content
  const searchBlob = [
    scene.heading || '',
    scene.narration || '',
    scene.content || '',
    ...(scene.bullets || []),
  ].join(' ').toLowerCase();

  // Score each variant by how many keywords match
  let bestVariant: string | undefined;
  let bestScore = 0;

  for (const rule of rules) {
    const score = rule.keywords.reduce((acc, kw) => acc + (searchBlob.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestVariant = rule.variant;
    }
  }

  // If no strong match, cycle through variants based on scene index to ensure variety
  if (bestScore === 0) {
    bestVariant = rules[sceneIndex % rules.length].variant;
  }

  return bestVariant;
}

/**
 * Post-process all scenes to assign vizVariant fields.
 * Call this after generateScript() to enrich scenes with per-scene variants.
 */
export function assignVizVariants(scenes: Scene[], topic: string): Scene[] {
  // Track used variants to encourage diversity
  const usedVariants = new Set<string>();
  let vizSceneIdx = 0;

  return scenes.map((scene) => {
    if (scene.type !== 'text' && scene.type !== 'interview') return scene;

    let variant = assignVizVariant(scene, topic, vizSceneIdx);

    // If this variant was already used and we have alternatives, try next best
    if (variant && usedVariants.has(variant)) {
      const family = getVizFamily(topic);
      if (family) {
        const rules = VIZ_VARIANT_RULES[family];
        const unused = rules.find(r => !usedVariants.has(r.variant));
        if (unused) variant = unused.variant;
      }
    }

    if (variant) usedVariants.add(variant);
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
  SURPRISE_FACTS,
  AUDIENCE_CALLOUTS,
  EMOTIONAL_STAKES,
  CATCHPHRASE,
  GURU_MODE_PHRASES,
  injectContractions,
};
