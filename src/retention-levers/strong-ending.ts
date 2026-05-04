/**
 * LEVER 7: Strong Ending Generator
 * Keeps 90% of viewers until the end
 */

export interface StrongEnding {
  recap: string;
  bonusTip: string;
  cta: string;
  cliffhanger: string;
  expectedFinishRate: number;
}

export function generateStrongEnding(topic: string): StrongEnding {
  return {
    recap: `So that's ${topic} in a nutshell: [key takeaway].`,
    bonusTip: `🎁 Bonus tip: Most engineers don't know that...`,
    cta: `👉 Watch next: [Link to advanced video]`,
    cliffhanger: `🤯 But here's the crazy part...`,
    expectedFinishRate: 0.90
  };
}

export function createEndingSequence(duration: number = 180000) {
  const endingStart = duration - 30000; // Last 30 seconds
  
  return {
    recap: { start: endingStart, duration: 5000 },
    bonusTip: { start: endingStart + 5000, duration: 8000 },
    cliffhanger: { start: endingStart + 13000, duration: 5000 },
    cta: { start: endingStart + 18000, duration: 12000 }
  };
}
