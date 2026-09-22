/* ================================================================
   汤圆小主角「圆圆」· 实时 3D 版
   用 WebGL 渲染的立体角色：柔光三点照明、糯米质感次表面散射、
   玻璃感眼球与高光、腮红、桂花头饰、接触阴影。
   依赖 three.min.js（本地文件，离线可用）；不可用时自动退回 SVG 版。
   ================================================================ */
(function () {
  if (!window.THREE) { window.TY3D = { available: false }; return; }
  const THREE = window.THREE;
  const instances = new Map();   // key -> instance

  const FACE_Y = 1.2;            // 角色在世界坐标里的半高，用于自适应取景

  function makeRenderable() {
    const canvas = document.createElement('canvas');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false });
    } catch (e) {
      return null;
    }
    renderer.setClearAlpha(0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if ('outputEncoding' in renderer) renderer.outputEncoding = THREE.sRGBEncoding;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 0.32, 5.4);
    camera.lookAt(0, 0.02, 0);

    // ---------- 灯光：主光 + 补光 + 轮廓光 + 环境 ----------
    scene.add(new THREE.HemisphereLight(0xfff6e8, 0xe4d3c0, 0.62));
    scene.add(new THREE.AmbientLight(0xfff2e2, 0.28));

    const key = new THREE.DirectionalLight(0xfff1d8, 1.55);
    key.position.set(2.6, 3.6, 3.4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0006;
    const sc = key.shadow.camera;
    sc.left = -2.2; sc.right = 2.2; sc.top = 2.2; sc.bottom = -2.2; sc.near = 0.5; sc.far = 12;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xd7e8ff, 0.45);
    fill.position.set(-2.8, 1.4, 2.2);
    scene.add(fill);

    const rim = new THREE.PointLight(0xffcf9e, 1.1, 12);
    rim.position.set(-1.6, 1.7, -2.6);
    scene.add(rim);

    // ---------- 角色 ----------
    const root = new THREE.Group();
    scene.add(root);

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffaf2, roughness: 0.66, metalness: 0.0,
      clearcoat: 0.32, clearcoatRoughness: 0.46,
      sheen: 0.75, sheenColor: new THREE.Color(0xffdfc6), sheenRoughness: 0.72
    });
    const darkMat = new THREE.MeshPhysicalMaterial({
      color: 0x33251c, roughness: 0.14, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.06
    });
    const blushMat = new THREE.MeshStandardMaterial({
      color: 0xf59a94, roughness: 1.0, transparent: true, opacity: 0.78
    });
    const flowerMat = new THREE.MeshPhysicalMaterial({
      color: 0xf6bd66, roughness: 0.55, clearcoat: 0.4
    });
    const flowerCoreMat = new THREE.MeshStandardMaterial({ color: 0xd08f2c, roughness: 0.7 });

    const bodyGroup = new THREE.Group();
    root.add(bodyGroup);

    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    body.scale.set(1, 0.95, 1);
    bodyGroup.add(body);

    // 手臂
    const armGeo = new THREE.CapsuleGeometry(0.105, 0.2, 6, 16);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-1.0, -0.16, 0.12);
    armL.rotation.z = 0.5;
    armL.castShadow = true;
    const armR = new THREE.Mesh(armGeo, bodyMat);
    armR.position.set(1.0, -0.16, 0.12);
    armR.rotation.z = -0.5;
    armR.castShadow = true;
    bodyGroup.add(armL, armR);

    // 眼睛（玻璃感）+ 高光
    function makeEye(sign) {
      const g = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.175, 32, 24), darkMat);
      g.add(ball);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi.position.set(0.055 * sign * -1, 0.07, 0.145);
      g.add(hi);
      const hi2 = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      hi2.position.set(-0.07 * sign * -1, -0.06, 0.15);
      g.add(hi2);
      g.position.set(0.345 * sign, 0.13, 0.885);
      g.rotation.y = sign * 0.18;
      return g;
    }
    const eyeL = makeEye(-1), eyeR = makeEye(1);
    bodyGroup.add(eyeL, eyeR);

    // 嘴（半环，旋转决定笑或撇嘴）
    const mouthGeo = new THREE.TorusGeometry(0.15, 0.027, 10, 36, Math.PI);
    const mouth = new THREE.Mesh(mouthGeo, darkMat);
    mouth.position.set(0, -0.26, 0.915);
    mouth.rotation.z = Math.PI;
    bodyGroup.add(mouth);

    // 腮红
    const blushGeo = new THREE.SphereGeometry(0.2, 24, 16);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.6, -0.17, 0.74);
    blushL.scale.set(1, 0.5, 0.22);
    const blushR = blushL.clone();
    blushR.position.x = 0.6;
    bodyGroup.add(blushL, blushR);

    // 桂花头饰
    const flower = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), flowerMat);
      const a = (i / 5) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0);
      petal.scale.set(1, 1, 0.62);
      flower.add(petal);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), flowerCoreMat);
    flower.add(core);
    flower.position.set(0.56, 0.79, 0.3);
    flower.rotation.set(0.35, -0.25, 0.2);
    flower.traverse(o => { if (o.isMesh) o.castShadow = true; });
    root.add(flower);

    // 接收阴影的地面（透明，只留下柔和的接触阴影）
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.ShadowMaterial({ opacity: 0.17 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.06;
    ground.receiveShadow = true;
    scene.add(ground);

    return { canvas, renderer, scene, camera, root, bodyGroup, eyeL, eyeR, mouth, blushL, blushR, armL, armR, flower };
  }

  function fit(inst, w, h) {
    const aspect = w / Math.max(1, h);
    const fov = inst.camera.fov * Math.PI / 180;
    const need = Math.max(FACE_Y, 1.15 / Math.min(1, aspect));
    inst.camera.position.z = (need / Math.tan(fov / 2)) * 1.14;
    inst.camera.lookAt(0, 0.02, 0);
    inst.camera.aspect = aspect;
    inst.camera.updateProjectionMatrix();
  }

  function mount(el, key, size, state) {
    let inst = instances.get(key);
    if (inst && inst.el !== el) { dispose(inst); instances.delete(key); inst = null; }
    if (!inst) {
      const core = makeRenderable();
      if (!core) return false;
      inst = Object.assign({ el, key, mood: state.mood || 'happy', react: null, blinkAt: 2.6, clock: 0 }, core);
      el.innerHTML = '';
      el.appendChild(core.canvas);
      instances.set(key, inst);
    }
    inst.mood = state.mood || inst.mood || 'happy';
    applyMood(inst, inst.mood);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = size, cssH = size;
    core_size(inst, cssW, cssH, dpr);
    return true;
  }

  function core_size(inst, w, h, dpr) {
    inst.el.style.width = w + 'px';
    inst.el.style.height = h + 'px';
    inst.el.style.display = 'inline-block';
    inst.renderer.setPixelRatio(dpr);
    inst.renderer.setSize(w, h, true);
    inst.canvas.style.width = w + 'px';
    inst.canvas.style.height = h + 'px';
    inst.canvas.style.display = 'block';
    fit(inst, w, h);
  }

  function applyMood(inst, mood) {
    const happy = mood !== 'worry' && mood !== 'cheer';
    inst.bodyGroup.rotation.x = 0;
    if (mood === 'cheer') {
      inst.eyeL.scale.set(1.05, 0.55, 1.05);
      inst.eyeR.scale.set(1.05, 0.55, 1.05);
      inst.mouth.rotation.z = Math.PI;
      inst.mouth.scale.set(1.28, 1.28, 1.28);
      inst.blushL.material.opacity = 0.95;
    } else if (mood === 'worry') {
      inst.eyeL.scale.set(0.95, 0.86, 0.95);
      inst.eyeR.scale.set(0.95, 0.86, 0.95);
      inst.mouth.rotation.z = 0;
      inst.mouth.scale.set(0.9, 0.9, 0.9);
      inst.blushL.material.opacity = 0.6;
    } else {
      inst.eyeL.scale.set(1, 1, 1);
      inst.eyeR.scale.set(1, 1, 1);
      inst.mouth.rotation.z = Math.PI;
      inst.mouth.scale.set(1, 1, 1);
      inst.blushL.material.opacity = 0.78;
    }
    inst.mood = mood;
  }

  function dispose(inst) {
    try {
      inst.scene.traverse(o => {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        if (o.material && o.material.dispose) o.material.dispose();
      });
      inst.renderer.dispose();
      const ctx = inst.renderer.getContext && inst.renderer.getContext();
      const lose = ctx && ctx.getExtension && ctx.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    } catch (e) {}
    if (inst.canvas && inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
  }

  function cleanup() {
    for (const [key, inst] of [...instances]) {
      if (!document.contains(inst.el)) { dispose(inst); instances.delete(key); }
    }
  }

  function react(kind) {
    const now = performance.now() / 1000;
    instances.forEach(inst => { inst.react = { kind, t0: now }; });
  }

  function mood(m) {
    instances.forEach(inst => applyMood(inst, m));
  }

  // ---------- 动画循环 ----------
  let last = performance.now() / 1000;
  function tick() {
    requestAnimationFrame(tick);
    const now = performance.now() / 1000;
    const dt = Math.min(0.05, now - last);
    last = now;
    instances.forEach(inst => {
      inst.clock += dt;
      const t = inst.clock;

      // 呼吸弹跳（挤压拉伸）
      const b = Math.sin(t * 2.15);
      const sy = 1 + 0.028 * b;
      const sxz = 1 - 0.018 * b;
      inst.bodyGroup.scale.set(sxz, sy, sxz);
      inst.root.position.y = 0.022 * Math.max(0, b);
      inst.root.rotation.z = Math.sin(t * 1.1) * 0.018;
      inst.armL.rotation.z = 0.5 + Math.sin(t * 2.15 + 0.4) * 0.14;
      inst.armR.rotation.z = -0.5 - Math.sin(t * 2.15 + 0.4) * 0.14;
      inst.flower.rotation.z = 0.2 + Math.sin(t * 1.6) * 0.12;

      // 眨眼
      if (t > inst.blinkAt) {
        const p = (t - inst.blinkAt) / 0.14;
        if (p < 1) {
          const k = 1 - Math.sin(Math.PI * p) * 0.9;
          inst.eyeL.scale.y = (inst.mood === 'cheer' ? 0.55 : inst.mood === 'worry' ? 0.86 : 1) * k;
          inst.eyeR.scale.y = inst.eyeL.scale.y;
        } else {
          applyMood(inst, inst.mood);
          inst.blinkAt = t + 2.6 + Math.random() * 2.4;
        }
      }

      // 反应动画
      if (inst.react) {
        const p = (now - inst.react.t0) / (inst.react.kind === 'wrong' ? 0.62 : 0.72);
        if (p >= 1) {
          inst.react = null;
          inst.root.position.y = 0;
          inst.root.rotation.z = 0;
        } else if (inst.react.kind === 'wrong') {
          inst.root.rotation.z = Math.sin(p * Math.PI * 3.2) * 0.3 * (1 - p);
          inst.root.position.y = -0.04 * Math.sin(p * Math.PI);
        } else {
          const jump = Math.sin(p * Math.PI);
          inst.root.position.y = 0.52 * jump;
          inst.bodyGroup.scale.y = 1 + 0.13 * Math.sin(p * Math.PI * 2) * (1 - Math.abs(p - 0.5) * 2);
          inst.root.rotation.z = Math.sin(p * Math.PI * 2) * 0.08;
        }
      }

      const visible = inst.el.offsetParent !== null && inst.el.offsetWidth > 0;
      if (visible) inst.renderer.render(inst.scene, inst.camera);
    });
  }
  requestAnimationFrame(tick);

  window.TY3D = { available: true, mount, cleanup, react, mood, instances };
})();
