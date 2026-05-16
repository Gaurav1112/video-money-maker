/**
 * src/pipeline/metadata-generator.ts  (PATCHED for RANK 6)
 *
 * Changes vs original:
 * 1. Added `communityPost` field to MetadataFile (see types.ts patch below).
 * 2. Added COMMUNITY_POST_TEMPLATES per language — teaser + recap + optional poll.
 *    Every post ends with a question (drives replies = engagement signal) and
 *    a guru-sishya.in CTA (cross-platform traffic).
 * 3. generateMetadata() now populates metadata.communityPost deterministically
 *    (same episode + language → same post text, every time).
 *
 * types.ts patch required (add to MetadataFile interface):
 *   communityPost?: {
 *     teaser: string;         // post before upload (T-30min)
 *     recap: string;          // post after upload (T+1h); contains {VIDEO_URL} placeholder
 *     poll?: {
 *       question: string;
 *       options: string[];     // 2–5 options
 *     };
 *   };
 */

import type { CartoonEpisode, SupportedLanguage, MetadataFile } from '../types';

// NO "kids", "children", "बच्चों" anywhere — prevents Made for Kids auto-flag

const TITLE_TEMPLATES: Record<SupportedLanguage, string[]> = {
  hi: [
    '{story} | {character} की कहानी | पंचतंत्र Ep {ep}',
    '{story} | हिंदी कार्टून कहानी | Katha Keeda',
    '{character} और {story} | नैतिक कहानी Ep {ep}',
  ],
  te: [
    '{story} | {character} కథ | పంచతంత్ర Ep {ep}',
    '{story} | తెలుగు కార్టూన్ | నీతి కథ | Katha Keeda',
    '{character} మరియు {story} | తెలుగు కార్టూన్ Ep {ep}',
  ],
  ta: [
    '{story} | {character} கதை | பஞ்சதந்திரம் Ep {ep}',
    '{story} | தமிழ் கார்ட்டூன் | நீதிக்கதை | Katha Keeda',
    '{character} மற்றும் {story} | தமிழ் கார்ட்டூன் Ep {ep}',
  ],
  kn: [
    '{story} | {character} ಕಥೆ | ಪಂಚತಂತ್ರ Ep {ep}',
    '{story} | ಕನ್ನಡ ಕಾರ್ಟೂನ್ | ನೀತಿ ಕಥೆ | Katha Keeda',
  ],
  mr: [
    '{story} | {character} ची गोष्ट | पंचतंत्र Ep {ep}',
    '{story} | मराठी कार्टून | नैतिक गोष्ट | Katha Keeda',
  ],
  bn: [
    '{story} | {character} গল্প | পঞ্চতন্ত্র Ep {ep}',
    '{story} | বাংলা কার্টুন | নীতিগল্প | Katha Keeda',
  ],
  en: [
    '{story} | {character} Story | Panchatantra Ep {ep}',
    '{story} | Animated Moral Tale | Katha Keeda',
    '{character} and {story} | Indian Folklore Ep {ep}',
  ],
};

const DESCRIPTION_TEMPLATES: Record<SupportedLanguage, string> = {
  hi: `🎬 {story}

{character} के साथ एक अनोखी पंचतंत्र कहानी!
इस कहानी में सीखें: {moral}

📺 हर Monday, Wednesday, Friday नई कहानी!
👉 Subscribe करें और Bell दबाएं!

अन्य भाषाओं में देखें:
తెలుగు • தமிழ் • ಕನ್ನಡ • मराठी • বাংলা • English

#KathaKeeda #पंचतंत्र #हिंदीकार्टून #नैतिककहानी #AnimatedStories #IndianCartoon #FamilyEntertainment

Katha Keeda — भारत की सबसे मज़ेदार कार्टून कहानियाँ! पंचतंत्र, जातक, हितोपदेश, तेनाली रामन, अकबर बीरबल — सब एनीमेशन में! परिवार के साथ देखें।`,

  te: `🎬 {story}

{character} తో ఒక అద్భుతమైన పంచతంత్ర కథ!
ఈ కథలో నేర్చుకోండి: {moral}

📺 ప్రతి Mon/Wed/Fri కొత్త కథ!
👉 Subscribe చేయండి!

#KathaKeeda #పంచతంత్రం #తెలుగుకార్టూన్ #నీతికథలు #AnimatedStories #IndianCartoon`,

  ta: `🎬 {story}

{character} உடன் ஒரு அற்புதமான பஞ்சதந்திரக் கதை!
இந்த கதையில் கற்றுக்கொள்ளுங்கள்: {moral}

📺 ஒவ்வொரு Mon/Wed/Fri புதிய கதை!

#KathaKeeda #பஞ்சதந்திரம் #தமிழ்கார்ட்டூன் #நீதிக்கதை #AnimatedStories #IndianCartoon`,

  kn: `🎬 {story}

{character} ಜೊತೆ ಒಂದು ಅದ್ಭುತ ಪಂಚತಂತ್ರ ಕಥೆ!
ಈ ಕಥೆಯಲ್ಲಿ ಕಲಿಯಿರಿ: {moral}

#KathaKeeda #ಪಂಚತಂತ್ರ #ಕನ್ನಡಕಾರ್ಟೂನ್ #ನೀತಿಕಥೆ #AnimatedStories`,

  mr: `🎬 {story}

{character} सोबत एक भारी पंचतंत्र गोष्ट!
या गोष्टीतून शिका: {moral}

#KathaKeeda #पंचतंत्र #मराठीकार्टून #नैतिकगोष्ट #AnimatedStories`,

  bn: `🎬 {story}

{character} এর সাথে একটি দুর্দান্ত পঞ্চতন্ত্র গল্প!
এই গল্পে শিখুন: {moral}

#KathaKeeda #পঞ্চতন্ত্র #বাংলাকার্টুন #নীতিগল্প #AnimatedStories`,

  en: `🎬 {story}

An amazing Panchatantra tale with {character}!
In this episode, learn: {moral}

📺 New story every Monday, Wednesday, Friday!
👉 Subscribe and hit the bell!

Watch in other languages:
हिंदी • తెలుగు • தமிழ் • ಕನ್ನಡ • मराठी • বাংলা

#KathaKeeda #Panchatantra #AnimatedStories #IndianCartoon #MoralTales #FamilyEntertainment #IndianFolklore

Katha Keeda — India's most entertaining animated stories! Panchatantra, Jataka, Hitopadesha, Tenali Raman, Akbar Birbal — all brought to life through animation. Watch with the whole family.`,
};

// ─── PATCH: Community post templates ─────────────────────────────────────────
//
// Each language gets:
//   teaser  — posted T-30min before upload to prime subscriber notifications
//   recap   — posted T+1h after upload with {VIDEO_URL} placeholder + CTA question
//   poll    — optional engagement poll (2 options, drives algorithm distribution)
//
// Every post includes:
//   • guru-sishya.in CTA for cross-platform traffic
//   • 1 question to drive replies (reply count = engagement signal)
//
// All templates are deterministic: same {placeholders} → same rendered string.

interface CommunityPostTemplates {
  teaser: string;
  recap: string;
  poll: { question: string; options: string[] };
}

const COMMUNITY_POST_TEMPLATES: Record<SupportedLanguage, CommunityPostTemplates> = {
  hi: {
    teaser:
      '🎬 आज की नई कहानी — "{story}" जल्द ही आ रही है!\n\n' +
      '{character} इस बार क्या सीखेंगे? 👀\n\n' +
      'आपकी पसंदीदा पंचतंत्र कहानी कौन सी है? 👇 Comment करें!\n\n' +
      '📚 और कहानियाँ पढ़ें: https://guru-sishya.in\n' +
      '#KathaKeeda #पंचतंत्र #हिंदीकार्टून',
    recap:
      '▶️ "{story}" अभी LIVE है! देखें →  {VIDEO_URL}\n\n' +
      'इस कहानी का सबक: {moral}\n\n' +
      '💬 आपने क्या सीखा? 1 शब्द में बताएं नीचे!\n\n' +
      '📚 लिखित संस्करण + और कहानियाँ: https://guru-sishya.in\n' +
      '#KathaKeeda #नैतिककहानी',
    poll: {
      question: 'आपको कौन सी कहानी ज़्यादा पसंद है?',
      options: ['पंचतंत्र की कहानियाँ', 'अकबर-बीरबल की कहानियाँ'],
    },
  },

  te: {
    teaser:
      '🎬 నేటి కొత్త కథ — "{story}" త్వరలో వస్తోంది!\n\n' +
      '{character} ఈసారి ఏమి నేర్చుకుంటారు? 👀\n\n' +
      'మీకు అత్యంత ఇష్టమైన పంచతంత్ర కథ ఏది? 👇 Comment చేయండి!\n\n' +
      '📚 మరిన్ని కథలు: https://guru-sishya.in\n' +
      '#KathaKeeda #పంచతంత్రం',
    recap:
      '▶️ "{story}" ఇప్పుడు LIVE! చూడండి → {VIDEO_URL}\n\n' +
      'ఈ కథ నుండి నేర్చుకున్నది: {moral}\n\n' +
      '💬 మీరు ఏమి నేర్చుకున్నారు? క్రింద చెప్పండి!\n\n' +
      '📚 రాతపూర్వక కథలు: https://guru-sishya.in\n' +
      '#KathaKeeda #నీతికథలు',
    poll: {
      question: 'మీకు ఏ కథ ఎక్కువ ఇష్టం?',
      options: ['పంచతంత్ర కథలు', 'జాతక కథలు'],
    },
  },

  ta: {
    teaser:
      '🎬 இன்றைய புதிய கதை — "{story}" விரைவில் வருகிறது!\n\n' +
      '{character} இம்முறை என்ன கற்றுக்கொள்வார்கள்? 👀\n\n' +
      'உங்களுக்கு மிகவும் பிடித்த பஞ்சதந்திரக் கதை எது? 👇 Comment செய்யுங்கள்!\n\n' +
      '📚 மேலும் கதைகள்: https://guru-sishya.in\n' +
      '#KathaKeeda #பஞ்சதந்திரம்',
    recap:
      '▶️ "{story}" இப்போது LIVE! பாருங்கள் → {VIDEO_URL}\n\n' +
      'இந்த கதையின் படிப்பினை: {moral}\n\n' +
      '💬 நீங்கள் என்ன கற்றுக்கொண்டீர்கள்? கீழே சொல்லுங்கள்!\n\n' +
      '📚 எழுத்துப்பூர்வ கதைகள்: https://guru-sishya.in\n' +
      '#KathaKeeda #நீதிக்கதை',
    poll: {
      question: 'எந்த கதை உங்களுக்கு அதிகம் பிடிக்கும்?',
      options: ['பஞ்சதந்திரக் கதைகள்', 'ஜாதகக் கதைகள்'],
    },
  },

  kn: {
    teaser:
      '🎬 ಇಂದಿನ ಹೊಸ ಕಥೆ — "{story}" ಶೀಘ್ರದಲ್ಲಿ ಬರುತ್ತಿದೆ!\n\n' +
      '{character} ಈ ಬಾರಿ ಏನು ಕಲಿಯುತ್ತಾರೆ? 👀\n\n' +
      'ನಿಮ್ಮ ನೆಚ್ಚಿನ ಪಂಚತಂತ್ರ ಕಥೆ ಯಾವುದು? 👇 Comment ಮಾಡಿ!\n\n' +
      '📚 ಹೆಚ್ಚಿನ ಕಥೆಗಳು: https://guru-sishya.in\n' +
      '#KathaKeeda #ಪಂಚತಂತ್ರ',
    recap:
      '▶️ "{story}" ಈಗ LIVE! ನೋಡಿ → {VIDEO_URL}\n\n' +
      'ಈ ಕಥೆಯ ನೀತಿ: {moral}\n\n' +
      '💬 ನೀವು ಏನು ಕಲಿತಿರಿ? ಕೆಳಗೆ ಹೇಳಿ!\n\n' +
      '📚 ಲಿಖಿತ ಕಥೆಗಳು: https://guru-sishya.in\n' +
      '#KathaKeeda #ನೀತಿಕಥೆ',
    poll: {
      question: 'ನಿಮಗೆ ಯಾವ ಕಥೆ ಹೆಚ್ಚು ಇಷ್ಟ?',
      options: ['ಪಂಚತಂತ್ರ ಕಥೆಗಳು', 'ಜಾತಕ ಕಥೆಗಳು'],
    },
  },

  mr: {
    teaser:
      '🎬 आजची नवीन गोष्ट — "{story}" लवकरच येत आहे!\n\n' +
      '{character} यावेळी काय शिकणार? 👀\n\n' +
      'तुमची आवडती पंचतंत्र गोष्ट कोणती? 👇 Comment करा!\n\n' +
      '📚 अधिक गोष्टी: https://guru-sishya.in\n' +
      '#KathaKeeda #पंचतंत्र',
    recap:
      '▶️ "{story}" आता LIVE आहे! पहा → {VIDEO_URL}\n\n' +
      'या गोष्टीचा बोध: {moral}\n\n' +
      '💬 तुम्ही काय शिकलात? खाली सांगा!\n\n' +
      '📚 लिखित गोष्टी: https://guru-sishya.in\n' +
      '#KathaKeeda #नैतिकगोष्ट',
    poll: {
      question: 'तुम्हाला कोणती गोष्ट जास्त आवडते?',
      options: ['पंचतंत्र गोष्टी', 'अकबर-बीरबल गोष्टी'],
    },
  },

  bn: {
    teaser:
      '🎬 আজকের নতুন গল্প — "{story}" শীঘ্রই আসছে!\n\n' +
      '{character} এবার কী শিখবে? 👀\n\n' +
      'আপনার প্রিয় পঞ্চতন্ত্র গল্প কোনটি? 👇 Comment করুন!\n\n' +
      '📚 আরও গল্প: https://guru-sishya.in\n' +
      '#KathaKeeda #পঞ্চতন্ত্র',
    recap:
      '▶️ "{story}" এখন LIVE! দেখুন → {VIDEO_URL}\n\n' +
      'এই গল্পের শিক্ষা: {moral}\n\n' +
      '💬 আপনি কী শিখলেন? নিচে বলুন!\n\n' +
      '📚 লিখিত গল্প: https://guru-sishya.in\n' +
      '#KathaKeeda #নীতিগল্প',
    poll: {
      question: 'আপনার কোন গল্প বেশি পছন্দ?',
      options: ['পঞ্চতন্ত্র গল্প', 'জাতক গল্প'],
    },
  },

  en: {
    teaser:
      '🎬 New episode dropping soon — "{story}"!\n\n' +
      'What do you think {character} will learn this time? 👀\n\n' +
      "What's your favourite Panchatantra story? 👇 Drop it in the comments!\n\n" +
      '📚 Read more stories: https://guru-sishya.in\n' +
      '#KathaKeeda #Panchatantra #AnimatedStories',
    recap:
      "▶️ \"{story}\" is LIVE now! Watch it here → {VIDEO_URL}\n\n" +
      'The lesson in this one: {moral}\n\n' +
      '💬 What did YOU take away from this story? Tell us in one word below!\n\n' +
      '📚 Read + share the written version: https://guru-sishya.in\n' +
      '#KathaKeeda #MoralStories',
    poll: {
      question: 'Which type of story do you love most?',
      options: ['Panchatantra tales', 'Akbar-Birbal tales'],
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────

const TAG_TEMPLATES: Record<SupportedLanguage, string[]> = {
  hi: [
    'Katha Keeda', 'katha keeda hindi', 'पंचतंत्र की कहानी', 'panchatantra hindi',
    'हिंदी कार्टून', 'hindi cartoon', 'नैतिक कहानी', 'moral story hindi',
    'कार्टून कहानी', 'panchatantra tales', 'हिंदी एनीमेशन', 'hindi animation',
    'folk tales hindi', 'लोककथा', 'animated story hindi', 'भारतीय कार्टून',
    'hindi stories', 'bedtime story hindi', 'Indian cartoon hindi',
    'family entertainment india', 'panchatantra cartoon',
  ],
  te: [
    'Katha Keeda', 'katha keeda telugu', 'పంచతంత్ర కథలు', 'panchatantra telugu',
    'తెలుగు కార్టూన్', 'telugu cartoon', 'నీతి కథలు', 'moral stories telugu',
    'తెలుగు కథలు', 'telugu animation', 'animated stories telugu',
    'folk tales telugu', 'Indian cartoon telugu', 'family entertainment',
  ],
  ta: [
    'Katha Keeda', 'katha keeda tamil', 'பஞ்சதந்திரக் கதைகள்', 'panchatantra tamil',
    'தமிழ் கார்ட்டூன்', 'tamil cartoon', 'நீதிக்கதை', 'moral stories tamil',
    'animated stories tamil', 'Indian cartoon tamil', 'family entertainment',
  ],
  kn: [
    'Katha Keeda', 'ಪಂಚತಂತ್ರ ಕಥೆಗಳು', 'panchatantra kannada', 'ಕನ್ನಡ ಕಾರ್ಟೂನ್',
    'kannada cartoon', 'ನೀತಿ ಕಥೆ', 'moral stories kannada', 'animated stories kannada',
  ],
  mr: [
    'Katha Keeda', 'पंचतंत्र गोष्टी', 'panchatantra marathi', 'मराठी कार्टून',
    'marathi cartoon', 'नैतिक गोष्ट', 'moral stories marathi', 'animated stories marathi',
  ],
  bn: [
    'Katha Keeda', 'পঞ্চতন্ত্র গল্প', 'panchatantra bengali', 'বাংলা কার্টুন',
    'bangla cartoon', 'নীতিগল্প', 'moral stories bengali', 'animated stories bengali',
  ],
  en: [
    'Katha Keeda', 'panchatantra stories', 'moral stories', 'Indian cartoon',
    'animated stories', 'panchatantra tales english', 'Indian animation',
    'folk tales india', 'animated moral stories', 'family entertainment',
    'Indian folklore', 'bedtime stories animated', 'moral lessons',
    'ancient Indian tales', 'wisdom stories', 'values stories',
    'Indian animated series', 'life lessons cartoon', 'panchatantra animated',
  ],
};

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── PATCH: community post generator ─────────────────────────────────────────

function generateCommunityPost(
  episode: CartoonEpisode,
  language: SupportedLanguage,
  characterName: string,
): MetadataFile['communityPost'] {
  const t = COMMUNITY_POST_TEMPLATES[language];
  const fill = (s: string) =>
    s
      .replace(/\{story\}/g, episode.title)
      .replace(/\{character\}/g, characterName)
      .replace(/\{moral\}/g, episode.moral.moralText);

  return {
    teaser: fill(t.teaser),
    recap: fill(t.recap), // {VIDEO_URL} is left as a literal placeholder for post-community.ts
    poll: t.poll,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function generateMetadata(
  episode: CartoonEpisode,
  language: SupportedLanguage,
  episodeNumber: number,
): MetadataFile {
  const templates = TITLE_TEMPLATES[language];
  const seed = simpleHash(episode.title + language + episodeNumber);
  const template = templates[seed % templates.length];

  const firstChar = episode.characters[0] ?? 'arjun';
  const characterName = firstChar.charAt(0).toUpperCase() + firstChar.slice(1);

  const title = template
    .replace('{story}', episode.title)
    .replace('{character}', characterName)
    .replace('{ep}', String(episodeNumber));

  const descTemplate = DESCRIPTION_TEMPLATES[language];
  const description = descTemplate
    .replace(/\{story\}/g, episode.title)
    .replace(/\{character\}/g, characterName)
    .replace(/\{moral\}/g, episode.moral.moralText);

  const baseTags = TAG_TEMPLATES[language];
  const storyTags = [episode.title, characterName, episode.moral.category, episode.storyType];
  const tags = [...baseTags, ...storyTags].filter(Boolean).slice(0, 30);

  // PATCH: generate community post text deterministically
  const communityPost = generateCommunityPost(episode, language, characterName);

  return {
    title: title.slice(0, 100),
    description,
    tags,
    playlistTitle: `Katha Keeda — ${language.toUpperCase()}`,
    language,
    episodeNumber,
    communityPost, // PATCH: was missing; now always populated
  };
}
