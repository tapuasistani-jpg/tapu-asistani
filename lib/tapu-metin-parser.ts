import {
  birlestirPortfoyBelgeler,
  type BelgeCikarim,
} from "./portfoy-birlestir";
import { olusturPortfoyRaporu } from "./portfoy-rapor-sablon";
import {
  normalizeTarih,
  olusturTapuRaporu,
  type HaneMaddesi,
  type RehinKaydi,
  type TapuCikarimVerisi,
} from "./tapu-rapor-sablon";
import type { PortfoyBelgeGirdisi } from "./openai-portfoy";

type SectionKey =
  | "beyan"
  | "serh"
  | "hak"
  | "rehin";

const KAYIT_YOK =
  /kayıt\s+bulunmamaktadır|kayit\s+bulunmamaktadir|herhangi\s+bir\s+.*kaydı?\s+bulunmamaktadır|kayit\s+yok/i;

const SECTION_MARKERS: { key: SectionKey; regex: RegExp }[] = [
  { key: "beyan", regex: /(?:^|\n)\s*(?:BEYANLAR?(?:\s+HANES[Iİ])?|Beyanlar?\s+Hanesi)\b/i },
  { key: "serh", regex: /(?:^|\n)\s*(?:ŞERHLER?|SERHLER?|Şerhler?\s+Hanesi)\b/i },
  {
    key: "hak",
    regex:
      /(?:^|\n)\s*(?:HAK\s+VE\s+M[ÜU]KELLEF[Iİ]YETLER?(?:\s+HANES[Iİ])?|Hak\s+ve\s+M[üu]kellefiyetler?\s+Hanesi)\b/i,
  },
  {
    key: "rehin",
    regex:
      /(?:^|\n)\s*(?:REH[Iİ]NLER?(?:\s+HANES[Iİ])?|Rehinler?\s+Hanesi|Rehin\s*\/\s*[İI]potek|İPOTEK|IPOTEK)\b/i,
  },
];

function normalizeMetin(metin: string): string {
  return metin
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function flattenMetin(metin: string): string {
  return normalizeMetin(metin).replace(/\n+/g, " ");
}

function extractBelgeTarihSaat(metin: string): { tarih: string; saat: string } {
  const flat = flattenMetin(metin);
  const patterns = [
    /elektronik\s+ortamda\s+(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+tarih\s+ve\s+saat\s+(\d{1,2}:\d{2})/i,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+tarih(?:i)?\s+ve\s+saat\s+(\d{1,2}:\d{2})/i,
    /alınma\s+tarihi[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /belge\s+tarihi[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+(\d{1,2}:\d{2})/,
  ];

  for (const p of patterns) {
    const m = flat.match(p);
    if (m) {
      return {
        tarih: normalizeTarih(m[1]),
        saat: m[2]?.trim() ?? "",
      };
    }
  }

  const onlyDate = flat.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/);
  return {
    tarih: onlyDate ? normalizeTarih(onlyDate[1]) : "",
    saat: "",
  };
}

function splitSections(metin: string): Record<SectionKey, string> {
  const hits: { key: SectionKey; index: number; len: number }[] = [];

  for (const { key, regex } of SECTION_MARKERS) {
    const m = regex.exec(metin);
    if (m?.index !== undefined) {
      hits.push({ key, index: m.index, len: m[0].length });
    }
  }

  hits.sort((a, b) => a.index - b.index);

  const sections: Record<SectionKey, string> = {
    beyan: "",
    serh: "",
    hak: "",
    rehin: "",
  };

  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index + hits[i].len;
    const end = i + 1 < hits.length ? hits[i + 1].index : metin.length;
    sections[hits[i].key] = trimSectionTail(metin.slice(start, end).trim());
  }

  return sections;
}

function extractYevmiye(metin: string): string {
  const patterns = [
    /yevmiye\s*(?:no|numarası|numarasi)?[:\s]*(\d{3,8})/i,
    /yev\.?\s*no[:\s]*(\d{3,8})/i,
    /(\d{3,8})\s*yevmiyeli/i,
    /tarih,?\s*(\d{3,8})\s*yevmiyeli/i,
    /yevmiye[:\s-]*(\d{3,8})/i,
  ];

  for (const p of patterns) {
    const m = metin.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function extractTarih(metin: string): string {
  const patterns = [
    /tesis\s+tarihi[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /ipotek\s+tarihi[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /(?:tarih|tarihi)[:\s]*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})\s+tarih/i,
    /(\d{1,2}[./-]\d{1,2}[./-]\d{4})/,
  ];

  for (const p of patterns) {
    const m = metin.match(p);
    if (m?.[1]) return normalizeTarih(m[1]);
  }
  return "";
}

function trimSectionTail(text: string): string {
  return text
    .split(
      /(?:karekod|kare\s*kod|UYARI\s*:|https?:\/\/|bu belge|doğrulama|dogrulama)/i
    )[0]
    .trim();
}

function extractKurum(metin: string): string {
  const patterns = [
    /((?:T\.?\s*C\.?\s*)?TÜRKİYE\s+CUMHURİYETİ\s+[\wçğıöşüÇĞİÖŞÜ\s.]+A\.Ş\.(?:\s*\(VKN:\s*\d+\))?)/i,
    /((?:T\.?\s*C\.?\s*)?TÜRKİYE\s+CUMHURİYETİ\s+[\wçğıöşüÇĞİÖŞÜ\s.]+BANKASI(?:\s*\(VKN:\s*\d+\))?)/i,
    /([A-ZÇĞİÖŞÜ][A-Za-zçğıöşüÇĞİÖŞÜ0-9\s.]{4,80}A\.Ş\.(?:\s*\([^)]{0,40}\))?)/,
    /([A-ZÇĞİÖŞÜ][A-Za-zçğıöşüÇĞİÖŞÜ0-9\s.]{4,80}BANKASI(?:\s*\([^)]{0,40}\))?)/i,
  ];

  for (const p of patterns) {
    const m = metin.match(p);
    if (m?.[1]) {
      return m[1]
        .trim()
        .replace(/\s*\(VKN:\s*\d+\)\s*/gi, "")
        .trim();
    }
  }
  return "";
}

function extractTutar(metin: string): string {
  const m = metin.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*TL/i);
  if (!m) return "";
  return `${m[1]} TL`;
}

function extractDerece(metin: string): string {
  const labeled = metin.match(
    /derece[:\s]*(\d+)[^\d]{0,24}s[ıi]ra[:\s]*(\d+)/i
  );
  if (labeled) return `${labeled[1]}/${labeled[2]}`;

  const ipotekDerece = metin.match(
    /(?:ipotek|rehin)\s+derecesi[:\s]*(\d+)/i
  );
  if (ipotekDerece) return `${ipotekDerece[1]}/0`;

  const dereceden = metin.match(/(\d+\/\d+)\s+dereceden/i);
  if (dereceden) return dereceden[1];

  const sadeceDerece = metin.match(/(\d+)\s*\.\s*derece/i);
  if (sadeceDerece) return `${sadeceDerece[1]}/0`;

  return "";
}

function yevmiyeTarihEslestir(metin: string, tarih: string): string {
  const direct = extractYevmiye(metin);
  if (direct) return direct;

  if (!tarih) return "";

  const escaped = tarih.replace(/\./g, "\\.");
  const near = new RegExp(
    `${escaped}[^\\d]{0,120}?(\\d{3,8})(?:\\s|$|[^\\d.,])`,
    "i"
  );
  const m = metin.match(near);
  if (m?.[1]) return m[1];

  const before = new RegExp(
    `(\\d{3,8})[^\\d]{0,80}?${escaped}`,
    "i"
  );
  const m2 = metin.match(before);
  return m2?.[1]?.trim() ?? "";
}

function extractTarihYevmiye(metin: string): { tarih: string; yevmiye: string } {
  const tarih = extractTarih(metin);
  const yevmiye = yevmiyeTarihEslestir(metin, tarih);
  return { tarih, yevmiye };
}

function temizAciklama(metin: string): string {
  return metin
    .replace(/\(?(?:tarih|tarihi)[:\s]*\d{1,2}[./-]\d{1,2}[./-]\d{4}[^)]*\)?/gi, "")
    .replace(/\(?(?:yevmiye(?:\s+no)?)[:\s]*\d+[^)]*\)?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHaneSection(sectionText: string): HaneMaddesi[] {
  const cleaned = trimSectionTail(sectionText);
  if (!cleaned || KAYIT_YOK.test(cleaned)) return [];

  const blocks = cleaned
    .split(/\n\s*\n|\n(?=\d+[\.)]\s)/)
    .map((b) => b.trim())
    .filter(
      (b) =>
        b.length > 8 &&
        !KAYIT_YOK.test(b) &&
        !/BANKASI|BANK|A\.Ş\.|ipotek|rehin|TL/i.test(b)
    );

  if (blocks.length === 0 && cleaned.length > 8 && !/BANKASI|TL/i.test(cleaned)) {
    blocks.push(cleaned);
  }

  return blocks
    .map((block) => {
      const { tarih, yevmiye } = extractTarihYevmiye(block);
      const aciklama = temizAciklama(block);
      if (!aciklama || aciklama.length < 5) return null;
      return { aciklama, tarih, yevmiye };
    })
    .filter((m): m is HaneMaddesi => m !== null);
}

function dedupeRehin(entries: RehinKaydi[]): RehinKaydi[] {
  const seen = new Set<string>();
  const result: RehinKaydi[] = [];

  for (const e of entries) {
    const key = `${e.kurum}|${e.tutar}|${e.tarih}|${e.yevmiye}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }

  return result;
}

function extractRehinEntries(sectionText: string): RehinKaydi[] {
  const cleaned = trimSectionTail(sectionText);
  const flat = flattenMetin(cleaned);
  if (!flat || KAYIT_YOK.test(flat)) return [];

  const entries: RehinKaydi[] = [];
  const amountPattern = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*TL/gi;
  const hits: number[] = [];

  let m: RegExpExecArray | null;
  while ((m = amountPattern.exec(flat)) !== null) {
    hits.push(m.index);
  }

  if (hits.length === 0) {
    const single = parseRehinBlock(cleaned);
    return single ? [single] : [];
  }

  for (const idx of hits) {
    const start = Math.max(0, idx - 280);
    const end = Math.min(flat.length, idx + 100);
    const window = flat.slice(start, end);

    const kurum = extractKurum(window);
    const tutar = extractTutar(window);
    const tarih = extractTarih(window);
    const yevmiye = yevmiyeTarihEslestir(window, tarih);
    const derece = extractDerece(window);

    if (!kurum && !tutar) continue;

    entries.push({
      kurum: kurum || "…………",
      derece,
      tutar,
      tarih,
      yevmiye,
    });
  }

  return dedupeRehin(entries);
}

function splitRehinBlocks(sectionText: string): string[] {
  const normalized = trimSectionTail(normalizeMetin(sectionText));
  if (!normalized || KAYIT_YOK.test(normalized)) return [];

  const byBank = normalized
    .split(/(?=(?:T\.?\s*C\.?\s*)?TÜRKİYE\s+CUMHURİYETİ)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 20 && /TL/i.test(b));
  if (byBank.length > 1) return byBank;

  const byAmount = normalized
    .split(/(?=\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*TL\b)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 20 && /TL/i.test(b));
  if (byAmount.length > 1) return byAmount;

  if (/ipotek|rehin|banka|TL/i.test(normalized)) {
    return [normalized];
  }

  return [];
}

function parseRehinBlock(block: string): RehinKaydi | null {
  const flat = flattenMetin(trimSectionTail(block));
  const kurum = extractKurum(flat);
  const tutar = extractTutar(flat);
  const tarih = extractTarih(flat);
  const yevmiye = yevmiyeTarihEslestir(flat, tarih);
  const derece = extractDerece(flat);

  if (!kurum && !tutar && !/ipotek|rehin/i.test(flat)) return null;

  return {
    kurum: kurum || "…………",
    derece,
    tutar,
    tarih,
    yevmiye,
  };
}

function parseRehinSection(sectionText: string): RehinKaydi[] {
  const fromAmounts = extractRehinEntries(sectionText);
  if (fromAmounts.length > 0) return fromAmounts;

  const blocks = splitRehinBlocks(sectionText);
  return dedupeRehin(
    blocks.map(parseRehinBlock).filter((r): r is RehinKaydi => r !== null)
  );
}

export function parseTapuMetni(metin: string): TapuCikarimVerisi {
  const normalized = normalizeMetin(metin);
  const { tarih, saat } = extractBelgeTarihSaat(normalized);
  const sections = splitSections(normalized);

  const rehinMaddeleri = parseRehinSection(sections.rehin);

  return {
    belgeTarihi: tarih,
    belgeSaati: saat,
    beyanMaddeleri: parseHaneSection(sections.beyan),
    serhMaddeleri: parseHaneSection(sections.serh),
    hakVeMukellefiyetMaddeleri: parseHaneSection(sections.hak),
    rehinMaddeleri,
  };
}

export function analyzeTapuTextYerel(metin: string): { rapor: string } {
  const cikarim = parseTapuMetni(metin);
  return { rapor: olusturTapuRaporu(cikarim) };
}

function extractAdaParseller(metin: string): string[] {
  const found = new Set<string>();

  const patterns = [
    /(\d+)\s*ada\s*[/\s-]*(\d+)\s*parsel/gi,
    /ada[:\s]*(\d+)[^\n]{0,40}?parsel[:\s]*(\d+)/gi,
    /(\d+)\s*ADA\s*(\d+)\s*PARSEL/g,
  ];

  for (const regex of patterns) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(metin)) !== null) {
      found.add(`${m[1]} ada ${m[2]} parsel`);
    }
  }

  return Array.from(found);
}

export function parseBelgeMetni(
  metin: string,
  dosyaAdi: string
): BelgeCikarim {
  const cikarim = parseTapuMetni(metin);
  const adaParseller = extractAdaParseller(metin);

  return {
    dosyaAdi,
    adaParseller,
    beyanMaddeleri: cikarim.beyanMaddeleri,
    serhMaddeleri: cikarim.serhMaddeleri,
    hakVeMukellefiyetMaddeleri: cikarim.hakVeMukellefiyetMaddeleri,
    rehinMaddeleri: cikarim.rehinMaddeleri,
  };
}

export function analyzePortfoyYerel(
  belgeler: PortfoyBelgeGirdisi[]
): { rapor: string } {
  if (belgeler.length === 0) {
    throw new Error("Analiz için en az bir PDF gerekli.");
  }

  const parsed: BelgeCikarim[] = belgeler.map((b) =>
    parseBelgeMetni(b.metin, b.dosyaAdi)
  );

  const tarihSaatler = belgeler.map((b) => {
    const { belgeTarihi, belgeSaati } = parseTapuMetni(b.metin);
    return { tarih: belgeTarihi, saat: belgeSaati };
  });

  const gecerliTarihler = tarihSaatler.filter((t) => t.tarih);
  const gecerliSaatler = tarihSaatler.filter((t) => t.saat);

  const baslangicTarihi =
    gecerliTarihler.length > 0
      ? gecerliTarihler
          .map((t) => t.tarih)
          .sort((a, b) => a.localeCompare(b))[0]
      : "";

  const saatSirali = gecerliSaatler.map((t) => t.saat).sort();
  const baslangicSaati = saatSirali[0] ?? "";
  const bitisSaati = saatSirali[saatSirali.length - 1] ?? baslangicSaati;

  const cikarim = birlestirPortfoyBelgeler(parsed, {
    baslangicTarihi,
    baslangicSaati,
    bitisSaati,
  });

  return { rapor: olusturPortfoyRaporu(cikarim) };
}
