const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

export const DEV_VERIFICATION_BYPASS_ENV = "ROUTEONE_DEV_VERIFICATION_BYPASS";

export function isDevVerificationBypassEnabled() {
  return TRUTHY_ENV_VALUES.has(
    process.env[DEV_VERIFICATION_BYPASS_ENV]?.trim().toLowerCase() ?? ""
  );
}
