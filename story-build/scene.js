/* K Clinics launch Story — deterministic frame compositor.
   render(t) positions every element purely as a function of time t (seconds),
   so frames are reproducible. Driven frame-by-frame by render.mjs. */

// ---------- assets ----------
const SCREENS = {
  home:    { src: 'capture/home-scroll.png',   nat: [930, 9600] },
  service: { src: 'capture/flow-1-service.png', nat: [1290, 2796] },
  variant: { src: 'capture/flow-2-variant.png', nat: [1290, 2796] },
  time:    { src: 'capture/flow-4-time.png',    nat: [1290, 2796] },
  slots:   { src: 'capture/flow-5-slots.png',   nat: [1290, 2796] },
  confirm: { src: 'capture/flow-7-confirm.png', nat: [1290, 2796] },
  portal:  { src: 'capture/portal-login.png',   nat: [1290, 2796] },
  ai:      { src: 'capture/ai-hero.png',        nat: [1290, 2796] },
};
const PLATES = {
  room: 'assets/bg-room.jpg', towels: 'assets/bg-towels.jpg',
  interior: 'assets/bg-interior.jpg', hands: 'assets/bg-hands.jpg',
};

// screen geometry
const SCREEN_W = 740, SCREEN_H = 1548, SX = 170, SY = 190;
const NAT_W = 1290;
const DISP = SCREEN_W / NAT_W;          // natural px -> displayed px (0.5736)
const CSS = SCREEN_W / 430;             // 430-css px -> displayed screen px (1.7209)

// build screen <img> layers
const screenEl = document.getElementById('screen');
const imgs = {};
for (const [name, cfg] of Object.entries(SCREENS)) {
  const im = document.createElement('img');
  im.className = 'scr'; im.src = cfg.src; im.dataset.name = name;
  im.style.height = (cfg.nat[1] * (SCREEN_W / cfg.nat[0])) + 'px';  // per-image aspect
  screenEl.appendChild(im); imgs[name] = im;
}

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, x) => a + (b - a) * x;
const eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;   // easeInOut cubic
const eo  = x => 1 - Math.pow(1 - x, 3);                                     // easeOut cubic
const ei  = x => x * x * x;
// progress of t across [a,b], optional easing
const seg = (t, a, b, e = eio) => e(clamp((t - a) / (b - a)));
// pulse: 0 before a, ramps up over `in`, holds, ramps down over `out` before b
function win(t, a, b, fin = .4, fout = .4) {
  if (t < a || t > b) return 0;
  return Math.min(eo(clamp((t - a) / fin)), eo(clamp((b - t) / fout)));
}

// ---------- timeline (seconds) ----------
const T = {
  open1: [0.0, 1.35],   // full-bleed website, settle
  open2: [1.35, 2.25],  // zoom out to phone
  home:  [2.25, 4.75],  // scroll homepage
  book:  [4.75, 12.25], // booking flow
  portal:[12.25, 16.35],
  ai:    [16.35, 19.25],
  close: [19.25, 23.5],
};
const TOTAL = T.close[1];

// booking choreography: each shot crossfades its screen in at `at`,
// cursor glides to `cur` (430-css coords) and taps at `tapAt`.
const BOOK = [
  { at: 4.75, img: 'service', cur: [213, 236], tapAt: 5.65, scroll: 0 },
  { at: 6.05, img: 'variant', cur: [318, 478], tapAt: 6.95, scroll: 0 },   // tap Continue
  { at: 7.20, img: 'time',    cur: [215, 252], tapAt: 8.00, scroll: 0 },   // tap date
  { at: 8.25, img: 'slots',   cur: [321, 344], tapAt: 9.15, scroll: 70 },  // tap a time
  { at: 9.55, img: 'confirm', cur: [210, 600], tapAt: 11.6, scroll: 470 }, // hold confirm
];

// captions per beat: [eyebrow, headlineHTML, sub]
const CAPS = {
  home:   ['Now live', 'A new home<br>for <span class="it">K&nbsp;Clinics.</span>', 'Book, browse and manage your care — all online.'],
  book:   ['Booking', 'Book in<br>a few <span class="it">taps.</span>', 'Choose a treatment and a time. Nothing to pay until your visit.'],
  portal: ['Client portal', 'Your care,<br><span class="it">in one place.</span>', 'Appointments, health forms and invoices — always to hand.'],
  ai:     ['Get my plan', 'A plan<br><span class="it">made for you.</span>', 'Upload a photo for personalised treatment guidance.'],
};

// ---------- element refs ----------
const $ = id => document.getElementById(id);
const bg = $('bg'), bggrad = $('bggrad'), phone = $('phone'), shadow = $('phoneshadow'),
  bezel = $('bezel'), notch = $('notch'), cursor = $('cursor'), ripple = $('ripple'),
  logo = $('logo'), eyebrow = $('eyebrow'), headline = $('headline'), sub = $('sub'),
  dots = $('dots'), dotI = [...document.querySelectorAll('#dots i')], endcard = $('endcard'),
  cap = $('cap');
let curBgKey = '', curCapKey = '';
function setBg(key) { if (key !== curBgKey) { bg.style.backgroundImage = `url('${PLATES[key]}')`; curBgKey = key; } }
function setCap(key) {
  if (key === curCapKey) return; curCapKey = key;
  if (!key) return;
  eyebrow.textContent = CAPS[key][0]; headline.innerHTML = CAPS[key][1]; sub.textContent = CAPS[key][2];
}
// css(430) coords -> stage px inside the screen, accounting for inner scroll
function tapStage(cx, cy, scroll) {
  return [SX + cx * CSS, SY + (cy * CSS - scroll)];
}

// ---------- main ----------
function render(t) {
  // ----- phone zoom / presence -----
  let scale = 1, phoneOpacity = 1, bgOp = 0, shadowOp = 0, bezelOp = 0, notchOp = 0;
  if (t < T.open2[1]) {
    // open: screen covers frame (scale ~1.46) -> settles to 1.0
    const p = seg(t, T.open1[0], T.open2[1], eo);
    scale = lerp(1.46, 1.0, p);
    bgOp = seg(t, T.open2[0], T.open2[1], eo);
    shadowOp = bgOp; bezelOp = bgOp; notchOp = bgOp;
  } else if (t >= T.close[0]) {
    // close: phone recedes & fades
    const p = seg(t, T.close[0], T.close[0] + 1.1, ei);
    scale = lerp(1.0, 0.86, p);
    phoneOpacity = 1 - seg(t, T.close[0] + .2, T.close[0] + 1.0, eo);
    bgOp = 1; shadowOp = 1 - p; bezelOp = 1; notchOp = 1 - p;
  } else { bgOp = 1; shadowOp = 1; bezelOp = 1; notchOp = 1; }

  phone.style.transform = `scale(${scale})`;
  phone.style.opacity = phoneOpacity;
  shadow.style.transform = `scale(${scale})`;
  shadow.style.opacity = shadowOp * .9;
  screenEl.style.transform = `scale(${scale})`;
  screenEl.style.opacity = phoneOpacity;
  bezel.style.opacity = bezelOp;
  notch.style.opacity = notchOp * phoneOpacity;

  // ----- background plate selection + slow ken burns -----
  let plate = 'interior', kb = 0;
  if (t >= T.close[0]) plate = 'towels';
  else if (t >= T.portal[0]) plate = 'room';
  else if (t >= T.book[0]) plate = 'interior';
  else plate = 'room';
  setBg(plate);
  kb = (t % 12) / 12;
  bg.style.transform = `scale(${lerp(1.05, 1.14, (Math.sin(t * 0.18) + 1) / 2)}) translate(${lerp(-14, 14, kb)}px, ${lerp(-8, 8, kb)}px)`;
  bg.style.opacity = bgOp * 0.9;
  bggrad.style.opacity = bgOp;

  // ----- screen content + scroll -----
  // default: hide all
  let active = {}, scrollOf = {};
  if (t < T.home[1]) {
    // open + home scroll
    active.home = 1;
    const sp = seg(t, T.home[0], T.home[1], eio);
    scrollOf.home = lerp(0, 1700, sp);   // px scroll within screen (displayed)
  } else if (t < T.portal[0]) {
    // booking shots crossfade
    for (let i = 0; i < BOOK.length; i++) {
      const s = BOOK[i]; const next = BOOK[i + 1];
      const end = next ? next.at : T.portal[0];
      if (t >= s.at - 0.3 && t < end) {
        const fin = seg(t, s.at - 0.3, s.at + 0.1, eo);
        const fout = next ? (1 - seg(t, end - 0.3, end + 0.05, eo)) : 1;
        active[s.img] = Math.max(active[s.img] || 0, Math.min(fin, fout));
        // confirm slow auto-scroll to reveal "nothing charged"
        let sc = s.scroll;
        if (s.img === 'confirm') sc = lerp(470, 700, seg(t, s.at, end, eio));
        scrollOf[s.img] = sc;
      }
    }
  } else if (t < T.ai[0]) {
    active.portal = win(t, T.portal[0] - 0.05, T.ai[0] + 0.1, .35, .35) || 1;
    if (t > T.ai[0] - 0.35) active.portal = 1 - seg(t, T.ai[0] - 0.35, T.ai[0], eo);
    else active.portal = seg(t, T.portal[0] - 0.05, T.portal[0] + 0.35, eo);
    scrollOf.portal = 0;
  } else {
    active.ai = (t < T.close[0] - 0.3) ? seg(t, T.ai[0] - 0.05, T.ai[0] + 0.35, eo)
                                        : 1 - seg(t, T.close[0] - 0.35, T.close[0], eo);
    scrollOf.ai = 0;
  }
  for (const name in imgs) {
    const op = active[name] || 0;
    imgs[name].style.opacity = clamp(op);
    imgs[name].style.transform = `translateY(${-(scrollOf[name] || 0)}px)`;
  }

  // ----- cursor + ripple (during booking) -----
  let cursorOp = 0, cx = 0, cy = 0, ripOp = 0, ripScale = .2;
  if (t >= T.book[0] - 0.1 && t < T.portal[0] - 0.2) {
    cursorOp = clamp(seg(t, T.book[0] - 0.1, T.book[0] + 0.3, eo) - seg(t, T.portal[0] - 0.6, T.portal[0] - 0.2, eo));
    // find current + previous shot to glide between targets
    let prev = BOOK[0], cur = BOOK[0];
    for (let i = 0; i < BOOK.length; i++) { if (t >= BOOK[i].at - 0.3) { cur = BOOK[i]; prev = BOOK[i - 1] || BOOK[i]; } }
    const segStart = cur.at - 0.2, settle = cur.tapAt ? cur.tapAt - 0.05 : cur.at + 0.6;
    const gp = seg(t, segStart, settle, eio);
    const [px, py] = tapStage(prev.cur[0], prev.cur[1], prev.scroll || 0);
    const [qx, qy] = tapStage(cur.cur[0], cur.cur[1], cur.scroll || 0);
    cx = lerp(px, qx, gp); cy = lerp(py, qy, gp);
    // tap ripple
    if (cur.tapAt) {
      const rp = seg(t, cur.tapAt, cur.tapAt + 0.5, eo);
      if (t >= cur.tapAt && t < cur.tapAt + 0.55) { ripOp = (1 - rp) * .9; ripScale = lerp(.2, 1.5, rp); }
      // little press dip on the cursor
      if (t >= cur.tapAt - 0.05 && t < cur.tapAt + 0.12) { cx += 3; cy += 4; }
    }
  }
  cursor.style.opacity = cursorOp;
  cursor.style.transform = `translate(${cx}px, ${cy}px)`;
  ripple.style.opacity = ripOp;
  ripple.style.left = cx + 'px'; ripple.style.top = cy + 'px';
  ripple.style.transform = `translate(-50%,-50%) scale(${ripScale})`;

  // ----- corner logo -----
  let logoOp = 0;
  if (t >= T.open2[1] - 0.2 && t < T.close[0] + 0.1) {
    logoOp = clamp(seg(t, T.open2[1] - 0.2, T.open2[1] + 0.5, eo) - seg(t, T.close[0] - 0.4, T.close[0], eo));
  }
  logo.style.opacity = logoOp;
  logo.style.transform = `translateY(${lerp(-10, 0, clamp(seg(t, T.open2[1] - 0.2, T.open2[1] + 0.5, eo)))}px)`;

  // ----- captions -----
  let capKey = '';
  if (t >= T.home[0] && t < T.book[0]) capKey = 'home';
  else if (t >= T.book[0] && t < T.portal[0]) capKey = 'book';
  else if (t >= T.portal[0] && t < T.ai[0]) capKey = 'portal';
  else if (t >= T.ai[0] && t < T.close[0]) capKey = 'ai';
  setCap(capKey);
  // window each caption block with in/out
  const ranges = { home: [T.home[0], T.book[0]], book: [T.book[0], T.portal[0]], portal: [T.portal[0], T.ai[0]], ai: [T.ai[0], T.close[0]] };
  let capShow = 0, slide = 16;
  if (capKey) {
    const [a, b] = ranges[capKey];
    capShow = win(t, a, b, .55, .45);
    slide = lerp(20, 0, seg(t, a, a + .6, eo));
  }
  // caption scrim: steady through content beats, fades at the ends
  $('capscrim').style.opacity = clamp(seg(t, T.home[0], T.home[0] + .5, eo) - seg(t, T.close[0] - .5, T.close[0], eo)) * .96;
  eyebrow.style.opacity = capShow;
  eyebrow.style.transform = `translateY(${slide * .6}px)`;
  headline.style.opacity = capShow;
  headline.style.transform = `translateY(${slide}px)`;
  sub.style.opacity = capShow * .96;
  sub.style.transform = `translateY(${slide * 1.2}px)`;

  // ----- progress dots -----
  dots.style.opacity = (t > T.home[0] && t < T.close[0]) ? clamp(seg(t, T.home[0], T.home[0] + .6, eo)) * .9 : 0;
  let di = 0;
  if (t >= T.book[0]) di = 1; if (t >= T.portal[0]) di = 2; if (t >= T.ai[0]) di = 3;
  dotI.forEach((d, i) => d.classList.toggle('on', i === di));

  // ----- end card -----
  if (t >= T.close[0] - 0.2) {
    const a = T.close[0];
    endcard.style.opacity = 1;
    const k = endcard.querySelector('.klogo'), kw = endcard.querySelector('.kw'),
      url = endcard.querySelector('.url'), loc = endcard.querySelector('.loc'), pill = endcard.querySelector('.pill');
    const kp = seg(t, a + .15, a + .9, eo);
    k.style.opacity = kp; k.style.transform = `translateY(${lerp(14, 0, kp)}px) scale(${lerp(.94, 1, kp)})`;
    kw.style.opacity = seg(t, a + .35, a + 1.05, eo); kw.style.transform = `translateY(${lerp(12, 0, seg(t, a + .35, a + 1.05, eo))}px)`;
    const up = seg(t, a + .7, a + 1.4, eo);
    url.style.opacity = up; url.style.transform = `translateY(${lerp(16, 0, up)}px)`;
    const lp = seg(t, a + 1.0, a + 1.6, eo);
    loc.style.opacity = lp; loc.style.transform = `translateY(${lerp(12, 0, lp)}px)`;
    const pp = seg(t, a + 1.3, a + 2.0, eo);
    pill.style.opacity = pp; pill.style.transform = `translateY(${lerp(16, 0, pp)}px) scale(${lerp(.96, 1, pp)})`;
  } else { endcard.style.opacity = 0; }

  // ----- grain shimmer -----
  $('grain').style.transform = `translate(${(t * 53) % 80 - 40}px, ${(t * 37) % 80 - 40}px)`;
}

// readiness for the driver
window.__ready = false;
window.__total = TOTAL;
(async () => {
  try { await document.fonts.ready; } catch (e) {}
  await Promise.all([...document.querySelectorAll('img')].map(im => im.complete ? 1 :
    new Promise(r => { im.onload = r; im.onerror = r; })));
  render(0);
  window.__ready = true;
})();
window.render = render;
