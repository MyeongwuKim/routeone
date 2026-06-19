import type { ApolloServerOptions } from "@apollo/server";
import { gql } from "graphql-tag";
import type { GraphQLContext } from "./context.js";
import { dateTimeScalar } from "./graphql/scalars.js";
import {
  routeResolvers,
  routeTypeDefs,
} from "./modules/routes/route.resolver.js";
import { userResolvers, userTypeDefs } from "./modules/user/user.resolver.js";

type ResolverRecord = Record<string, unknown>;
type TypeDefsServerOptions = Extract<
  ApolloServerOptions<GraphQLContext>,
  { typeDefs: unknown }
>;
type ResolverMap = NonNullable<TypeDefsServerOptions["resolvers"]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeResolvers(...resolverGroups: ResolverRecord[]): ResolverMap {
  const merged = resolverGroups.reduce<ResolverRecord>((acc, current) => {
    for (const key of Object.keys(current)) {
      const existing = acc[key];
      const incoming = current[key];

      acc[key] =
        isRecord(existing) && isRecord(incoming)
          ? {
              ...existing,
              ...incoming,
            }
          : incoming;
    }

    return acc;
  }, {});

  return merged as ResolverMap;
}

export const typeDefs = [
  gql`
    scalar DateTime

    schema {
      query: Query
      mutation: Mutation
    }

    type Query {
      _empty: String
    }

    type Mutation {
      _empty: String
    }
  `,
  userTypeDefs,
  routeTypeDefs,
];

export const resolvers = mergeResolvers(
  {
    DateTime: dateTimeScalar,
  },
  userResolvers,
  routeResolvers
);
