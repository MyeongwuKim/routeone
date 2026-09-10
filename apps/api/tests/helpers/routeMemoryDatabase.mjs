import assert from "node:assert/strict";

export const owner = { id: "owner" };
export const origin = { lat: 37, lng: 127 };
export const secondOrigin = { lat: 36, lng: 128 };
export const changedOrigin = { lat: 35, lng: 129 };

export function stopInput(dayIndex, title = `Place ${dayIndex}`) {
  return { dayIndex, place: { provider: "CUSTOM", title, lat: 37, lng: 127 } };
}

export function routeRow(overrides = {}) {
  return {
    id: "route",
    ownerId: owner.id,
    tripDays: 2,
    status: "ACTIVE",
    totalStopCount: 0,
    completedStopCount: 0,
    visibility: "PRIVATE",
    countryCode: "KR",
    travelStartDate: null,
    travelEndDate: null,
    dailyStartMinutes: null,
    scheduleEndMinutes: null,
    startLocation: origin,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

export function dayRow(dayIndex, startLocation = origin, overrides = {}) {
  return {
    id: `day-${dayIndex}`,
    routeId: "route",
    dayIndex,
    date: null,
    plannedStartMinutes: null,
    startedAt: null,
    startLocation,
    ...overrides,
  };
}

export function memoryDatabase(initial = {}) {
  const state = structuredClone({ routes: [], days: [], stops: [], requests: [], ...initial });
  const writes = [];
  let nextId = 1;
  let transactionDepth = 0;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) =>
      value && typeof value === "object" && "in" in value
        ? value.in.includes(row[key])
        : row[key] === value
    );
  const recordWrite = (model, operation, data) => {
    writes.push({ model, operation, data: structuredClone(data), inTransaction: transactionDepth > 0 });
  };
  const table = (name, defaults = {}) => ({
    async findUnique({ where }) {
      return structuredClone(state[name].find((row) => matches(row, where)) ?? null);
    },
    async findMany({ where, orderBy } = {}) {
      const rows = state[name].filter((row) => matches(row, where));
      const orderKey = Object.keys(orderBy ?? {})[0];
      if (orderKey) rows.sort((left, right) => left[orderKey] - right[orderKey]);
      return structuredClone(rows);
    },
    async count({ where }) {
      return state[name].filter((row) => matches(row, where)).length;
    },
    async create({ data }) {
      const row = structuredClone({ ...defaults, id: `created-${name}-${nextId++}`, ...data });
      state[name].push(row);
      recordWrite(name, "create", row);
      return structuredClone(row);
    },
    async createMany({ data }) {
      const rows = data.map((item) =>
        structuredClone({ ...defaults, id: `created-${name}-${nextId++}`, ...item })
      );
      state[name].push(...rows);
      recordWrite(name, "createMany", rows);
      return { count: rows.length };
    },
    async update({ where, data }) {
      const row = state[name].find((item) => matches(item, where));
      assert.ok(row, `${name} row must exist for update`);
      Object.assign(row, structuredClone(data));
      recordWrite(name, "update", { id: row.id, ...data });
      return structuredClone(row);
    },
    async deleteMany({ where }) {
      const rows = state[name].filter((row) => !matches(row, where));
      const count = state[name].length - rows.length;
      state[name].splice(0, state[name].length, ...rows);
      recordWrite(name, "deleteMany", where);
      return { count };
    },
    async delete({ where }) {
      return this.deleteMany({ where });
    },
  });
  const route = table("routes", routeRow());
  const baseFindRoute = route.findUnique;
  route.findUnique = async (args) => {
    const row = await baseFindRoute(args);
    return row && args.include
      ? {
          ...row,
          days: structuredClone(state.days.filter((day) => day.routeId === row.id)),
          stops: structuredClone(state.stops.filter((stop) => stop.routeId === row.id)),
        }
      : row;
  };
  route.findFirst = async () => null;
  const requests = table("requests");
  requests.findUnique = async ({ where }) =>
    structuredClone(state.requests.find((row) => matches(row, where.ownerId_requestId)) ?? null);

  const decode = (value) => {
    if (!value || typeof value !== "object") return value;
    if ("$oid" in value) return value.$oid;
    if ("$date" in value) return new Date(value.$date);
    if (Array.isArray(value)) return value.map(decode);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  };
  const prisma = {
    route,
    routeDay: table("days", { date: null, startLocation: null }),
    routeStop: table("stops", { visitStatus: "PENDING" }),
    routeCreateRequest: requests,
    userNotification: { deleteMany: async () => ({ count: 0 }) },
    placePhoto: { deleteMany: async () => ({ count: 0 }) },
    async $runCommandRaw(command) {
      assert.ok(transactionDepth > 0, "batch writes must be inside the transaction");
      recordWrite("raw", "command", command);
      const name = { RouteDay: "days", RouteStop: "stops" }[command.update];
      assert.ok(name, "this test double supports only DAY/stop scalar updates");
      let n = 0;
      for (const item of command.updates) {
        const { _id, ...where } = decode(item.q);
        const row = state[name].find(row => matches(row, { id: _id, ...where }));
        if (!row) continue;
        assert.deepEqual(Object.keys(item.u), ["$set"]);
        const data = decode(item.u.$set);
        Object.assign(row, data);
        recordWrite(name, "update", { id: row.id, ...data });
        n++;
      }
      return { ok: 1, n };
    },
    async $transaction(operation) {
      const before = structuredClone(state);
      transactionDepth += 1;
      try {
        return await operation(prisma);
      } catch (error) {
        for (const name of Object.keys(state)) state[name].splice(0, state[name].length, ...before[name]);
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
  };
  return { prisma, state, writes };
}

