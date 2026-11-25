/**
 * PBD Enterprise API — ตรวจตัวตน LINE และคืนรายการระบบตามสิทธิ์ตำแหน่ง
 * ------------------------------------------------------------------
 * ติดตั้งเป็น Apps Script โปรเจกต์ใหม่ (แยกจาก "Line-log dashboard" เพื่อไม่แตะ doGet เดิม)
 *   1) วางไฟล์นี้ › Project Settings › Script Properties เพิ่ม
 *        LINE_CHANNEL_ID = Channel ID ของแชนเนล LINE Login ที่สร้าง LIFF ของ PBD Enterprise
 *   2) รันฟังก์ชัน setupEnterprise() 1 ครั้ง (สร้างแท็บ "ระบบ Enterprise" และ "สิทธิ์ Enterprise" ใน LINE-Log)
 *   3) Deploy › Web app › Execute as: Me · Who has access: Anyone › คัดลอกลิงก์ /exec ไปใส่ API_URL ใน config.js
 *
 * แหล่งสิทธิ์ (อ่านอย่างเดียว ยกเว้นแท็บที่สคริปต์สร้างเอง):
 *   - แท็บ Role            : UserID | LINE Name | ชื่อเล่น | ตำแหน่ง  (เช่น "ผู้จัดการสาขาNT หัวหน้าทีมNT1")
 *   - แท็บ สิทธิ์ Enterprise : UserID | ชื่อเล่น | ตำแหน่ง | สาขา | ทีม | Key | ใช้งาน
 *                            สำหรับคนที่ไม่อยู่ในแท็บ Role (ช่าง พนักงานขาย แอดมินคลัง) หรือเพิ่ม Key ลิงก์ส่วนตัว
 *   - แท็บ ระบบ Enterprise  : รายการระบบ ลิงก์ และตำแหน่งที่เข้าได้ — เพิ่ม/แก้ระบบได้ในชีต ไม่ต้องแก้โค้ด
 */

var ENT = {
  SHEET_ID: "1mwpfhpViX1u4byMsEcn8atIfeMGXfgZhIMHerRhCBZw", // LINE-Log บันทึกทุกข้อความ
  TAB_ROLE: "Role",
  TAB_EXTRA: "สิทธิ์ Enterprise",
  TAB_SYSTEMS: "ระบบ Enterprise",
  TAB_LOG: "Log Enterprise",
  CACHE_SEC: 300,
  DASH: "https://script.google.com/macros/s/AKfycbz1_a4EXwbMK2RoZ1-6GZ6QUXLTdFshQASP7EcdXAPnGOgmcZmJbbIHNh6SNtkK9k588Q/exec"
};

var ENT_GROUPS = { "รายงานและแดชบอร์ด": "report", "ขายและคลังสินค้า": "sales", "บุคคลและเวลาทำงาน": "people", "เงินเดือนและการเงิน": "finance" };
var ENT_ROLE_KEYS = { "ผู้บริหาร": "exec", "เลขา": "sec", "ผู้ดูแลระบบ": "admin", "ผู้จัดการสาขา": "bm", "แอดมินสาขา": "badmin",
  "หัวหน้าทีม": "lead", "แอดมินคลัง": "stock", "ช่าง": "tech", "พนักงานขาย": "sales", "ทุกคน": "*" };

/* ---------------- จุดเข้า ---------------- */
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents || "{}"); } catch (err) { return entJson_({ ok: false, code: "BAD_REQUEST", message: "รูปแบบคำขอไม่ถูกต้อง" }); }
  if (body.action === "me") return entJson_(entMe_(body.idToken));
  return entJson_({ ok: false, code: "BAD_REQUEST", message: "ไม่รู้จักคำสั่ง" });
}

function doGet() {
  return entJson_({ ok: true, service: "PBD Enterprise API", time: new Date().toISOString() });
}

function entJson_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- ตรวจตัวตน ---------------- */
function entMe_(idToken) {
  if (!idToken) return { ok: false, code: "TOKEN", message: "ไม่พบข้อมูลการเข้าสู่ระบบ" };
  var prof;
  try { prof = entVerify_(idToken); } catch (err) { return { ok: false, code: "TOKEN", message: String(err.message || err) }; }

  var cache = CacheService.getScriptCache();
  var ck = "ent_me_" + prof.sub;
  var hit = cache.get(ck);
  if (hit) return JSON.parse(hit);

  var who = entLookup_(prof.sub);
  if (!who.roles.length) {
    entLog_(prof.sub, prof.name, "ไม่มีสิทธิ์");
    return { ok: false, code: "NOT_FOUND", message: "บัญชี LINE \"" + (prof.name || "") + "\" ยังไม่มีสิทธิ์ แจ้งผู้ดูแลระบบให้เพิ่มในแท็บ Role หรือ สิทธิ์ Enterprise" };
  }
  var out = {
    ok: true,
    user: { name: who.nick || prof.name, picture: prof.picture || "", roles: who.roles },
    systems: entResolve_(who)
  };
  cache.put(ck, JSON.stringify(out), ENT.CACHE_SEC);
  entLog_(prof.sub, who.nick || prof.name, who.roles.map(function (r) { return r.key + (r.team || r.branch || ""); }).join(" "));
  return out;
}

/** ตรวจ ID token กับ LINE (ลายเซ็น วันหมดอายุ และ Channel ID) */
function entVerify_(idToken) {
  var channelId = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ID");
  if (!channelId) throw new Error("ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID ใน Script Properties");
  var res = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "post", muteHttpExceptions: true,
    payload: { id_token: idToken, client_id: channelId }
  });
  var j = JSON.parse(res.getContentText() || "{}");
  if (res.getResponseCode() !== 200 || !j.sub) throw new Error("เซสชัน LINE หมดอายุหรือไม่ถูกต้อง");
  return { sub: j.sub, name: j.name || "", picture: j.picture || "" };
}

/* ---------------- หาตำแหน่ง ---------------- */
function entLookup_(uid) {
  var ss = SpreadsheetApp.openById(ENT.SHEET_ID);
  var roles = [], nick = "", key = "";

  var role = ss.getSheetByName(ENT.TAB_ROLE);
  if (role) {
    var v = role.getDataRange().getDisplayValues(), h = v[0];
    var cU = h.indexOf("UserID"), cN = h.indexOf("ชื่อเล่น"), cP = h.indexOf("ตำแหน่ง");
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][cU]).trim() !== uid) continue;
      nick = nick || v[i][cN];
      roles = roles.concat(entParsePosition_(v[i][cP]));
    }
  }

  var extra = ss.getSheetByName(ENT.TAB_EXTRA);
  if (extra) {
    var x = extra.getDataRange().getDisplayValues(), hx = x[0];
    var col = function (name) { return hx.indexOf(name); };
    for (var r = 1; r < x.length; r++) {
      var row = x[r];
      if (String(row[col("UserID")]).trim() !== uid) continue;
      if (/^(false|ไม่|no|0)$/i.test(String(row[col("ใช้งาน")]).trim())) continue;
      nick = nick || row[col("ชื่อเล่น")];
      key = key || row[col("Key")];
      var parsed = entParsePosition_(row[col("ตำแหน่ง")]);
      parsed.forEach(function (p) {
        if (!p.branch && row[col("สาขา")]) p.branch = String(row[col("สาขา")]).trim().toUpperCase();
        if (!p.team && row[col("ทีม")]) p.team = String(row[col("ทีม")]).trim().toUpperCase();
      });
      roles = roles.concat(parsed);
    }
  }

  // ตัดตำแหน่งซ้ำ
  var seen = {};
  roles = roles.filter(function (r) { var k = r.key + "|" + (r.branch || "") + "|" + (r.team || ""); if (seen[k]) return false; seen[k] = 1; return true; });
  return { uid: uid, nick: nick, key: key, roles: roles };
}

/** แปลงข้อความตำแหน่ง เช่น "ผู้จัดการสาขาAPT หัวหน้าทีมAP1.1 หัวหน้าทีมAP1.2" เป็นรายการสิทธิ์ */
function entParsePosition_(text) {
  var t = String(text || ""), out = [], m;
  if (/ประธาน|ผู้บริหาร/.test(t)) out.push({ key: "exec" });
  if (/ผู้ดูแลระบบ/.test(t)) out.push({ key: "admin" });
  if (/เลขา/.test(t)) out.push({ key: "sec" });
  if (/แอดมินคลัง/.test(t)) out.push({ key: "stock", branch: "DLG" });
  var reBm = /ผู้จัดการสาขา\s*([A-Z]{2,4})?/g;
  while ((m = reBm.exec(t))) out.push({ key: "bm", branch: m[1] || "" });
  var reBa = /แอดมินสาขา\s*([A-Z]{2,4})?/g;
  while ((m = reBa.exec(t))) out.push({ key: "badmin", branch: m[1] || "" });
  var reLead = /หัวหน้าทีม\s*([A-Z]{2,4}[0-9.]*)?/g;
  while ((m = reLead.exec(t))) out.push({ key: "lead", team: m[1] || "", branch: entBranchOfTeam_(m[1]) });
  if (/ช่าง/.test(t)) out.push({ key: "tech" });
  if (/พนักงานขาย|เซลล์|^sales$/i.test(t)) out.push({ key: "sales" });
  return out;
}

function entBranchOfTeam_(team) {
  if (!team) return "";
  var p = String(team).replace(/[0-9.].*$/, "");
  return p === "AP" ? "APT" : p;
}

/* ---------------- รายการระบบตามสิทธิ์ ---------------- */
function entResolve_(who) {
  var sh = SpreadsheetApp.openById(ENT.SHEET_ID).getSheetByName(ENT.TAB_SYSTEMS);
  if (!sh) return [];
  var v = sh.getDataRange().getDisplayValues(), h = v[0];
  var c = function (n) { return h.indexOf(n); };
  var keys = who.roles.map(function (r) { return r.key; });
  var out = [];

  for (var i = 1; i < v.length; i++) {
    var row = v[i];
    if (!row[c("รหัส")] || /^(false|ไม่)$/i.test(String(row[c("เปิดใช้")]).trim())) continue;
    var allow = String(row[c("สิทธิ์")]).split(/[,،\s]+/).filter(String).map(function (s) { return ENT_ROLE_KEYS[s] || s; });
    var everyone = allow.indexOf("*") >= 0;
    if (!everyone && !keys.some(function (k) { return allow.indexOf(k) >= 0; })) continue;

    var name = row[c("ชื่อระบบ")], link = row[c("ลิงก์")];
    var needT = /\{team\}/.test(name + link), needB = /\{branch\}/.test(name + link);
    var ctx = [{}];
    if (needT || needB) {
      ctx = who.roles.filter(function (r) { return allow.indexOf(r.key) >= 0 && (needT ? r.team : r.branch); });
      if (!ctx.length) continue;
    }
    ctx.forEach(function (cx) {
      var fill = function (s) {
        return String(s).replace(/\{branch\}/g, cx.branch || "").replace(/\{team\}/g, cx.team || "")
          .replace(/\{key\}/g, encodeURIComponent(entAccessKey_(who) || ""));
      };
      var url = fill(link).trim();
      var status = String(row[c("สถานะ")] || "").trim() || (url ? "พร้อมใช้" : "รอลิงก์");
      if (!url && status === "พร้อมใช้") status = "รอลิงก์";
      out.push({
        id: row[c("รหัส")] + (cx.team || cx.branch || ""),
        name: fill(name), desc: row[c("คำอธิบาย")],
        group: ENT_GROUPS[row[c("หมวด")]] || row[c("หมวด")] || "report",
        icon: row[c("ไอคอน")] || "layers",
        url: status === "พร้อมใช้" ? url : "",
        status: status
      });
    });
  }
  return out;
}

/** Key ลิงก์ส่วนตัวของแดชบอร์ด: ใช้ฟังก์ชัน getAccessKey_(uid) ถ้ามีในโปรเจกต์ ไม่เช่นนั้นใช้คอลัมน์ Key ในแท็บ สิทธิ์ Enterprise */
function entAccessKey_(who) {
  try { if (typeof getAccessKey_ === "function") return getAccessKey_(who.uid) || who.key; } catch (e) {}
  return who.key;
}

function entLog_(uid, name, roles) {
  try {
    var ss = SpreadsheetApp.openById(ENT.SHEET_ID);
    var sh = ss.getSheetByName(ENT.TAB_LOG) || ss.insertSheet(ENT.TAB_LOG);
    if (sh.getLastRow() === 0) sh.appendRow(["เวลา", "ชื่อ", "สิทธิ์", "UserID (ท้าย 6)"]);
    sh.appendRow([new Date(), name, roles, String(uid).slice(-6)]);
  } catch (e) { /* บันทึกไม่ได้ไม่เป็นไร */ }
}

/* ---------------- ตั้งค่าครั้งแรก (รันเองใน editor) ---------------- */
function setupEnterprise() {
  var ss = SpreadsheetApp.openById(ENT.SHEET_ID);
  if (!ss.getSheetByName(ENT.TAB_EXTRA)) {
    var x = ss.insertSheet(ENT.TAB_EXTRA);
    x.appendRow(["UserID", "ชื่อเล่น", "ตำแหน่ง", "สาขา", "ทีม", "Key", "ใช้งาน"]);
    x.getRange("A2:G2").setValues([["(LINE User ID)", "ตัวอย่าง", "ช่าง", "DLG", "", "", "ไม่"]]);
    x.setFrozenRows(1);
  }
  if (!ss.getSheetByName(ENT.TAB_SYSTEMS)) {
    var s = ss.insertSheet(ENT.TAB_SYSTEMS);
    var D = ENT.DASH;
    var rows = [
      ["รหัส", "ชื่อระบบ", "คำอธิบาย", "หมวด", "ไอคอน", "ลิงก์", "สิทธิ์", "สถานะ", "เปิดใช้"],
      ["dash-exec", "PBD Dashboard · ผู้บริหาร", "ยอดขายทุกสาขา ทันเป้า ทีมที่ต้องเร่ง และแท็บกลยุทธ์ & แผนงาน", "รายงานและแดชบอร์ด", "chart", D + "?view=exec", "ผู้บริหาร", "", "TRUE"],
      ["dash-sec", "PBD Dashboard · เลขา", "ภาพรวมยอด งาน-ประชุม และคำถามเลขา", "รายงานและแดชบอร์ด", "chart", D + "?view=sec", "เลขา", "", "TRUE"],
      ["dash-all", "PBD Dashboard · ผู้ดูแลระบบ", "ทุกมุมมอง ทุกสาขา พร้อมเครื่องมือดูแลระบบ", "รายงานและแดชบอร์ด", "chart", D + "?view=all", "ผู้ดูแลระบบ", "", "TRUE"],
      ["dash-branch", "PBD Dashboard · สาขา {branch}", "ยอดทีมในสาขา ทันเป้า แผน 7 วันของสาขา", "รายงานและแดชบอร์ด", "branch", D + "?view=branch&b={branch}", "ผู้จัดการสาขา", "", "TRUE"],
      ["dash-badmin", "PBD Dashboard · แอดมินสาขา {branch}", "ข้อมูลที่แอดมินสาขาต้องตรวจและยืนยัน", "รายงานและแดชบอร์ด", "branch", D + "?view=badmin&b={branch}", "แอดมินสาขา", "", "TRUE"],
      ["dash-team", "PBD Dashboard · ทีม {team}", "ยอดรายคน Demo รูปเช็คอิน ของทีม", "รายงานและแดชบอร์ด", "team", D + "?view=team&t={team}", "หัวหน้าทีม", "", "TRUE"],
      ["tech", "PBD Tech Insight", "งานช่าง เคสค้าง แจ้งยอดช่าง ขาด ลา สาย (สรุป 21:30)", "รายงานและแดชบอร์ด", "wrench", "", "ผู้บริหาร, เลขา, ผู้ดูแลระบบ, ช่าง", "", "TRUE"],
      ["enterprise", "ภาพรวมองค์กร", "รวม Sales · Technical · HR · PAY · STOCK ในหน้าเดียว", "รายงานและแดชบอร์ด", "layers", "", "ผู้บริหาร, ผู้ดูแลระบบ", "กำลังพัฒนา", "TRUE"],
      ["report-tech", "สรุปรายงานประจำวัน · ช่าง", "ไฟล์สรุปรายวันในโฟลเดอร์ \"สรุปงาน\"", "รายงานและแดชบอร์ด", "file", "https://drive.google.com/drive/folders/1OkORqj1O7EM-VmYE6GvHnAQKoT3ivbk8", "ผู้บริหาร, เลขา, ผู้ดูแลระบบ", "", "TRUE"],
      ["stock", "PBDSTOCK คลังสินค้า", "เบิก คืน โอน นับสต็อก ปิดยอดพีเรียด สโตร์ 2", "ขายและคลังสินค้า", "box", "", "ผู้ดูแลระบบ, แอดมินคลัง, ผู้จัดการสาขา, แอดมินสาขา, หัวหน้าทีม", "", "TRUE"],
      ["pos", "PBD POS ขายหน้างาน", "ขายออฟไลน์ ตัดสต็อกทีม พิมพ์ใบเสร็จ SUNMI", "ขายและคลังสินค้า", "cart", "", "หัวหน้าทีม, พนักงานขาย, ผู้จัดการสาขา, แอดมินสาขา, ผู้ดูแลระบบ", "กำลังพัฒนา", "TRUE"],
      ["pos-back", "หลังบ้าน POS", "ราคา รูปสินค้า แผนผ่อน บิล ลูกค้าค้างชำระ", "ขายและคลังสินค้า", "receipt", "", "ผู้ดูแลระบบ, แอดมินคลัง", "กำลังพัฒนา", "TRUE"],
      ["loyverse", "Loyverse Back Office", "ยอดขายและใบเสร็จจาก Loyverse", "ขายและคลังสินค้า", "store", "https://r.loyverse.com/", "ผู้บริหาร, ผู้ดูแลระบบ, แอดมินคลัง", "", "TRUE"],
      ["wallet", "PBD Wallet", "พ้อย เหรียญ ค่าคอมโดยประมาณ คูปอง", "บุคคลและเวลาทำงาน", "wallet", "https://liff.line.me/2012225566-hFrR9T1Q", "ทุกคน", "", "TRUE"],
      ["outwork", "PBD Outwork", "สแกนหน้านอกพื้นที่ (เฉพาะวันที่มีใบออกแวน)", "บุคคลและเวลาทำงาน", "face", "https://pbdgroupsystem.github.io/pbd-facescan/", "หัวหน้าทีม, ผู้จัดการสาขา, ผู้ดูแลระบบ", "", "TRUE"],
      ["scan", "บันทึกเวลาสแกนหน้า", "สแกนเข้างาน ลาและออกแวน วันทำงานรายคน", "บุคคลและเวลาทำงาน", "clock", "https://docs.google.com/spreadsheets/d/19wiEB2aDhzs9rMhZs9ZXI9Gu3HXRg0omzo36oXwglcw/edit", "ผู้บริหาร, เลขา, ผู้ดูแลระบบ", "", "TRUE"],
      ["hr", "PBD HR", "ข้อมูลพนักงาน (อยู่อีกบัญชี Google)", "บุคคลและเวลาทำงาน", "users", "", "ผู้บริหาร, ผู้ดูแลระบบ", "รอลิงก์", "TRUE"],
      ["pay", "PBD PAY", "ข้อมูลการชำระเงินลูกค้า (อยู่อีกบัญชี Google)", "เงินเดือนและการเงิน", "cash", "", "ผู้บริหาร, ผู้ดูแลระบบ", "รอลิงก์", "TRUE"],
      ["payroll", "PBD PAYROLL", "เงินเดือนรายเดือนและรายพีเรียด", "เงินเดือนและการเงิน", "coins", "", "ผู้บริหาร, ผู้ดูแลระบบ", "กำลังพัฒนา", "TRUE"]
    ];
    s.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
    s.setFrozenRows(1);
    s.getRange("A1:I1").setFontWeight("bold");
  }
  Logger.log("ตั้งค่าแท็บเรียบร้อย");
}

/** ทดสอบการแปลงตำแหน่ง (รันใน editor ดูผลใน Log) */
function testParsePosition() {
  ["ประธานบริหารPBD Group", "ผู้จัดการสาขาAPT หัวหน้าทีมAP1.1 หัวหน้าทีมAP1.2", "แอดมินสาขาAPT", "เลขาฝ่ายบริหารPBD Group", "ช่าง"]
    .forEach(function (t) { Logger.log(t + " → " + JSON.stringify(entParsePosition_(t))); });
}
