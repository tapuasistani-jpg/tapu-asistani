/** Beyan / şerh / hak ve mükellefiyet maddesi */
export type HaneMaddesi = {
  aciklama: string;
  tarih: string;
  yevmiye: string;
};

/** Rehinler (ipotek) kaydı */
export type RehinKaydi = {
  kurum: string;
  derece: string;
  tutar: string;
  tarih: string;
  yevmiye: string;
};

export type TapuCikarimVerisi = {
  belgeTarihi: string;
  belgeSaati: string;
  beyanMaddeleri: HaneMaddesi[];
  serhMaddeleri: HaneMaddesi[];
  hakVeMukellefiyetMaddeleri: HaneMaddesi[];
  rehinMaddeleri: RehinKaydi[];
};

const BEYAN_YOK = "Herhangi bir beyan kaydı bulunmamaktadır.";
const SERH_YOK = "Herhangi bir şerh kaydı bulunmamaktadır.";
const HAK_YOK = "Herhangi bir hak ve mükellefiyet kaydı bulunmamaktadır.";
const REHIN_YOK = "Herhangi bir rehin/ipotek kaydı bulunmamaktadır.";

function pad2(n: string): string {
  return n.padStart(2, "0");
}

/** Tüm tarihleri GG.AA.YYYY (noktalı) formata çevirir */
export function normalizeTarih(tarih: string): string {
  const t = tarih?.trim();
  if (!t) return "";

  const dot = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dot) {
    return `${pad2(dot[1])}.${pad2(dot[2])}.${dot[3]}`;
  }

  const dmy = t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    return `${pad2(dmy[1])}.${pad2(dmy[2])}.${dmy[3]}`;
  }

  const ymd = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymd) {
    return `${pad2(ymd[3])}.${pad2(ymd[2])}.${ymd[1]}`;
  }

  return t;
}

/** Rapordaki kalan tireli tarihleri noktalıya çevirir (saat HH:MM korunur) */
export function normalizeTarihlerMetin(metin: string): string {
  return metin
    .replace(/(\d{1,2})-(\d{1,2})-(\d{4})/g, (_, g, a, y) =>
      `${pad2(g)}.${pad2(a)}.${y}`
    )
    .replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (_, g, a, y) =>
      `${pad2(g)}.${pad2(a)}.${y}`
    );
}

function formatTarihYevmiyeParantez(tarih: string, yevmiye: string): string {
  const t = normalizeTarih(tarih) || "…………";
  const y = yevmiye?.trim() || "…………";
  return `(Tarih: ${t} - Yevmiye: ${y})`;
}

function formatHaneMadde(madde: HaneMaddesi): string {
  const aciklama = madde.aciklama.trim();
  return `- ${aciklama} ${formatTarihYevmiyeParantez(madde.tarih, madde.yevmiye)}`;
}

function formatHane(maddeler: HaneMaddesi[], yokMetni: string): string {
  if (!maddeler?.length) {
    return `- ${yokMetni}`;
  }
  return maddeler.map(formatHaneMadde).join("\n");
}

function formatRehinKaydi(kayit: RehinKaydi): string {
  const kurum = kayit.kurum.trim() || "…………";
  const derece = kayit.derece.trim() || "…………";
  const tutar = kayit.tutar.trim() || "…………";
  const tarih = normalizeTarih(kayit.tarih) || "…………";
  const yevmiye = kayit.yevmiye.trim() || "…………";

  return `- ${kurum} lehine ${derece} dereceden ${tutar} bedelle ${tarih} tarih, ${yevmiye} yevmiyeli ipotek kaydı görülmüştür.`;
}

function formatRehinler(maddeler: RehinKaydi[]): string {
  if (!maddeler?.length) {
    return `- ${REHIN_YOK}`;
  }
  return maddeler.map(formatRehinKaydi).join("\n");
}

/**
 * Gayrimenkul takyidat raporu — kelime kalıpları ve düzen şablona sabittir.
 */
export function olusturTapuRaporu(veri: TapuCikarimVerisi): string {
  const tarih = normalizeTarih(veri.belgeTarihi) || "…………";
  const saat = veri.belgeSaati?.trim() || "…………";

  const rapor = `Web Tapu portaldan elektronik ortamda ${tarih} tarih ve saat ${saat} itibarıyla alınan ve rapor ekinde yer alan Tapu Kayıt Belgesi'ne göre taşınmaz üzerinde aşağıda yer alan takyidatlar bulunmaktadır.

Beyanlar Hanesinde:
${formatHane(veri.beyanMaddeleri, BEYAN_YOK)}

Şerhler Hanesinde:
${formatHane(veri.serhMaddeleri, SERH_YOK)}

Hak ve Mükellefiyetler Hanesinde:
${formatHane(veri.hakVeMukellefiyetMaddeleri, HAK_YOK)}

Rehinler Hanesinde:
${formatRehinler(veri.rehinMaddeleri)}`;

  return normalizeTarihlerMetin(rapor);
}
