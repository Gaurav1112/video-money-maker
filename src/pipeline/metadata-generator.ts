import { Storyboard } from '../types';

export interface YouTubeMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  chapters: string;
}

export function generateYouTubeMetadata(storyboard: Storyboard, language: string): YouTubeMetadata {
  const { topic, sessionNumber, scenes } = storyboard;

  // Title (rotate formulas)
  const titleFormulas = [
    `${topic} Explained in ${Math.ceil(storyboard.durationInFrames / storyboard.fps / 60)} Minutes | Interview Prep`,
    `${topic} - Everything You Need to Know (${language})`,
    `Master ${topic} for Your Next Interview | ${language} Examples`,
    `${topic} Step by Step | Coding Interview Prep`,
  ];
  const title = titleFormulas[(topic.length + sessionNumber) % titleFormulas.length];

  // Chapters from scenes
  const chapters = scenes.map((scene) => {
    const seconds = Math.floor(scene.startFrame / storyboard.fps);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timestamp = `${mins}:${String(secs).padStart(2, '0')}`;
    const label = scene.heading || scene.type.charAt(0).toUpperCase() + scene.type.slice(1);
    return `${timestamp} ${label}`;
  }).join('\n');

  // Description
  const description = `Learn ${topic} for coding interviews with step-by-step ${language} code examples.

${chapters}

Practice this topic with interactive quizzes: https://guru-sishya.in
Full playlist: [playlist link]

#CodingInterview #${topic.replace(/\s+/g, '')} #${language} #InterviewPrep #DataStructures`;

  // Tags
  const tags = [
    topic.toLowerCase(),
    `${topic.toLowerCase()} interview`,
    `${topic.toLowerCase()} ${language.toLowerCase()}`,
    `${topic.toLowerCase()} tutorial`,
    'coding interview',
    'interview prep',
    'data structures',
    'algorithms',
    language.toLowerCase(),
    'software engineer',
    'leetcode',
    'faang interview',
  ];

  return {
    title,
    description,
    tags,
    categoryId: '27', // Education
    chapters,
  };
}

export function generateInstagramCaption(topic: string, language: string): string {
  const hooks = [
    `Master ${topic} in 60 seconds`,
    `${topic} explained simply`,
    `Can you solve this? ${topic}`,
  ];
  const hook = hooks[(topic.length) % hooks.length];

  return `${hook} | Full lesson on YouTube

#coding #programming #${topic.replace(/\s+/g, '').toLowerCase()} #interviewprep #developer #${language.toLowerCase()} #softwareengineering #leetcode #techinterview`;
}
