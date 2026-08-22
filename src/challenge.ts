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

/** O'zbekcha so'zdan darajани aniqlash (admin buyrug'i uchun). */
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
      "JavaScript — brauzerда ishlaydigan dasturlash tili. Birinchi buyruq — console.log(), u ekranга (konsolга) ma'lumot chiqaradi.",
    green: "Konsolга \"Salom, dunyo!\" deb chiqaring.",
    yellow: "Ismingiz va yoshingizni ikkita alohida console.log bilan chiqaring.",
    red: "Bitta console.log ichida ism va yoshni birlashtiring: masalan — Ali, 20 yosh.",
  },
  {
    day: 2,
    topic: "O'zgaruvchilar (let, const)",
    intro:
      "O'zgaruvchi — ma'lumot saqlaydigan quti. `let` — qiymati o'zgaradi, `const` — o'zgarmas. Asosiy tiplar: string (matn), number (son), boolean (rost/yolg'on).",
    green: "ism (matn), yosh (son) va student (boolean) o'zgaruvchilarини yarating va chiqaring.",
    yellow: "Ikkita son o'zgaruvchisini yarating, ularning yig'indisini hisoblab chiqaring.",
    red: "const bilan o'zgaruvchi yarating, keyin uni o'zgartirishга urining. Qanday xato chiqadi — izohда yozing.",
  },
  {
    day: 3,
    topic: "Operatorlar va typeof",
    intro:
      "Arifmetik: + - * / % (qoldiq). Taqqoslash: === !== > <. `typeof` — qiymatning tipini aytadi.",
    green: "17 ni 5 ga bo'lганда qoldiqни (%) toping va chiqaring.",
    yellow: "Berilган son juftmi yoki toqmi — % yordamida aniqlang.",
    red: "5 xil qiymatning (son, matn, boolean, undefined, obyekt) typeof natijasини chiqaring.",
  },
  {
    day: 4,
    topic: "Shartlar: if / else",
    intro:
      "Shart — dastur qaror qabul qilishي. `if (shart) { ... } else { ... }` — shart rost bo'lsa bir ish, aks holda boshqa ish bajariladi.",
    green: "Yosh 18 dan katta yoki tengmi — tekshirib, \"Voyaga yetган\" yoki \"Yosh\" deb chiqaring.",
    yellow: "Baho (0-100) berilган: 90+ = 'A', 70+ = 'B', 50+ = 'C', aks holda 'F' chiqaring.",
    red: "Yil berilган — u kabisa yilimi (leap year) ekanини aniqlang (4 ga bo'linadi, lekin 100 ga bo'linsa 400 ga ham bo'linishi kerak).",
  },
  {
    day: 5,
    topic: "switch va ternary operator",
    intro:
      "Ko'p variant bo'lsa `switch` qulay. Qisqa shart uchun ternary: `shart ? a : b`.",
    green: "Hafta kуни raqami (1-7) berilган, switch bilan kун nomини chiqaring (1=Dushanba...).",
    yellow: "Ternary operator bilan sonning musbat/manfiy/nol ekanини bir qatorда aniqlang.",
    red: "Oddiy kalkulyator: ikki son va amal (+ - * /) berilган, switch bilan natijани hisoblang.",
  },
  {
    day: 6,
    topic: "For sikli",
    intro:
      "Sikl — takrorlash. `for (let i = 0; i < 5; i++) { ... }` — kodни bir necha marta ishlatadi.",
    green: "1 dan 10 gacha sonларни chiqaring.",
    yellow: "1 dan 100 gacha sonlarning yig'indisини hisoblang.",
    red: "1 dan 50 gacha faqat 3 ga bo'linadigan sonларни chiqaring.",
  },
  {
    day: 7,
    topic: "While va amaliyot kуни",
    intro:
      "`while (shart) { ... }` — shart rost ekan takrorlanadi. Bu hafta o'rganganlarни mustahkamlaymiz!",
    green: "while bilan 10 dan 1 gacha teskari sanang.",
    yellow: "Berilган sonning faktorialини hisoblang (5! = 120).",
    red: "1-hafta bo'yicha: foydalanuvchi yoshини so'rab (o'zingiz qiymat bering), shartlar bilan bolalik/o'smir/kattalик guruhини aniqlang va sikl bilan 'Tabriklaymiz' ни yosh soni marta chiqaring.",
  },

  // ---- 2-hafta: Ma'lumotlar bilan ishlash ----
  {
    day: 8,
    topic: "Funksiyalar",
    intro:
      "Funksiya — qayta ishlatiladigan kod bo'lagi. `function salom(ism) { return 'Salom ' + ism }`.",
    green: "Ikki sonни qabul qilib, yig'indисини qaytaradigan funksiya yozing.",
    yellow: "Berilган sonning kvadratини qaytaradigan funksiya yozing va 3 ta son bilan sinang.",
    red: "Matn berilган — undаги so'zlar sonини qaytaradigan funksiya yozing (probel bo'yicha).",
  },
  {
    day: 9,
    topic: "Massivlar (array)",
    intro:
      "Massiv — bir nechта qiymatни saqlaydigan ro'yxat: `let mevalar = ['olma', 'nok']`. Indeks 0 dan boshlanadi.",
    green: "5 ta mevадан iborat massiv yarating va birinchi hamda oxirgi elementни chiqaring.",
    yellow: "Massivга yangi element qo'shing (push), birinчисини o'chiring (shift), uzunligини chiqaring.",
    red: "Sonlar massivидан eng katta va eng kichik sonни toping (sikl bilan).",
  },
  {
    day: 10,
    topic: "map, filter, reduce",
    intro:
      "Eng muhim massiv metodlari: `map` — har elementни o'zgartiradi, `filter` — tanlaydi, `reduce` — bitta natijага yig'adi.",
    green: "[1,2,3,4,5] massividagi har bir sonни 2 baravar oshiring (map).",
    yellow: "Ismlar massividан 4 harfдан uzun ismларни ajrating va katta harfда qaytaring (filter + map).",
    red: "Mahsulotlar massivи ({nom, narx}) berilган — reduce bilan umumiy narxни hisoblang va eng qimmatини toping.",
  },
  {
    day: 11,
    topic: "Obyektlar",
    intro:
      "Obyekt — nom bilan saqlanadigan ma'lumot to'plami: `let user = { ism: 'Ali', yosh: 20 }`. `user.ism` bilan olinadi.",
    green: "O'zingiz haqingizда obyekt yarating (ism, yosh, shahar) va har birини chiqaring.",
    yellow: "Obyektга yangi maydon qo'shing va bittasини o'zgartiring, natijани chiqaring.",
    red: "Obyektlar massivи (talabalar) berilған — o'rtacha yoshни hisoblang.",
  },
  {
    day: 12,
    topic: "String metodlari",
    intro:
      "Matn bilan ishlash: length, toUpperCase(), toLowerCase(), includes(), slice(), split(), trim().",
    green: "Ismингизни katta harfларгa o'giring va uzunligини chiqaring.",
    yellow: "Berilган gapни so'zlarга ajrating (split) va nechта so'z borини chiqaring.",
    red: "Matn palindrommi (teskari o'qiganda ham bir xil) ekанини tekshiradigan funksiya yozing.",
  },
  {
    day: 13,
    topic: "Math va Date",
    intro:
      "Math.random(), Math.round(), Math.max() — matematika. `new Date()` — hozirgi sana/vaqt.",
    green: "1 dan 100 gacha tasodifiy son generatsiya qiling (Math.random + Math.floor).",
    yellow: "Berilган sonlar massividан eng kattaسини Math.max bilan toping.",
    red: "Bugungi sana va vaqtни chiroyli formatда chiqaring (kun/oy/yil, soat:daqiqa).",
  },
  {
    day: 14,
    topic: "Xatoliklar (try/catch) + amaliyot",
    intro:
      "`try { ... } catch (e) { ... }` — xato bo'lса dastur to'xtamaslиги uchun. 2-hafта yakuni!",
    green: "try/catch ichида ataylab xato chiqaring va catchда \"Xato bo'ldi\" deb yozing.",
    yellow: "Funksiya yozing: son bo'lmasa xato tashlasin (throw), try/catch bilan ushlang.",
    red: "2-hafта loyihasi: mahsulotlar massivи bilan ishlang — qo'shish, o'chirish, umumiy narx, eng arzon/qimmatني chiqaradigan funksiyalar to'plamини yozing.",
  },

  // ---- 3-hafta: DOM va brauzer ----
  {
    day: 15,
    topic: "DOM: elementни tanlash",
    intro:
      "DOM — sahifадаги HTML elementlari. `document.querySelector('#id')` bilan elementни olamiz. (HTML fayl kerak bo'ladi.)",
    green: "HTML'да bitta <h1> yarating, JS bilan tanlab, matnини console'ga chiqaring.",
    yellow: "Bitta tugma va matn yarating, tugмани querySelector bilan tanlang.",
    red: "querySelectorAll bilan bir necha <li> ni tanlab, har birining matnини chiqaring (sikl).",
  },
  {
    day: 16,
    topic: "Elementни o'zgartirish",
    intro:
      "textContent — matnни, style — ko'rinishни, innerHTML — ichki HTML'ни o'zgartiradi.",
    green: "Sahifадаги sarlavha matnини JS bilan o'zgartiring.",
    yellow: "Elementning rangини (style.color) va fonините o'zgartiring.",
    red: "Tugма bosilганда sarlavha matni va rangи o'zgaradigan qiling (keyingi kun bilan bog'liq).",
  },
  {
    day: 17,
    topic: "Hodisalar (events)",
    intro:
      "addEventListener('click', ...) — foydalanuvchi harakatига javob berish. Eng ko'p ishlatiladigan — click.",
    green: "Tugма bosilганда \"Bosildingiz!\" degan alert chiqaring.",
    yellow: "Tugма bosilган sonини sanab, ekranга chiqaring.",
    red: "Ikkita tugма: biri sonни oshiradi, biri kamaytiradi, natija ekranда ko'rinsin (hisoblagich).",
  },
  {
    day: 18,
    topic: "Formalar va input",
    intro:
      "input.value — foydalanuvchi kiritган matnни oladi. Formani submit qilганда e.preventDefault() sahifани yangilanishдан to'xtatadi.",
    green: "Input va tugма yarating — kiritган matnни ekranга chiqaring.",
    yellow: "Ism kiritilса \"Salom, {ism}!\" deb chiqaring, bo'sh bo'lса ogohlantiring.",
    red: "Oddiy forma: ism va yosh kiritilса, ularни ro'yxatга (ul) qo'shib boring.",
  },
  {
    day: 19,
    topic: "localStorage",
    intro:
      "localStorage — ma'lumotни brauzerда saqlaydi (sahifа yangilansа ham qoladi). setItem/getItem.",
    green: "Ismingizни localStorage'ga saqlang va konsолга chiqaring.",
    yellow: "Input orqали kiritган matnни saqlang, sahifа ochilганда avtomatik ko'rsating.",
    red: "Tungи/kunduzги rejimни (dark mode) localStorage bilan eslab qoladigan qiling.",
  },
  {
    day: 20,
    topic: "classList va interaktivlик",
    intro:
      "classList.add/remove/toggle — CSS klassларни JS bilan boshqarish. UI'ни jonlantiradi.",
    green: "Tugма bosilганda elementга rangли klass qo'shing.",
    yellow: "toggle bilan tugма bosilган sайин elementни ko'rsat/yashir qiling.",
    red: "3 ta tab (bo'lim) yarating — har biri bosilганда faqat o'zi ko'rinadigan qiling.",
  },
  {
    day: 21,
    topic: "Amaliyot: To-Do ilova",
    intro:
      "3-hafта yakuni! O'rganганlarни birlashtirib, ishlaydigan To-Do ro'yxati yasang.",
    green: "Input + tugма bilan vazifa qo'shish va ro'yxatда ko'rsatish.",
    yellow: "Har vazifа yonида o'chirish tugмаси qo'shing.",
    red: "Vazifаларни localStorage'da saqlang (sahifа yangilanса ham qolsin) va bajarилганини belgилаш (chizib tashlash) qo'shing.",
  },

  // ---- 4-hafta: Zamonaviy JS + loyiha ----
  {
    day: 22,
    topic: "ES6: arrow va template literals",
    intro:
      "Zamonaviy JS: arrow funksiya `(a) => a * 2`, template literal `Salom, ${ism}!` (backtick bilan).",
    green: "Oddiy funksiyани arrow ko'rinishига o'giring.",
    yellow: "Template literal bilan ism va yoshni bitta chiroyli jumlага jamlang.",
    red: "Massivни map + arrow bilan qayta ishlab, har element uchun template literal jumla yasang.",
  },
  {
    day: 23,
    topic: "Destructuring va spread",
    intro:
      "Destructuring: `const {ism, yosh} = user`. Spread: `[...massiv1, ...massiv2]` — birlashtiradi.",
    green: "Obyektдан destructuring bilan ikki maydonни ajratib oling.",
    yellow: "Ikki massivни spread (...) bilan birlashtiring.",
    red: "Obyektni spread bilan nusxalab, bitta maydonини o'zgartiring (aslini buzмасdan).",
  },
  {
    day: 24,
    topic: "Promise",
    intro:
      "Promise — kelajakда tugaydigan ish (masalan serverдан ma'lumot). `.then()` — tugaganда, `.catch()` — xato bo'lса.",
    green: "1 soniyадан keyin \"Tayyor!\" chiqaradigan Promise yozing (setTimeout bilan).",
    yellow: ".then() va .catch() bilan muvaffaqiyat va xato holатларини ishlang.",
    red: "Ketma-ket 3 ta Promise (masalan 3 qadamli jarayon) ni .then zanjiri bilan bajaring.",
  },
  {
    day: 25,
    topic: "async / await",
    intro:
      "Promise'ni oson yozish usulи: `async function` ichида `await` bilan natijани kutamiz. Toza va tushunarli.",
    green: "Oldingi kунги Promise'ни async/await bilan qayta yozing.",
    yellow: "await bilan ketma-ket ikки ishни bajaring, orasида vaqt bilan.",
    red: "try/catch bilan async funksiyада xatoni ushlang va chiroyli xabar chiqaring.",
  },
  {
    day: 26,
    topic: "fetch — API'dan ma'lumot",
    intro:
      "fetch() — internetдан ma'lumot oladi. Masalan bepul API'lardан foydalaning (JSONPlaceholder, ochiq API'lар).",
    green: "Bepul API'дан bitta ma'lumot olib (fetch + await), konsолга chiqaring.",
    yellow: "OlINган ma'lumotdan bir necха maydonни ekранга chiroyli chiqaring.",
    red: "FoydalanuvchIлар ro'yxatини API'дан olib, sahifада kartаlар ko'rinishида ko'rsating.",
  },
  {
    day: 27,
    topic: "JSON va modullar",
    intro:
      "JSON — ma'lumot almashuv formatи. JSON.parse() / JSON.stringify(). Modullar: import/export bilan kodни bo'lish.",
    green: "Obyektни JSON.stringify bilan matnга, keyin JSON.parse bilan qaytaring.",
    yellow: "Ma'lumotни localStorage'ga JSON ko'rinishда saqlab, o'qib oling.",
    red: "Kodни ikки faylга bo'ling: bittasида funksiyalar (export), boshqasида ishlatiш (import).",
  },
  {
    day: 28,
    topic: "Yakuniy loyiha (1/3): reja va tuzilma",
    intro:
      "Oxirги 3 kун — bitta to'liq loyiha! Tavsiya: Ob-havo yoki Valyuta kalkulyatori (bepul API bilan). Bugun — HTML tuzilма va dizayn.",
    green: "Loyiha uchun HTML tayyorlang: sarlavha, input, tugма, natijа joyи.",
    yellow: "CSS bilan chiroyli ko'rinish bering (rang, joylashuv).",
    red: "Loyiha rejasини yozing: qanday API, qandaй ma'lumot, qadamlар. GitHub'ga repo oching.",
  },
  {
    day: 29,
    topic: "Yakuniy loyiha (2/3): mantiq va API",
    intro:
      "Bugun — loyiha jonlanadi. fetch bilan API'дан ma'lumot olib, ekранга chiqaramiz.",
    green: "Tugма bosilганда API'дан ma'lumot olishни ulang (fetch + async/await).",
    yellow: "OlINган ma'lumotни chiroyli ko'rsating va yuklanаётганда 'Yuklanmoqda...' chiqaring.",
    red: "Xatoларни ishlang (internet yo'q, noto'g'ri kiritиш) va foydalanuvchIга tushunarли xabar bering.",
  },
  {
    day: 30,
    topic: "Yakuniy loyiha (3/3): pardoz va namoyish 🎉",
    intro:
      "Tabriklaymiz — 30 kun! Bugun loyihани yakunlab, hammага ko'rsatamiz.",
    green: "Loyihани oxirигача ishlaydigan qiling va o'zингиз sinang.",
    yellow: "Dizaynни yaxshилаng: animatsiya, mobil ko'riniш, kichik detallар.",
    red: "Loyihани GitHub'ga joylang, README yozing va kanалга havolа bilan ulashing. #30kunJS_yakun!",
  },
];

/**
 * Har kun uchun mavzuга oid MISOL kod (vazifа javobи EMAS — sintaksisни o'rgatadi).
 * Kod-kartochка rasm sifatida chiziladi (src/codeimage.ts).
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

/** Belgilangan kун va darajада post matnини (HTML) tuzadi. */
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
