/** Pure helpers that return an updated copy of the start page state. */
import type { GroupDTO, ItemDTO, PageDTO, StateDTO } from "@/lib/start-page-types";

export function mapPage(s: StateDTO, pageId: string, fn: (p: PageDTO) => PageDTO): StateDTO {
  return { ...s, pages: s.pages.map((p) => (p.id === pageId ? fn(p) : p)) };
}

export function mapGroup(s: StateDTO, groupId: string, fn: (g: GroupDTO) => GroupDTO): StateDTO {
  return {
    ...s,
    pages: s.pages.map((p) => ({ ...p, groups: p.groups.map((g) => (g.id === groupId ? fn(g) : g)) })),
  };
}

export function mapItem(s: StateDTO, itemId: string, fn: (i: ItemDTO) => ItemDTO): StateDTO {
  return {
    ...s,
    pages: s.pages.map((p) => ({
      ...p,
      groups: p.groups.map((g) => ({ ...g, items: g.items.map((i) => (i.id === itemId ? fn(i) : i)) })),
    })),
  };
}

export function removeItem(s: StateDTO, itemId: string): StateDTO {
  return {
    ...s,
    pages: s.pages.map((p) => ({
      ...p,
      groups: p.groups.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== itemId) })),
    })),
  };
}

export function reorderBy<T extends { id: string }>(list: T[], ids: string[]): T[] {
  const byId = new Map(list.map((x) => [x.id, x]));
  return ids.map((id, position) => ({ ...byId.get(id)!, position }));
}

/** Replace a page's groups (used after drag and drop). */
export function setPageGroups(s: StateDTO, pageId: string, groups: GroupDTO[]): StateDTO {
  return mapPage(s, pageId, (p) => ({
    ...p,
    groups: groups.map((g, gi) => ({ ...g, position: gi, items: g.items.map((i, ii) => ({ ...i, position: ii })) })),
  }));
}

