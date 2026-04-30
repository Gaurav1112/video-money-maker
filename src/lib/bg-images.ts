import type { SceneType } from '../types';

/**
 * Maps scene types to background stock photos in public/images/bg/.
 * Photos are darkened to 8% opacity via CSS overlay in the scene component.
 * Source: Unsplash/Pexels (free commercial license, no attribution required).
 */
const BG_MAP: Partial<Record<SceneType, string>> = {
  code: 'images/bg/coding-screen.jpg',
  diagram: 'images/bg/data-center.jpg',
  interview: 'images/bg/office-desk.jpg',
  table: 'images/bg/whiteboard.jpg',
  text: 'images/bg/server-room.jpg',
  review: 'images/bg/terminal.jpg',
  summary: 'images/bg/dashboard.jpg',
};

export function getBackgroundImage(sceneType: SceneType): string | null {
  return BG_MAP[sceneType] || null;
}
