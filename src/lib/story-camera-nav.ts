import type { Href } from 'expo-router';

/** Swipe-reveal on home already animated; skip stack transition. */
export const STORY_CAMERA_INSTANT_PARAM = 'instant';

export function storyCameraHref(instant = false): Href {
  return instant
    ? { pathname: '/stories/camera', params: { [STORY_CAMERA_INSTANT_PARAM]: '1' } }
    : '/stories/camera';
}
