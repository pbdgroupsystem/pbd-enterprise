/* PBD Enterprise — ศูนย์รวมระบบตามสิทธิ์ตำแหน่ง
 * ใช้ร่วมกันทั้ง index.html (PWA มือถือ) และ desktop.html (คอมพิวเตอร์)
 * ลำดับ: LINE Login (LIFF) → ส่ง ID token ให้ Apps Script ตรวจ → ได้ตำแหน่ง + รายการระบบที่เข้าได้ → แสดงผล
 */
(function () {
  "use strict";
  var CFG = window.PBD_CONFIG || {};
  var SHELL = document.body.getAttribute("data-shell") || "mobile";
  var DEMO = !CFG.LIFF_ID || !CFG.API_URL;
  var CACHE_KEY = "pbd-enterprise-me";

  /* ---------- ตำแหน่ง ---------- */
  var ROLE_LABEL = {
    exec: "ผู้บริหาร", sec: "เลขาฝ่ายบริหาร", admin: "ผู้ดูแลระบบ",
    bm: "ผู้จัดการสาขา", badmin: "แอดมินสาขา", lead: "หัวหน้าทีม",
    stock: "แอดมินคลัง (HQ)", tech: "ช่าง", sales: "พนักงานขาย"
  };

  var GROUPS = [
    { id: "report", label: "รายงานและแดชบอร์ด" },
    { id: "sales", label: "ขายและคลังสินค้า" },
    { id: "people", label: "บุคคลและเวลาทำงาน" },
    { id: "finance", label: "เงินเดือนและการเงิน" }
  ];

  /* ---------- ไอคอน (เส้น 24px) ---------- */
  var ICON = {
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.9.3 5 2.6 5 5.8"/>',
    branch: '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-6h6v6"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    box: '<path d="m3 7 9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>',
    cart: '<path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    store: '<path d="M3 9 5 3h14l2 6"/><path d="M3 9h18v3a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 14v7h14v-7"/>',
    wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 13h2M2 10h20M6 6l10-3 1 3"/>',
    face: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="10" r="2.6"/><path d="M7.5 17c1-2 2.6-3 4.5-3s3.5 1 4.5 3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v.01M18 15v.01"/>',
    coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/>',
    arrow: '<path d="M7 17 17 7M9 7h8v8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 16l4-4-4-4M14 12H3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || "ico") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || ICON.layers) + "</svg>";
  }

  /* ---------- ข้อมูลตัวอย่าง (ใช้เฉพาะโหมดตัวอย่าง — ของจริงมาจากแท็บ "ระบบ Enterprise") ---------- */
  var DASH = "https://script.google.com/macros/s/AKfycbz1_a4EXwbMK2RoZ1-6GZ6QUXLTdFshQASP7EcdXAPnGOgmcZmJbbIHNh6SNtkK9k588Q/exec";
  var DEMO_SYSTEMS = [
    ["dash-exec", "PBD Dashboard · ผู้บริหาร", "ยอดขายทุกสาขา ทันเป้า ทีมที่ต้องเร่ง และแท็บกลยุทธ์ & แผนงาน", "report", "chart", DASH + "?view=exec", "exec", "พร้อมใช้"],
    ["dash-sec", "PBD Dashboard · เลขา", "ภาพรวมยอด งาน-ประชุม และคำถามเลขา", "report", "chart", DASH + "?view=sec", "sec", "พร้อมใช้"],
    ["dash-all", "PBD Dashboard · ผู้ดูแลระบบ", "ทุกมุมมอง ทุกสาขา พร้อมเครื่องมือดูแลระบบ", "report", "chart", DASH + "?view=all", "admin", "พร้อมใช้"],
    ["dash-branch", "PBD Dashboard · สาขา {branch}", "ยอดทีมในสาขา ทันเป้า แผน 7 วันของสาขา", "report", "branch", DASH + "?view=branch&b={branch}", "bm", "พร้อมใช้"],
    ["dash-badmin", "PBD Dashboard · แอดมินสาขา {branch}", "ข้อมูลที่แอดมินสาขาต้องตรวจและยืนยัน", "report", "branch", DASH + "?view=badmin&b={branch}", "badmin", "พร้อมใช้"],
    ["dash-team", "PBD Dashboard · ทีม {team}", "ยอดรายคน Demo รูปเช็คอิน ของทีม", "report", "team", DASH + "?view=team&t={team}", "lead", "พร้อมใช้"],
    ["tech", "PBD Tech Insight", "งานช่าง เคสค้าง แจ้งยอดช่าง ขาด ลา สาย (สรุป 21:30)", "report", "wrench", "", "exec,sec,admin,tech", ""],
    ["enterprise", "ภาพรวมองค์กร", "รวม Sales · Technical · HR · PAY · STOCK ในหน้าเดียว", "report", "layers", "", "exec,admin", "กำลังพัฒนา"],
    ["report-tech", "สรุปรายงานประจำวัน · ช่าง", "ไฟล์สรุปรายวันในโฟลเดอร์ \"สรุปงาน\"", "report", "file", "https://drive.google.com/drive/folders/1OkORqj1O7EM-VmYE6GvHnAQKoT3ivbk8", "exec,sec,admin", "พร้อมใช้"],
    ["stock", "PBDSTOCK คลังสินค้า", "เบิก คืน โอน นับสต็อก ปิดยอดพีเรียด สโตร์ 2", "sales", "box", "", "admin,stock,bm,badmin,lead", ""],
    ["pos", "PBD POS ขายหน้างาน", "ขายออฟไลน์ ตัดสต็อกทีม พิมพ์ใบเสร็จ SUNMI", "sales", "cart", "", "lead,sales,bm,badmin,admin", "กำลังพัฒนา"],
    ["pos-back", "หลังบ้าน POS", "ราคา รูปสินค้า แผนผ่อน บิล ลูกค้าค้างชำระ", "sales", "receipt", "", "admin,stock", "กำลังพัฒนา"],
    ["loyverse", "Loyverse Back Office", "ยอดขายและใบเสร็จจาก Loyverse", "sales", "store", "https://r.loyverse.com/", "exec,admin,stock", "พร้อมใช้"],
    ["wallet", "PBD Wallet", "พ้อย เหรียญ ค่าคอมโดยประมาณ คูปอง", "people", "wallet", "https://liff.line.me/2012225566-hFrR9T1Q", "ทุกคน", "พร้อมใช้"],
    ["outwork", "PBD Outwork", "สแกนหน้านอกพื้นที่ (เฉพาะวันที่มีใบออกแวน)", "people", "face", "https://pbdgroupsystem.github.io/pbd-facescan/", "lead,bm,admin", "พร้อมใช้"],
    ["scan", "บันทึกเวลาสแกนหน้า", "สแกนเข้างาน ลาและออกแวน วันทำงานรายคน", "people", "clock", "https://docs.google.com/spreadsheets/d/19wiEB2aDhzs9rMhZs9ZXI9Gu3HXRg0omzo36oXwglcw/edit", "exec,sec,admin", "พร้อมใช้"],
    ["hr", "PBD HR", "ข้อมูลพนักงาน (อยู่อีกบัญชี Google)", "people", "users", "", "exec,admin", "รอลิงก์"],
    ["pay", "PBD PAY", "ข้อมูลการชำระเงินลูกค้า (อยู่อีกบัญชี Google)", "finance", "cash", "", "exec,admin", "รอลิงก์"],
    ["payroll", "PBD PAYROLL", "เงินเดือนรายเดือนและรายพีเรียด", "finance", "coins", "", "exec,admin", "กำลังพัฒนา"]
  ];

  var DEMO_USERS = {
    exec: { name: "ผู้บริหาร (ตัวอย่าง)", roles: [{ key: "exec" }] },
    sec: { name: "เลขา (ตัวอย่าง)", roles: [{ key: "sec" }] },
    admin: { name: "ผู้ดูแลระบบ (ตัวอย่าง)", roles: [{ key: "admin" }] },
    bm: { name: "ผู้จัดการ NT (ตัวอย่าง)", roles: [{ key: "bm", branch: "NT" }, { key: "lead", branch: "NT", team: "NT1" }] },
    badmin: { name: "แอดมิน APT (ตัวอย่าง)", roles: [{ key: "badmin", branch: "APT" }] },
    lead: { name: "หัวหน้าทีม SD2 (ตัวอย่าง)", roles: [{ key: "lead", branch: "SD", team: "SD2" }] },
    tech: { name: "ช่าง (ตัวอย่าง)", roles: [{ key: "tech", branch: "DLG" }] },
    sales: { name: "พนักงานขาย (ตัวอย่าง)", roles: [{ key: "sales", branch: "ZH", team: "ZH1" }] }
  };

  /* เลียนแบบสิ่งที่ Enterprise.gs ทำ เพื่อให้โหมดตัวอย่างแสดงผลเหมือนของจริง */
  function demoResolve(user) {
    var keys = user.roles.map(function (r) { return r.key; });
    var out = [];
    DEMO_SYSTEMS.forEach(function (s) {
      var allow = s[6].split(",").map(function (x) { return x.trim(); });
      var hit = allow.indexOf("ทุกคน") >= 0 || keys.indexOf("admin") >= 0 && allow.indexOf("admin") >= 0 ||
        keys.some(function (k) { return allow.indexOf(k) >= 0; });
      if (!hit) return;
      var needB = /\{branch\}/.test(s[1] + s[5]), needT = /\{team\}/.test(s[1] + s[5]);
      var ctx = [{}];
      if (needB || needT) {
        ctx = user.roles.filter(function (r) { return allow.indexOf(r.key) >= 0 && (needT ? r.team : r.branch); });
      }
      ctx.forEach(function (c) {
        var fill = function (t) { return t.replace(/\{branch\}/g, c.branch || "").replace(/\{team\}/g, c.team || ""); };
        var url = fill(s[5]);
        out.push({ id: s[0] + (c.team || c.branch || ""), name: fill(s[1]), desc: s[2], group: s[3], icon: s[4],
          url: url, roles: allow, status: url ? (s[7] || "พร้อมใช้") : (s[7] || "รอลิงก์") });
      });
    });
    return { ok: true, demo: true, user: { name: user.name, picture: "", roles: user.roles }, systems: out };
  }

  /* ---------- สถานะของหน้า ---------- */
  var state = { me: null, q: "", group: "all", demoRole: "exec", installEvt: null };
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || "null"); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  function roleText(r) {
    var t = ROLE_LABEL[r.key] || r.label || r.key;
    if (r.team) t += " " + r.team; else if (r.branch && r.key !== "tech") t += " " + r.branch;
    return t;
  }

  /* ---------- หน้าจอ ---------- */
  function show(view) {
    ["#view-loading", "#view-login", "#view-error", "#view-app"].forEach(function (id) { var el = $(id); if (el) el.hidden = id !== view; });
  }

  function renderLogin(msg) {
    show("#view-login");
    var m = $("#login-msg"); if (m) { m.textContent = msg || ""; m.hidden = !msg; }
  }

  function renderError(title, detail) {
    show("#view-error");
    $("#err-title").textContent = title;
    $("#err-detail").textContent = detail || "";
  }

  function statusChip(s) {
    if (s.status === "พร้อมใช้") return "";
    var cls = s.status === "กำลังพัฒนา" ? "chip-dev" : "chip-wait";
    return '<span class="chip ' + cls + '">' + esc(s.status) + "</span>";
  }

  function card(s) {
    var live = s.status === "พร้อมใช้" && s.url;
    var tag = live ? "a" : "div";
    var attrs = live ? ' href="' + esc(s.url) + '" target="_blank" rel="noopener" data-url="' + esc(s.url) + '"' : ' aria-disabled="true"';
    return "<" + tag + ' class="sys' + (live ? "" : " sys-off") + '"' + attrs + ">" +
      '<span class="sys-ico">' + icon(s.icon) + "</span>" +
      '<span class="sys-body"><span class="sys-name">' + esc(s.name) + "</span>" +
      '<span class="sys-desc">' + esc(s.desc) + "</span></span>" +
      '<span class="sys-end">' + (live ? icon("arrow", "ico go") : statusChip(s)) + "</span></" + tag + ">";
  }

  function renderApp() {
    var me = state.me; show("#view-app");
    var first = (me.user.name || "").split(" ")[0];
    $("#hello").textContent = "สวัสดี " + first;
    var av = $("#avatar");
    if (me.user.picture) { av.innerHTML = '<img src="' + esc(me.user.picture) + '" alt="">'; }
    else { av.textContent = (first || "P").slice(0, 1); }
    $("#roles").innerHTML = me.user.roles.map(function (r) { return '<span class="role">' + esc(roleText(r)) + "</span>"; }).join("");

    var demoBar = $("#demo-bar");
    if (demoBar) {
      demoBar.hidden = !me.demo;
      if (me.demo) {
        $("#demo-role").innerHTML = Object.keys(DEMO_USERS).map(function (k) {
          return '<option value="' + k + '"' + (k === state.demoRole ? " selected" : "") + ">" + esc(ROLE_LABEL[k]) + "</option>";
        }).join("");
      }
    }
    renderList();
  }

  function renderList() {
    var me = state.me, q = state.q.trim().toLowerCase();
    var items = me.systems.filter(function (s) {
      return (!q || (s.name + " " + s.desc).toLowerCase().indexOf(q) >= 0) && (state.group === "all" || s.group === state.group);
    });
    var ready = me.systems.filter(function (s) { return s.status === "พร้อมใช้" && s.url; }).length;
    $("#count").textContent = "เข้าได้ " + me.systems.length + " ระบบ · พร้อมใช้ " + ready;

    var tabs = $("#tabs");
    var present = GROUPS.filter(function (g) { return me.systems.some(function (s) { return s.group === g.id; }); });
    tabs.innerHTML = '<button type="button" class="tab' + (state.group === "all" ? " on" : "") + '" data-g="all">ทั้งหมด</button>' +
      present.map(function (g) {
        var n = me.systems.filter(function (s) { return s.group === g.id; }).length;
        return '<button type="button" class="tab' + (state.group === g.id ? " on" : "") + '" data-g="' + g.id + '">' + esc(g.label) + ' <span class="n">' + n + "</span></button>";
      }).join("");

    var html = "";
    GROUPS.forEach(function (g) {
      var list = items.filter(function (s) { return s.group === g.id; });
      if (!list.length) return;
      html += '<section class="grp"><h2 class="grp-h">' + esc(g.label) + '<span class="n">' + list.length + "</span></h2>" +
        '<div class="grid">' + list.map(card).join("") + "</div></section>";
    });
    $("#list").innerHTML = html || '<p class="empty">ไม่พบระบบที่ตรงกับ “' + esc(state.q) + '”</p>';
  }

  /* ---------- เข้าสู่ระบบ ---------- */
  function fetchMe(idToken) {
    /* ส่งแบบ POST text/plain: ไม่ติด CORS preflight ของ Apps Script และ token ไม่ไปอยู่ใน URL */
    return fetch(CFG.API_URL, {
      method: "POST", redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "me", idToken: idToken })
    }).then(function (r) {
      if (!r.ok) throw new Error("เซิร์ฟเวอร์ตอบกลับ " + r.status);
      return r.json();
    });
  }

  function boot() {
    bindUi();
    if (DEMO) { state.me = demoResolve(DEMO_USERS[state.demoRole]); renderApp(); return; }
    if (!window.liff) { renderError("โหลด LINE ไม่สำเร็จ", "ตรวจสอบอินเทอร์เน็ต แล้วเปิดหน้านี้ใหม่"); return; }
    show("#view-loading");
    liff.init({ liffId: CFG.LIFF_ID }).then(function () {
      if (!liff.isLoggedIn()) { renderLogin(); return; }
      var cached = store(CACHE_KEY);
      if (cached && cached.exp > Date.now()) { state.me = cached.me; renderApp(); }
      var token = liff.getIDToken();
      if (!token) { renderLogin("กรุณาเข้าสู่ระบบอีกครั้ง"); return; }
      return fetchMe(token).then(function (me) {
        if (!me.ok) {
          store(CACHE_KEY, null);
          if (me.code === "TOKEN") { liff.logout(); renderLogin("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"); return; }
          renderError(me.code === "NOT_FOUND" ? "บัญชี LINE นี้ยังไม่มีสิทธิ์" : "เข้าสู่ระบบไม่สำเร็จ",
            me.message || "แจ้งผู้ดูแลระบบให้เพิ่ม LINE ของคุณในแท็บ Role หรือ สิทธิ์ Enterprise");
          return;
        }
        state.me = me;
        store(CACHE_KEY, { exp: Date.now() + 10 * 60 * 1000, me: me });
        renderApp();
      });
    }).catch(function (e) {
      if (state.me) return;
      renderError("เชื่อมต่อไม่สำเร็จ", String(e && e.message || e));
    });
  }

  function login() {
    if (DEMO) return;
    liff.login({ redirectUri: location.href.split("#")[0] });
  }

  function logout() {
    store(CACHE_KEY, null);
    if (DEMO) { state.demoRole = "exec"; state.me = demoResolve(DEMO_USERS.exec); renderApp(); return; }
    try { liff.logout(); } catch (e) { /* ไม่เป็นไร */ }
    state.me = null; renderLogin("ออกจากระบบแล้ว");
  }

  function openSystem(e) {
    var a = e.target.closest("a.sys"); if (!a) return;
    /* ใน LINE (LIFF) เปิดลิงก์ภายนอกด้วย openWindow เพื่อไม่ให้หลุดออกจากหน้า */
    if (!DEMO && window.liff && liff.isInClient && liff.isInClient()) {
      e.preventDefault();
      liff.openWindow({ url: a.getAttribute("data-url"), external: true });
    }
  }

  function bindUi() {
    var on = function (sel, ev, fn) { var el = $(sel); if (el) el.addEventListener(ev, fn); };
    on("#btn-login", "click", login);
    on("#btn-retry", "click", function () { location.reload(); });
    on("#btn-logout", "click", logout);
    on("#q", "input", function (e) { state.q = e.target.value; renderList(); });
    on("#tabs", "click", function (e) { var b = e.target.closest("[data-g]"); if (!b) return; state.group = b.getAttribute("data-g"); renderList(); });
    on("#list", "click", openSystem);
    on("#demo-role", "change", function (e) { state.demoRole = e.target.value; state.group = "all"; state.me = demoResolve(DEMO_USERS[state.demoRole]); renderApp(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== $("#q") && $("#q")) { e.preventDefault(); $("#q").focus(); }
    });

    /* ติดตั้งแอป (PWA) */
    var inst = $("#btn-install");
    if (inst) {
      var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
      var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); state.installEvt = e; inst.hidden = false; });
      if (!standalone && ios && !DEMO) { inst.hidden = false; }
      inst.addEventListener("click", function () {
        if (state.installEvt) { state.installEvt.prompt(); state.installEvt.userChoice.then(function () { state.installEvt = null; inst.hidden = true; }); return; }
        var tip = $("#ios-tip"); if (tip) tip.hidden = !tip.hidden;
      });
    }
  }

  if (SHELL === "mobile" && "serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  document.querySelectorAll("[data-icon]").forEach(function (el) { el.innerHTML = icon(el.getAttribute("data-icon")); });
  boot();
})();
