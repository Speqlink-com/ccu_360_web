export const defaultWorkspaceAccent = "#008f87";

export const workspaceAccentPresets = [
  { name: "Teal", color: defaultWorkspaceAccent },
  { name: "Midnight navy", color: "#012246" },
  { name: "Clinical blue", color: "#06529a" },
  { name: "Surgical green", color: "#2b7057" },
] as const;

export const workspaceAppearanceKey = (userId: string) =>
  `ccu360:appearance:${userId}`;

export function readableWorkspaceAccent(input: string) {
  if (!/^#[0-9a-f]{6}$/i.test(input)) return defaultWorkspaceAccent;
  const preset = workspaceAccentPresets.find(
    (item) => item.color.toLowerCase() === input.toLowerCase(),
  );
  if (preset) return preset.color;
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(input.slice(index, index + 2), 16),
  );
  const luminance = () =>
    channels.reduce((sum, channel, index) => {
      const linear = channel / 255 <= 0.04045
        ? channel / 255 / 12.92
        : ((channel / 255 + 0.055) / 1.055) ** 2.4;
      return sum + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  while (1.05 / (luminance() + 0.05) < 4.5) {
    channels.forEach((channel, index) => {
      channels[index] = Math.floor(channel * 0.9);
    });
  }
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export const validWorkspaceFontScale = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 100 &&
  value <= 130 &&
  value % 5 === 0;
