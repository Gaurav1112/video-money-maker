import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
} from 'remotion';
import { FONTS } from '../../lib/theme';

interface VerticalReviewQuestionProps {
  question: string;
  answer?: string;
  heading?: string;
  quizOptions?: string[];
  sceneIndex?: number;
  sceneStartFrame?: number;
  startFrame?: number;
  endFrame?: number;
}

const BG = '#0C0A15';
const SAFFRON = '#E85D26';
const GOLD = '#FDB813';
const TEAL = '#1DD1A1';
const OPTION_COLORS = [SAFFRON, GOLD, TEAL, '#7C3AED'];

/**
 * Native vertical review/quiz scene — game-show style with options.
 * 1080x1920, full dark theme, animated option reveals.
 */
export const VerticalReviewQuestion: React.FC<VerticalReviewQuestionProps> = ({
  question,
  answer,
  heading,
  quizOptions = [],
  sceneStartFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - sceneStartFrame);

  // Question entrance
  const qSpring = spring({ frame: local, fps, config: { damping: 18, stiffness: 200, mass: 0.5 } });

  // Show answer after 60% of scene
  const sceneDur = 180; // ~6s default
  const answerDelay = Math.round(sceneDur * 0.6);
  const showAnswer = local > answerDelay;
  const answerSpring = showAnswer
    ? spring({ frame: local - answerDelay, fps, config: { damping: 16, stiffness: 150, mass: 0.6 } })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 25%, rgba(232,93,38,0.08) 0%, transparent 60%)`,
      }} />

      {/* Badge */}
      <div style={{
        position: 'absolute', top: 220, left: 60, right: 140,
        opacity: interpolate(qSpring, [0, 1], [0, 1]),
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          backgroundColor: `${GOLD}18`, border: `2px solid ${GOLD}`,
          borderRadius: 40, padding: '10px 24px',
        }}>
          <span style={{
            fontFamily: FONTS.heading, fontSize: 26, fontWeight: 700,
            color: GOLD, letterSpacing: 2, textTransform: 'uppercase' as const,
          }}>
            {heading || '🧠 Quick Check'}
          </span>
        </div>
      </div>

      {/* Question */}
      <div style={{
        position: 'absolute', top: 320, left: 60, right: 140,
        opacity: interpolate(qSpring, [0, 1], [0, 1]),
        transform: `scale(${interpolate(qSpring, [0, 1], [0.95, 1])})`,
      }}>
        <div style={{
          fontFamily: FONTS.heading, fontSize: 48, fontWeight: 900,
          color: '#FFFFFF', lineHeight: 1.25,
          textShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}>
          {question}
        </div>
        <div style={{
          width: 60, height: 4, borderRadius: 2, marginTop: 20,
          background: `linear-gradient(90deg, ${SAFFRON}, ${GOLD})`,
        }} />
      </div>

      {/* Quiz options (if available) */}
      {quizOptions.length > 0 && (
        <div style={{
          position: 'absolute', top: 600, left: 60, right: 140,
          display: 'flex', flexDirection: 'column', gap: 18,
        }}>
          {quizOptions.slice(0, 4).map((opt, i) => {
            const delay = 15 + i * 10;
            const s = spring({
              frame: Math.max(0, local - delay), fps,
              config: { damping: 16, stiffness: 140, mass: 0.6 },
            });
            const isCorrect = i === 0; // first option is always correct in our system
            const revealed = showAnswer;
            const color = OPTION_COLORS[i];

            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '18px 22px',
                backgroundColor: revealed && isCorrect ? `${TEAL}18` : 'rgba(255,255,255,0.04)',
                borderRadius: 14,
                borderLeft: `4px solid ${revealed && isCorrect ? TEAL : color}`,
                border: revealed && isCorrect ? `2px solid ${TEAL}60` : `1px solid rgba(255,255,255,0.06)`,
                opacity: interpolate(s, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(s, [0, 1], [40, 0])}px)`,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  backgroundColor: `${color}22`, border: `1.5px solid ${color}55`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONTS.heading, fontSize: 20, fontWeight: 800, color,
                  flexShrink: 0,
                }}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span style={{
                  fontFamily: FONTS.text, fontSize: 34, fontWeight: 500,
                  color: revealed && isCorrect ? '#FFFFFF' : 'rgba(255,255,255,0.85)',
                  lineHeight: 1.4, flex: 1,
                }}>
                  {opt}
                </span>
                {revealed && isCorrect && (
                  <span style={{ fontSize: 32, flexShrink: 0 }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Answer text (when no quiz options) */}
      {quizOptions.length === 0 && answer && showAnswer && (
        <div style={{
          position: 'absolute', top: 600, left: 60, right: 140,
          opacity: interpolate(answerSpring, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(answerSpring, [0, 1], [30, 0])}px)`,
        }}>
          <div style={{
            backgroundColor: `${TEAL}12`, border: `1px solid ${TEAL}40`,
            borderRadius: 16, padding: '24px 28px',
          }}>
            <div style={{
              fontFamily: FONTS.heading, fontSize: 24, fontWeight: 700,
              color: TEAL, letterSpacing: 1, marginBottom: 12,
              textTransform: 'uppercase' as const,
            }}>
              Answer
            </div>
            <div style={{
              fontFamily: FONTS.text, fontSize: 36, fontWeight: 500,
              color: 'rgba(255,255,255,0.9)', lineHeight: 1.5,
            }}>
              {answer.length > 200 ? answer.slice(0, 200) + '...' : answer}
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default VerticalReviewQuestion;
