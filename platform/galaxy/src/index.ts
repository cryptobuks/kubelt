import { createServer } from "@graphql-yoga/common";

import Env from "./env";
import schema from "./schema";

const yoga = createServer<{ env: Env; ctx: ExecutionContext }>({ schema });

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (!env.OORT) {
      throw Error("OORT not set");
    }
    return yoga.handleRequest(request, { env, ctx });
  },
};
