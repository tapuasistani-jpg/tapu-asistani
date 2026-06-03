# Tapu Asistanı

Gayrimenkul tapu analizi için modern web arayüz iskeleti.

## Teknolojiler

- **Next.js 15** (App Router)
- **Tailwind CSS**
- **Lucide React** (ikonlar)
- **TypeScript**

## Kurulum ve Çalıştırma

### 1. Node.js kurulu mu?

Terminalde şunu yazın:

```bash
node -v
```

Sürüm numarası görünüyorsa (ör. `v20.x.x`) devam edin. Görünmüyorsa [nodejs.org](https://nodejs.org) adresinden LTS sürümünü indirip kurun.

### 2. Proje klasörüne gidin

```bash
cd "c:\Users\earsl\OneDrive\Masaüstü\tapu asistanı"
```

### 3. Bağımlılıkları yükleyin

```bash
npm install
```

### 4. Geliştirme sunucusunu başlatın

```bash
npm run dev
```

### 5. Tarayıcıda açın

Adres çubuğuna yazın: **http://localhost:3000**

Sunucuyu durdurmak için terminalde `Ctrl + C` tuşlarına basın.

## OpenAI API anahtarı

`.env.local` dosyasına (sunucu tarafı, tarayıcıya gitmez):

```
OPENAI_API_KEY=sk-...
```

`NEXT_PUBLIC_` öneki kullanmayın; anahtar istemciye sızar.

## Sekmeler

| Sekme | Kabul edilen dosya | İşlev |
|-------|-------------------|--------|
| Tekli Tapu Analizi | **Yalnızca PDF** | Tüm sayfalar okunur → gpt-4o → Beyan/Şerh/İpotek özeti |
| Çoklu Tapu (Portföy) | **Yalnızca PDF** | Her PDF analiz edilir, tabloda özetlenir |
| Proje Ölçüm Aracı | **JPG, JPEG, PNG** | Canvas üzerinde tıklayarak mesafe ölçümü |

## Proje Yapısı

```
tapu asistanı/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx          # Ana sayfa + sekme state
├── components/
│   ├── Navbar.tsx
│   ├── TekliTapuAnalizi.tsx
│   ├── CokluTapuPortfoy.tsx
│   └── ProjeOlcumAraci.tsx
├── package.json
└── tailwind.config.ts
```
