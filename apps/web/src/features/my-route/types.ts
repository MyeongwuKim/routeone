import type { RouteDetailFieldsFragment } from "@/generated/graphql";

export type MyRoute = RouteDetailFieldsFragment;
export type MyRouteDay = MyRoute["days"][number];
export type MyRouteStop = MyRoute["stops"][number];
