'use strict';
// ── THREE.JS INIT ─────────────────────────────────────────
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x7ab8f5);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x7ab8f5, 0.006);

const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 200);
camera.position.set(0, 5, 13);
camera.lookAt(0, 0.5, -1);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// ── COORDINATE MAPPING ────────────────────────────────────
// 2D canvas: 420×680, 3D field: centred at origin
// Scale: divide by 50 → field ≈ 8.4 × 13.6 units
const SC = 1 / 50;
function to3(x2, y2) { return { x: (x2 - 210) * SC, z: (y2 - 340) * SC }; }

// GOAL zone in 2D: x 145→275, y 48→86  →  3D z ≈ -5.84
const GZ = { xMin: (145-210)*SC, xMax: (275-210)*SC, z: (67-340)*SC, h: 2.5, w: 130*SC };

// ── LIGHTING ─────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const sun = new THREE.DirectionalLight(0xfffdf5, 2.4);
sun.position.set(6, 14, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 24, bottom: -24, near: 0.1, far: 80 });
scene.add(sun);
const fill = new THREE.DirectionalLight(0x4488ff, 0.25);
fill.position.set(-6, 8, -6);
scene.add(fill);

// ── STAGE DATA ────────────────────────────────────────────
const CHAPTERS = [
  {
    id: 1, name: '챕터 1: 무명 신인의 데뷔',
    stages: [
      { id:0, title:'첫 슛', situation:'88분·0:0·마지막 공격 기회', goal:'골을 넣어라!', type:'score',
        players:[{id:0,x:210,y:480,name:'나'}], defenders:[], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.maxPower>=120?3:2):0 },
      { id:1, title:'첫 어시스트', situation:'75분·0:0·측면 공격', goal:'동료에게 패스 후 골!', type:'pass_then_score', minPasses:1,
        players:[{id:0,x:120,y:460,name:'나'},{id:1,x:300,y:330,name:'윤성'}],
        defenders:[{id:0,x:210,y:360,speed:2.5}], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.passes>=1?3:1):0 },
      { id:2, title:'세 번의 패스', situation:'82분·1:2·역전의 기회', goal:'3번 패스 후 골!', type:'combo', minPasses:2,
        players:[{id:0,x:100,y:500,name:'나'},{id:1,x:290,y:390,name:'윤성'},{id:2,x:210,y:290,name:'박준'}],
        defenders:[{id:0,x:180,y:440,speed:2.8},{id:1,x:320,y:340,speed:2.5}], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.passes>=3?3:r.passes>=2?2:1):0 },
      { id:3, title:'감아차기', situation:'90분·0:1·프리킥!', goal:'감아차기로 골!', type:'curve', mustCurve:true,
        players:[{id:0,x:155,y:440,name:'나'}],
        defenders:[{id:0,x:195,y:360,speed:0,isWall:true},{id:1,x:220,y:360,speed:0,isWall:true},{id:2,x:245,y:360,speed:0,isWall:true}],
        gk:{x:270,y:110}, calcStars:(r)=> r.scored?(r.curved?3:1):0 },
      { id:4, title:'시간과의 싸움', situation:'94분·0:1·마지막 공격!', goal:'8초 안에 골!', type:'timed', timeLimit:8,
        players:[{id:0,x:210,y:460,name:'나'},{id:1,x:330,y:350,name:'윤성'}],
        defenders:[{id:0,x:250,y:370,speed:3},{id:1,x:165,y:300,speed:2.8}], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.timeLeft>=4?3:2):0 },
    ],
  },
  {
    id: 2, name: '챕터 2: 주전 경쟁',
    stages: [
      { id:5, title:'경쟁자', situation:'70분·0:0·돌파 찬스', goal:'수비수를 피해 골!', type:'score',
        players:[{id:0,x:210,y:500,name:'나'}],
        defenders:[{id:0,x:165,y:380,speed:3.2},{id:1,x:255,y:380,speed:3.2}], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.actions<=1?3:2):0 },
      { id:6, title:'역습', situation:'55분·0:1·카운터 어택!', goal:'2패스 이상 연결 후 득점!', type:'combo', minPasses:1,
        players:[{id:0,x:80,y:520,name:'나'},{id:1,x:340,y:380,name:'정민'},{id:2,x:200,y:290,name:'윤성'}],
        defenders:[{id:0,x:225,y:440,speed:3},{id:1,x:285,y:330,speed:3}], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.passes>=3?3:r.passes>=2?2:1):0 },
      { id:7, title:'패널티 킥', situation:'87분·1:1·페널티 킥!', goal:'골키퍼를 속여라!', type:'penalty',
        players:[{id:0,x:210,y:360,name:'나'}], defenders:[], gk:{x:210,y:110,isAlert:true,speed:5},
        calcStars:(r)=> r.scored?(r.cornerShot?3:2):0 },
      { id:8, title:'세트피스', situation:'89분·0:1·코너킥!', goal:'코너킥으로 동점골!', type:'combo', minPasses:1,
        players:[{id:0,x:390,y:560,name:'나'},{id:1,x:210,y:280,name:'윤성'},{id:2,x:285,y:240,name:'박준'}],
        defenders:[{id:0,x:180,y:270,speed:2.8},{id:1,x:250,y:255,speed:2.8}], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.passes>=2?3:2):0 },
      { id:9, title:'클러치 모먼트', situation:'90+3분·1:2·최후의 역전!', goal:'3패스 이상 후 역전골!', type:'combo', minPasses:3, timeLimit:15,
        players:[{id:0,x:210,y:530,name:'나'},{id:1,x:340,y:400,name:'윤성'},{id:2,x:95,y:380,name:'정민'},{id:3,x:265,y:280,name:'박준'}],
        defenders:[{id:0,x:285,y:450,speed:3.2},{id:1,x:140,y:375,speed:3},{id:2,x:225,y:300,speed:3.5}], gk:{x:210,y:110},
        calcStars:(r)=> r.scored?(r.passes>=4?3:r.passes>=3?2:1):0 },
    ],
  },
];

// ── SAVE ─────────────────────────────────────────────────
function loadSave(){ try{ return JSON.parse(localStorage.getItem('cs3d')||'null'); }catch{ return null; } }
function doSave(){ localStorage.setItem('cs3d', JSON.stringify({ stars: G.stars })); }

// ── TACTICS ──────────────────────────────────────────────
const TACTICS = [
  { name:'침투 우선', icon:'▶▶', desc:'수비 속도 -20%\n패스 범위 +10px' },
  { name:'측면 전개', icon:'↔',  desc:'슛 각도 보너스\n짧은 패스 정확도 ↑' },
  { name:'원투 패스', icon:'↩',  desc:'패스 후 빠른 연결\n패스 속도 +20%' },
];

// ── GLOBAL STATE ─────────────────────────────────────────
const sv = loadSave();
const G = {
  screen: 'title',
  chapter: 0, stage: 0, tactic: 0,
  stars: sv ? sv.stars : Array(10).fill(0),
  play: null, result: null,
};

// ── 3D SCENE OBJECTS ──────────────────────────────────────
let ballMesh, playerMeshes = [], defMeshes = [], gkMesh, bgMeshes = [];
let selRing, aimLine, aimLinePts = [], powerRing;
let aimDotPool = [], ballGroundShadow;
let particles = [], ptMesh;

function makeMat(color, rough=0.7, metal=0.1){
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}

function buildField() {
  // Grass base — vibrant pitch green (larger than line markings for realistic apron)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 22),
    makeMat(0x2a9e42, 0.88, 0)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Mowing stripes across full grass area
  for (let i = 0; i < 11; i++) {
    if (i % 2 === 0) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), makeMat(0x2eb84e, 0.88, 0));
      s.rotation.x = -Math.PI / 2;
      s.position.set(0, 0.001, -10 + i * 2 + 1);
      s.receiveShadow = true;
      scene.add(s);
    }
  }

  // White lines helper
  const lm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  function line(...pts) {
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(([x,z])=> new THREE.Vector3(x,0.005,z)));
    scene.add(new THREE.Line(geo, lm));
  }
  line([-4.2,-6.8],[4.2,-6.8],[4.2,6.8],[-4.2,6.8],[-4.2,-6.8]); // border
  line([-4.2,0],[4.2,0]); // centre
  const cc=[]; for(let i=0;i<=64;i++){const a=i/64*Math.PI*2; cc.push([Math.cos(a)*0.96,Math.sin(a)*0.96]);} line(...cc); // centre circle
  line([-2.2,-6.8],[-2.2,-4.9],[2.2,-4.9],[2.2,-6.8]); // penalty box
  line([-1.1,-6.8],[-1.1,-5.8],[1.1,-5.8],[1.1,-6.8]); // goal box

  // Penalty spot
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.05,16), new THREE.MeshBasicMaterial({color:0xffffff}));
  dot.rotation.x = -Math.PI/2; dot.position.set(0,0.006,-4.9); scene.add(dot);
}

function buildGoal() {
  const pm = makeMat(0xf5c518, 0.4, 0.5);
  const pr = 0.06;
  function post(x,y,z,rx=0,ry=0,rz=0,h=GZ.h){
    const m = new THREE.Mesh(new THREE.CylinderGeometry(pr,pr,h,10), pm);
    m.position.set(x,y,z); m.rotation.set(rx,ry,rz); m.castShadow=true; scene.add(m);
  }
  post(GZ.xMin, GZ.h/2, GZ.z); // left post
  post(GZ.xMax, GZ.h/2, GZ.z); // right post
  post(0, GZ.h, GZ.z, 0,0,Math.PI/2, GZ.w); // crossbar

  // Net (wireframe plane)
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(GZ.w, GZ.h, 8, 6),
    new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.12, wireframe:true, side:THREE.DoubleSide })
  );
  net.position.set(0, GZ.h/2, GZ.z-0.3); scene.add(net);

  // Goal floor glow
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(GZ.w, 0.5),
    new THREE.MeshBasicMaterial({ color:0xf5c518, transparent:true, opacity:0.22 })
  );
  glow.rotation.x=-Math.PI/2; glow.position.set(0,0.003,GZ.z); scene.add(glow);

  // Stadium lights (optional spheres above posts)
  const lm2 = makeMat(0xfff5cc, 0.2, 0.8);
  [-4.5,4.5].forEach(x=>{
    const lb = new THREE.Mesh(new THREE.SphereGeometry(0.18,8,8), lm2);
    lb.position.set(x,6,-3); scene.add(lb);
    const pl = new THREE.PointLight(0xfff5cc, 0.6, 18);
    pl.position.set(x,5.5,-3); scene.add(pl);
  });
}

function makePlayerMesh(color) {
  const g = new THREE.Group();
  const jMat = makeMat(color);
  const sMat = makeMat(0xffcba4, 0.85, 0);   // skin
  const wMat = makeMat(0xf0f0f0, 0.8, 0);    // white shorts/socks
  const bMat = makeMat(0x111111, 0.95, 0);   // boots
  const hMat = makeMat(0x3d2b1f, 0.9, 0);    // hair

  // Ground shadow
  const shd = new THREE.Mesh(new THREE.CircleGeometry(0.22,16),
    new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:0.22,side:THREE.DoubleSide}));
  shd.rotation.x=-Math.PI/2; shd.position.y=0.005; g.add(shd);

  // Leg pivot groups — pivot sits at hip height (y=0.36) so rotation.x swings leg
  function makeLeg(xOff) {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 0.36, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072,0.065,0.17,6),sMat);
    thigh.position.y=-0.085; thigh.castShadow=true; pivot.add(thigh);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.058,0.054,0.19,6),wMat);
    sock.position.y=-0.19; sock.castShadow=true; pivot.add(sock);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11,0.07,0.18),bMat);
    boot.position.set(0,-0.325,0.025); boot.castShadow=true; pivot.add(boot);
    g.add(pivot); return pivot;
  }
  const lLeg = makeLeg(-0.09);
  const rLeg = makeLeg(0.09);

  // Shorts (static, covers hips)
  const shorts = new THREE.Mesh(new THREE.CylinderGeometry(0.155,0.14,0.18,8),wMat);
  shorts.position.y=0.36; shorts.castShadow=true; g.add(shorts);

  // Torso (jersey)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.31,0.37,0.19),jMat);
  torso.position.y=0.63; torso.castShadow=true; g.add(torso);

  // Arm pivot groups — pivot at shoulder (y=0.82), arm hangs below
  function makeArm(xOff, rzBase) {
    const pivot = new THREE.Group();
    pivot.position.set(xOff, 0.82, 0);
    pivot.rotation.z = rzBase;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.056,0.048,0.32,6),jMat);
    arm.position.y=-0.16; arm.castShadow=true; pivot.add(arm);
    g.add(pivot); return pivot;
  }
  const lArm = makeArm(-0.24, Math.PI/9);
  const rArm = makeArm(0.24, -Math.PI/9);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068,0.072,0.1,6),sMat);
  neck.position.y=0.87; g.add(neck);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145,12,10),sMat);
  head.position.y=1.05; head.castShadow=true; g.add(head);
  // Hair cap (upper hemisphere)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.15,12,8,0,Math.PI*2,0,Math.PI*0.46),hMat);
  hair.position.y=1.05; g.add(hair);

  // Store limb refs for per-frame animation
  g.userData.lLeg = lLeg; g.userData.rLeg = rLeg;
  g.userData.lArm = lArm; g.userData.rArm = rArm;
  return g;
}

function makeBallMesh() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18,24,24), makeMat(0xffffff,0.3,0.15));
  ball.castShadow=true; g.add(ball);
  // seam lines
  const seam = new THREE.Mesh(new THREE.SphereGeometry(0.183,8,8),
    new THREE.MeshBasicMaterial({color:0x222222,wireframe:true,transparent:true,opacity:0.45}));
  g.add(seam);
  // ground shadow
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.18,16),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28}));
  sh.rotation.x=-Math.PI/2; sh.position.y=-0.17; g.add(sh);
  return g;
}

function makeSelRing() {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(0.42,0.06,8,32),
    new THREE.MeshBasicMaterial({color:0xfacc15,transparent:true,opacity:0.9})
  );
  r.rotation.x=Math.PI/2; r.position.y=0.04; r.visible=false; scene.add(r); return r;
}

function makeAimLine() {
  const pts=[new THREE.Vector3(0,0.1,0),new THREE.Vector3(0,0.1,0)];
  const geo=new THREE.BufferGeometry().setFromPoints(pts);
  const m=new THREE.Line(geo,new THREE.LineDashedMaterial({color:0xfacc15,dashSize:0.18,gapSize:0.09,transparent:true,opacity:0.9}));
  m.computeLineDistances(); m.visible=false; scene.add(m); return m;
}

function makePowerRing() {
  const r = new THREE.Mesh(
    new THREE.TorusGeometry(0.5, 0.045, 8, 32),
    new THREE.MeshBasicMaterial({color:0xfacc15, transparent:true, opacity:0.82})
  );
  r.rotation.x = Math.PI/2; r.position.y = 0.06; r.visible = false;
  scene.add(r); return r;
}

// Dot-trail trajectory indicator (Score!-Hero style)
const DOT_N = 14;
function makeAimDots() {
  const geo = new THREE.CircleGeometry(0.09, 10);
  for (let i = 0; i < DOT_N; i++) {
    const m = new THREE.Mesh(geo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.045;
    m.visible = false;
    scene.add(m);
    aimDotPool.push(m);
  }
}

// Ground shadow blob that stays at y=0 and scales with ball height
function initBallShadow() {
  ballGroundShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.24, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
  );
  ballGroundShadow.rotation.x = -Math.PI / 2;
  ballGroundShadow.position.y = 0.01;
  ballGroundShadow.visible = false;
  scene.add(ballGroundShadow);
}

// Particle pool for goals
function initParticles() {
  const count=80;
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3);
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  ptMesh=new THREE.Points(geo,new THREE.PointsMaterial({color:0xfacc15,size:0.18,transparent:true,opacity:0}));
  scene.add(ptMesh);
  for(let i=0;i<count;i++) particles.push({vx:0,vy:0,vz:0,life:0,i});
}

// ── INPUT ─────────────────────────────────────────────────
const ray = new THREE.Raycaster();
const fieldPlane = new THREE.Plane(new THREE.Vector3(0,1,0), 0); // y=0
const mouse2D = new THREE.Vector2();
let dragStart3 = null; // THREE.Vector3 of ball-holder when drag starts
let isCurved = false;

function getFieldPos(e) {
  const src = e.touches ? e.touches[0] || e.changedTouches[0] : e;
  mouse2D.set(
    (src.clientX / window.innerWidth) * 2 - 1,
    -(src.clientY / window.innerHeight) * 2 + 1
  );
  ray.setFromCamera(mouse2D, camera);
  const hit = new THREE.Vector3();
  ray.ray.intersectPlane(fieldPlane, hit);
  return hit; // 3D point on y=0 plane
}

function dist3(a, b) { return Math.hypot(a.x-b.x, a.z-b.z); }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('touchstart', e=>{ e.preventDefault(); onPointerDown(e); }, {passive:false});
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('touchend', e=>{ e.preventDefault(); onPointerUp(e); }, {passive:false});
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('touchmove', e=>{ e.preventDefault(); onPointerMove(e); }, {passive:false});

function onPointerDown(e) {
  if (G.screen !== 'play' || !G.play) return;
  const play = G.play;
  if (play.phase !== 'idle') return;
  // Tap anywhere — aim starts from ball holder
  const holder = play.players[play.ballHolder];
  const hp = to3(holder.x, holder.y);
  play.phase = 'aiming';
  dragStart3 = new THREE.Vector3(hp.x, 0, hp.z);
  powerRing.position.set(hp.x, 0.06, hp.z);
  powerRing.scale.setScalar(0.3);
  powerRing.visible = true;
}

function onPointerMove(e) {
  if (G.screen !== 'play' || !G.play || G.play.phase !== 'aiming') return;
  const fp = getFieldPos(e);
  if (!fp || !dragStart3) return;
  updateAimDots(dragStart3, fp);
  // Power ring scale + color
  const dx = fp.x - dragStart3.x, dz = fp.z - dragStart3.z;
  const power = clamp(Math.hypot(dx, dz) / 3.2, 0, 1);
  powerRing.scale.setScalar(0.3 + power * 2.8);
  powerRing.material.color.setHex(power > 0.65 ? 0xef4444 : power > 0.35 ? 0xf97316 : 0xfacc15);
}

function onPointerUp(e) {
  if (G.screen !== 'play' || !G.play) return;
  const play = G.play;
  if (play.phase !== 'aiming') return;
  const fp = getFieldPos(e);
  powerRing.visible = false;
  hideAimDots();
  if (!fp || !dragStart3) { play.phase='idle'; return; }
  const dx = fp.x - dragStart3.x, dz = fp.z - dragStart3.z;
  const power3 = clamp(Math.hypot(dx,dz), 0, 3.2); // 3.2 = MAX_DRAG/50
  if (power3 < 0.24) { play.phase='idle'; return; }
  executeShot(play, dragStart3.x, dragStart3.z, dx, dz, power3, isCurved);
}

function updateAimLine(from, to) {
  // Keep hidden — dots are used instead
  aimLine.visible = false;
}

function updateAimDots(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const dist = Math.hypot(dx, dz);
  // Clamp endpoint so dots don't extend too far
  const maxDist = 3.5;
  const ratio = dist > maxDist ? maxDist / dist : 1;
  const ex = from.x + dx * ratio, ez = from.z + dz * ratio;

  for (let i = 0; i < DOT_N; i++) {
    const t = (i + 1) / (DOT_N + 1);
    let x, z;
    if (isCurved) {
      const cx = (from.x + ex) / 2 + (ez - from.z) * 0.4;
      const cz = (from.z + ez) / 2 - (ex - from.x) * 0.4;
      const u = 1 - t;
      x = u*u*from.x + 2*u*t*cx + t*t*ex;
      z = u*u*from.z + 2*u*t*cz + t*t*ez;
    } else {
      x = from.x + (ex - from.x) * t;
      z = from.z + (ez - from.z) * t;
    }
    const dot = aimDotPool[i];
    dot.position.set(x, 0.045, z);
    // Dots shrink and fade toward the end
    const scale = 1.1 - t * 0.55;
    dot.scale.setScalar(scale);
    dot.material.opacity = 0.95 - t * 0.5;
    dot.visible = true;
  }
}

function hideAimDots() {
  aimDotPool.forEach(d => { d.visible = false; });
}

document.getElementById('btn-curve').addEventListener('click', ()=>{
  isCurved = !isCurved;
  document.getElementById('btn-curve').classList.toggle('active', isCurved);
  if (G.play) G.play.curved = isCurved;
});

// ── GAME LOGIC ────────────────────────────────────────────
function initPlay(ci, si) {
  const st = CHAPTERS[ci].stages[si];
  const defSpeedMul = G.tactic === 0 ? 0.8 : 1;
  G.play = {
    st,
    players: st.players.map(p=>({...p,isTeam:p.id!==0})),
    defenders: st.defenders.map(d=>({...d, speed: d.isWall?0:d.speed*defSpeedMul})),
    gk: {...st.gk},
    ball: { x: st.players[0].x, y: st.players[0].y },
    ballAnim: null,
    ballHolder: 0,
    phase: 'idle',
    passes: 0, actions: 0, maxPower: 0,
    curved: false, cornerShot: false,
    timeLeft: st.timeLimit || 0,
    flashTimer: 0, goalTimer: 0, failCount: 0, pulse: 0,
  };
  isCurved = false;
  document.getElementById('btn-curve').classList.remove('active');
  spawnActors();
  updateHUD();
}

function resetPlay(play) {
  const st = play.st;
  const defSpeedMul = G.tactic === 0 ? 0.8 : 1;
  play.players = st.players.map(p=>({...p,isTeam:p.id!==0}));
  play.defenders = st.defenders.map(d=>({...d, speed:d.isWall?0:d.speed*defSpeedMul}));
  play.gk = {...st.gk};
  play.ball = { x: st.players[0].x, y: st.players[0].y };
  play.ballAnim = null; play.ballHolder = 0; play.phase = 'idle';
  play.passes = 0; play.actions = 0; play.maxPower = 0;
  play.curved = false; play.cornerShot = false;
  play.timeLeft = st.timeLimit || 0; play.flashTimer = 0;
  spawnActors(); updateHUD();
}

function executeShot(play, fx, fz, dx, dz, power3, curved) {
  const len = Math.hypot(dx,dz)||1;
  const ndx=dx/len, ndz=dz/len;
  const snapR = G.tactic===0 ? 1.0 : 0.8;

  // Pass detection
  let snapTarget = null;
  if (power3 < 2.8) {
    for (const pl of play.players) {
      if (pl === play.players[play.ballHolder]) continue;
      const p3 = to3(pl.x, pl.y);
      const pdx=p3.x-fx, pdz=p3.z-fz;
      const proj = pdx*ndx+pdz*ndz;
      if (proj < 0) continue;
      const perp = Math.abs(pdx*ndz - pdz*ndx);
      if (perp < snapR && proj < power3*2.5) {
        if (!snapTarget || proj < (snapTarget._proj||Infinity)) { snapTarget=pl; snapTarget._proj=proj; }
      }
    }
  }

  play.actions++;
  if (curved) play.curved = true;

  if (snapTarget) {
    play.phase = 'flying';
    const t3 = to3(snapTarget.x, snapTarget.y);
    const speedMul = G.tactic===2 ? 1.2 : 1;
    startAnim(play, fx, fz, t3.x, t3.z, curved, false, ()=>{
      play.ballHolder = play.players.indexOf(snapTarget);
      play.passes++;
      play.ball.x = snapTarget.x; play.ball.y = snapTarget.y;
      play.phase = 'idle';
      updateHUD();
    });
  } else {
    const shotDist = 6 + power3;
    const tx = fx + ndx*shotDist, tz = fz + ndz*shotDist;
    play.phase = 'flying';
    play.maxPower = Math.max(play.maxPower, power3*50);
    // Corner shot check
    const tx2d = tx/SC+210;
    if (tx2d < 145+30 || tx2d > 275-30) play.cornerShot = true;
    startAnim(play, fx, fz, tx, tz, curved, true, ()=>{
      if (checkGoal(play)) {
        play.phase = 'goal'; play.goalTimer = 0;
        spawnParticles(play.ball.x, play.ball.y);
      } else {
        triggerFail(play);
      }
    });
  }
}

function startAnim(play, sx, sz, tx, tz, curved, isShot, onDone) {
  const dist2d = Math.hypot(tx-sx, tz-sz);
  const arcH = isShot ? dist2d * 0.3 : dist2d * 0.12;
  const cx = curved ? (sx+tx)/2+(tz-sz)*0.4 : (sx+tx)/2;
  const cz = curved ? (sz+tz)/2-(tx-sx)*0.4 : (sz+tz)/2;
  play.ballAnim = { sx,sz,cx,cz,tx,tz,arcH,t:0,onDone };
}

function tickAnim(play, dt) {
  const a = play.ballAnim;
  if (!a) return;
  a.t += dt * 0.045;
  if (a.t >= 1) a.t = 1;
  const t=a.t, u=1-t;
  play.ball.x = (u*u*a.sx+2*u*t*a.cx+t*t*a.tx)/SC+210;
  play.ball.y = (u*u*a.sz+2*u*t*a.cz+t*t*a.tz)/SC+340;
  // arc height stored in 3D coords → convert back via SC
  if (ballMesh) ballMesh.position.y = 0.18 + a.arcH * Math.sin(Math.PI*t);
  if (a.t >= 1) { play.ballAnim=null; if(ballMesh) ballMesh.position.y=0.18; a.onDone(); }
}

function checkGoal(play) {
  const b3 = to3(play.ball.x, play.ball.y);
  return b3.x >= GZ.xMin && b3.x <= GZ.xMax && b3.z <= GZ.z+0.3 && b3.z >= GZ.z-0.8;
}

function checkIntercept(play) {
  for (const d of play.defenders) {
    const d3=to3(d.x,d.y), b3=to3(play.ball.x,play.ball.y);
    if (Math.hypot(d3.x-b3.x,d3.z-b3.z) < 0.38+0.18) return true;
  }
  return false;
}

function checkGKSave(play) {
  const g3=to3(play.gk.x,play.gk.y), b3=to3(play.ball.x,play.ball.y);
  return Math.hypot(g3.x-b3.x,g3.z-b3.z) < 0.44+0.18;
}

function triggerFail(play) {
  play.failCount++; play.phase='fail'; play.flashTimer=0;
  renderer.setClearColor(0x3b0000);
}

function tickDefenders(play, dt) {
  const b3 = to3(play.ball.x, play.ball.y);
  play.defenders.forEach(d=>{
    if (d.isWall||d.speed===0) return;
    const d3=to3(d.x,d.y);
    const dx=b3.x-d3.x, dz=b3.z-d3.z, len=Math.hypot(dx,dz)||1;
    const spd = d.speed*SC*dt*0.06;
    d.x += dx/len*spd/SC; d.y += dz/len*spd/SC;
  });
  // GK track ball X
  const gkSpd = (play.gk.speed||3.5)*SC*dt*0.06;
  if (play.phase==='flying') {
    const diff = b3.x - to3(play.gk.x,play.gk.y).x;
    play.gk.x += Math.sign(diff)*Math.min(Math.abs(diff)/SC, gkSpd/SC);
    play.gk.x = Math.max(145+5, Math.min(275-5, play.gk.x));
  }
}

// ── PARTICLES ─────────────────────────────────────────────
function spawnParticles(bx2d, by2d) {
  const p3 = to3(bx2d, by2d);
  particles.forEach(p=>{
    const a=Math.random()*Math.PI*2;
    const spd=1.5+Math.random()*3;
    p.x=p3.x; p.y=0.5; p.z=p3.z;
    p.vx=Math.cos(a)*spd*0.05; p.vy=0.06+Math.random()*0.1; p.vz=Math.sin(a)*spd*0.05;
    p.life=1;
  });
  ptMesh.material.opacity=1; ptMesh.material.color.setHex(0xfacc15);
}

function tickParticles() {
  let alive=false;
  const pos=ptMesh.geometry.attributes.position.array;
  particles.forEach(p=>{
    if(p.life<=0){ pos[p.i*3]=0; pos[p.i*3+1]=-5; pos[p.i*3+2]=0; return; }
    p.x+=p.vx; p.y+=p.vy; p.z+=p.vz; p.vy-=0.004; p.life-=0.025;
    pos[p.i*3]=p.x; pos[p.i*3+1]=p.y; pos[p.i*3+2]=p.z;
    if(p.life>0) alive=true;
  });
  ptMesh.geometry.attributes.position.needsUpdate=true;
  if(!alive) ptMesh.material.opacity=0;
}

// ── ACTOR SPAWN + SYNC ────────────────────────────────────
function spawnActors() {
  // Clear old
  [...playerMeshes, ...defMeshes, ...bgMeshes].forEach(m=>scene.remove(m));
  if(gkMesh) scene.remove(gkMesh);
  playerMeshes=[]; defMeshes=[]; bgMeshes=[];

  const play=G.play;
  play.players.forEach(p=>{
    const m = makePlayerMesh(p.isTeam?0x16a34a:0x1d4ed8);
    const p3=to3(p.x,p.y); m.position.set(p3.x,0,p3.z); scene.add(m); playerMeshes.push(m);
  });
  play.defenders.forEach(d=>{
    const m = makePlayerMesh(d.isWall?0x991b1b:0xdc2626);
    const d3=to3(d.x,d.y); m.position.set(d3.x,0,d3.z); scene.add(m); defMeshes.push(m);
  });
  gkMesh = makePlayerMesh(0xd97706);
  const g3=to3(play.gk.x,play.gk.y); gkMesh.position.set(g3.x,0,g3.z); scene.add(gkMesh);

  // Ball
  if(ballMesh) scene.remove(ballMesh);
  ballMesh = makeBallMesh();
  const b3=to3(play.ball.x,play.ball.y); ballMesh.position.set(b3.x,0.18,b3.z); scene.add(ballMesh);

  // 11v11: dynamically fill remaining slots with background players
  // Blue team: play.players already spawned → need 11 - play.players.length more
  // Red team: play.defenders + GK already spawned → need 11 - play.defenders.length - 1 more
  const bgBlueFull = [
    {x:130,y:612},{x:165,y:607},{x:210,y:614},{x:255,y:607},{x:290,y:612}, // defensive line
    {x:148,y:565},{x:183,y:560},{x:210,y:558},{x:237,y:560},{x:275,y:565}, // midfield line
  ];
  const bgRedFull = [
    {x:130,y:140},{x:165,y:135},{x:210,y:138},{x:255,y:135},{x:290,y:140}, // defensive line (behind GK)
    {x:148,y:208},{x:183,y:203},{x:210,y:200},{x:237,y:203},{x:275,y:208}, // midfield line
  ];
  const blueExtra = Math.max(0, 11 - play.players.length);
  const redExtra  = Math.max(0, 11 - play.defenders.length - 1); // -1 for GK
  bgBlueFull.slice(0, blueExtra).forEach(p=>{
    const m=makePlayerMesh(0x1d4ed8);
    const p3=to3(p.x,p.y); m.position.set(p3.x,0,p3.z); scene.add(m); bgMeshes.push(m);
  });
  bgRedFull.slice(0, redExtra).forEach(p=>{
    const m=makePlayerMesh(0xdc2626);
    const p3=to3(p.x,p.y); m.position.set(p3.x,0,p3.z); scene.add(m); bgMeshes.push(m);
  });

  // Sel ring follows ball holder
  scene.remove(selRing);
  const hp=to3(play.players[play.ballHolder].x, play.players[play.ballHolder].y);
  selRing.position.set(hp.x,0.04,hp.z); scene.add(selRing); selRing.visible=true;
}

function syncActors(play, pulse) {
  // Ball-holder idle sway + leg rock
  play.players.forEach((p,i) => {
    const m = playerMeshes[i];
    const p3 = to3(p.x, p.y);
    m.position.set(p3.x, 0, p3.z);
    const ud = m.userData;
    if (i === play.ballHolder) {
      m.scale.setScalar(1 + 0.05 * Math.sin(pulse * 0.12));
      if (ud.lLeg) {
        const idle = Math.sin(pulse * 0.05) * 0.08;
        ud.lLeg.rotation.x =  idle; ud.rLeg.rotation.x = -idle;
        ud.lArm.rotation.x = -idle * 0.5; ud.rArm.rotation.x = idle * 0.5;
      }
    } else {
      m.scale.setScalar(1);
    }
  });

  // Defenders: running animation + face movement direction
  play.defenders.forEach((d,i) => {
    const m = defMeshes[i];
    const d3 = to3(d.x, d.y);
    const prevX = m.position.x, prevZ = m.position.z;
    m.position.set(d3.x, 0, d3.z);
    if (!d.isWall) {
      const mvx = d3.x - prevX, mvz = d3.z - prevZ;
      if (Math.hypot(mvx, mvz) > 0.0005) m.rotation.y = Math.atan2(-mvx, -mvz);
      const ud = m.userData;
      if (ud.lLeg) {
        const s = Math.sin(pulse * 0.07 + i * 1.2) * 0.45;
        ud.lLeg.rotation.x =  s; ud.rLeg.rotation.x = -s;
        ud.lArm.rotation.x = -s * 0.5; ud.rArm.rotation.x = s * 0.5;
      }
    }
  });

  // GK faces field, shuffles side to side
  const g3 = to3(play.gk.x, play.gk.y);
  gkMesh.position.set(g3.x, 0, g3.z);
  gkMesh.rotation.y = Math.PI;
  const gkUD = gkMesh.userData;
  if (gkUD.lLeg) {
    const gs = Math.sin(pulse * 0.09) * 0.15;
    gkUD.lLeg.rotation.x = gs; gkUD.rLeg.rotation.x = -gs;
  }

  // Ball position
  const b3 = to3(play.ball.x, play.ball.y);
  if (ballMesh) { ballMesh.position.x = b3.x; ballMesh.position.z = b3.z; }

  // Spin ball perpendicular to travel direction during flight
  if (play.phase === 'flying' && ballMesh && play.ballAnim) {
    const a = play.ballAnim;
    const tdx = a.tx - a.sx, tdz = a.tz - a.sz;
    const len = Math.hypot(tdx, tdz) || 1;
    ballMesh.rotation.x += (tdz / len) * 0.18;
    ballMesh.rotation.z -= (tdx / len) * 0.18;
  }

  // Dynamic ground shadow under ball
  if (ballGroundShadow && ballMesh) {
    ballGroundShadow.position.x = ballMesh.position.x;
    ballGroundShadow.position.z = ballMesh.position.z;
    const h = Math.max(0, ballMesh.position.y - 0.18);
    ballGroundShadow.scale.setScalar(Math.max(0.25, 1 - h * 0.1));
    ballGroundShadow.material.opacity = Math.max(0.04, 0.38 - h * 0.06);
    ballGroundShadow.visible = (play.phase === 'flying');
  }

  // Sel ring pulses around ball holder
  const hp = to3(play.players[play.ballHolder].x, play.players[play.ballHolder].y);
  selRing.position.set(hp.x, 0.04, hp.z);
  selRing.visible = play.phase === 'idle' || play.phase === 'aiming';
  selRing.material.opacity = 0.6 + 0.3 * Math.sin(pulse * 0.12);
}

// ── HUD ───────────────────────────────────────────────────
function updateHUD() {
  const play=G.play; if(!play) return;
  document.getElementById('hud-title').textContent=play.st.title;
  document.getElementById('hud-passes').textContent=`패스: ${play.passes}`;
  document.getElementById('hud-fails').textContent=`실패: ${play.failCount}/3`;
  const timeEl=document.getElementById('hud-time');
  if(play.st.timeLimit){ timeEl.textContent=`⏱ ${Math.ceil(Math.max(0,play.timeLeft))}s`; timeEl.className=play.timeLeft<=3?'urgent':''; }
  else timeEl.textContent='';
  document.getElementById('hud-goal-text').textContent=play.st.goal;
}

// ── SCREEN MANAGER ────────────────────────────────────────
function showScreen(id) {
  ['screen-title','screen-select','screen-tactic','screen-result'].forEach(s=>{
    document.getElementById(s).classList.toggle('hidden', s!==id);
  });
  const playing = id===null;
  document.getElementById('hud').classList.toggle('hidden',!playing);
  document.getElementById('hud-goal-text').style.display=playing?'':'none';
  document.getElementById('btn-curve').style.display=playing?'':'none';
  G.screen = playing?'play':id.replace('screen-','');
}

function buildSelectScreen() {
  const cont=document.getElementById('chapters-container');
  cont.innerHTML='';
  cont.style.cssText='display:flex;flex-direction:column;gap:12px;';
  CHAPTERS.forEach((ch,ci)=>{
    const block=document.createElement('div'); block.className='chapter-block';
    const nm=document.createElement('div'); nm.className='chapter-name'; nm.textContent=ch.name; block.appendChild(nm);
    const grid=document.createElement('div'); grid.className='stage-grid';
    ch.stages.forEach((st,si)=>{
      const gi=ci*5+si;
      const unlocked=gi===0||G.stars[gi-1]>0||G.stars[gi]>0;
      const btn=document.createElement('button');
      btn.className='stage-btn'+(G.stars[gi]===3?' done':unlocked?' unlocked':'');
      btn.disabled=!unlocked;
      btn.innerHTML=`<span class="stage-num">${gi+1}</span><span class="stage-stars">${'★'.repeat(G.stars[gi])}${'☆'.repeat(3-G.stars[gi])}</span><span class="stage-lbl">${st.title}</span>`;
      btn.addEventListener('click',()=>{ G.chapter=ci; G.stage=si; G.tactic=0; buildTacticScreen(); showScreen('screen-tactic'); });
      grid.appendChild(btn);
    });
    block.appendChild(grid); cont.appendChild(block);
  });
}

function buildTacticScreen() {
  const st=CHAPTERS[G.chapter].stages[G.stage];
  const gi=G.chapter*5+G.stage;
  document.getElementById('tactic-title-el').textContent=st.title;
  document.getElementById('tactic-sit-el').textContent=st.situation;
  document.getElementById('tactic-goal-el').textContent=st.goal;
  const cont=document.getElementById('tactics-container'); cont.innerHTML='';
  TACTICS.forEach((t,i)=>{
    const card=document.createElement('div');
    card.className='tactic-card'+(G.tactic===i?' sel':'');
    card.innerHTML=`<div class="tac-icon">${t.icon}</div><div class="tac-name">${t.name}</div><div class="tac-desc">${t.desc.replace('\n','<br>')}</div>`;
    card.addEventListener('click',()=>{ G.tactic=i; buildTacticScreen(); });
    cont.appendChild(card);
  });
}

function showResult(scored, stars, passes, timeLeft) {
  G.result={scored,stars,passes,timeLeft};
  const gi=G.chapter*5+G.stage;
  document.getElementById('result-header').textContent=scored?'⚽ GOAL!':'실패...';
  document.getElementById('result-header').className=scored?'ok':'fail';
  document.getElementById('result-stars-el').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);
  document.getElementById('result-stats-el').textContent=`패스 ${passes}회`;
  const hasNext=gi<9;
  document.getElementById('btn-next').textContent=hasNext?'다음 ▶':'완료!';
  document.getElementById('btn-next').disabled=!scored;
  showScreen('screen-result');
}

// ── BUTTON WIRING ─────────────────────────────────────────
document.getElementById('btn-start').addEventListener('click',()=>{ buildSelectScreen(); showScreen('screen-select'); });
document.getElementById('btn-select-back').addEventListener('click',()=>showScreen('screen-title'));
document.getElementById('btn-tactic-back').addEventListener('click',()=>{ buildSelectScreen(); showScreen('screen-select'); });
document.getElementById('btn-play').addEventListener('click',()=>{
  initPlay(G.chapter,G.stage); showScreen(null);
});
document.getElementById('btn-retry').addEventListener('click',()=>{ initPlay(G.chapter,G.stage); showScreen(null); });
document.getElementById('btn-next').addEventListener('click',()=>{
  const gi=G.chapter*5+G.stage;
  if(gi<9){
    const ni=gi+1; G.chapter=Math.floor(ni/5); G.stage=ni%5; G.tactic=0;
    buildTacticScreen(); showScreen('screen-tactic');
  } else { buildSelectScreen(); showScreen('screen-select'); }
});
document.getElementById('btn-to-select').addEventListener('click',()=>{ buildSelectScreen(); showScreen('screen-select'); });

// ── STADIUM ───────────────────────────────────────────────
function buildStadium() {
  const concMat = new THREE.MeshStandardMaterial({ color: 0xb0bfcc, roughness: 0.88 });
  const trackMat = new THREE.MeshStandardMaterial({ color: 0xc05a2a, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a2535, roughness: 0.5, metalness: 0.4, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  const seatCols = [0x1d3f82, 0xc0392b, 0xdddddd, 0x1a5a36, 0xe6b800];
  const TIERS=5, TW=0.9, TH=0.75;

  // Running track strips (outside field lines)
  [{x:0,z:-7.6,w:11,d:0.85},{x:0,z:7.6,w:11,d:0.85},{x:-5.3,z:0,w:0.8,d:16.6},{x:5.3,z:0,w:0.8,d:16.6}]
  .forEach(({x,z,w,d})=>{
    const t=new THREE.Mesh(new THREE.BoxGeometry(w,0.015,d),trackMat);
    t.position.set(x,0.007,z); scene.add(t);
  });

  // Side stands (west / east) — pushed further out for bigger stadium
  [-1,1].forEach(side=>{
    const bx=side*6.5;
    for(let t=0;t<TIERS;t++){
      const px=bx+side*(t*TW+TW*0.5), py=t*TH+TH*0.5;
      const slab=new THREE.Mesh(new THREE.BoxGeometry(TW,TH,22),concMat);
      slab.position.set(px,py,0); slab.receiveShadow=true; slab.castShadow=true; scene.add(slab);
      const seat=new THREE.Mesh(new THREE.BoxGeometry(TW*0.85,0.07,22),
        new THREE.MeshStandardMaterial({color:seatCols[t%seatCols.length],roughness:0.7}));
      seat.position.set(px,t*TH+TH+0.035,0); scene.add(seat);
    }
    const wall=new THREE.Mesh(new THREE.BoxGeometry(0.3,TIERS*TH+0.4,22),concMat);
    wall.position.set(bx+side*(TIERS*TW+0.15),TIERS*TH*0.5,0); wall.castShadow=true; scene.add(wall);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(TIERS*TW+0.6,0.18,22.4),roofMat);
    roof.position.set(bx+side*(TIERS*TW*0.5),TIERS*TH+0.75,0); scene.add(roof);
  });

  // End stands — NORTH ONLY (south removed so camera behind player is unobstructed)
  const bz=-9.5; const nT=4;
  for(let t=0;t<nT;t++){
    const pz=bz-(t*TW+TW*0.5), py=t*TH+TH*0.5;
    const slab=new THREE.Mesh(new THREE.BoxGeometry(14,TH,TW),concMat);
    slab.position.set(0,py,pz); slab.receiveShadow=true; slab.castShadow=true; scene.add(slab);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(14,0.07,TW*0.85),
      new THREE.MeshStandardMaterial({color:seatCols[t%seatCols.length],roughness:0.7}));
    seat.position.set(0,t*TH+TH+0.035,pz); scene.add(seat);
  }
  const nRoof=new THREE.Mesh(new THREE.BoxGeometry(14.4,0.18,nT*TW+0.5),roofMat);
  nRoof.position.set(0,nT*TH+0.75,bz-nT*TW*0.5); scene.add(nRoof);

  // Corner pillars (only north corners)
  [[-1,-1],[1,-1]].forEach(([sx,sz])=>{
    const px=sx*(6.5+TIERS*TW*0.5), pz=sz*(9.5+2*TW*0.5);
    const pillar=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,TIERS*TH+1,8),concMat);
    pillar.position.set(px,TIERS*TH*0.5,pz); pillar.castShadow=true; scene.add(pillar);
  });

  // Floodlight poles — larger stadium positions
  const poleMat=makeMat(0xc8d4e0,0.4,0.6);
  const lampMat=new THREE.MeshStandardMaterial({color:0xfff8e0,emissive:0xfff5cc,emissiveIntensity:0.9});
  [[-13,-12],[13,-12],[-13,12],[13,12]].forEach(([px,pz])=>{
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.13,0.2,14,8),poleMat);
    pole.position.set(px,7,pz); pole.castShadow=true; scene.add(pole);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.4,0.8),lampMat);
    lamp.position.set(px,14.2,pz); scene.add(lamp);
    const pl=new THREE.PointLight(0xfff5e0,3.2,55);
    pl.position.set(px,14,pz); scene.add(pl);
  });

  // Crowd
  buildCrowd(TIERS,TW,TH);
}

function buildCrowd(TIERS,TW,TH) {
  const dummy=new THREE.Object3D();
  const bodyGeo=new THREE.CylinderGeometry(0.065,0.082,0.22,5);
  const headGeo=new THREE.SphereGeometry(0.078,5,4);
  const skinMat=new THREE.MeshStandardMaterial({color:0xffcba4,roughness:0.9});

  [{color:0x1d4ed8,n:200},{color:0xdc2626,n:140},{color:0xffffff,n:110},{color:0xf5c518,n:80}]
  .forEach(({color,n})=>{
    const mat=new THREE.MeshStandardMaterial({color,roughness:0.9});
    const bIM=new THREE.InstancedMesh(bodyGeo,mat,n);
    const hIM=new THREE.InstancedMesh(headGeo,skinMat,n);
    let idx=0;

    function place(x,y,z){
      if(idx>=n) return;
      const jx=x+(Math.random()-0.5)*0.22, jz=z+(Math.random()-0.5)*0.22;
      dummy.position.set(jx,y+0.12,jz); dummy.rotation.y=Math.random()*Math.PI*2; dummy.updateMatrix();
      bIM.setMatrixAt(idx,dummy.matrix);
      dummy.position.y=y+0.31; dummy.updateMatrix();
      hIM.setMatrixAt(idx,dummy.matrix);
      idx++;
    }

    // Side stands (wider)
    [-1,1].forEach(side=>{
      const bx=side*6.5;
      for(let t=0;t<TIERS;t++){
        const px=bx+side*(t*TW+TW*0.5), py=t*TH+TH+0.08;
        for(let r=0;r<28;r++){
          if(Math.random()<0.1) continue;
          place(px,py,-10.5+r*0.78);
        }
      }
    });
    // North end stand only
    const cbz=-9.5;
    for(let t=0;t<4;t++){
      const pz=cbz-(t*TW+TW*0.5), py=t*TH+TH+0.08;
      for(let c=0;c<18;c++){
        if(Math.random()<0.08) continue;
        place(-6.0+c*0.72,py,pz);
      }
    }

    bIM.instanceMatrix.needsUpdate=true; hIM.instanceMatrix.needsUpdate=true;
    scene.add(bIM); scene.add(hIM);
  });
}

// ── CAMERA FOLLOW ────────────────────────────────────────
function updateCamera(play) {
  if (!play) return;
  const holder = play.players[play.ballHolder];
  const hp = to3(holder.x, holder.y);
  // Low behind-player camera — Score!-Hero style
  const tx = hp.x * 0.35;
  const ty = 4.8;
  const tz = hp.z + 7;
  const lr = 0.06; // lerp rate
  camera.position.x += (tx - camera.position.x) * lr;
  camera.position.y += (ty - camera.position.y) * lr;
  camera.position.z += (tz - camera.position.z) * lr;
  // Look toward goal, slightly above ground
  camera.lookAt(hp.x * 0.15, 0.3, hp.z - 7);
}

// ── MAIN LOOP ─────────────────────────────────────────────
function buildScene() {
  // Sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x7ab8f5, side: THREE.BackSide })
  );
  scene.add(sky);

  buildField(); buildGoal(); buildStadium();
  selRing = makeSelRing();
  aimLine = makeAimLine();
  powerRing = makePowerRing();
  makeAimDots();
  initBallShadow();
  initParticles();
}

buildScene();
showScreen('screen-title');

let lastT=0, pulse=0;

function loop(ts) {
  const dt=Math.min(ts-lastT,50); lastT=ts; pulse++;
  renderer.render(scene, camera);

  if (G.screen!=='play'||!G.play) { requestAnimationFrame(loop); return; }
  const play=G.play;
  renderer.setClearColor(0x7ab8f5); // reset flash

  // Timer
  if(play.st.timeLimit && play.phase==='idle'){
    play.timeLeft-=dt/1000;
    if(play.timeLeft<=0){ play.timeLeft=0; triggerFail(play); }
    updateHUD();
  }

  // Ball animation + collision
  if(play.phase==='flying'){
    tickAnim(play,dt);
    tickDefenders(play,dt);
    if(checkIntercept(play)){ play.ballAnim=null; if(ballMesh) ballMesh.position.y=0.18; triggerFail(play); }
    else if(checkGKSave(play)){ play.ballAnim=null; if(ballMesh) ballMesh.position.y=0.18; triggerFail(play); }
  } else {
    tickDefenders(play,dt);
  }

  // Goal phase
  if(play.phase==='goal'){
    play.goalTimer+=dt;
    tickParticles();
    // GOAL! text via DOM (quick banner)
    const banner=document.getElementById('hud-goal-text');
    banner.textContent='⚽ GOAL!'; banner.style.color='#f5c518'; banner.style.fontSize='22px'; banner.style.fontWeight='900';
    if(play.goalTimer>1600){
      banner.style.fontSize=''; banner.style.fontWeight=''; banner.style.color='';
      const r={scored:true,passes:play.passes,actions:play.actions,maxPower:play.maxPower,curved:play.curved,cornerShot:play.cornerShot,timeLeft:play.timeLeft};
      const stars=play.st.calcStars(r);
      const gi=G.chapter*5+G.stage;
      if(stars>G.stars[gi]){ G.stars[gi]=stars; doSave(); }
      showResult(true,stars,play.passes,play.timeLeft);
    }
  }

  // Fail phase
  if(play.phase==='fail'){
    play.flashTimer+=dt;
    renderer.setClearColor(0x3b0000);
    if(play.flashTimer>900){
      renderer.setClearColor(0x0a1628);
      if(play.failCount>=3){
        const gi=G.chapter*5+G.stage;
        G.stars[gi]=Math.max(G.stars[gi],0);
        showResult(false,0,play.passes,play.timeLeft);
      } else {
        resetPlay(play); updateHUD();
      }
    }
  }

  updateCamera(play);
  syncActors(play, pulse);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
