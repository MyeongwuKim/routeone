const fs = require("node:fs/promises");
const path = require("node:path");
const {
  IOSConfig,
  withFinalizedMod,
  withInfoPlist,
  withXcodeProject
} = require("expo/config-plugins");

const LAUNCH_STORYBOARD = "MasilLaunchScreen";
const LAUNCH_ASSETS = [
  { source: "SplashScreenLogo", name: "MasilLaunchLogo", kind: "imageset" },
  { source: "SplashScreenBackground", name: "MasilLaunchBackground", kind: "colorset" }
];

/** Expo가 생성한 시작 화면을 마실 전용 이름으로 등록해 이전 앱의 시작 화면과 구분한다. */
module.exports = function withMasilLaunchScreen(config) {
  // Expo 스플래시 플러그인보다 먼저 등록해야 기본 설정 이후에 실행된다.
  config = withInfoPlist(config, (nextConfig) => {
    nextConfig.modResults.UILaunchStoryboardName = LAUNCH_STORYBOARD;
    return nextConfig;
  });

  config = withXcodeProject(config, (nextConfig) => {
    const { projectName } = nextConfig.modRequest;
    const project = nextConfig.modResults;
    const filepath = path.join(projectName, `${LAUNCH_STORYBOARD}.storyboard`);

    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath,
        groupName: projectName,
        isBuildFile: true,
        project
      });
    }

    // Xcode가 스토리보드를 복사 대신 .storyboardc로 컴파일하도록 파일 형식을 지정한다.
    const storyboardRef = project.hasFile(filepath);
    if (!storyboardRef) {
      throw new Error(`Could not register ${filepath} in the Xcode project.`);
    }
    storyboardRef.lastKnownFileType = "file.storyboard";
    storyboardRef.fileEncoding = 4;
    delete storyboardRef.explicitFileType;

    return nextConfig;
  });

  // Expo가 이미지, 라이트·다크 배경색과 스토리보드를 모두 쓴 뒤 해당 결과물을 사용한다.
  return withFinalizedMod(config, ["ios", async (nextConfig) => {
    const { platformProjectRoot, projectName } = nextConfig.modRequest;
    const sourceRoot = path.join(platformProjectRoot, projectName);
    const catalog = path.join(sourceRoot, "Images.xcassets");
    let storyboard = await fs.readFile(path.join(sourceRoot, "SplashScreen.storyboard"), "utf8");

    for (const { source, name, kind } of LAUNCH_ASSETS) {
      await fs.cp(path.join(catalog, `${source}.${kind}`), path.join(catalog, `${name}.${kind}`), {
        recursive: true
      });
      storyboard = storyboard.replaceAll(`"${source}"`, `"${name}"`);
    }

    await fs.writeFile(path.join(sourceRoot, `${LAUNCH_STORYBOARD}.storyboard`), storyboard);
    return nextConfig;
  }]);
};
