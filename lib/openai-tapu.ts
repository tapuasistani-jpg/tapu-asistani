import OpenAI from "openai";
import type { TapuAnalizSonucu } from "./tapu-analiz";
import {
  normalizeHaneArray,
  normalizeRehinArray,
} from "./openai-parse";
import {
  olusturTapuRaporu,
  type TapuCikarimVerisi,
} from "./tapu-rapor-sablon";

const SYSTEM_PROMPT = `Sen Türkiye tapu kayıtları ve gayrimenkul due diligence konusunda uzman bir veri çıkarma asistanısın.

GÖREVİN: Verilen Tapu Kayıt Belgesi metninden yalnızca yapılandırılmış JSON veri çıkarmak. Rapor cümlesi YAZMA; metin sistem tarafından sabit şablona yerleştirilecek.

TARİH KURALI (ÇOK ÖNEMLİ):
- Tüm tarihler mutlaka GG.AA.YYYY formatında ve AYRAÇ OLARAK NOKTA (.) kullanılmalı.
- Asla tire (-) veya slash (/) ile tarih yazma. Örnek doğru: "30.10.2024", "22.11.2022"
- belgeTarihi ve tüm madde tarihleri bu kurala uymalı.

ÇIKARILACAK ALANLAR:

1. belgeTarihi — Belge alınma/düzenleme tarihi (GG.AA.YYYY). Yoksa "".
2. belgeSaati — Saat (ör. "14:32"). Yoksa "".

3. beyanMaddeleri — Beyanlar hanesi; her kayıt bir nesne:
   { "aciklama": "beyan metni (parantez içi tarih-yevmiye YAZMA)", "tarih": "GG.AA.YYYY", "yevmiye": "numara" }
   Kayıt yoksa [].

4. serhMaddeleri — Şerhler hanesi; aynı nesne yapısı. Kayıt yoksa [].

5. hakVeMukellefiyetMaddeleri — Hak ve Mükellefiyetler hanesi; aynı nesne yapısı. Kayıt yoksa [].

6. rehinMaddeleri — Rehinler/ipotek hanesi; her kayıt bir nesne (string DEĞİL):
   {
     "kurum": "Banka veya kurum adı",
     "derece": "ipotek derecesi",
     "tutar": "bedel/tutar (belgedeki ifadeyle)",
     "tarih": "GG.AA.YYYY",
     "yevmiye": "yevmiye numarası"
   }
   Kayıt yoksa [].

KURALLAR:
- Metinde olmayan bilgi UYDURMA.
- rehinMaddeleri elemanları asla düz string olmamalı; mutlaka nesne.
- aciklama alanına tarih veya yevmiye ekleme; bunlar ayrı alanlarda.
- Yalnızca geçerli JSON döndür.

JSON ŞEMASI:
{
  "belgeTarihi": "",
  "belgeSaati": "",
  "beyanMaddeleri": [],
  "serhMaddeleri": [],
  "hakVeMukellefiyetMaddeleri": [],
  "rehinMaddeleri": []
}`;

function parseCikarim(raw: unknown): TapuCikarimVerisi {
  const data = (raw ?? {}) as Record<string, unknown>;
  return {
    belgeTarihi: String(data.belgeTarihi ?? "").trim(),
    belgeSaati: String(data.belgeSaati ?? "").trim(),
    beyanMaddeleri: normalizeHaneArray(data.beyanMaddeleri),
    serhMaddeleri: normalizeHaneArray(data.serhMaddeleri),
    hakVeMukellefiyetMaddeleri: normalizeHaneArray(
      data.hakVeMukellefiyetMaddeleri
    ),
    rehinMaddeleri: normalizeRehinArray(data.rehinMaddeleri),
  };
}

export async function analyzeTapuTextWithGpt(
  tapuMetni: string
): Promise<TapuAnalizSonucu> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY tanımlı değil. .env.local dosyasına anahtarınızı ekleyin."
    );
  }

  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Aşağıda Tapu Kayıt Belgesinin tüm sayfalarından çıkarılmış metin yer almaktadır. Yalnızca JSON veri çıkarımı yap:\n\n${tapuMetni.slice(0, 120_000)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI yanıt vermedi.");
  }

  const cikarim = parseCikarim(JSON.parse(raw));
  const rapor = olusturTapuRaporu(cikarim);

  return { rapor };
}
