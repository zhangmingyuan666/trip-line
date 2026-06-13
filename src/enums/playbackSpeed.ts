export const playbackSpeeds = ['slow', 'normal', 'fast'] as const;

export type PlaybackSpeed = (typeof playbackSpeeds)[number];

export const playbackSpeedLabels: Record<PlaybackSpeed, string> = {
  slow: '慢',
  normal: '正常',
  fast: '快',
};
