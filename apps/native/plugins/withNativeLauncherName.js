const { AndroidConfig, withInfoPlist, withStringsXml } = require("expo/config-plugins");

/** Expo 프로젝트 이름으로 생성되는 빌드 대상은 유지하고, 홈 화면에 보이는 앱 이름을 적용한다. */
module.exports = function withNativeLauncherName(config, { name }) {
  const withIosName = withInfoPlist(config, (nextConfig) => {
    nextConfig.modResults.CFBundleDisplayName = name;
    return nextConfig;
  });

  return withStringsXml(withIosName, (nextConfig) => {
    nextConfig.modResults = AndroidConfig.Strings.setStringItem(
      [AndroidConfig.Resources.buildResourceItem({ name: "app_name", value: name })],
      nextConfig.modResults
    );
    return nextConfig;
  });
};
