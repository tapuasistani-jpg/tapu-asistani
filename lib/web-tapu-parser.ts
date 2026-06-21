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

function temizSbiAciklama(chunk: string): string {
  const aciklama = chunk
    .replace(/^(Beyan|Şerh|Serh|İrtifak)\s*/i, "")
    .replace(/\(?\s*Şablon:[^)]*\)?/gi, "")
    .replace(/\(?\s*Şablon:\s*3083\s+Sayılı\s+Kanunun\s+\d+\.?[^)]*/gi, "")
    .replace(/3083\s+Sayılı\s+Kanunun\s+\d+\.\s*/gi, "")
    .replace(/Maddesine\s+Göre\s+Belirtme\)?/gi, "")
    .replace(/\(SN:\d+\)/g, "")
    .replace(/Delice\s*-\s*/gi, "")
    .replace(/VKN:\s*\d*/gi, "")
    .replace(/\d{1,2}-\d{1,2}-\d{4}[\s\S]*$/i, "")
    .replace(/\(\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return aciklama.replace(/\s+\d+\.\s*$/, "").trim();
}

function parseSbiChunk(chunk: string): HaneMaddesi | null {
  if (/AçıklamaMalik|Ş\/B\/İ|Terkin\s+Sebebi|Malik\/Lehtar/i.test(chunk)) {
    return null;
  }

  const { tarih, yevmiye } = parseDateYevmiye(chunk);
  const aciklama = temizSbiAciklama(chunk);

  if (!aciklama || aciklama.length < 8) return null;

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
  const re = /(?:^|[\s\n])(Beyan|Şerh|Serh|İrtifak)(?=[\dA-ZÇĞİÖŞÜ(])/gim;

  for (const m of body.matchAll(re)) {
    const idx = m.index ?? 0;
    const offset = m[0].length - m[1].length;
    starts.push(idx + offset);
  }

  const chunks: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : body.length;
    const piece = body.slice(starts[i], end).trim();
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

    const madde = parseSbiChunk(chunk);
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
