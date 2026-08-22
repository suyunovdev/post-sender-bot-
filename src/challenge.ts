import { escapeHtml } from "./telegram.js";

export type Level = "green" | "yellow" | "red";

export interface ChallengeDay {
  day: number;
  topic: string;
  intro: string;
  green: string; // 🟢 boshlang'ich
  yellow: string; // 🟡 o'rta
  red: string; // 🔴 qiyin
}

export const LEVEL_META: Record<Level, { emoji: string; name: string }> = {
  green: { emoji: "🟢", name: "Boshlang'ich" },
  yellow: { emoji: "🟡", name: "O'rta" },
  red: { emoji: "🔴", name: "Qiyin" },
};

/** O'zbekcha so'zdan darajani aniqlash (admin buyrug'i uchun). */
export function parseLevel(input: string): Level | null {
  const v = input.trim().toLowerCase();
  if (["yashil", "green", "1", "boshlangich", "boshlang'ich", "oson"].includes(v)) return "green";
  if (["sariq", "yellow", "2", "orta", "o'rta"].includes(v)) return "yellow";
  if (["qizil", "red", "3", "qiyin"].includes(v)) return "red";
  return null;
}

export const CHALLENGE: ChallengeDay[] = [
  // ---- 1-hafta: Asoslar ----
  {
    day: 1,
    topic: "Kirish va console.log",
    intro:
      "JavaScript — brauzerda ishlaydigan dasturlash tili. Birinchi buyruq — console.log(), u ekranga (konsolga) ma'lumot chiqaradi.",
    green: "Konsolga \"Salom, dunyo!\" deb chiqaring.",
    yellow: "Ismingiz va yoshingizni ikkita alohida console.log bilan chiqaring.",
    red: "Bitta console.log ichida ism va yoshni birlashtiring: masalan — Ali, 20 yosh.",
  },
  {
    day: 2,
    topic: "O'zgaruvchilar (let, const)",
    intro:
      "O'zgaruvchi — ma'lumot saqlaydigan quti. `let` — qiymati o'zgaradi, `const` — o'zgarmas. Asosiy tiplar: string (matn), number (son), boolean (rost/yolg'on).",
    green: "ism (matn), yosh (son) va student (boolean) o'zgaruvchilarini yarating va chiqaring.",
    yellow: "Ikkita son o'zgaruvchisini yarating, ularning yig'indisini hisoblab chiqaring.",
    red: "const bilan o'zgaruvchi yarating, keyin uni o'zgartirishga urining. Qanday xato chiqadi — izohda yozing.",
  },
  {
    day: 3,
    topic: "Operatorlar va typeof",
    intro:
      "Arifmetik: + - * / % (qoldiq). Taqqoslash: === !== > <. `typeof` — qiymatning tipini aytadi.",
    green: "17 ni 5 ga bo'lganda qoldiqni (%) toping va chiqaring.",
    yellow: "Berilgan son juftmi yoki toqmi — % yordamida aniqlang.",
    red: "5 xil qiymatning (son, matn, boolean, undefined, obyekt) typeof natijasini chiqaring.",
  },
  {
    day: 4,
    topic: "Shartlar: if / else",
    intro:
      "Shart — dastur qaror qabul qilishي. `if (shart) { ... } else { ... }` — shart rost bo'lsa bir ish, aks holda boshqa ish bajariladi.",
    green: "Yosh 18 dan katta yoki tengmi — tekshirib, \"Voyaga yetgan\" yoki \"Yosh\" deb chiqaring.",
    yellow: "Baho (0-100) berilgan: 90+ = 'A', 70+ = 'B', 50+ = 'C', aks holda 'F' chiqaring.",
    red: "Yil berilgan — u kabisa yilimi (leap year) ekanini aniqlang (4 ga bo'linadi, lekin 100 ga bo'linsa 400 ga ham bo'linishi kerak).",
  },
  {
    day: 5,
    topic: "switch va ternary operator",
    intro:
      "Ko'p variant bo'lsa `switch` qulay. Qisqa shart uchun ternary: `shart ? a : b`.",
    green: "Hafta kuni raqami (1-7) berilgan, switch bilan kun nomini chiqaring (1=Dushanba...).",
    yellow: "Ternary operator bilan sonning musbat/manfiy/nol ekanini bir qatorda aniqlang.",
    red: "Oddiy kalkulyator: ikki son va amal (+ - * /) berilgan, switch bilan natijani hisoblang.",
  },
  {
    day: 6,
    topic: "For sikli",
    intro:
      "Sikl — takrorlash. `for (let i = 0; i < 5; i++) { ... }` — kodni bir necha marta ishlatadi.",
    green: "1 dan 10 gacha sonlarni chiqaring.",
    yellow: "1 dan 100 gacha sonlarning yig'indisini hisoblang.",
    red: "1 dan 50 gacha faqat 3 ga bo'linadigan sonlarni chiqaring.",
  },
  {
    day: 7,
    topic: "While va amaliyot kuni",
    intro:
      "`while (shart) { ... }` — shart rost ekan takrorlanadi. Bu hafta o'rganganlarni mustahkamlaymiz!",
    green: "while bilan 10 dan 1 gacha teskari sanang.",
    yellow: "Berilgan sonning faktorialini hisoblang (5! = 120).",
    red: "1-hafta bo'yicha: foydalanuvchi yoshini so'rab (o'zingiz qiymat bering), shartlar bilan bolalik/o'smir/kattalik guruhini aniqlang va sikl bilan 'Tabriklaymiz' ni yosh soni marta chiqaring.",
  },

  // ---- 2-hafta: Ma'lumotlar bilan ishlash ----
  {
    day: 8,
    topic: "Funksiyalar",
    intro:
      "Funksiya — qayta ishlatiladigan kod bo'lagi. `function salom(ism) { return 'Salom ' + ism }`.",
    green: "Ikki sonni qabul qilib, yig'indisini qaytaradigan funksiya yozing.",
    yellow: "Berilgan sonning kvadratini qaytaradigan funksiya yozing va 3 ta son bilan sinang.",
    red: "Matn berilgan — undagi so'zlar sonini qaytaradigan funksiya yozing (probel bo'yicha).",
  },
  {
    day: 9,
    topic: "Massivlar (array)",
    intro:
      "Massiv — bir nechta qiymatni saqlaydigan ro'yxat: `let mevalar = ['olma', 'nok']`. Indeks 0 dan boshlanadi.",
    green: "5 ta mevadan iborat massiv yarating va birinchi hamda oxirgi elementni chiqaring.",
    yellow: "Massivga yangi element qo'shing (push), birinchisini o'chiring (shift), uzunligini chiqaring.",
    red: "Sonlar massividan eng katta va eng kichik sonni toping (sikl bilan).",
  },
  {
    day: 10,
    topic: "map, filter, reduce",
    intro:
      "Eng muhim massiv metodlari: `map` — har elementni o'zgartiradi, `filter` — tanlaydi, `reduce` — bitta natijaga yig'adi.",
    green: "[1,2,3,4,5] massividagi har bir sonni 2 baravar oshiring (map).",
    yellow: "Ismlar massividan 4 harfdan uzun ismlarni ajrating va katta harfda qaytaring (filter + map).",
    red: "Mahsulotlar massivi ({nom, narx}) berilgan — reduce bilan umumiy narxni hisoblang va eng qimmatini toping.",
  },
  {
    day: 11,
    topic: "Obyektlar",
    intro:
      "Obyekt — nom bilan saqlanadigan ma'lumot to'plami: `let user = { ism: 'Ali', yosh: 20 }`. `user.ism` bilan olinadi.",
    green: "O'zingiz haqingizda obyekt yarating (ism, yosh, shahar) va har birini chiqaring.",
    yellow: "Obyektga yangi maydon qo'shing va bittasini o'zgartiring, natijani chiqaring.",
    red: "Obyektlar massivi (talabalar) berilg'an — o'rtacha yoshni hisoblang.",
  },
  {
    day: 12,
    topic: "String metodlari",
    intro:
      "Matn bilan ishlash: length, toUpperCase(), toLowerCase(), includes(), slice(), split(), trim().",
    green: "Ismingizni katta harflarga o'giring va uzunligini chiqaring.",
    yellow: "Berilgan gapni so'zlarga ajrating (split) va nechta so'z borini chiqaring.",
    red: "Matn palindrommi (teskari o'qiganda ham bir xil) ekanini tekshiradigan funksiya yozing.",
  },
  {
    day: 13,
    topic: "Math va Date",
    intro:
      "Math.random(), Math.round(), Math.max() — matematika. `new Date()` — hozirgi sana/vaqt.",
    green: "1 dan 100 gacha tasodifiy son generatsiya qiling (Math.random + Math.floor).",
    yellow: "Berilgan sonlar massividan eng kattaسini Math.max bilan toping.",
    red: "Bugungi sana va vaqtni chiroyli formatda chiqaring (kun/oy/yil, soat:daqiqa).",
  },
  {
    day: 14,
    topic: "Xatoliklar (try/catch) + amaliyot",
    intro:
      "`try { ... } catch (e) { ... }` — xato bo'lsa dastur to'xtamasligi uchun. 2-hafta yakuni!",
    green: "try/catch ichida ataylab xato chiqaring va catchda \"Xato bo'ldi\" deb yozing.",
    yellow: "Funksiya yozing: son bo'lmasa xato tashlasin (throw), try/catch bilan ushlang.",
    red: "2-hafta loyihasi: mahsulotlar massivi bilan ishlang — qo'shish, o'chirish, umumiy narx, eng arzon/qimmatني chiqaradigan funksiyalar to'plamini yozing.",
  },

  // ---- 3-hafta: DOM va brauzer ----
  {
    day: 15,
    topic: "DOM: elementni tanlash",
    intro:
      "DOM — sahifadagi HTML elementlari. `document.querySelector('#id')` bilan elementni olamiz. (HTML fayl kerak bo'ladi.)",
    green: "HTML'da bitta <h1> yarating, JS bilan tanlab, matnini console'ga chiqaring.",
    yellow: "Bitta tugma va matn yarating, tugmani querySelector bilan tanlang.",
    red: "querySelectorAll bilan bir necha <li> ni tanlab, har birining matnini chiqaring (sikl).",
  },
  {
    day: 16,
    topic: "Elementni o'zgartirish",
    intro:
      "textContent — matnni, style — ko'rinishni, innerHTML — ichki HTML'ni o'zgartiradi.",
    green: "Sahifadagi sarlavha matnini JS bilan o'zgartiring.",
    yellow: "Elementning rangini (style.color) va foninite o'zgartiring.",
    red: "Tugma bosilganda sarlavha matni va rangi o'zgaradigan qiling (keyingi kun bilan bog'liq).",
  },
  {
    day: 17,
    topic: "Hodisalar (events)",
    intro:
      "addEventListener('click', ...) — foydalanuvchi harakatiga javob berish. Eng ko'p ishlatiladigan — click.",
    green: "Tugma bosilganda \"Bosildingiz!\" degan alert chiqaring.",
    yellow: "Tugma bosilgan sonini sanab, ekranga chiqaring.",
    red: "Ikkita tugma: biri sonni oshiradi, biri kamaytiradi, natija ekranda ko'rinsin (hisoblagich).",
  },
  {
    day: 18,
    topic: "Formalar va input",
    intro:
      "input.value — foydalanuvchi kiritgan matnni oladi. Formani submit qilganda e.preventDefault() sahifani yangilanishdan to'xtatadi.",
    green: "Input va tugma yarating — kiritgan matnni ekranga chiqaring.",
    yellow: "Ism kiritilsa \"Salom, {ism}!\" deb chiqaring, bo'sh bo'lsa ogohlantiring.",
    red: "Oddiy forma: ism va yosh kiritilsa, ularni ro'yxatga (ul) qo'shib boring.",
  },
  {
    day: 19,
    topic: "localStorage",
    intro:
      "localStorage — ma'lumotni brauzerda saqlaydi (sahifa yangilansa ham qoladi). setItem/getItem.",
    green: "Ismingizni localStorage'ga saqlang va konsolga chiqaring.",
    yellow: "Input orqali kiritgan matnni saqlang, sahifa ochilganda avtomatik ko'rsating.",
    red: "Tungi/kunduzgi rejimni (dark mode) localStorage bilan eslab qoladigan qiling.",
  },
  {
    day: 20,
    topic: "classList va interaktivlik",
    intro:
      "classList.add/remove/toggle — CSS klasslarni JS bilan boshqarish. UI'ni jonlantiradi.",
    green: "Tugma bosilganda elementga rangli klass qo'shing.",
    yellow: "toggle bilan tugma bosilgan sayin elementni ko'rsat/yashir qiling.",
    red: "3 ta tab (bo'lim) yarating — har biri bosilganda faqat o'zi ko'rinadigan qiling.",
  },
  {
    day: 21,
    topic: "Amaliyot: To-Do ilova",
    intro:
      "3-hafta yakuni! O'rganganlarni birlashtirib, ishlaydigan To-Do ro'yxati yasang.",
    green: "Input + tugma bilan vazifa qo'shish va ro'yxatda ko'rsatish.",
    yellow: "Har vazifa yonida o'chirish tugmasi qo'shing.",
    red: "Vazifalarni localStorage'da saqlang (sahifa yangilansa ham qolsin) va bajarilganini belgilash (chizib tashlash) qo'shing.",
  },

  // ---- 4-hafta: Zamonaviy JS + loyiha ----
  {
    day: 22,
    topic: "ES6: arrow va template literals",
    intro:
      "Zamonaviy JS: arrow funksiya `(a) => a * 2`, template literal `Salom, ${ism}!` (backtick bilan).",
    green: "Oddiy funksiyani arrow ko'rinishiga o'giring.",
    yellow: "Template literal bilan ism va yoshni bitta chiroyli jumlaga jamlang.",
    red: "Massivni map + arrow bilan qayta ishlab, har element uchun template literal jumla yasang.",
  },
  {
    day: 23,
    topic: "Destructuring va spread",
    intro:
      "Destructuring: `const {ism, yosh} = user`. Spread: `[...massiv1, ...massiv2]` — birlashtiradi.",
    green: "Obyektdan destructuring bilan ikki maydonni ajratib oling.",
    yellow: "Ikki massivni spread (...) bilan birlashtiring.",
    red: "Obyektni spread bilan nusxalab, bitta maydonini o'zgartiring (aslini buzmasdan).",
  },
  {
    day: 24,
    topic: "Promise",
    intro:
      "Promise — kelajakda tugaydigan ish (masalan serverdan ma'lumot). `.then()` — tugaganda, `.catch()` — xato bo'lsa.",
    green: "1 soniyadan keyin \"Tayyor!\" chiqaradigan Promise yozing (setTimeout bilan).",
    yellow: ".then() va .catch() bilan muvaffaqiyat va xato holatlarini ishlang.",
    red: "Ketma-ket 3 ta Promise (masalan 3 qadamli jarayon) ni .then zanjiri bilan bajaring.",
  },
  {
    day: 25,
    topic: "async / await",
    intro:
      "Promise'ni oson yozish usuli: `async function` ichida `await` bilan natijani kutamiz. Toza va tushunarli.",
    green: "Oldingi kungi Promise'ni async/await bilan qayta yozing.",
    yellow: "await bilan ketma-ket ikki ishni bajaring, orasida vaqt bilan.",
    red: "try/catch bilan async funksiyada xatoni ushlang va chiroyli xabar chiqaring.",
  },
  {
    day: 26,
    topic: "fetch — API'dan ma'lumot",
    intro:
      "fetch() — internetdan ma'lumot oladi. Masalan bepul API'lardan foydalaning (JSONPlaceholder, ochiq API'lar).",
    green: "Bepul API'dan bitta ma'lumot olib (fetch + await), konsolga chiqaring.",
    yellow: "OlINgan ma'lumotdan bir necxa maydonni ekranga chiroyli chiqaring.",
    red: "FoydalanuvchIlar ro'yxatini API'dan olib, sahifada kartalar ko'rinishida ko'rsating.",
  },
  {
    day: 27,
    topic: "JSON va modullar",
    intro:
      "JSON — ma'lumot almashuv formati. JSON.parse() / JSON.stringify(). Modullar: import/export bilan kodni bo'lish.",
    green: "Obyektni JSON.stringify bilan matnga, keyin JSON.parse bilan qaytaring.",
    yellow: "Ma'lumotni localStorage'ga JSON ko'rinishda saqlab, o'qib oling.",
    red: "Kodni ikki faylga bo'ling: bittasida funksiyalar (export), boshqasida ishlatish (import).",
  },
  {
    day: 28,
    topic: "Yakuniy loyiha (1/3): reja va tuzilma",
    intro:
      "Oxirgi 3 kun — bitta to'liq loyiha! Tavsiya: Ob-havo yoki Valyuta kalkulyatori (bepul API bilan). Bugun — HTML tuzilma va dizayn.",
    green: "Loyiha uchun HTML tayyorlang: sarlavha, input, tugma, natija joyi.",
    yellow: "CSS bilan chiroyli ko'rinish bering (rang, joylashuv).",
    red: "Loyiha rejasini yozing: qanday API, qanday ma'lumot, qadamlar. GitHub'ga repo oching.",
  },
  {
    day: 29,
    topic: "Yakuniy loyiha (2/3): mantiq va API",
    intro:
      "Bugun — loyiha jonlanadi. fetch bilan API'dan ma'lumot olib, ekranga chiqaramiz.",
    green: "Tugma bosilganda API'dan ma'lumot olishni ulang (fetch + async/await).",
    yellow: "OlINgan ma'lumotni chiroyli ko'rsating va yuklanayotganda 'Yuklanmoqda...' chiqaring.",
    red: "Xatolarni ishlang (internet yo'q, noto'g'ri kiritish) va foydalanuvchIga tushunarli xabar bering.",
  },
  {
    day: 30,
    topic: "Yakuniy loyiha (3/3): pardoz va namoyish 🎉",
    intro:
      "Tabriklaymiz — 30 kun! Bugun loyihani yakunlab, hammaga ko'rsatamiz.",
    green: "Loyihani oxirigacha ishlaydigan qiling va o'zingiz sinang.",
    yellow: "Dizaynni yaxshilang: animatsiya, mobil ko'rinish, kichik detallar.",
    red: "Loyihani GitHub'ga joylang, README yozing va kanalga havola bilan ulashing. #30kunJS_yakun!",
  },
];

/**
 * Har kun uchun mavzuga oid MISOL kod (vazifa javobi EMAS — sintaksisni o'rgatadi).
 * Kod-kartochka rasm sifatida chiziladi (src/codeimage.ts).
 */
const CODE_EXAMPLES: Record<number, string> = {
  1: `console.log("Salom, dunyo!");`,
  2: `const ism = "Ali";\nlet yosh = 20;\nconsole.log(ism, yosh);`,
  3: `let a = 7 % 3; // 1\nconsole.log(typeof a); // "number"`,
  4: `let yosh = 18;\nif (yosh >= 18) {\n  console.log("Voyaga yetgan");\n} else {\n  console.log("Yosh");\n}`,
  5: `let n = 5;\nlet holat = n > 0 ? "musbat" : "manfiy";\nconsole.log(holat);`,
  6: `for (let i = 1; i <= 3; i++) {\n  console.log(i);\n}`,
  7: `let i = 3;\nwhile (i > 0) {\n  console.log(i);\n  i--;\n}`,
  8: `function qoshish(a, b) {\n  return a + b;\n}\nconsole.log(qoshish(2, 3)); // 5`,
  9: `const mevalar = ["olma", "nok"];\nmevalar.push("uzum");\nconsole.log(mevalar[0]); // "olma"`,
  10: `const sonlar = [1, 2, 3];\nconst ikki = sonlar.map(n => n * 2);\nconsole.log(ikki); // [2, 4, 6]`,
  11: `const user = { ism: "Ali", yosh: 20 };\nconsole.log(user.ism); // "Ali"`,
  12: `let s = "JavaScript";\nconsole.log(s.toUpperCase());\nconsole.log(s.length); // 10`,
  13: `let r = Math.floor(Math.random() * 100);\nconsole.log(r);`,
  14: `try {\n  nomalum();\n} catch (e) {\n  console.log("Xato bo'ldi");\n}`,
  15: `const el = document.querySelector("#sarlavha");\nconsole.log(el.textContent);`,
  16: `const el = document.querySelector("h1");\nel.textContent = "Yangi matn";\nel.style.color = "red";`,
  17: `const btn = document.querySelector("button");\nbtn.addEventListener("click", () => {\n  alert("Bosildingiz!");\n});`,
  18: `const inp = document.querySelector("input");\nconsole.log(inp.value);`,
  19: `localStorage.setItem("ism", "Ali");\nconst ism = localStorage.getItem("ism");\nconsole.log(ism);`,
  20: `const box = document.querySelector(".box");\nbox.classList.toggle("active");`,
  21: `const royxat = [];\nroyxat.push("Kod yozish");\nconsole.log(royxat);`,
  22: `const salom = (ism) => \`Salom, \${ism}!\`;\nconsole.log(salom("Ali"));`,
  23: `const user = { ism: "Ali", yosh: 20 };\nconst { ism, yosh } = user;\nconsole.log(ism, yosh);`,
  24: `const p = new Promise((resolve) => {\n  setTimeout(() => resolve("Tayyor!"), 1000);\n});\np.then(natija => console.log(natija));`,
  25: `async function main() {\n  const res = await fetch("/data");\n  console.log(res);\n}`,
  26: `const res = await fetch("https://api.example.com/user");\nconst data = await res.json();\nconsole.log(data);`,
  27: `const obj = { ism: "Ali" };\nconst matn = JSON.stringify(obj);\nconsole.log(matn);`,
  28: `// index.html: input, tugma, natija joyi\nconst tugma = document.querySelector("#qidir");\nconst natija = document.querySelector("#natija");`,
  29: `tugma.addEventListener("click", async () => {\n  const res = await fetch(url);\n  const data = await res.json();\n  natija.textContent = data.value;\n});`,
  30: `// Loyiha tayyor! 🎉\nconsole.log("30 kunlik challenge tugadi!");`,
};

/** Kun uchun misol kod (bo'lmasa undefined). */
export function challengeCode(day: number): string | undefined {
  return CODE_EXAMPLES[day];
}

export function challengeDay(n: number): ChallengeDay | undefined {
  return CHALLENGE.find((c) => c.day === n);
}

/** Belgilangan kun va darajada post matnini (HTML) tuzadi. */
export function buildChallengePost(entry: ChallengeDay, level: Level, signature: string): string {
  const m = LEVEL_META[level];
  const task = level === "green" ? entry.green : level === "yellow" ? entry.yellow : entry.red;
  const parts = [
    `🟨 <b>#30kunJS — Kun ${entry.day}/30</b>`,
    "",
    `📖 <b>${escapeHtml(entry.topic)}</b>`,
    escapeHtml(entry.intro),
    "",
    `${m.emoji} <b>${m.name} daraja:</b>`,
    escapeHtml(task),
    "",
    `💬 Yechimingizni <b>#kun${entry.day}</b> bilan tashlang!`,
  ];
  if (signature) parts.push("", escapeHtml(signature));
  return parts.join("\n");
}
