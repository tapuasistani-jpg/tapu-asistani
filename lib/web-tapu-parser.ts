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

function parseSbiChunk(chunk: string): HaneMaddesi | null {
  if (/AçıklamaMalik|Ş\/B\/İ|Terkin\s+Sebebi|Malik\/Lehtar/i.test(chunk)) {
    return null;
  }

  const { tarih, yevmiye } = parseDateYevmiye(chunk);

  let aciklama = chunk
    .replace(/^(Beyan|Şerh|Serh|İrtifak)\s*/i, "")
    .replace(/\(Şablon:[^)]*\)/gi, "")
    .replace(/Maddesine\s+Göre\s+Belirtme\)?/gi, "")
    .replace(/\(SN:\d+\)/g, "")
    .replace(/Delice\s*-\s*/gi, "")
    .replace(/VKN:\s*\d*/gi, "")
    .replace(/\d{1,2}-\d{1,2}-\d{4}[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  aciklama = aciklama.replace(/\s+\d+\.\s*$/, "").trim();

  if (!aciklama || aciklama.length < 8) return null;

  return { aciklama, tarih, yevmiye };
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

  const chunks = match[1]
    .split(/(?=(?:^|\n)(?:Beyan|Şerh|Serh|İrtifak))/im)
    .map((c) => c.trim())
    .filter((c) => c.length > 12);

  for (const chunk of chunks) {
    const typeMatch = chunk.match(/^(Beyan|Şerh|Serh|İrtifak)/i);
    if (!typeMatch) continue;

    const madde = parseSbiChunk(chunk);
    if (!madde) continue;

    const upper = chunk.toUpperCase();
    const isSerh =
      /^ŞERH|^SERH|^İRTİFAK/i.test(typeMatch[1]) ||
      /ŞERH|3083\s+SAYILI\s+KANUN\s+GEREĞİNCE\s+ŞERH|TARIM REFORMU/i.test(
        upper
      );

    if (isSerh) serh.push(madde);
    else if (/^BEYAN/i.test(typeMatch[1])) beyan.push(madde);
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
  const sbi = metin.match(WEB_TAPU_SBI);
  if (sbi) {
    const m = sbi[1].match(
      /(\d{1,2}-\d{1,2}-\d{4})\s+(\d{1,2}:\d{2})\s*-\s*\d+/
    );
    if (m) {
      return { tarih: normalizeTarih(m[1]), saat: m[2] };
    }
  }

  const fallback = metin.match(
    /(\d{1,2}-\d{1,2}-\d{4})\s+(\d{1,2}:\d{2})\s*-\s*\d+/
  );
  if (fallback) {
    return { tarih: normalizeTarih(fallback[1]), saat: fallback[2] };
  }

  return { tarih: "", saat: "" };
}
