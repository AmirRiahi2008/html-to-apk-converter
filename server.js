const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');

const T = process.env.TEMPLATE || '/opt/template';   // پروژه‌ی Capacitor آماده
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const app = express();
let queue = Promise.resolve(); // ساخت‌ها یکی‌یکی انجام می‌شن

const run = (cmd, args, cwd) => new Promise((ok, fail) =>
  execFile(cmd, args, { cwd, maxBuffer: 1e8, timeout: 600000 },
    (e, out, err) => e ? fail(new Error(err || e.message)) : ok(out)));

const esc = s => s.replace(/[<>&"'\\$]/g, '').trim() || 'App';
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

// ساخت آیکون در همه‌ی سایزها از روی لوگوی کاربر
async function setIcon(buf) {
  const res = path.join(T, 'android/app/src/main/res');
  await fs.rm(path.join(res, 'mipmap-anydpi-v26'), { recursive: true, force: true });
  for (const [d, s] of Object.entries(DENSITIES)) {
    const square = await sharp(buf)
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const circle = Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}"/></svg>`);
    const round = await sharp(square).composite([{ input: circle, blend: 'dest-in' }]).png().toBuffer();
    const dir = path.join(res, `mipmap-${d}`);
    await fs.writeFile(path.join(dir, 'ic_launcher.png'), square);
    await fs.writeFile(path.join(dir, 'ic_launcher_round.png'), round);
  }
}

async function build(html, logo, name) {
  await fs.writeFile(path.join(T, 'www/index.html'), html);   // HTML بدون تغییر
  await setIcon(logo);
  const sp = path.join(T, 'android/app/src/main/res/values/strings.xml');
  let s = await fs.readFile(sp, 'utf8');
  s = s.replace(/(<string name="(?:app_name|title_activity_main)">)[^<]*/g, `$1${esc(name)}`);
  await fs.writeFile(sp, s);
  await run('npx', ['cap', 'sync', 'android'], T);
  const g = path.join(T, 'android');
  try { await run('./gradlew', ['assembleDebug', '--no-daemon', '--offline'], g); }   // بدون نیاز به اینترنت
  catch { await run('./gradlew', ['assembleDebug', '--no-daemon'], g); }
  return fs.readFile(path.join(T, 'android/app/build/outputs/apk/debug/app-debug.apk'));
}

app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/convert',
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'logo', maxCount: 1 }]),
  (req, res) => {
    const html = req.files?.file?.[0];
    const logo = req.files?.logo?.[0];
    const name = (req.body.appName || '').trim();
    if (!html || !/\.html?$/i.test(html.originalname)) return res.status(400).send('فایل HTML لازمه');
    if (!logo) return res.status(400).send('لوگو لازمه');
    if (!name) return res.status(400).send('نام برنامه لازمه');
    queue = queue.then(async () => {
      try {
        const apk = await build(html.buffer, logo.buffer, name);
        res.set({
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': `attachment; filename="app.apk"; filename*=UTF-8''${encodeURIComponent(esc(name))}.apk`
        }).send(apk);
      } catch (e) { res.status(500).send(e.message); }
    });
  });

app.listen(3000, () => console.log('http://localhost:3000'));