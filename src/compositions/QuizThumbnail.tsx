// src/compositions/QuizThumbnail.tsx
// Dedicated 1080x1920 still for YouTube Shorts thumbnail.
// Zero animation budget — every pixel optimized for stop-the-scroll readability.
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { FONTS } from '../lib/theme';
import type { QuizQuestion } from '../lib/quiz-content';
import { pickHook } from '../lib/quiz-hook';

// Feature P8: same hash as QuizShort.tsx so thumbnail hook == video hook.
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const FPS = 30;

interface QuizThumbnailProps {
  quiz: QuizQuestion;
}

export const QuizThumbnail: React.FC<QuizThumbnailProps> = ({ quiz }) => {
  const hookText = pickHook(quiz, hashStr(quiz.title + quiz.topic));
  const lines = hookText.split('\n');
  const autoFontSize = lines.length <= 2 ? 120 : lines.length === 3 ? 96 : 78;
  const avatarSrc = staticFile('images/guru-avatar-crop.png');

  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(ellipse at 50% 35%, #1a1a2e 0%, #0A0A12 70%)',
      width: 1080, height: 1920,
    }}>
      {/* Top brand bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 100,
        background: 'linear-gradient(90deg, #FF4444, #FBBF24, #FF4444)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontSize: 36, fontFamily: FONTS.heading, fontWeight: 900,
          color: '#0A0A12', letterSpacing: 4, textTransform: 'uppercase',
        }}>
          {quiz.topic.replace(/-/g, ' ')} · QUIZ
        </span>
      </div>

      {/* Hook text — centered, dominant */}
      <div style={{
        position: 'absolute', top: 200, left: 0, right: 0, bottom: 320,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 60px',
      }}>
        <div style={{ textAlign: 'center' }}>
          {lines.map((line, i) => (
            <div key={i} style={{
              fontSize: autoFontSize,
              fontFamily: FONTS.heading, fontWeight: 900,
              color: i === 1 ? '#FBBF24' : '#FFFFFF',
              lineHeight: 1.05,
              textTransform: 'uppercase',
              textShadow: '0 6px 40px rgba(0,0,0,0.95), 0 0 80px rgba(255,68,68,0.35)',
              letterSpacing: -3,
            }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* Teaser caption — small line under hook teasing the question */}
      <div style={{
        position: 'absolute', bottom: 470, left: 60, right: 60,
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '10px 24px',
          backgroundColor: 'rgba(34, 211, 238, 0.15)',
          border: '2px solid rgba(34, 211, 238, 0.6)',
          borderRadius: 24,
          fontSize: 26, fontFamily: FONTS.heading, fontWeight: 700,
          color: '#22D3EE',
          letterSpacing: 1.5, textTransform: 'uppercase',
        }}>
          ▶ Can you answer this?
        </div>
      </div>

      {/* Avatar — bottom center, large */}
      <div style={{
        position: 'absolute', bottom: 80, left: '50%',
        transform: 'translateX(-50%)',
        width: 220, height: 220, borderRadius: '50%',
        overflow: 'hidden',
        border: '6px solid #FF4444',
        boxShadow: '0 0 60px rgba(255, 68, 68, 0.6)',
      }}>
        <Img src={avatarSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* WATCH play indicator — overlaps avatar to draw eye */}
      <div style={{
        position: 'absolute', bottom: 60, right: 60,
        width: 90, height: 90, borderRadius: '50%',
        backgroundColor: 'rgba(251, 191, 36, 0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 30px rgba(251, 191, 36, 0.6)',
        border: '3px solid #fff',
      }}>
        <span style={{ fontSize: 44, color: '#0A0A12', marginLeft: 6 }}>▶</span>
      </div>

      {/* Bottom emphasis bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 14,
        background: 'linear-gradient(90deg, transparent, #FF4444 30%, #FBBF24 70%, transparent)',
      }} />
    </AbsoluteFill>
  );
};

export function calculateQuizThumbnailMetadata() {
  return {
    durationInFrames: 1,
    fps: FPS,
    width: 1080,
    height: 1920,
  };
}

export default QuizThumbnail;
