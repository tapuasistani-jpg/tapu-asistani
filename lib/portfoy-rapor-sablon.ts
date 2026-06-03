import {
  normalizeTarih,
  normalizeTarihlerMetin,
  type HaneMaddesi,
  type RehinKaydi,
} from "./tapu-rapor-sablon";

export const TUM_TASINMAZLAR = "Tüm taşınmazlar üzerinde";

/** Portföy raporunda ada/parsel bilgisi ekli hane maddesi */
export type PortfoyHaneMaddesi = HaneMaddesi & {
  adaParseller: string;
};

export type PortfoyRehinKaydi = RehinKaydi & {
  adaParseller: string;
};

export type PortfoyCikarimVerisi = {
  baslangicTarihi: string;
  baslangicSaati: string;
  bitisSaati: string;
  beyanMaddeleri: PortfoyHaneMaddesi[];
  serhMaddeleri: PortfoyHaneMaddesi[];
  hakVeMukellefiyetMaddeleri: PortfoyHaneMaddesi[];
  rehinMaddeleri: PortfoyRehinKaydi[];
};

const BEYAN_YOK = "Herhangi bir beyan kaydı bulunmamaktadır.";
const SERH_YOK = "Herhangi bir şerh kaydı bulunmamaktadır.";
const HAK_YOK = "Herhangi bir hak ve mükellefiyet kaydı bulunmamaktadır.";
const REHIN_YOK = "Herhangi bir rehin/ipotek kaydı bulunmamaktadır.";

function formatTarihYevmiyeParantez(tarih: string, yevmiye: string): string {
  const t = normalizeTarih(tarih) || "…………";
  const y = yevmiye?.trim() || "…………";
  return `(Tarih: ${t} - Yevmiye: ${y})`;
}

function formatAdaParselParantez(adaParseller: string): string {
  const s = adaParseller.trim();
  if (!s) return "";
  if (s === TUM_TASINMAZLAR || /tüm taşınmazlar üzerinde/i.test(s)) {
    return ` (${TUM_TASINMAZLAR})`;
  }
  if (/nolu taşınmaz/i.test(s)) {
    return ` (${s})`;
  }
  return ` (${s} nolu taşınmazlar üzerinde)`;
}

function formatPortfoyHaneMadde(madde: PortfoyHaneMaddesi): string {
  const aciklama = madde.aciklama.trim();
  const ada = formatAdaParselParantez(madde.adaParseller);
  return `- ${aciklama} ${formatTarihYevmiyeParantez(madde.tarih, madde.yevmiye)}${ada}`;
}

function formatPortfoyHane(
  maddeler: PortfoyHaneMaddesi[],
  yokMetni: string
): string {
  if (!maddeler?.length) {
    return `- ${yokMetni}`;
  }
  return maddeler.map(formatPortfoyHaneMadde).join("\n");
}

function formatPortfoyRehinKaydi(kayit: PortfoyRehinKaydi): string {
  const kurum = kayit.kurum.trim() || "…………";
  const derece = kayit.derece.trim() || "…………";
  const tutar = kayit.tutar.trim() || "…………";
  const tarih = normalizeTarih(kayit.tarih) || "…………";
  const yevmiye = kayit.yevmiye.trim() || "…………";
  const ada = formatAdaParselParantez(kayit.adaParseller);

  return `- ${kurum} lehine ${derece} dereceden ${tutar} bedelle ${tarih} tarih, ${yevmiye} yevmiyeli ipotek kaydı görülmüştür.${ada}`;
}

function formatPortfoyRehinler(maddeler: PortfoyRehinKaydi[]): string {
  if (!maddeler?.length) {
    return `- ${REHIN_YOK}`;
  }
  return maddeler.map(formatPortfoyRehinKaydi).join("\n");
}

/**
 * Birleşik portföy takyidat raporu — çoklu tapu belgeleri tek raporda.
 */
export function olusturPortfoyRaporu(veri: PortfoyCikarimVerisi): string {
  const baslangicTarihi =
    normalizeTarih(veri.baslangicTarihi) || "…………";
  const baslangicSaati = veri.baslangicSaati?.trim() || "…………";
  const bitisSaati = veri.bitisSaati?.trim() || "…………";

  const rapor = `Web Tapu portaldan elektronik ortamda ${baslangicTarihi} tarih ve saat ${baslangicSaati} - ${bitisSaati} itibarıyla alınan ve rapor eklerinde yer alan Tapu Kayıt Belgelerine göre taşınmazlar üzerinde aşağıda yer alan takyidatlar bulunmaktadır.

Beyanlar Hanesinde:
${formatPortfoyHane(veri.beyanMaddeleri, BEYAN_YOK)}

Şerhler Hanesinde:
${formatPortfoyHane(veri.serhMaddeleri, SERH_YOK)}

Hak ve Mükellefiyetler Hanesinde:
${formatPortfoyHane(veri.hakVeMukellefiyetMaddeleri, HAK_YOK)}

Rehinler Hanesinde:
${formatPortfoyRehinler(veri.rehinMaddeleri)}`;

  return normalizeTarihlerMetin(rapor);
}
