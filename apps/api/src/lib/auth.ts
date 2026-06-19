import type { GraphQLContext } from "../context.js";

export function requireUser(context: GraphQLContext) {
  return context.user;
}
