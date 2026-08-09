import { ApolloServer } from "@apollo/server";
import fastifyApollo, {
  fastifyApolloDrainPlugin,
} from "@as-integrations/fastify";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { createContext } from "./context.js";
import type { GraphQLContext } from "./context.js";
import { registerNotificationSchedulerRoutes } from "./modules/notifications/notificationScheduler.route.js";
import { resolvers, typeDefs } from "./schema.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    ok: true,
  }));

  registerNotificationSchedulerRoutes(app);

  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    plugins: [fastifyApolloDrainPlugin(app)],
  });

  await server.start();

  await app.register(fastifyApollo(server), {
    path: "/graphql",
    context: async (request) => createContext(request),
  });

  return app;
}
