const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const compiledModules = new Map();

function loadModule(relativePath, mocks = {}, globals = {}) {
  if (!compiledModules.has(relativePath)) {
    const result = ts.transpileModule(
      readFileSync(path.join(__dirname, relativePath), "utf8"),
      {
        reportDiagnostics: true,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }
    );
    assert.equal(result.diagnostics.length, 0);
    compiledModules.set(relativePath, result.outputText);
  }

  const exports = {};
  vm.runInNewContext(compiledModules.get(relativePath), {
    exports,
    Error,
    require: (specifier) => {
      assert.ok(Object.hasOwn(mocks, specifier), `Unexpected import: ${specifier}`);
      return mocks[specifier];
    },
    ...globals,
  });
  return exports;
}

// Explicit render cycles cover hook behavior; native presentation is stubbed.
function createHookRenderer() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const changed = (slot, deps) => !slot || !deps || slot.deps.length !== deps.length ||
    deps.some((value, index) => !Object.is(value, slot.deps[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        const slot = { value: initial };
        slot.set = (value) => {
          slot.value = typeof value === "function" ? value(slot.value) : value;
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (changed(slots[index], deps)) slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (changed(slots[index], deps)) {
        slots[index] = { deps };
        effects.push(effect);
      }
    },
  };
  return {
    react,
    render(callback) {
      cursor = 0;
      effects = [];
      const result = callback();
      effects.forEach((effect) => effect());
      return result;
    },
  };
}

const onboarding = loadModule("../src/constants/nativeOnboarding.ts");

function createAlertHarness() {
  const renderer = createHookRenderer();
  const alerts = [];
  const events = [];
  const { useNativeLoginErrorAlert } = loadModule(
    "../src/auth/useNativeLoginErrorAlert.ts",
    {
      react: renderer.react,
      "@/constants/nativeOnboarding": onboarding,
      "react-native": {
        Keyboard: { dismiss: () => events.push("keyboard") },
        Alert: {
          alert: (title, message, buttons, options) => {
            events.push("alert");
            alerts.push({ title, message, buttons, options });
          },
        },
      },
    }
  );
  const defaults = { errorMessage: null, language: "ko", onDismiss: () => {} };
  return {
    renderer,
    alerts,
    events,
    useNativeLoginErrorAlert,
    render: (props = {}) => renderer.render(() =>
      useNativeLoginErrorAlert({ ...defaults, ...props })
    ),
  };
}

test("오류가 없으면 팝업을 띄우거나 키보드를 닫지 않는다", () => {
  const harness = createAlertHarness();
  harness.render();
  harness.render({ errorMessage: "" });
  assert.deepEqual(harness.events, []);
});

for (const action of ["confirm", "dismiss"]) {
  test(`오류 팝업은 키보드를 닫고 ${action} 동작에 오류 해제를 연결한다`, () => {
    const harness = createAlertHarness();
    let dismissals = 0;
    harness.render({
      errorMessage: "로그인 요청에 실패했어요.",
      onDismiss: () => { dismissals += 1; },
    });
    assert.deepEqual(harness.events, ["keyboard", "alert"]);
    const alert = harness.alerts[0];
    assert.equal(alert.title, onboarding.LOGIN_TEXT.ko.errorTitle);
    assert.equal(alert.message, "로그인 요청에 실패했어요.");
    assert.equal(alert.buttons.length, 1);
    assert.equal(alert.buttons[0].text, "확인");
    assert.equal(alert.options.cancelable, true);
    if (action === "confirm") alert.buttons[0].onPress();
    else alert.options.onDismiss();
    assert.equal(dismissals, 1);
  });
}

test("열린 오류 팝업은 재렌더링으로 중복 표시되지 않는다", () => {
  const harness = createAlertHarness();
  harness.render({ errorMessage: "같은 오류" });
  harness.render({ errorMessage: "같은 오류", onDismiss: () => {} });
  assert.equal(harness.alerts.length, 1);
});

for (const language of ["ko", "en"]) {
  test(`${language} 설정 오류는 친화적인 문구와 해당 언어의 확인 버튼을 사용한다`, () => {
    for (const [message, key] of [
      ["Missing URL schemes", "googleConfigurationError"],
      ["비활성화된 빌드", "applePermissionError"],
      ["Sign in with Apple is disabled", "applePermissionError"],
    ]) {
      const harness = createAlertHarness();
      harness.render({ language, errorMessage: message });
      const alert = harness.alerts[0];
      assert.equal(alert.title, onboarding.LOGIN_TEXT[language].errorTitle);
      assert.equal(alert.message, onboarding.LOGIN_TEXT[language][key]);
      assert.equal(alert.buttons[0].text, language === "ko" ? "확인" : "OK");
    }
  });
}

function createLoginHarness() {
  const harness = createAlertHarness();
  const state = { googleError: null, appleError: null, oauthCalls: 0, completions: 0 };
  const { useNativeLogin } = loadModule("../src/auth/useNativeLogin.ts", {
    react: harness.renderer.react,
    "@react-native-google-signin/google-signin": {
      GoogleSignin: {
        configure: () => {},
        hasPlayServices: async () => true,
        signIn: async () => {
          if (state.googleError) throw state.googleError;
          return { type: "cancelled" };
        },
      },
      isErrorWithCode: (error) => error != null && typeof error === "object" && "code" in error,
      isSuccessResponse: (response) => response.type === "success",
      statusCodes: {
        SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
        PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
        IN_PROGRESS: "IN_PROGRESS",
      },
    },
    "expo-apple-authentication": {
      isAvailableAsync: async () => true,
      signInAsync: async () => { throw state.appleError; },
      AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    },
    "./nativeAuth": {
      loginWithNativePassword: async () => { throw new Error("비밀번호 오류"); },
      loginWithNativeOAuth: async () => { state.oauthCalls += 1; },
    },
  }, { process: { env: {} } });
  const onComplete = async () => { state.completions += 1; };
  return {
    ...harness,
    state,
    render: () => harness.renderer.render(() => {
      const login = useNativeLogin({ onComplete });
      harness.useNativeLoginErrorAlert({
        errorMessage: login.errorMessage,
        language: "ko",
        onDismiss: login.dismissError,
      });
      return login;
    }),
  };
}

test("팝업을 닫아도 입력값을 유지하고 같은 오류로 재시도하면 다시 표시한다", async () => {
  const harness = createLoginHarness();
  let login = harness.render();
  const dismissError = login.dismissError;
  login.setAccountId("test-account");
  login.setPassword("test-password");
  login.setDisplayName("테스트 닉네임");
  login = harness.render();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await login.handlePasswordLogin();
    login = harness.render();
    assert.equal(login.errorMessage, "비밀번호 오류");
    assert.equal(harness.alerts.length, attempt + 1);
    if (attempt === 0) harness.alerts[attempt].buttons[0].onPress();
    else harness.alerts[attempt].options.onDismiss();
    login = harness.render();
    assert.equal(login.errorMessage, null);
    assert.equal(login.accountId, "test-account");
    assert.equal(login.password, "test-password");
    assert.equal(login.displayName, "테스트 닉네임");
    assert.equal(login.dismissError, dismissError);
  }
});

for (const [label, provider, error] of [
  ["Google 취소 응답", "Google", null],
  ["Google 취소 오류", "Google", { code: "SIGN_IN_CANCELLED" }],
  ["Apple 취소 오류", "Apple", { code: "ERR_REQUEST_CANCELED" }],
]) {
  test(`${label} 처리 후 로그인 오류 팝업 없이 종료한다`, async () => {
    const harness = createLoginHarness();
    harness.state.googleError = provider === "Google" ? error : null;
    harness.state.appleError = provider === "Apple" ? error : null;
    let login = harness.render();
    await login[`handle${provider}Login`]();
    login = harness.render();
    assert.equal(login.activeProvider, null);
    assert.equal(login.errorMessage, null);
    assert.equal(harness.alerts.length, 0);
    assert.equal(harness.state.oauthCalls, 0);
    assert.equal(harness.state.completions, 0);
  });
}
