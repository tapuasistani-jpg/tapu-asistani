"use client";

import {
  Crosshair,
  Eraser,
  Hexagon,
  ImagePlus,
  Ruler,
  Scaling,
  Triangle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { pdfIlkSayfaDataUrl } from "@/lib/render-pdf-page";
import {
  IMAGE_ONLY_MESSAGE,
  isPdfFile,
  isProjectPlanFile,
  PROJECT_PLAN_ACCEPT,
} from "@/lib/file-types";

type Point = { x: number; y: number };

type Cizgi = {
  id: string;
  baslangic: Point;
  bitis: Point;
  metre?: number;
};

type Poligon = {
  id: string;
  noktalar: Point[];
  alanM2: number;
};

type Mod = "bekleme" | "kalibrasyon" | "mesafe" | "alan";

const ILK_NOKTA_YAKINLIK = 14;

function mesafePx(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function ortaNokta(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Shoelace — piksel kare alanı */
function cokgenAlaniPx(noktalar: Point[]): number {
  if (noktalar.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < noktalar.length; i++) {
    const j = (i + 1) % noktalar.length;
    sum += noktalar[i].x * noktalar[j].y - noktalar[j].x * noktalar[i].y;
  }
  return Math.abs(sum) / 2;
}

/** Çokgen ağırlık merkezi (etiket konumu) */
function cokgenMerkezi(noktalar: Point[]): Point {
  if (noktalar.length === 0) return { x: 0, y: 0 };
  if (noktalar.length < 3) {
    const sx = noktalar.reduce((s, p) => s + p.x, 0) / noktalar.length;
    const sy = noktalar.reduce((s, p) => s + p.y, 0) / noktalar.length;
    return { x: sx, y: sy };
  }

  let cx = 0;
  let cy = 0;
  let alan = 0;

  for (let i = 0; i < noktalar.length; i++) {
    const j = (i + 1) % noktalar.length;
    const cross =
      noktalar[i].x * noktalar[j].y - noktalar[j].x * noktalar[i].y;
    cx += (noktalar[i].x + noktalar[j].x) * cross;
    cy += (noktalar[i].y + noktalar[j].y) * cross;
    alan += cross;
  }

  alan *= 0.5;
  if (Math.abs(alan) < 1e-6) {
    const sx = noktalar.reduce((s, p) => s + p.x, 0) / noktalar.length;
    const sy = noktalar.reduce((s, p) => s + p.y, 0) / noktalar.length;
    return { x: sx, y: sy };
  }

  return { x: cx / (6 * alan), y: cy / (6 * alan) };
}

export default function ProjeOlcumAraci() {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arkaPlanRef = useRef<HTMLImageElement | null>(null);
  const ciftTikRef = useRef(false);

  const [dosyaAdi, setDosyaAdi] = useState<string | null>(null);
  const [arkaPlanHazir, setArkaPlanHazir] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const [mod, setMod] = useState<Mod>("bekleme");
  const [metrePerPiksel, setMetrePerPiksel] = useState<number | null>(null);

  const [kalibrasyonCizgisi, setKalibrasyonCizgisi] = useState<Cizgi | null>(
    null
  );
  const [mesafeCizgileri, setMesafeCizgileri] = useState<Cizgi[]>([]);
  const [tamamlananPoligonlar, setTamamlananPoligonlar] = useState<Poligon[]>(
    []
  );
  const [aktifPoligon, setAktifPoligon] = useState<{
    noktalar: Point[];
    imlec: Point | null;
  } | null>(null);

  const [aktifCizgi, setAktifCizgi] = useState<{
    baslangic: Point;
    bitis: Point;
  } | null>(null);

  const [kalibrasyonModal, setKalibrasyonModal] = useState(false);
  const [bekleyenPikselUzunluk, setBekleyenPikselUzunluk] = useState(0);
  const [gercekMetreGirdi, setGercekMetreGirdi] = useState("10");

  const [canvasBoyut, setCanvasBoyut] = useState({ width: 800, height: 520 });

  const olcekTanimli = metrePerPiksel !== null && metrePerPiksel > 0;

  const canvasBoyutunuGuncelle = useCallback(() => {
    const container = containerRef.current;
    const img = arkaPlanRef.current;
    if (!container || !img?.complete) return;

    const maxW = container.clientWidth;
    const maxH = 560;
    const oran = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    setCanvasBoyut({
      width: Math.round(img.naturalWidth * oran),
      height: Math.round(img.naturalHeight * oran),
    });
  }, []);

  const yenidenCiz = useCallback(() => {
    const canvas = canvasRef.current;
    const img = arkaPlanRef.current;
    if (!canvas || !img?.complete) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const noktaCiz = (p: Point, renk: string, vurgulu = false) => {
      ctx.beginPath();
      ctx.fillStyle = renk;
      ctx.arc(p.x, p.y, vurgulu ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const cizgiCiz = (
      a: Point,
      b: Point,
      renk: string,
      kesik: boolean,
      kalin = 2
    ) => {
      ctx.beginPath();
      ctx.strokeStyle = renk;
      ctx.lineWidth = kalin;
      ctx.setLineDash(kesik ? [8, 6] : []);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const etiketCiz = (konum: Point, metin: string, buyuk = false) => {
      ctx.font = buyuk
        ? "bold 16px system-ui, sans-serif"
        : "bold 13px system-ui, sans-serif";
      const padding = buyuk ? 10 : 6;
      const metinGen = ctx.measureText(metin).width;
      const yukseklik = buyuk ? 28 : 20;
      ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
      ctx.strokeStyle = buyuk ? "#059669" : "#2563eb";
      ctx.lineWidth = buyuk ? 2 : 1;
      const rx = konum.x - metinGen / 2 - padding;
      const ry = konum.y - yukseklik / 2 - padding / 2;
      const rw = metinGen + padding * 2;
      const rh = yukseklik + padding;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = buyuk ? "#047857" : "#1e40af";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(metin, konum.x, konum.y);
    };

    const poligonCiz = (
      noktalar: Point[],
      renkCizgi: string,
      renkDolgu: string,
      etiket?: string
    ) => {
      if (noktalar.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(noktalar[0].x, noktalar[0].y);
      for (let i = 1; i < noktalar.length; i++) {
        ctx.lineTo(noktalar[i].x, noktalar[i].y);
      }
      if (noktalar.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = renkDolgu;
        ctx.fill();
      }
      ctx.strokeStyle = renkCizgi;
      ctx.lineWidth = 2;
      ctx.stroke();

      noktalar.forEach((p, i) =>
        noktaCiz(p, renkCizgi, i === 0 && mod === "alan")
      );

      if (etiket && noktalar.length >= 3) {
        etiketCiz(cokgenMerkezi(noktalar), etiket, true);
      }
    };

    if (kalibrasyonCizgisi) {
      cizgiCiz(
        kalibrasyonCizgisi.baslangic,
        kalibrasyonCizgisi.bitis,
        "#d97706",
        false
      );
      noktaCiz(kalibrasyonCizgisi.baslangic, "#d97706");
      noktaCiz(kalibrasyonCizgisi.bitis, "#d97706");
      if (olcekTanimli) {
        const m =
          mesafePx(
            kalibrasyonCizgisi.baslangic,
            kalibrasyonCizgisi.bitis
          ) * metrePerPiksel!;
        etiketCiz(
          ortaNokta(
            kalibrasyonCizgisi.baslangic,
            kalibrasyonCizgisi.bitis
          ),
          `${m.toFixed(2)} m (kalibrasyon)`
        );
      }
    }

    for (const cizgi of mesafeCizgileri) {
      cizgiCiz(cizgi.baslangic, cizgi.bitis, "#2563eb", false);
      noktaCiz(cizgi.baslangic, "#2563eb");
      noktaCiz(cizgi.bitis, "#2563eb");
      if (cizgi.metre !== undefined) {
        etiketCiz(
          ortaNokta(cizgi.baslangic, cizgi.bitis),
          `${cizgi.metre.toFixed(2)} metre`
        );
      }
    }

    for (const pol of tamamlananPoligonlar) {
      poligonCiz(
        pol.noktalar,
        "#059669",
        "rgba(5, 150, 105, 0.22)",
        `${pol.alanM2.toFixed(2)} m²`
      );
    }

    if (aktifPoligon && aktifPoligon.noktalar.length > 0) {
      const { noktalar, imlec } = aktifPoligon;
      for (let i = 0; i < noktalar.length - 1; i++) {
        cizgiCiz(noktalar[i], noktalar[i + 1], "#7c3aed", false);
      }
      if (imlec && noktalar.length > 0) {
        cizgiCiz(
          noktalar[noktalar.length - 1],
          imlec,
          "#7c3aed",
          true
        );
      }
      noktalar.forEach((p, i) =>
        noktaCiz(p, "#7c3aed", i === 0 && noktalar.length >= 3)
      );

      if (noktalar.length >= 3 && olcekTanimli) {
        const onizleme = [...noktalar];
        if (imlec) onizleme.push(imlec);
        const alanM2 = cokgenAlaniPx(onizleme) * metrePerPiksel! ** 2;
        etiketCiz(cokgenMerkezi(noktalar), `${alanM2.toFixed(2)} m²`, true);
      }
    }

    if (aktifCizgi) {
      const renk = mod === "kalibrasyon" ? "#d97706" : "#2563eb";
      cizgiCiz(aktifCizgi.baslangic, aktifCizgi.bitis, renk, true);
      if (mod === "mesafe" && olcekTanimli) {
        const px = mesafePx(aktifCizgi.baslangic, aktifCizgi.bitis);
        const m = px * metrePerPiksel!;
        etiketCiz(
          ortaNokta(aktifCizgi.baslangic, aktifCizgi.bitis),
          `${m.toFixed(2)} metre`
        );
      }
    }
  }, [
    aktifCizgi,
    aktifPoligon,
    kalibrasyonCizgisi,
    metrePerPiksel,
    mesafeCizgileri,
    mod,
    olcekTanimli,
    tamamlananPoligonlar,
  ]);

  useEffect(() => {
    yenidenCiz();
  }, [yenidenCiz, canvasBoyut]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => canvasBoyutunuGuncelle());
    ro.observe(container);
    return () => ro.disconnect();
  }, [canvasBoyutunuGuncelle, arkaPlanHazir]);

  const olcumleriSifirla = () => {
    setMesafeCizgileri([]);
    setTamamlananPoligonlar([]);
    setAktifPoligon(null);
    setAktifCizgi(null);
  };

  const arkaPlanYukle = async (file: File) => {
    setYukleniyor(true);
    setHata(null);
    handleTemizle(false);

    try {
      let dataUrl: string;
      if (isPdfFile(file)) {
        dataUrl = await pdfIlkSayfaDataUrl(file);
      } else {
        dataUrl = URL.createObjectURL(file);
      }

      const img = new Image();
      img.onload = () => {
        arkaPlanRef.current = img;
        setDosyaAdi(file.name);
        setArkaPlanHazir(true);
        setYukleniyor(false);
        canvasBoyutunuGuncelle();
      };
      img.onerror = () => {
        setHata("Görsel yüklenemedi.");
        setYukleniyor(false);
      };
      img.src = dataUrl;
    } catch {
      setHata("Dosya işlenirken hata oluştu.");
      setYukleniyor(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isProjectPlanFile(file)) {
      setHata(IMAGE_ONLY_MESSAGE);
      return;
    }
    void arkaPlanYukle(file);
  };

  const handleTemizle = (sifirlaDosya = true) => {
    setMod("bekleme");
    setMetrePerPiksel(null);
    setKalibrasyonCizgisi(null);
    olcumleriSifirla();
    setKalibrasyonModal(false);
    setBekleyenPikselUzunluk(0);
    if (sifirlaDosya) {
      arkaPlanRef.current = null;
      setArkaPlanHazir(false);
      setDosyaAdi(null);
    }
  };

  const canvasKoordinat = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const poligonuKapat = useCallback(() => {
    if (!aktifPoligon || aktifPoligon.noktalar.length < 3 || !olcekTanimli) {
      return;
    }

    const noktalar = aktifPoligon.noktalar;
    const alanPx = cokgenAlaniPx(noktalar);
    const alanM2 = alanPx * metrePerPiksel! ** 2;

    setTamamlananPoligonlar((prev) => [
      ...prev,
      { id: `${Date.now()}`, noktalar, alanM2 },
    ]);
    setAktifPoligon(null);
  }, [aktifPoligon, metrePerPiksel, olcekTanimli]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mod !== "alan" || !olcekTanimli || !arkaPlanHazir) return;
    if (ciftTikRef.current) return;

    const p = canvasKoordinat(e);

    if (aktifPoligon && aktifPoligon.noktalar.length >= 3) {
      const ilk = aktifPoligon.noktalar[0];
      if (mesafePx(p, ilk) <= ILK_NOKTA_YAKINLIK) {
        poligonuKapat();
        return;
      }
    }

    setAktifPoligon((prev) => ({
      noktalar: [...(prev?.noktalar ?? []), p],
      imlec: p,
    }));
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mod !== "alan") return;
    e.preventDefault();
    ciftTikRef.current = true;
    poligonuKapat();
    window.setTimeout(() => {
      ciftTikRef.current = false;
    }, 80);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mod !== "kalibrasyon" && mod !== "mesafe") return;
    if (!arkaPlanHazir) return;
    const baslangic = canvasKoordinat(e);
    setAktifCizgi({ baslangic, bitis: baslangic });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = canvasKoordinat(e);

    if (mod === "alan" && aktifPoligon) {
      setAktifPoligon({ ...aktifPoligon, imlec: p });
      return;
    }

    if (!aktifCizgi) return;
    setAktifCizgi({ ...aktifCizgi, bitis: p });
  };

  const handleMouseUp = () => {
    if (!aktifCizgi) return;

    const px = mesafePx(aktifCizgi.baslangic, aktifCizgi.bitis);
    if (px < 4) {
      setAktifCizgi(null);
      return;
    }

    if (mod === "kalibrasyon") {
      setKalibrasyonCizgisi({
        id: "kal",
        baslangic: aktifCizgi.baslangic,
        bitis: aktifCizgi.bitis,
      });
      setBekleyenPikselUzunluk(px);
      setKalibrasyonModal(true);
      setAktifCizgi(null);
      return;
    }

    if (mod === "mesafe" && olcekTanimli) {
      const metre = px * metrePerPiksel!;
      setMesafeCizgileri((prev) => [
        ...prev,
        {
          id: `${Date.now()}`,
          baslangic: aktifCizgi.baslangic,
          bitis: aktifCizgi.bitis,
          metre,
        },
      ]);
    }

    setAktifCizgi(null);
  };

  const kalibrasyonuOnayla = () => {
    const metre = parseFloat(gercekMetreGirdi.replace(",", "."));
    if (!Number.isFinite(metre) || metre <= 0) {
      setHata("Geçerli bir metre değeri girin (ör. 10).");
      return;
    }
    if (bekleyenPikselUzunluk <= 0) return;

    setMetrePerPiksel(metre / bekleyenPikselUzunluk);
    setKalibrasyonModal(false);
    setMod("alan");
    setHata(null);
  };

  const kalibrasyonuIptal = () => {
    setKalibrasyonModal(false);
    setKalibrasyonCizgisi(null);
    setMod("kalibrasyon");
  };

  const kalibrasyonuYenidenBaslat = () => {
    setMod("kalibrasyon");
    setKalibrasyonCizgisi(null);
    setMetrePerPiksel(null);
    olcumleriSifirla();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Ruler className="h-5 w-5 text-brand-600" />
            Proje Ölçüm Aracı
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ölçek kalibre edin; parsel veya bina alanını m² olarak ölçün
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={yukleniyor}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          Görsel / PDF Yükle
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={PROJECT_PLAN_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {hata && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {hata}
        </p>
      )}

      {arkaPlanHazir && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <button
            type="button"
            onClick={kalibrasyonuYenidenBaslat}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mod === "kalibrasyon"
                ? "bg-amber-600 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-amber-50"
            }`}
          >
            <Scaling className="h-4 w-4" />
            Ölçek Tanımla
          </button>

          <button
            type="button"
            disabled={!olcekTanimli}
            onClick={() => {
              setMod("mesafe");
              setAktifPoligon(null);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              mod === "mesafe"
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50"
            }`}
          >
            <Crosshair className="h-4 w-4" />
            Mesafe Ölç
          </button>

          <button
            type="button"
            disabled={!olcekTanimli}
            onClick={() => {
              setMod("alan");
              setAktifCizgi(null);
            }}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              mod === "alan"
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-emerald-50"
            }`}
          >
            <Hexagon className="h-4 w-4" />
            Alan Ölç (m²)
          </button>

          {mod === "alan" &&
            aktifPoligon &&
            aktifPoligon.noktalar.length >= 3 && (
              <button
                type="button"
                onClick={poligonuKapat}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
              >
                <Hexagon className="h-4 w-4" />
                Alanı Kapat
              </button>
            )}

          <button
            type="button"
            onClick={() => handleTemizle(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-700"
          >
            <Eraser className="h-4 w-4" />
            Temizle
          </button>

          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            {dosyaAdi && (
              <span className="rounded-full bg-white px-3 py-1 text-slate-600 ring-1 ring-slate-200">
                {dosyaAdi}
              </span>
            )}
            {olcekTanimli && (
              <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
                Ölçek: 1 px = {metrePerPiksel!.toFixed(6)} m
              </span>
            )}
            {mod === "kalibrasyon" && (
              <span className="rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-800">
                Bilinen mesafeye çizgi çizin
              </span>
            )}
            {mod === "mesafe" && (
              <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800">
                Sürükleyerek mesafe ölçün
              </span>
            )}
            {mod === "alan" && (
              <span className="rounded-full bg-violet-100 px-3 py-1 font-medium text-violet-800">
                Köşelere tıklayın; ilk noktaya veya çift tık ile kapatın
              </span>
            )}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative flex justify-center overflow-auto rounded-lg border border-slate-300 bg-slate-800/5"
      >
        {yukleniyor && (
          <div className="flex min-h-[400px] w-full items-center justify-center">
            <p className="text-sm text-slate-500">Plan yükleniyor…</p>
          </div>
        )}

        {!yukleniyor && !arkaPlanHazir && (
          <div className="flex min-h-[480px] w-full flex-col items-center justify-center p-8 text-center">
            <Hexagon className="mb-4 h-16 w-16 text-slate-300" />
            <p className="text-base font-medium text-slate-600">
              İmar planı veya proje görseli yükleyin
            </p>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Ölçek tanımlayın, ardından parsel sınırına tıklayarak alan (m²)
              ölçün.
            </p>
          </div>
        )}

        {arkaPlanHazir && !yukleniyor && (
          <canvas
            ref={canvasRef}
            width={canvasBoyut.width}
            height={canvasBoyut.height}
            onClick={handleCanvasClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (aktifCizgi) handleMouseUp();
            }}
            className={`max-w-full ${
              mod !== "bekleme" ? "cursor-crosshair" : "cursor-default"
            }`}
            aria-label="Proje ölçüm canvas"
          />
        )}
      </div>

      {arkaPlanHazir && (
        <ol className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
          <li className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <Triangle className="h-4 w-4 shrink-0 text-brand-600" />
            <span>
              <strong className="text-slate-800">1. Yükle</strong> — Plan veya
              PDF.
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <Scaling className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong className="text-slate-800">2. Kalibre</strong> — Bilinen
              mesafe (m).
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <Hexagon className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong className="text-slate-800">3. Alan</strong> — Köşeleri
              tıklayın, kapatın.
            </span>
          </li>
          <li className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <Crosshair className="h-4 w-4 shrink-0 text-brand-600" />
            <span>
              <strong className="text-slate-800">4. Mesafe</strong> — İsteğe
              bağlı çizgi ölçümü.
            </span>
          </li>
        </ol>
      )}

      {kalibrasyonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-labelledby="kalibrasyon-baslik"
          >
            <h3
              id="kalibrasyon-baslik"
              className="text-lg font-semibold text-slate-900"
            >
              Ölçek Kalibrasyonu
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Çizgi uzunluğu:{" "}
              <strong>{bekleyenPikselUzunluk.toFixed(1)} px</strong>. Gerçek
              mesafe kaç metre?
            </p>
            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">
                Gerçek mesafe (metre)
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={gercekMetreGirdi}
                onChange={(e) => setGercekMetreGirdi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                placeholder="ör. 10"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && kalibrasyonuOnayla()}
              />
            </label>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={kalibrasyonuOnayla}
                className="flex-1 rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Ölçeği Kaydet
              </button>
              <button
                type="button"
                onClick={kalibrasyonuIptal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
