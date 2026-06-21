import {
  normalizeTarih,
  type HaneMaddesi,
  type RehinKaydi,
} from "./tapu-rapor-sablon";

const WEB_TAPU_SBI =
  /TAŞINMAZA\s+AİT\s+ŞERH\s+BEYAN\s+İRTİFAK\s+BİLGİLERİ([\s\S]*?)(?=MÜLKİYET\s+BİLGİLERİ|MÜLKİYETE\s+AİT\s+REHİN|$)/i;

const WEB_TAPU_REHIN =
  /MÜLKİYETE\s+AİT\s+REHİN\s+BİLGİLERİ([\s\S]*?)(?=Bu belgeyi akıllı|Web Tapu anasayfas|\d+\s*\/\s*4|$)/i;

export function isWebTapuKayitBelgesi(metin: string): boolean {
  return /TAŞINMAZA\s+AİT\s+ŞERH\s+BEYAN|MÜLKİYETE\s+AİT\s+REHİN|TAPU\s+KAYIT\s+BİLGİSİ/i.test(
    metin
  );
}

export function stripWebTapuFooters(metin: string): string {
  return metin
    .replace(
      /BU BELGE TOPLAM\s+\d+\s+SAYFADAN[\s\S]*?BİLGİ AMAÇLIDIR\.?/gi,
      "\n"
    )
    .replace(/\d+\s*\/\s*\d+\s*\n?\s*BİLGİ AMAÇLIDIR/gi, "\n")
    .replace(/BİLGİ AMAÇLIDIR/gi, "");
}

function parseDateYevmiye(chunk: string): {
  tarih: string;
  saat: string;
  yevmiye: string;
} {
  const m = chunk.match(
    /(\d{1,2}-\d{1,2}-\d{4})(?:\s+(\d{1,2}:\d{2}))?\s*-\s*(\d+)/
  );
  if (!m) return { tarih: "", saat: "", yevmiye: "" };
  return {
    tarih: normalizeTarih(m[1]),
    saat: m[2]?.trim() ?? "",
    yevmiye: m[3],
  };
}

function extractLehtar(chunk: string): string {
  const m = chunk.match(
    /(?:SN:\d+\)\s*)((?:TARIM REFORMU|T\.?\s*C\.?\s*)?[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜa-zçğıöşü\s]{4,80}?)(?=\s*VKN:|\s*Delice|\d{1,2}-\d{1,2}-\d{4})/i
  );
  const ad = m?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  if (!ad || /^(Beyan|Şerh|Serh|İrtifak|Delice)$/i.test(ad)) return "";
  if (/^\d+$/.test(ad)) return "";
  return ad;
}

function temizSbiAciklama(chunk: string, lehtar = ""): string {
  let text = chunk.replace(/^(Beyan|Şerh|Serh|İrtifak)\s*/i, "");

  text = text
    .replace(/\(\s*Şablon:[^)]*\)/gi, "")
    .replace(/Şablon:\s*3083[\s\S]*?Maddesine\s+Göre\s+Belirtme\)?/gi, "")
    .replace(/Maddesine\s+Göre\s+Belirtme\)?/gi, "")
    .replace(/\(SN:\d+\)/g, "")
    .replace(/VKN:\s*\d*/gi, "")
    .replace(/Delice\s*-\s*/gi, "")
    .replace(/(?:-\s*)?\d{1,2}-\d{1,2}-\d{4}[\s\S]*$/i, "")
    .replace(/\(\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (lehtar) {
    const esc = lehtar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text
      .replace(new RegExp(`\\(SN:\\d+\\)\\s*${esc}`, "gi"), "")
      .replace(new RegExp(esc, "gi"), "")
      .trim();
  }

  return text
    .replace(/\s+\d+\.\s*$/, "")
    .replace(/\(\s*$/, "")
    .replace(/ŞERH\s*\(\s*$/i, "ŞERH")
    .trim();
}

function parseSbiChunk(chunk: string, columnTip: string): HaneMaddesi | null {
  if (/AçıklamaMalik|Ş\/B\/İ|Terkin\s+Sebebi|Malik\/Lehtar/i.test(chunk)) {
    return null;
  }

  if (/^ŞERH[\s(]/i.test(chunk) && !/^Şerh\s|^Serh\s/i.test(columnTip)) {
    return null;
  }

  const { tarih, yevmiye } = parseDateYevmiye(chunk);
  const lehtar = extractLehtar(chunk);
  let aciklama = temizSbiAciklama(chunk, lehtar);

  if (lehtar) {
    aciklama = `${aciklama} (${lehtar} lehine)`.replace(/\s+/g, " ").trim();
  }

  if (!aciklama || aciklama.length < 8) return null;

  // Sadece kurum adı kalmış sahte şerh satırı
  if (
    sbiTipindenHane(columnTip) === "serh" &&
    !/\d+\s*SAYILI|KANUN|BEYAN|İRTİFAK|ŞERH|HACİZ|İPOTEK/i.test(aciklama) &&
    /MÜDÜRLÜĞÜ|BANKASI|A\.Ş\./i.test(aciklama)
  ) {
    return null;
  }

  return { aciklama, tarih, yevmiye };
}

/** Web Tapu tablosunda Ş/B/İ sütun tipine göre ayır (içerikte "ŞERH" geçse bile Beyan kalır) */
function sbiTipindenHane(
  tip: string
): "beyan" | "serh" | "hak" {
  const t = tip.toLowerCase();
  if (t.startsWith("beyan")) return "beyan";
  if (t.startsWith("şerh") || t.startsWith("serh")) return "serh";
  return "hak";
}

function extractSbiEntryChunks(body: string): string[] {
  const starts: number[] = [];
  // Yalnızca satır başındaki sütun tipi (GEREĞİNCE ŞERH metnini bölme)
  const re =
    /(?:^|\n)(Beyan(?=\d|\s)|Şerh(?=\s)|Serh(?=\s)|İrtifak(?=\s))/g;

  for (const m of body.matchAll(re)) {
    const idx = m.index ?? 0;
    const offset = m[0].length - m[1].length;
    starts.push(idx + offset);
  }

  const unique = [...new Set(starts)].sort((a, b) => a - b);

  const chunks: string[] = [];
  for (let i = 0; i < unique.length; i++) {
    const end = i + 1 < unique.length ? unique[i + 1] : body.length;
    const piece = body.slice(unique[i], end).trim();
    if (piece.length > 12) chunks.push(piece);
  }

  return chunks;
}

export function parseWebTapuSbi(metin: string): {
  beyanMaddeleri: HaneMaddesi[];
  serhMaddeleri: HaneMaddesi[];
  hakVeMukellefiyetMaddeleri: HaneMaddesi[];
} {
  const match = metin.match(WEB_TAPU_SBI);
  const beyan: HaneMaddesi[] = [];
  const serh: HaneMaddesi[] = [];
  const hak: HaneMaddesi[] = [];

  if (!match) {
    return {
      beyanMaddeleri: beyan,
      serhMaddeleri: serh,
      hakVeMukellefiyetMaddeleri: hak,
    };
  }

  const chunks = extractSbiEntryChunks(match[1]);

  for (const chunk of chunks) {
    const typeMatch = chunk.match(/^(Beyan|Şerh|Serh|İrtifak)/i);
    if (!typeMatch) continue;

    const madde = parseSbiChunk(chunk, typeMatch[1]);
    if (!madde) continue;

    const hane = sbiTipindenHane(typeMatch[1]);
    if (hane === "beyan") beyan.push(madde);
    else if (hane === "serh") serh.push(madde);
    else hak.push(madde);
  }

  return {
    beyanMaddeleri: beyan,
    serhMaddeleri: serh,
    hakVeMukellefiyetMaddeleri: hak,
  };
}

function parseWebTapuIpotekBlock(block: string): RehinKaydi | null {
  const flat = block.replace(/\s+/g, " ").trim();

  const kurumMatch = flat.match(
    /(?:SN:\d+\s*)?(TÜRKİYE\s+CUMHURİYETİ\s+[\wçğıöşüÇĞİÖŞÜ\s.]+A\.Ş\.)/i
  );

  const tutarMatch = flat.match(/(\d+\.\d{2})\s*TL/i);

  const dereceMatch =
    flat.match(/(\d+\/\d+)(?=F\.B\.K)/i) ||
    flat.match(/%\s*[\d.]+\s*(?:Değişken\s+Faiz\s*)?(\d+\/\d+)/i);

  const dateYev = flat.match(
    /(\d{1,2}-\d{1,2}-\d{4})\s+\d{1,2}:\d{2}\s*-\s*(\d+)/
  );

  if (!kurumMatch && !tutarMatch) return null;

  return {
    kurum: kurumMatch?.[1].trim() ?? "…………",
    derece: dereceMatch?.[1] ?? "",
    tutar: tutarMatch ? `${tutarMatch[1]} TL` : "",
    tarih: dateYev ? normalizeTarih(dateYev[1]) : "",
    yevmiye: dateYev?.[2] ?? "",
  };
}

export function parseWebTapuRehin(metin: string): RehinKaydi[] {
  const match = metin.match(WEB_TAPU_REHIN);
  if (!match) return [];

  const blocks = match[1]
    .split(/(?=Ipotek)/i)
    .filter((b) => /BANKASI|\d+\.\d{2}\s*TL/i.test(b));

  const entries: RehinKaydi[] = [];
  for (const block of blocks) {
    const parsed = parseWebTapuIpotekBlock(block);
    if (parsed) entries.push(parsed);
  }

  return entries;
}

export function extractWebTapuBelgeTarihSaat(metin: string): {
  tarih: string;
  saat: string;
} {
  const all = [
    ...metin.matchAll(
      /(\d{1,2}-\d{1,2}-\d{4})\s+(\d{1,2}:\d{2})\s*-\s*\d+/g
    ),
  ];

  const sorguSaati =
    all.find((m) => m[2] !== "00:00") ??
    all.find((m) => m[2] === "00:00");

  if (sorguSaati) {
    return {
      tarih: normalizeTarih(sorguSaati[1]),
      saat: sorguSaati[2],
    };
  }

  const sbi = metin.match(WEB_TAPU_SBI);
  if (sbi) {
    const m = sbi[1].match(/(\d{1,2}-\d{1,2}-\d{4})\s*-\s*(\d+)/);
    if (m) {
      return { tarih: normalizeTarih(m[1]), saat: "" };
    }
  }

  return { tarih: "", saat: "" };
}
