/* PBD Enterprise service worker — เก็บหน้าเว็บไว้เปิดได้เร็ว ข้อมูลสิทธิ์ดึงสดจากเซิร์ฟเวอร์ทุกครั้ง
   เปลี่ยน VERSION ทุกครั้งที่อัปโหลดไฟล์ใหม่ขึ้น GitHub */
var VERSION = "pbd-enterprise-v1";
var SHELL = ["./", "index.html", "desktop.html", "app.css", "app.js", "config.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  /* ไม่แคช API, LINE และโดเมนอื่น */
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  /* ไฟล์ของแอป: ลองเครือข่ายก่อน ถ้าออฟไลน์ใช้ของในแคช */
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match("index.html"); });
  }));
});
