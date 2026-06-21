import type { MyRoutesQuery } from "@/generated/graphql";

export type MyRoute = MyRoutesQuery["myRoutes"][number];
export type MyRouteDay = MyRoute["days"][number];
export type MyRouteStop = MyRoute["stops"][number];
