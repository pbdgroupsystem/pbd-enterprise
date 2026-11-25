# PBD Enterprise

หน้าเดียวรวมทุกระบบของ PBDGROUP แสดงตามสิทธิ์ตำแหน่ง เข้าสู่ระบบด้วย LINE

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `index.html` | เวอร์ชันมือถือ (PWA ติดตั้งลงหน้าจอโฮมได้ / เปิดใน LINE ได้) |
| `desktop.html` | เวอร์ชันคอมพิวเตอร์ (แถบเมนูซ้าย + การ์ดหลายคอลัมน์) |
| `app.js`, `app.css`, `config.js` | โค้ดและสีที่ใช้ร่วมกันทั้งสองแบบ |
| `manifest.webmanifest`, `sw.js`, `icon*.png/svg` | ส่วนของ PWA |
| `gas/Enterprise.gs` | Apps Script ตรวจ LINE ID token และคืนรายการระบบตามสิทธิ์ |

ถ้า `config.js` ยังว่าง หน้าเว็บจะเปิดเป็น **โหมดตัวอย่าง** (เลือกตำแหน่งดูได้ ไม่ต้องล็อกอิน)

## ขั้นตอนเปิดใช้จริง

1. **GitHub** — อัปโหลดทุกไฟล์ (ยกเว้นโฟลเดอร์ `gas`) ไว้ที่ repo ใหม่ เช่น `pbdgroupsystem/pbd-enterprise` แล้วเปิด GitHub Pages
   → ได้ `https://pbdgroupsystem.github.io/pbd-enterprise/`
2. **LINE Developers** — ในแชนเนล LINE Login (ใช้แชนเนลเดิมของ PBD Wallet ได้) สร้าง LIFF ใหม่
   - Size: Full · Endpoint URL: ลิงก์ GitHub Pages ข้อ 1 · Scope: `openid`, `profile`
   - จด **LIFF ID** และ **Channel ID** ของแชนเนล
3. **Apps Script** (บัญชี pbdgroup.system) — สร้างโปรเจกต์ใหม่ชื่อ "PBD Enterprise API" วาง `gas/Enterprise.gs`
   - Project Settings › Script Properties: `LINE_CHANNEL_ID` = Channel ID
   - รัน `setupEnterprise()` 1 ครั้ง → สร้างแท็บ **ระบบ Enterprise** และ **สิทธิ์ Enterprise** ในชีต LINE-Log
   - Deploy › Web app · Execute as: Me · Who has access: Anyone → คัดลอกลิงก์ `/exec`
4. แก้ `config.js` ใส่ `LIFF_ID` และ `API_URL` แล้วอัปโหลดขึ้น GitHub อีกครั้ง (เปลี่ยน `VERSION` ใน `sw.js` ทุกครั้งที่อัปโหลดไฟล์ใหม่)

## จัดการสิทธิ์และระบบ (ไม่ต้องแก้โค้ด)

- **ใครเข้าได้**: อ่านจากแท็บ `Role` เดิม (คอลัมน์ ตำแหน่ง เช่น `ผู้จัดการสาขาNT หัวหน้าทีมNT1`)
  คนที่ไม่อยู่ใน Role (ช่าง พนักงานขาย แอดมินคลัง) เพิ่มในแท็บ `สิทธิ์ Enterprise`
- **ตำแหน่งที่รองรับ**: ผู้บริหาร (รวมประธาน) · เลขา · ผู้ดูแลระบบ · ผู้จัดการสาขา · แอดมินสาขา · หัวหน้าทีม · แอดมินคลัง · ช่าง · พนักงานขาย
- **ระบบที่แสดง**: แท็บ `ระบบ Enterprise` — เพิ่มแถว ใส่ลิงก์ เลือกตำแหน่งในคอลัมน์ สิทธิ์ (คั่นด้วย , หรือ `ทุกคน`)
  - ลิงก์ใส่ `{branch}` `{team}` ได้ ระบบจะสร้างการ์ดแยกตามสาขา/ทีมของคนนั้น
  - ใส่ `{key}` สำหรับลิงก์ส่วนตัว (อ่านจากคอลัมน์ Key หรือฟังก์ชัน `getAccessKey_` ถ้ามีในโปรเจกต์)
  - ช่อง ลิงก์ ว่าง = แสดงเป็น "รอลิงก์" · สถานะ `กำลังพัฒนา` = แสดงแต่กดไม่ได้
- ทุกครั้งที่มีคนเข้า จะบันทึกในแท็บ `Log Enterprise` (เวลา ชื่อ สิทธิ์ เลขท้าย UserID)

## ลิงก์ที่ยังต้องเติมในแท็บ ระบบ Enterprise

PBD Tech Insight · PBDSTOCK · PBD POS · หลังบ้าน POS · PBD HR · PBD PAY · PBD PAYROLL
