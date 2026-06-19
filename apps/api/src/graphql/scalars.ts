import { GraphQLScalarType, Kind } from "graphql";

function parseDateTime(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError("DateTime 값이 올바르지 않습니다.");
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("DateTime 값이 올바르지 않습니다.");
  }

  return date;
}

export const dateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "ISO-8601 DateTime scalar",
  serialize(value) {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return parseDateTime(value).toISOString();
  },
  parseValue(value) {
    return parseDateTime(value);
  },
  parseLiteral(ast) {
    if (ast.kind !== Kind.STRING && ast.kind !== Kind.INT) {
      throw new TypeError("DateTime 값이 올바르지 않습니다.");
    }

    return parseDateTime(ast.value);
  },
});
