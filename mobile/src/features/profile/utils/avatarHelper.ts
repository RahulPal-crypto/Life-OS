export interface AvatarPreset {
  id: string;
  emoji: string;
  bgColor: string;
  value: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'violet', emoji: '🌱', bgColor: '#EDE9FE', value: 'avatar:🌱:#6D28D9' },
  { id: 'rocket', emoji: '🚀', bgColor: '#E0E7FF', value: 'avatar:🚀:#4F46E5' },
  { id: 'brain', emoji: '🧠', bgColor: '#E0F2FE', value: 'avatar:🧠:#0284C7' },
  { id: 'spark', emoji: '✨', bgColor: '#F3E8FF', value: 'avatar:✨:#9333EA' },
  { id: 'target', emoji: '🎯', bgColor: '#FFEDD5', value: 'avatar:🎯:#EA580C' },
  { id: 'fire', emoji: '🔥', bgColor: '#FFE4E6', value: 'avatar:🔥:#E11D48' },
];

export type ParsedAvatar =
  | { kind: 'image'; uri: string }
  | { kind: 'emoji'; emoji: string; accentColor: string }
  | { kind: 'initials'; initials: string };

/**
 * Parse stored `profileImage` field into either an image URI, emoji preset, or name initials.
 */
export const parseAvatar = (
  profileImage?: string | null,
  fullName?: string | null
): ParsedAvatar => {
  const raw = profileImage?.trim();
  if (raw) {
    if (raw.startsWith('avatar:')) {
      const parts = raw.split(':');
      const emoji = parts[1] || '🌱';
      const accentColor = parts[2] || '#6D28D9';
      return { kind: 'emoji', emoji, accentColor };
    }
    if (/^https?:\/\//i.test(raw)) {
      return { kind: 'image', uri: raw };
    }
  }

  const cleanName = (fullName || 'User').trim();
  const words = cleanName.split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase()
      : cleanName.charAt(0).toUpperCase() || 'U';

  return { kind: 'initials', initials };
};
