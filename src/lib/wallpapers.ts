import type { Wallpaper } from "@/db/schema";

/** Built-in wallpapers: CSS gradients, so there are no image files to host. */
export const PRESET_WALLPAPERS: Record<string, { name: string; css: string }> = {
  // Brand presets first (navy, ice and a restrained orange glow).
  navy: { name: "Navy", css: "linear-gradient(160deg, #0b1f44 0%, #06152f 100%)" },
  horizon: { name: "Horizon", css: "radial-gradient(120% 90% at 100% 100%, rgba(250,70,22,0.35) 0%, rgba(250,70,22,0) 55%), linear-gradient(160deg, #0b1f44 0%, #06152f 100%)" },
  ice: { name: "Ice", css: "linear-gradient(160deg, #f8fafc 0%, #dbeafe 100%)" },
  daybreak: { name: "Daybreak", css: "radial-gradient(100% 80% at 100% 0%, rgba(250,70,22,0.14) 0%, rgba(250,70,22,0) 60%), linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%)" },
  dawn: { name: "Dawn", css: "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)" },
  ocean: { name: "Ocean", css: "linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)" },
  forest: { name: "Forest", css: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)" },
  dusk: { name: "Dusk", css: "linear-gradient(135deg, #2c3e50 0%, #fd746c 100%)" },
  night: { name: "Night", css: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" },
  sand: { name: "Sand", css: "linear-gradient(135deg, #e6dada 0%, #c9b79c 100%)" },
  aurora: { name: "Aurora", css: "linear-gradient(135deg, #00c9ff 0%, #92fe9d 100%)" },
  plum: { name: "Plum", css: "linear-gradient(135deg, #41295a 0%, #2f0743 100%)" },
};

export const PRESET_COLORS = ["#f8fafc", "#dbeafe", "#e2e8f0", "#fff4ef", "#0b1f44", "#06152f", "#334155", "#1e3a8a"];

/** CSS `background` value for a wallpaper, or undefined for none. */
export function wallpaperCss(wallpaper: Wallpaper | null | undefined): string | undefined {
  if (!wallpaper || wallpaper.type === "none") return undefined;
  if (wallpaper.type === "preset") return PRESET_WALLPAPERS[wallpaper.value]?.css;
  if (wallpaper.type === "color") return wallpaper.value;
  // JSON.stringify produces a safely quoted CSS string.
  return `center / cover no-repeat url(${JSON.stringify(wallpaper.value)})`;
}

