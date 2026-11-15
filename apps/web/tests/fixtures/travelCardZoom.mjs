// 실제 편집기와 터치 이벤트·PNG·저장 경계를 연결한다. 테스트 사진만 쓰며 서버 쓰기는 fixture가 거절한다.
async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await context.newPage();
  const checks = [];
  const errors = [];
  p.on("pageerror", error => errors.push(error.message));
  const check = (name, passed, detail) => { if (!passed) throw new Error(`${name}${detail ? `: ${JSON.stringify(detail)}` : ""}`); checks.push(name); };
  const zoom = () => p.getByRole("slider", { name: "확대·축소", exact: true });
  const crop = () => p.locator("[data-travel-card-crop]");
  const cropReady = () => p.waitForFunction(() => { const input = document.querySelector('input[aria-valuetext]'); return Boolean(input && !input.disabled); });
  const ready = () => p.waitForFunction(() => Boolean(document.querySelector('img[alt="완성될 여행 카드"]')) && [...document.querySelectorAll("button")].some(button => button.textContent === "공유하기" && !button.disabled));
  const focal = async () => [await p.getByRole("slider", { name: "가로 위치", exact: true }).inputValue(), await p.getByRole("slider", { name: "세로 위치", exact: true }).inputValue()];
  const contained = () => crop().evaluate(element => {
    const box = element.getBoundingClientRect(); const image = element.querySelector("img").getBoundingClientRect();
    return image.width <= box.width + 0.6 && image.height <= box.height + 0.6 && (Math.abs(image.width - box.width) < 0.6 || Math.abs(image.height - box.height) < 0.6);
  });
  // CSS가 실제로 표시한 이미지 사각형으로 그린 픽셀과 완성 PNG의 대표 사진 픽셀을 비교한다.
  const matchingPng = () => p.evaluate(async () => {
    const element = document.querySelector("[data-travel-card-crop]");
    const image = element.querySelector("img"); const box = element.getBoundingClientRect(); const rect = image.getBoundingClientRect();
    const complete = document.querySelector('img[alt="완성될 여행 카드"]'); await complete.decode();
    const expected = document.createElement("canvas"); expected.width = 972; expected.height = 580;
    const a = expected.getContext("2d"); a.fillStyle = "#fffcf5"; a.fillRect(0,0,972,580);
    a.drawImage(image, (rect.left - box.left)/box.width*972, (rect.top - box.top)/box.height*580, rect.width/box.width*972, rect.height/box.height*580);
    const actual = document.createElement("canvas"); actual.width = 1080; actual.height = 1350;
    const b = actual.getContext("2d"); b.drawImage(complete,0,0);
    return [[80,100],[486,120],[890,100],[100,450],[486,290],[880,450]].every(([x,y]) => [...a.getImageData(x,y,1,1).data].every((value,index) => Math.abs(value-b.getImageData(x+54,y+54,1,1).data[index]) <= 2));
  });
  try {
    await p.goto("http://127.0.0.1:5173/tests/fixtures/travelCardEditor.html");
    await p.getByRole("button", { name: "카드 만들기", exact: true }).click(); await ready();
    await p.getByRole("button", { name: "사진 편집", exact: true }).click();
    await cropReady();
    check("기존 사진은 100% 틀 채움으로 시작", await zoom().inputValue() === "100");
    await zoom().focus(); await zoom().press("End"); await ready();
    check("키보드로 300% 확대", await zoom().inputValue() === "300");
    check("확대 미리보기와 PNG 픽셀 일치", await matchingPng());
    await p.getByRole("slider", { name: "가로 위치", exact: true }).press("Home");
    await p.getByRole("button", { name: "가운데로", exact: true }).click();
    check("가운데로는 배율을 유지하고 위치만 복원", await zoom().inputValue() === "300" && (await focal()).join() === "50,50");
    await p.getByRole("button", { name: "전체 보기", exact: true }).click(); await ready();
    check("전체 보기에서 원본 전체와 여백 표시", await contained() && Number(await zoom().inputValue()) < 100);
    check("축소 미리보기와 PNG 픽셀 일치", await matchingPng());
    await p.getByRole("button", { name: "틀 채우기", exact: true }).click(); await ready();
    check("틀 채우기로 기본 구도 복원", await zoom().inputValue() === "100" && (await focal()).join() === "50,50");

    await crop().scrollIntoViewIfNeeded();
    const box = await crop().boundingBox(); const x = box.x + box.width/2; const y = box.y + box.height/2;
    const cdp = await context.newCDPSession(p);
    const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([id,dx,dy])=>({id,x:x+dx,y:y+dy,radiusX:2,radiusY:2,force:1})) });
    await touch("touchStart", [[1,-40,0],[2,40,0]]);
    await touch("touchMove", [[1,-72,0],[2,72,0]]);
    await touch("touchEnd", [[2,72,0]]);
    const pinched = Number(await zoom().inputValue()); const beforeDrag = (await focal()).join();
    await touch("touchMove", [[1,-45,15]]);
    await touch("touchEnd", []); await ready();
    check("실제 두 손가락 터치로 확대", pinched >= 170 && pinched <= 190);
    check("핀치 후 한 손가락 이동은 배율 유지", Number(await zoom().inputValue()) === pinched && (await focal()).join() !== beforeDrag, {pinched,zoom:await zoom().inputValue(),beforeDrag,afterDrag:await focal()});
    check("핀치·이동 후 PNG 구도 일치", await matchingPng());

    await touch("touchStart", [[1,-10,0],[2,10,0]]); await touch("touchMove", [[1,-75,0],[2,75,0]]); await touch("touchEnd", []);
    check("핀치 확대 상한 300%", await zoom().inputValue() === "300");
    await touch("touchStart", [[1,-75,0],[2,75,0]]); await touch("touchMove", [[1,-5,0],[2,5,0]]); await touch("touchEnd", []);
    check("핀치 축소 하한에서 원본 전체 표시", await contained());
    await touch("touchStart", [[1,-20,0]]); await touch("touchCancel", []);
    await p.getByRole("button", { name: "틀 채우기", exact: true }).click();
    await crop().scrollIntoViewIfNeeded();
    const resetBox = await crop().boundingBox();
    await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{id:3,x:resetBox.x+80,y:resetBox.y+100}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{id:3,x:resetBox.x+105,y:resetBox.y+115}]});
    await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
    check("터치 취소 후 새 이동 정상 동작", (await focal()).join() !== "50,50");

    await zoom().press("End");
    await p.getByRole("button",{name:"사진 2: 오후의 카페",exact:true}).click();
    await cropReady();
    check("다른 사진은 독립된 기본 배율", await zoom().inputValue() === "100");
    await p.getByRole("button",{name:"대표 사진: 바다 산책",exact:true}).click();
    await cropReady();
    check("사진을 다시 골라도 편집 배율 보존", await zoom().inputValue() === "300");
    await p.getByRole("button",{name:"뒤로 이동",exact:true}).click(); await ready();
    check("대표·보조 순서 변경 후 같은 사진 배율 보존", await zoom().inputValue() === "300");
    await p.getByRole("button",{name:"앞으로 이동",exact:true}).click(); await ready();

    await p.evaluate(() => { window.zoomTransfers=[]; window.RouteOneNative={saveImage:async options=>{window.zoomTransfers.push(options);return {shared:false};}}; });
    await p.getByRole("button",{name:"이미지 저장",exact:true}).click();
    await p.waitForFunction(()=>window.zoomTransfers.length === 1);
    check("저장 경계에 확대된 현재 PNG 전달", await p.evaluate(()=>window.zoomTransfers[0].dataUrl === document.querySelector('img[alt="완성될 여행 카드"]').src));
    await ready();

    const portrait = await p.evaluate(() => {const canvas=document.createElement("canvas");canvas.width=400;canvas.height=1200;const c=canvas.getContext("2d");c.fillStyle="#397b9b";c.fillRect(0,0,400,1200);return canvas.toDataURL().split(",")[1];});
    await p.locator('input[type="file"]').evaluate(input=>{input.value="";});
    // 웹 파일 경계도 실제 교체 버튼을 거쳐 실행한다.
    await p.evaluate(()=>{delete window.RouteOneNative;});
    const chooser = p.waitForEvent("filechooser");
    await p.getByRole("button",{name:"앨범 사진으로 교체",exact:true}).click();
    await (await chooser).setFiles({name:"portrait.png",mimeType:"image/png",buffer:Buffer.from(portrait,"base64")}); await ready();
    check("새 앨범 사진은 기존 사진 배율을 상속하지 않음", await zoom().inputValue() === "100");
    await p.getByRole("button",{name:"전체 보기",exact:true}).click(); await ready();
    check("세로 앨범 사진도 원본 전체 표시", await contained());
    check("세로 축소 미리보기와 PNG 픽셀 일치", await matchingPng());
    await p.getByRole("button", { name: "사진 편집", exact: true }).click();
    await p.screenshot({path:"/private/tmp/masil-travel-card-zoom-mobile.png"});
    check("모바일 가로 넘침 없음", await p.getByRole("dialog").evaluate(element=>element.scrollWidth<=element.clientWidth));
    await p.setViewportSize({width:1440,height:900});
    await p.getByRole("button", { name: "사진 편집", exact: true }).click();
    await p.screenshot({path:"/private/tmp/masil-travel-card-zoom-desktop.png"});
    check("데스크톱 가로 넘침 없음", await p.getByRole("dialog").evaluate(element=>element.scrollWidth<=element.clientWidth));
    await p.evaluate(async()=>{document.documentElement.classList.add("dark");const {useAppLanguageStore}=await import("/src/stores/appLanguageStore.ts");useAppLanguageStore.setState({language:"en"});});
    await p.getByRole("slider",{name:"Zoom",exact:true}).waitFor();
    await p.getByRole("img",{name:"Your finished travel card",exact:true}).waitFor();
    await p.screenshot({path:"/private/tmp/masil-travel-card-zoom-dark.png"});
    check("영어·다크 모드 확대 도구 표시", await p.getByRole("button",{name:"Fit photo",exact:true}).isVisible() && await p.getByRole("button",{name:"Fill frame",exact:true}).isVisible());
    check("카드 편집 후 원본 여행 기록 보존", await p.evaluate(()=>JSON.stringify(window.travelCardTest.route) === window.travelCardTest.original));
    check("방문·인증·업로드 쓰기 요청 없음", await p.evaluate(()=>window.travelCardTest.requests.every(query=>!query.includes("mutation")||query.startsWith("mutation LocalizeTourPlaces("))));
    check("브라우저 실행 오류 없음", errors.length === 0);
    return {passed:true,checked:checks.length,checks,screenshots:["/private/tmp/masil-travel-card-zoom-mobile.png","/private/tmp/masil-travel-card-zoom-desktop.png","/private/tmp/masil-travel-card-zoom-dark.png"]};
  } finally { await context.close(); }
}
