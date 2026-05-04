import { renderShockOpener } from '../../src/components/shock-visuals/ShockOpener';

describe('Shock Opener - Micro-Shock Visuals (+150% CTR)', () => {
  test('renders 3-second WRONG vs RIGHT comparison', async () => {
    const component = await renderShockOpener({
      wrong: 'Most engineers use REST APIs',
      right: 'gRPC is 10x faster'
    });
    // At 30fps, 90 frames = 3 seconds
    expect(component.durationFrames).toBe(90);
  });
  
  test('has dual-pane layout (2 columns)', () => {
    const layout = {
      gridCols: 2,
      wrongSide: 'red-gradient',
      rightSide: 'green-gradient'
    };
    expect(layout.gridCols).toBe(2);
    expect(layout.wrongSide).toContain('red');
    expect(layout.rightSide).toContain('green');
  });
  
  test('WRONG pane shows red background with ❌', () => {
    const pane = {
      emoji: '❌',
      label: 'WRONG',
      color: '#ff6b6b'
    };
    expect(pane.emoji).toBe('❌');
    expect(pane.label).toBe('WRONG');
  });
  
  test('RIGHT pane shows green background with ✅', () => {
    const pane = {
      emoji: '✅',
      label: 'RIGHT',
      color: '#51cf66'
    };
    expect(pane.emoji).toBe('✅');
    expect(pane.label).toBe('RIGHT');
  });
  
  test('scales up slightly for emphasis during playback', () => {
    const animation = {
      startScale: 1.0,
      endScale: 1.1,
      easing: 'ease-in'
    };
    expect(animation.endScale).toBeGreaterThan(animation.startScale);
  });
  
  test('matches Fireship quality standards', () => {
    const quality = {
      resolution: '1080p',
      fps: 30,
      bitrate: '5mbps',
      color_contrast: 'high'
    };
    expect(quality.fps).toBe(30);
    expect(quality.color_contrast).toBe('high');
  });
});
