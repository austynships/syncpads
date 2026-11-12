/** Shapes shared by the start page API and the browser client. */
import type { Wallpaper } from "@/db/schema";

export type GroupLayout = "list" | "tiles";
export type PageLayout = "auto" | "1" | "2" | "3" | "4" | "5";
export type Theme = "system" | "light" | "dark";

export type ItemDTO = {
  id: string;
  type: "link" | "note";
  url: string | null;
  title: string | null;
  noteBody: string | null; // sanitized HTML
  position: number;
  summary?: string | null; // from enrichment (SP-13), when smart features are on
  tags?: string[] | null;
};

export type GroupDTO = {
  id: string;
  name: string;
  layout: GroupLayout;
  position: number;
  items: ItemDTO[];
};

export type PageDTO = {
  id: string;
  name: string;
  layout: PageLayout;
  position: number;
  hiddenFromAgents: boolean;
  groups: GroupDTO[];
};

export type SettingsDTO = {
  theme: Theme;
  wallpaper: Wallpaper;
  aiEnabled: boolean; // the user's consent to send page text to AI providers
  aiAvailable: { summaries: boolean; embeddings: boolean }; // provider keys configured on the server
};

export type StateDTO = {
  revision: number;
  settings: SettingsDTO;
  pages: PageDTO[];
};

/** Every write returns the new revision so clients know whether they missed changes. */
export type WriteResult<T = unknown> = { revision: number } & T;

