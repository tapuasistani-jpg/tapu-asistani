export type TapuAnalizSonucu = {
  /** Sabit şablonda biçimlendirilmiş takyidat raporu metni */
  rapor: string;
};

export async function analyzeTapuPdf(file: File): Promise<TapuAnalizSonucu> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/analyze-tapu", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as TapuAnalizSonucu & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Analiz sırasında bir hata oluştu.");
  }

  return { rapor: data.rapor };
}

export async function analyzePortfoyPdfs(
  files: File[]
): Promise<TapuAnalizSonucu> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/analyze-portfolio", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as TapuAnalizSonucu & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Portföy analizi sırasında bir hata oluştu.");
  }

  return { rapor: data.rapor };
}
