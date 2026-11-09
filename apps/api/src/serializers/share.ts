import type { Share } from "@algoforge/contracts";
import { toIso } from "./dates";

export interface ShareRow {
  shareId: string;
  type: Share["type"];
  targetId: string;
  createdAt: Date | string;
  revokedAt: Date | string | null;
  viewCount: number;
}

export function serializeShare(row: ShareRow, url: string): Share {
  return {
    shareId: row.shareId,
    url,
    type: row.type,
    targetId: row.targetId,
    createdAt: toIso(row.createdAt),
    revokedAt: row.revokedAt ? toIso(row.revokedAt) : null,
    viewCount: row.viewCount,
  };
}
