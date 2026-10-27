export interface OfficeGroup {
  id: string;
  name: string;
  memberIds: string[];
}

const PREFIX = "certified_office_groups_v1:";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadGroups(orgId: string): OfficeGroup[] {
  const store = storage();
  if (!store) return [];
  try {
    const value = JSON.parse(store.getItem(PREFIX + orgId) || "[]") as OfficeGroup[];
    if (!Array.isArray(value)) return [];
    return value.filter((group) => group && typeof group.id === "string" && typeof group.name === "string");
  } catch {
    return [];
  }
}

export function saveGroups(orgId: string, groups: OfficeGroup[]) {
  storage()?.setItem(PREFIX + orgId, JSON.stringify(groups));
}
