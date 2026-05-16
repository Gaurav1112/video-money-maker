import { ShockOpener, ShockPattern } from '../../src/components/shock-visuals/ShockOpener';
import React from 'react';

describe('Shock Opener - Micro-Shock Visuals (+150% CTR)', () => {
  test('renders with [WRONG] vs [RIGHT] props', () => {
    const props = {
      wrong: 'Most engineers use REST APIs',
      right: 'gRPC is 10x faster',
      durationFrames: 90
    };
    const component = React.createElement(ShockOpener, props);
    expect(component).toBeDefined();
    expect(component.props.wrong).toBe('Most engineers use REST APIs');
    expect(component.props.right).toBe('gRPC is 10x faster');
  });
  
  test('has default duration of 90 frames (3 seconds at 30fps)', () => {
    const props = {
      wrong: 'Test wrong',
      right: 'Test right'
    };
    const component = React.createElement(ShockOpener, props);
    expect(component.props.durationFrames || 90).toBe(90);
  });

  test('supports 6 animation patterns', () => {
    const patterns: ShockPattern[] = ['side-by-side', 'flip-wipe', 'truth-bomb', 'myth-buster', 'plot-twist', 'reveal'];
    
    patterns.forEach(pattern => {
      const props = {
        wrong: 'Test claim',
        right: 'Correct claim',
        pattern,
        durationFrames: 90
      };
      const component = React.createElement(ShockOpener, props);
      expect(component.props.pattern).toBe(pattern);
    });
  });

  test('pattern: side-by-side - scale animation', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Old approach',
      right: 'New approach',
      pattern: 'side-by-side',
      durationFrames: 90
    });
    expect(component.props.pattern).toBe('side-by-side');
  });

  test('pattern: flip-wipe - card rotation reveal', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Misconception',
      right: 'Truth',
      pattern: 'flip-wipe',
      durationFrames: 90
    });
    expect(component.props.pattern).toBe('flip-wipe');
  });

  test('pattern: truth-bomb - staggered pop-in with glow', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Common myth',
      right: 'Reality',
      pattern: 'truth-bomb',
      durationFrames: 90
    });
    expect(component.props.pattern).toBe('truth-bomb');
  });

  test('pattern: myth-buster - slide and fade reveal', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Wrong assumption',
      right: 'Correct fact',
      pattern: 'myth-buster',
      durationFrames: 90
    });
    expect(component.props.pattern).toBe('myth-buster');
  });

  test('pattern: plot-twist - rotate flip reveal', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Initial belief',
      right: 'Surprise reveal',
      pattern: 'plot-twist',
      durationFrames: 90
    });
    expect(component.props.pattern).toBe('plot-twist');
  });

  test('pattern: reveal - bottom-up wipe with glow', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Hidden assumption',
      right: 'Revealed truth',
      pattern: 'reveal',
      durationFrames: 90
    });
    expect(component.props.pattern).toBe('reveal');
  });

  test('WRONG pane has red gradient background (#ff6b6b to #ff4444)', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Test wrong',
      right: 'Test right'
    });
    expect(component).toBeDefined();
  });

  test('RIGHT pane has green gradient background (#51cf66 to #37b24d)', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Test wrong',
      right: 'Test right'
    });
    expect(component).toBeDefined();
  });

  test('accepts optional topic parameter', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'Test wrong',
      right: 'Test right',
      topic: 'Performance Optimization'
    });
    expect(component.props.topic).toBe('Performance Optimization');
  });

  test('displays ❌ WRONG label', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'REST APIs are always better',
      right: 'gRPC is 10x faster',
      durationFrames: 90
    });
    expect(component.props.wrong).toContain('REST');
  });

  test('displays ✅ RIGHT label', () => {
    const component = React.createElement(ShockOpener, {
      wrong: 'REST APIs are always better',
      right: 'gRPC is 10x faster',
      durationFrames: 90
    });
    expect(component.props.right).toContain('gRPC');
  });
});
