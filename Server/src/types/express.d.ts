import type { JwtPayload } from "../modules/auth/auth.utils.js";
import type { WorkspaceMembership } from "../middleware/rbac.js";
import type { IWorkspace } from "../modules/workspace/workspace.schema.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      membership?: WorkspaceMembership;
      workspace?: IWorkspace;
    }
  }
}

export {};
