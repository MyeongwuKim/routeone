const fs = require("node:fs/promises");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

const MODULAR_HEADER_PODS = [
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true",
];

module.exports = function withGoogleModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (nextConfig) => {
      const podfilePath = path.join(
        nextConfig.modRequest.platformProjectRoot,
        "Podfile"
      );
      const podfile = await fs.readFile(podfilePath, "utf8");
      const missingPods = MODULAR_HEADER_PODS.filter(
        (podLine) => !podfile.includes(podLine)
      );

      if (!missingPods.length) {
        return nextConfig;
      }

      await fs.writeFile(
        podfilePath,
        podfile.replace(
          "  use_expo_modules!\n",
          `  use_expo_modules!\n${missingPods.join("\n")}\n`
        )
      );

      return nextConfig;
    },
  ]);
};
