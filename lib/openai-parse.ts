import type { HaneMaddesi, RehinKaydi } from "./tapu-rapor-sablon";

export function parseHaneMaddesi(item: unknown): HaneMaddesi | null {
  if (typeof item === "string") {
    const s = item.trim();
    if (!s || s === "[object Object]") return null;
    return { aciklama: s, tarih: "", yevmiye: "" };
  }

  if (!item || typeof item !== "object") return null;

  const o = item as Record<string, unknown>;
  const aciklama = String(
    o.aciklama ?? o.metin ?? o.icerik ?? o.beyan ?? o.serh ?? ""
  ).trim();

  if (!aciklama || aciklama === "[object Object]") return null;

  return {
    aciklama,
    tarih: String(o.tarih ?? "").trim(),
    yevmiye: String(o.yevmiye ?? o.yevmiyeNo ?? "").trim(),
  };
}

export function parseRehinKaydi(item: unknown): RehinKaydi | null {
  if (typeof item === "string") {
    const s = item.trim();
    if (!s || s === "[object Object]") return null;
    return {
      kurum: s,
      derece: "",
      tutar: "",
      tarih: "",
      yevmiye: "",
    };
  }

  if (!item || typeof item !== "object") return null;

  const o = item as Record<string, unknown>;

  const kurum = String(
    o.kurum ?? o.banka ?? o.kurumAdi ?? o.lehtar ?? o.alacakli ?? ""
  ).trim();

  const derece = String(o.derece ?? o.ipotekDerecesi ?? "").trim();
  const tutar = String(o.tutar ?? o.bedel ?? o.miktar ?? "").trim();
  const tarih = String(o.tarih ?? "").trim();
  const yevmiye = String(o.yevmiye ?? o.yevmiyeNo ?? "").trim();

  if (!kurum && !derece && !tutar && !tarih && !yevmiye) return null;

  return { kurum, derece, tutar, tarih, yevmiye };
}

export function normalizeHaneArray(value: unknown): HaneMaddesi[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseHaneMaddesi)
    .filter((m): m is HaneMaddesi => m !== null);
}

export function normalizeRehinArray(value: unknown): RehinKaydi[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseRehinKaydi)
    .filter((r): r is RehinKaydi => r !== null);
}
