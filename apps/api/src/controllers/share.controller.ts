import { Request, Response } from "express";
import type { ShareListResponse, ShareType } from "@algoforge/contracts";
import { serializeShare } from "../serializers/share";
import { publicShareService } from "../services/public-share.service";
import { shareService } from "../services/share.service";
import { asyncHandler } from "../utils/async-handler";
import { parseCreateShare, parseShareId, parseShareTargetQuery } from "../validation/share";

const present = (row: Parameters<typeof serializeShare>[0]) => serializeShare(row, shareService.urlFor(row.shareId));

/** Owner endpoints: always scoped to req.auth.user.id inside the service and the queries. */
class ShareController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const { type, targetId } = parseShareTargetQuery(req.query.target);
    const rows = await shareService.listForTarget(req.auth!.user.id, type, targetId);
    const body: ShareListResponse = { data: rows.map(present) };
    res.setHeader("Cache-Control", "no-store");
    res.json(body);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateShare(req.body);
    const share = await shareService.create(req.auth!.user.id, input.type, input.targetId);
    res.setHeader("Cache-Control", "no-store");
    res.json(present(share));
  });

  revoke = asyncHandler(async (req: Request, res: Response) => {
    await shareService.revoke(req.auth!.user.id, parseShareId(req.params.shareId));
    res.status(204).send();
  });
}

/** Anonymous endpoints. Never reads req.auth. */
class PublicShareController {
  private headers(res: Response, ok: boolean): void {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    // Revalidate every time: the server answers 304/200 only after re-checking the share is still active.
    res.setHeader("Cache-Control", ok ? "public, no-cache" : "no-store");
  }

  resolve = asyncHandler(async (req: Request, res: Response) => {
    this.headers(res, false); // an error keeps no-store
    const body = await publicShareService.resolve(String(req.params.shareId));
    this.headers(res, true);
    res.json(body);
  });

  private alias(type: ShareType) {
    return asyncHandler(async (req: Request, res: Response) => {
      this.headers(res, false);
      const payload = await publicShareService.resolveAs(String(req.params.shareId), type);
      this.headers(res, true);
      res.json(payload.data);
    });
  }
  resolveAnalysis = this.alias("analysis");
  resolveExplain = this.alias("explain");
}

export const shareController = new ShareController();
export const publicShareController = new PublicShareController();
