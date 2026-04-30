import React from 'react';
import { useCurrentFrame, AbsoluteFill, interpolate, useVideoConfig, spring } from 'remotion';

interface TerminalCommand {
  cmd: string;
  output: string;
  delay?: number;
}

interface TerminalSceneProps {
  commands: TerminalCommand[];
  title?: string;
  prompt?: string;
  startFrame?: number;
  sceneIndex?: number;
  sceneStartFrame?: number;
  sceneDurationFrames?: number;
}

// Traffic light dot component
const TrafficDot: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: '50%',
      backgroundColor: color,
    }}
  />
);

/**
 * Realistic terminal window with commands typed character-by-character
 * and output appearing after each command completes.
 */
export const TerminalScene: React.FC<TerminalSceneProps> = ({
  commands,
  title = 'Terminal — bash',
  prompt = '$ ',
  startFrame = 0,
  sceneIndex,
  sceneDurationFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate timing per command: type + delay + output reveal
  const CHARS_PER_FRAME = 1.5; // ~45 chars/sec at 30fps
  const OUTPUT_DELAY_FRAMES = Math.round(fps * 0.4); // 0.4s pause before output
  const OUTPUT_REVEAL_FRAMES = Math.round(fps * 0.3); // 0.3s to show output

  // Build timeline of events
  let currentFrame = 0;
  const timeline: Array<{
    cmdStart: number;
    cmdEnd: number;
    outputStart: number;
    outputEnd: number;
    cmd: string;
    output: string;
  }> = [];

  for (const command of commands) {
    const typingFrames = Math.ceil(command.cmd.length / CHARS_PER_FRAME);
    const cmdStart = currentFrame;
    const cmdEnd = cmdStart + typingFrames;
    const outputStart = cmdEnd + OUTPUT_DELAY_FRAMES;
    const outputEnd = outputStart + OUTPUT_REVEAL_FRAMES;

    timeline.push({
      cmdStart,
      cmdEnd,
      outputStart,
      outputEnd,
      cmd: command.cmd,
      output: command.output,
    });

    currentFrame = outputEnd + (command.delay ?? Math.round(fps * 0.5));
  }

  // Window entrance animation
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1 },
  });
  const windowScale = interpolate(entrance, [0, 1], [0.92, 1]);
  const windowOpacity = interpolate(entrance, [0, 1], [0, 1]);

  // Blinking cursor
  const cursorOpacity = Math.sin(frame * 0.3) > 0 ? 1 : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0D0D1A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          maxWidth: 1600,
          maxHeight: 900,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
          transform: `scale(${windowScale})`,
          opacity: windowOpacity,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            backgroundColor: '#2D2D3F',
            height: 40,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <TrafficDot color="#FF5F57" />
          <TrafficDot color="#FFBD2E" />
          <TrafficDot color="#28CA41" />
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              color: '#8B8BA7',
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 500,
            }}
          >
            {title}
          </div>
          {/* Spacer to balance the dots */}
          <div style={{ width: 52 }} />
        </div>

        {/* Terminal body */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#1E1E2E',
            padding: '20px 24px',
            overflowY: 'hidden',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 20,
            lineHeight: 1.6,
          }}
        >
          {timeline.map((entry, idx) => {
            // Determine how much of the command is typed
            const typedChars = Math.max(
              0,
              Math.min(
                entry.cmd.length,
                Math.floor((frame - entry.cmdStart) * CHARS_PER_FRAME),
              ),
            );
            const commandVisible = frame >= entry.cmdStart;
            const commandDone = frame >= entry.cmdEnd;
            const outputVisible = frame >= entry.outputStart;
            const outputOpacity = outputVisible
              ? interpolate(
                  frame,
                  [entry.outputStart, entry.outputEnd],
                  [0, 1],
                  { extrapolateRight: 'clamp' },
                )
              : 0;

            // Is this the currently-typing command?
            const isActive = frame >= entry.cmdStart && !commandDone;
            // Is this the last completed command (cursor should be here if no more active)
            const isLastDone =
              commandDone &&
              (idx === timeline.length - 1 || frame < timeline[idx + 1].cmdStart);

            if (!commandVisible) return null;

            return (
              <div key={idx} style={{ marginBottom: 8 }}>
                {/* Command line */}
                <div style={{ display: 'flex' }}>
                  <span style={{ color: '#6B7280' }}>{prompt}</span>
                  <span style={{ color: '#4ADE80' }}>
                    {commandDone ? entry.cmd : entry.cmd.slice(0, typedChars)}
                  </span>
                  {/* Blinking cursor on active line */}
                  {(isActive || isLastDone) && (
                    <span
                      style={{
                        color: '#4ADE80',
                        opacity: cursorOpacity,
                        marginLeft: 1,
                      }}
                    >
                      ▋
                    </span>
                  )}
                </div>

                {/* Output */}
                {outputVisible && entry.output && (
                  <div
                    style={{
                      color: '#E5E7EB',
                      opacity: outputOpacity,
                      whiteSpace: 'pre-wrap',
                      marginTop: 4,
                      paddingLeft: 4,
                    }}
                  >
                    {entry.output}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default TerminalScene;
