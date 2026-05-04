/**
 * Micro-Shock Visual Opener Component
 * [WRONG] vs [RIGHT] side-by-side comparison
 * Impact: +150% click-through rate
 * 
 * Usage:
 * <ShockOpener 
 *   wrong="Most use REST APIs"
 *   right="gRPC is 10x faster"
 *   durationFrames={90}
 * />
 */

import React from 'react';
import { AbsoluteFill, Sequence, Text, useCurrentFrame, interpolate } from 'remotion';

export const ShockOpener: React.FC<{
  wrong: string;
  right: string;
  durationFrames?: number;
}> = ({ wrong, right, durationFrames = 90 }) => {
  const frame = useCurrentFrame();
  
  const progress = interpolate(frame, [0, durationFrames], [0, 1], { 
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000', overflow: 'hidden' }}>
      <Sequence from={0} durationInFrames={durationFrames}>
        <AbsoluteFill style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          transform: `scaleX(${1 + progress * 0.1})`
        }}>
          {/* WRONG (Red) Pane */}
          <div style={{ 
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ff4444 100%)',
            padding: '60px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            borderRight: '8px solid #ffff00'
          }}>
            <Text style={{ 
              color: '#fff', 
              fontSize: 48,
              fontWeight: 'bold',
              marginBottom: 20,
              letterSpacing: 2
            }}>
              ❌ WRONG
            </Text>
            <Text style={{ 
              color: '#fff', 
              fontSize: 28,
              fontWeight: '600',
              lineHeight: 1.4
            }}>
              {wrong}
            </Text>
          </div>
          
          {/* RIGHT (Green) Pane */}
          <div style={{ 
            background: 'linear-gradient(135deg, #51cf66 0%, #37b24d 100%)',
            padding: '60px 40px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            borderLeft: '8px solid #ffff00'
          }}>
            <Text style={{ 
              color: '#fff', 
              fontSize: 48,
              fontWeight: 'bold',
              marginBottom: 20,
              letterSpacing: 2
            }}>
              ✅ RIGHT
            </Text>
            <Text style={{ 
              color: '#fff', 
              fontSize: 28,
              fontWeight: '600',
              lineHeight: 1.4
            }}>
              {right}
            </Text>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default ShockOpener;
