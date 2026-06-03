import {
  normalizeHaneArray,
  normalizeRehinArray,
} from "./openai-parse";
import {
  normalizeTarih,
  type HaneMaddesi,
  type RehinKaydi,
} from "./tapu-rapor-sablon";
import type {
  PortfoyCikarimVerisi,
  PortfoyHaneMaddesi,
  PortfoyRehinKaydi,
} from "./portfoy-rapor-sablon";
import { TUM_TASINMAZLAR } from "./portfoy-rapor-sablon";

export { TUM_TASINMAZLAR };

/** Belge başına GPT çıkarımı */
export type BelgeCikarim = {
  dosyaAdi: string;
  adaParseller: string[];
  beyanMaddeleri: HaneMaddesi[];
  serhMaddeleri: HaneMaddesi[];
  hakVeMukellefiyetMaddeleri: HaneMaddesi[];
  rehinMaddeleri: RehinKaydi[];
};

type HaneGrup = {
  madde: HaneMaddesi;
  kimlikler: Set<string>;
  belgeIndeksleri: Set<number>;
};

type RehinGrup = {
  kayit: RehinKaydi;
  kimlikler: Set<string>;
  belgeIndeksleri: Set<number>;
};

function normalizeKimlik(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseAdaParselListesi(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function buildKimlikEtiketHaritasi(
  belgeler: BelgeCikarim[]
): Map<string, string> {
  const harita = new Map<string, string>();
  for (const belge of belgeler) {
    for (const ap of belge.adaParseller) {
      const kimlik = normalizeKimlik(ap);
      if (!harita.has(kimlik)) {
        harita.set(kimlik, ap.trim());
      }
    }
  }
  return harita;
}

function tumTasinmazKimlikleri(belgeler: BelgeCikarim[]): Set<string> {
  const set = new Set<string>();
  for (const belge of belgeler) {
    for (const ap of belge.adaParseller) {
      set.add(normalizeKimlik(ap));
    }
  }
  return set;
}

function gecerliBelgeler(belgeler: BelgeCikarim[]): BelgeCikarim[] {
  return belgeler.filter((b) => b.adaParseller.length > 0);
}

/** "3083 SAYILI KANUN" vb. kanun numaralarını çıkarır */
function kanunNumaralariniCikar(metin: string): string[] {
  const nums = new Set<string>();
  const regex = /(\d{3,5})\s*SAYILI\s*KANUN/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(metin)) !== null) {
    nums.add(m[1]);
  }
  return Array.from(nums).sort();
}

function metinKarsilastirmaAnahtari(metin: string): string {
  return metin
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9]/g, "");
}

function levenshteinOrani(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const dist = matrix[b.length][a.length];
  return 1 - dist / Math.max(a.length, b.length);
}

/** En okunaklı / doğru yazımlı metni seçer */
function enIyiAciklamayiSec(mevcut: string, aday: string): string {
  const skor = (t: string) => {
    let p = 0;
    if (/GEREĞİNCE/i.test(t)) p += 20;
    if (/GER[ĞG]İNCE|GEREİNCE|GEREGINCE/i.test(t)) p -= 8;
    if (/ŞERH/i.test(t)) p += 10;
    if (/\bSERH\b/i.test(t) && !/ŞERH/i.test(t)) p -= 6;
    if (/SAYILI\s+KANUN/i.test(t)) p += 8;
    if (/Ğ|Ş|İ|Ö|Ü|Ç/.test(t)) p += 4;
    p += Math.min(t.length, 120) / 120;
    return p;
  };
  return skor(aday) > skor(mevcut) ? aday : mevcut;
}

function beyanlarAyniMi(a: HaneMaddesi, b: HaneMaddesi): boolean {
  const tarihA = normalizeTarih(a.tarih);
  const tarihB = normalizeTarih(b.tarih);
  const yevA = a.yevmiye.trim();
  const yevB = b.yevmiye.trim();

  if (!tarihA || !tarihB || !yevA || !yevB) return false;
  if (tarihA !== tarihB || yevA !== yevB) return false;

  const kanunA = kanunNumaralariniCikar(a.aciklama);
  const kanunB = kanunNumaralariniCikar(b.aciklama);

  if (kanunA.length > 0 && kanunB.length > 0) {
    return kanunA.join(",") === kanunB.join(",");
  }

  const anaA = metinKarsilastirmaAnahtari(a.aciklama);
  const anaB = metinKarsilastirmaAnahtari(b.aciklama);
  if (anaA === anaB) return true;

  return levenshteinOrani(anaA, anaB) >= 0.82;
}

function serhVeHakAyniMi(a: HaneMaddesi, b: HaneMaddesi): boolean {
  const tarihA = normalizeTarih(a.tarih);
  const tarihB = normalizeTarih(b.tarih);
  const yevA = a.yevmiye.trim();
  const yevB = b.yevmiye.trim();

  if (tarihA && tarihB && yevA && yevB) {
    if (tarihA === tarihB && yevA === yevB) {
      const kanunA = kanunNumaralariniCikar(a.aciklama);
      const kanunB = kanunNumaralariniCikar(b.aciklama);
      if (kanunA.length > 0 && kanunB.length > 0) {
        return kanunA.join(",") === kanunB.join(",");
      }
      const anaA = metinKarsilastirmaAnahtari(a.aciklama);
      const anaB = metinKarsilastirmaAnahtari(b.aciklama);
      if (anaA === anaB) return true;
      return levenshteinOrani(anaA, anaB) >= 0.85;
    }
  }

  const anaA = metinKarsilastirmaAnahtari(a.aciklama);
  const anaB = metinKarsilastirmaAnahtari(b.aciklama);
  return anaA === anaB || levenshteinOrani(anaA, anaB) >= 0.9;
}

function haneGruplariniBul(
  belgeler: BelgeCikarim[],
  secici: (b: BelgeCikarim) => HaneMaddesi[],
  eslestir: (a: HaneMaddesi, b: HaneMaddesi) => boolean
): HaneGrup[] {
  const gruplar: HaneGrup[] = [];

  belgeler.forEach((belge, belgeIndex) => {
    if (belge.adaParseller.length === 0) return;

    for (const madde of secici(belge)) {
      let grup = gruplar.find((g) => eslestir(g.madde, madde));

      if (!grup) {
        grup = {
          madde: { ...madde },
          kimlikler: new Set(),
          belgeIndeksleri: new Set(),
        };
        gruplar.push(grup);
      } else {
        grup.madde = {
          ...grup.madde,
          aciklama: enIyiAciklamayiSec(grup.madde.aciklama, madde.aciklama),
          tarih: grup.madde.tarih || madde.tarih,
          yevmiye: grup.madde.yevmiye || madde.yevmiye,
        };
      }

      grup.belgeIndeksleri.add(belgeIndex);
      for (const ap of belge.adaParseller) {
        grup.kimlikler.add(normalizeKimlik(ap));
      }
    }
  });

  return gruplar;
}

function normalizeKurum(kurum: string): string {
  return kurum
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function normalizeDerece(derece: string): string {
  return derece.trim().replace(/\s+/g, "");
}

function tutarAnahtari(tutar: string): string {
  return tutar.replace(/[^\d]/g, "");
}

function rehinlerAyniMi(a: RehinKaydi, b: RehinKaydi): boolean {
  const tarihA = normalizeTarih(a.tarih);
  const tarihB = normalizeTarih(b.tarih);
  const yevA = a.yevmiye.trim();
  const yevB = b.yevmiye.trim();

  if (!tarihA || !tarihB || !yevA || !yevB) return false;

  return (
    normalizeKurum(a.kurum) === normalizeKurum(b.kurum) &&
    normalizeDerece(a.derece) === normalizeDerece(b.derece) &&
    tutarAnahtari(a.tutar) === tutarAnahtari(b.tutar) &&
    tarihA === tarihB &&
    yevA === yevB
  );
}

function enIyiKurumAdiniSec(mevcut: string, aday: string): string {
  const skor = (t: string) => {
    let p = t.length;
    if (/A\.Ş\.|A\.S\./i.test(t)) p += 5;
    if (t === t.toLocaleUpperCase("tr-TR")) p += 2;
    return p;
  };
  return skor(aday) > skor(mevcut) ? aday : mevcut;
}

function tumTasinmazMi(
  belgeIndeksleri: Set<number>,
  kimlikler: Set<string>,
  tumKimlikler: Set<string>,
  toplamBelgeSayisi: number
): boolean {
  if (toplamBelgeSayisi > 0 && belgeIndeksleri.size >= toplamBelgeSayisi) {
    return true;
  }
  if (tumKimlikler.size === 0) return false;
  if (kimlikler.size < tumKimlikler.size) return false;
  for (const k of tumKimlikler) {
    if (!kimlikler.has(k)) return false;
  }
  return true;
}

function adaParselEtiketiOlustur(
  grup: { kimlikler: Set<string>; belgeIndeksleri: Set<number> },
  tumKimlikler: Set<string>,
  etiketHaritasi: Map<string, string>,
  toplamBelgeSayisi: number
): string {
  if (grup.kimlikler.size === 0) return "";

  if (
    tumTasinmazMi(
      grup.belgeIndeksleri,
      grup.kimlikler,
      tumKimlikler,
      toplamBelgeSayisi
    )
  ) {
    return TUM_TASINMAZLAR;
  }

  const etiketler = Array.from(grup.kimlikler)
    .map((k) => etiketHaritasi.get(k) ?? k)
    .sort((a, b) => a.localeCompare(b, "tr"));

  return etiketler.join(", ");
}

function gruplariPortfoyHaneyeCevir(
  gruplar: HaneGrup[],
  belgeler: BelgeCikarim[]
): PortfoyHaneMaddesi[] {
  const gecerli = gecerliBelgeler(belgeler);
  const tumKimlikler = tumTasinmazKimlikleri(gecerli);
  const etiketHaritasi = buildKimlikEtiketHaritasi(gecerli);

  return gruplar.map((grup) => ({
    ...grup.madde,
    adaParseller: adaParselEtiketiOlustur(
      grup,
      tumKimlikler,
      etiketHaritasi,
      gecerli.length
    ),
  }));
}

function birlestirBeyanMaddeleri(belgeler: BelgeCikarim[]): PortfoyHaneMaddesi[] {
  const gecerli = gecerliBelgeler(belgeler);
  const gruplar = haneGruplariniBul(
    gecerli,
    (b) => b.beyanMaddeleri,
    beyanlarAyniMi
  );
  return gruplariPortfoyHaneyeCevir(gruplar, gecerli);
}

function birlestirSerhVeHakMaddeleri(
  belgeler: BelgeCikarim[],
  secici: (b: BelgeCikarim) => HaneMaddesi[]
): PortfoyHaneMaddesi[] {
  const gecerli = gecerliBelgeler(belgeler);
  const gruplar = haneGruplariniBul(gecerli, secici, serhVeHakAyniMi);
  return gruplariPortfoyHaneyeCevir(gruplar, gecerli);
}

function birlestirRehinMaddeleri(belgeler: BelgeCikarim[]): PortfoyRehinKaydi[] {
  const gecerli = gecerliBelgeler(belgeler);
  const tumKimlikler = tumTasinmazKimlikleri(gecerli);
  const etiketHaritasi = buildKimlikEtiketHaritasi(gecerli);
  const gruplar: RehinGrup[] = [];

  gecerli.forEach((belge, belgeIndex) => {
    for (const kayit of belge.rehinMaddeleri) {
      let grup = gruplar.find((g) => rehinlerAyniMi(g.kayit, kayit));

      if (!grup) {
        grup = {
          kayit: { ...kayit },
          kimlikler: new Set(),
          belgeIndeksleri: new Set(),
        };
        gruplar.push(grup);
      } else {
        grup.kayit = {
          ...grup.kayit,
          kurum: enIyiKurumAdiniSec(grup.kayit.kurum, kayit.kurum),
          derece: grup.kayit.derece || kayit.derece,
          tutar: grup.kayit.tutar || kayit.tutar,
          tarih: grup.kayit.tarih || kayit.tarih,
          yevmiye: grup.kayit.yevmiye || kayit.yevmiye,
        };
      }

      grup.belgeIndeksleri.add(belgeIndex);
      for (const ap of belge.adaParseller) {
        grup.kimlikler.add(normalizeKimlik(ap));
      }
    }
  });

  return gruplar.map((grup) => ({
    ...grup.kayit,
    adaParseller: adaParselEtiketiOlustur(
      grup,
      tumKimlikler,
      etiketHaritasi,
      gecerli.length
    ),
  }));
}

/**
 * Belge bazlı çıkarımları akıllı gruplandırma ile tek portföy verisine dönüştürür.
 */
export function birlestirPortfoyBelgeler(
  belgeler: BelgeCikarim[],
  giris: {
    baslangicTarihi: string;
    baslangicSaati: string;
    bitisSaati: string;
  }
): PortfoyCikarimVerisi {
  return {
    baslangicTarihi: giris.baslangicTarihi,
    baslangicSaati: giris.baslangicSaati,
    bitisSaati: giris.bitisSaati,
    beyanMaddeleri: birlestirBeyanMaddeleri(belgeler),
    serhMaddeleri: birlestirSerhVeHakMaddeleri(
      belgeler,
      (b) => b.serhMaddeleri
    ),
    hakVeMukellefiyetMaddeleri: birlestirSerhVeHakMaddeleri(
      belgeler,
      (b) => b.hakVeMukellefiyetMaddeleri
    ),
    rehinMaddeleri: birlestirRehinMaddeleri(belgeler),
  };
}

export function parseBelgeCikarim(
  item: unknown,
  varsayilanDosyaAdi: string
): BelgeCikarim | null {
  if (!item || typeof item !== "object") return null;

  const o = item as Record<string, unknown>;
  const adaParseller = parseAdaParselListesi(
    o.adaParseller ?? o.adaParsel ?? o.tasinmazKimlikleri
  );

  return {
    dosyaAdi: String(o.dosyaAdi ?? varsayilanDosyaAdi).trim(),
    adaParseller,
    beyanMaddeleri: normalizeHaneArray(o.beyanMaddeleri),
    serhMaddeleri: normalizeHaneArray(o.serhMaddeleri),
    hakVeMukellefiyetMaddeleri: normalizeHaneArray(
      o.hakVeMukellefiyetMaddeleri
    ),
    rehinMaddeleri: normalizeRehinArray(o.rehinMaddeleri),
  };
}
