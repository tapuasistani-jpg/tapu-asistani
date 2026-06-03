import OpenAI from "openai";
import {
  birlestirPortfoyBelgeler,
  parseBelgeCikarim,
  type BelgeCikarim,
} from "./portfoy-birlestir";
import { olusturPortfoyRaporu } from "./portfoy-rapor-sablon";

export type PortfoyBelgeGirdisi = {
  dosyaAdi: string;
  metin: string;
};

const PORTFOY_SYSTEM_PROMPT = `Sen Türkiye tapu kayıtları ve gayrimenkul portföy due diligence konusunda uzman bir veri çıkarma asistanısın.

GÖREVİN: Her Tapu Kayıt Belgesini AYRI AYRI analiz et ve belge bazlı JSON üret. Kayıtları birleştirme veya ada/parsel gruplama YAPMA; birleştirme işlemi sistem tarafından yapılacak.

TARİH KURALI (ÇOK ÖNEMLİ):
- Tüm tarihler GG.AA.YYYY formatında, ayraç NOKTA (.). Asla tire veya slash ile tarih yazma.

GİRİŞ ALANLARI (tüm belgelerden en erken ve en geç alınma zamanına göre):
- baslangicTarihi — En erken belge tarihi (GG.AA.YYYY)
- baslangicSaati — En erken belge saati (ör. "09:15")
- bitisSaati — En geç belge saati (ör. "17:42")

HER BELGE İÇİN (belgeler dizisi — her PDF bir eleman):
{
  "dosyaAdi": "dosya adı",
  "adaParseller": ["249 ada 110 parsel"],
  "beyanMaddeleri": [
    { "aciklama": "madde metni", "tarih": "GG.AA.YYYY", "yevmiye": "numara" }
  ],
  "serhMaddeleri": [],
  "hakVeMukellefiyetMaddeleri": [],
  "rehinMaddeleri": [
    {
      "kurum": "Banka adı",
      "derece": "1/0",
      "tutar": "5.000.000,00 TL",
      "tarih": "GG.AA.YYYY",
      "yevmiye": "973"
    }
  ]
}

KURALLAR:
- adaParseller: o belgedeki taşınmaz kimlikleri (dizi). Tek parsel ise tek elemanlı dizi.
- Hane maddelerinde adaParsel alanı KULLANMA; madde o belgede geçiyorsa belgenin adaParseller listesi geçerlidir.
- rehinMaddeleri mutlaka nesne dizisi (string değil).
- Metinde olmayan bilgi UYDURMA.
- Yalnızca geçerli JSON döndür.

JSON ŞEMASI:
{
  "baslangicTarihi": "",
  "baslangicSaati": "",
  "bitisSaati": "",
  "belgeler": []
}`;

function parsePortfoyYanit(
  raw: unknown,
  girdiBelgeler: PortfoyBelgeGirdisi[]
): ReturnType<typeof birlestirPortfoyBelgeler> {
  const data = (raw ?? {}) as Record<string, unknown>;

  const belgelerRaw = Array.isArray(data.belgeler) ? data.belgeler : [];

  const belgeler: BelgeCikarim[] = belgelerRaw
    .map((item, index) =>
      parseBelgeCikarim(
        item,
        girdiBelgeler[index]?.dosyaAdi ?? `Belge ${index + 1}`
      )
    )
    .filter((b): b is BelgeCikarim => b !== null);

  if (belgeler.length === 0 && girdiBelgeler.length > 0) {
    throw new Error("Belgelerden veri çıkarılamadı.");
  }

  return birlestirPortfoyBelgeler(belgeler, {
    baslangicTarihi: String(data.baslangicTarihi ?? "").trim(),
    baslangicSaati: String(data.baslangicSaati ?? "").trim(),
    bitisSaati: String(data.bitisSaati ?? "").trim(),
  });
}

function buildPortfoyUserMessage(belgeler: PortfoyBelgeGirdisi[]): string {
  const bloklar = belgeler.map(
    (b, i) =>
      `--- BELGE ${i + 1} (${b.dosyaAdi}) ---\n${b.metin.slice(0, 50_000)}`
  );
  return `Aşağıda ${belgeler.length} adet Tapu Kayıt Belgesi metni var. Her belge için ayrı çıkarım yap; belgeler dizisinde ${belgeler.length} eleman olmalı:\n\n${bloklar.join("\n\n")}`;
}

export async function analyzePortfoyWithGpt(
  belgeler: PortfoyBelgeGirdisi[]
): Promise<{ rapor: string }> {
  if (belgeler.length === 0) {
    throw new Error("Analiz için en az bir PDF gerekli.");
  }

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
      { role: "system", content: PORTFOY_SYSTEM_PROMPT },
      { role: "user", content: buildPortfoyUserMessage(belgeler) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI yanıt vermedi.");
  }

  const cikarim = parsePortfoyYanit(JSON.parse(raw), belgeler);
  const rapor = olusturPortfoyRaporu(cikarim);

  return { rapor };
}
