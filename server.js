
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DOSYA = path.join(__dirname, "sorular.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TAHAM12345";

app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

function normalize(metin) {
  return String(metin || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function oku() {
  if (!fs.existsSync(DOSYA)) {
    fs.writeFileSync(DOSYA, "[]", "utf8");
  }

  const veri = JSON.parse(fs.readFileSync(DOSYA, "utf8"));

  if (!Array.isArray(veri)) {
    throw new Error("sorular.json bir liste olmalıdır.");
  }

  return veri;
}

function kaydet(veri) {
  fs.writeFileSync(DOSYA, JSON.stringify(veri, null, 2), "utf8");
}

function yonetici(req, res, next) {
  const sifre = req.headers["x-admin-password"];

  if (!sifre || sifre !== ADMIN_PASSWORD) {
    return res.status(401).json({
      basarili: false,
      mesaj: "Yönetici şifresi hatalı."
    });
  }

  next();
}

function kelimelereAyir(metin) {
  const durdurulanlar = [
    "ve", "ile", "bir", "bu", "icin", "ne", "nasil",
    "mi", "mu", "mı", "mü", "ben", "benim", "var",
    "yok", "istiyorum", "istiyorum"
  ];

  return normalize(metin)
    .split(" ")
    .filter(k => k.length > 1 && !durdurulanlar.includes(k));
}

// Vatandaş soru sorma sistemi
app.post("/api/soru", (req, res) => {
  try {
    const soru = String(req.body.soru || "").trim();

    if (!soru) {
      return res.status(400).json({
        bulundu: false,
        cevap: "Lütfen sorunuzu yazın."
      });
    }

    const sorular = oku();
    const aranan = normalize(soru);
    const kelimeler = kelimelereAyir(soru);

    let enIyi = null;
    let enYuksekPuan = 0;

    for (const kayit of sorular) {
      let puan = 0;

      const ornekSorular = Array.isArray(kayit.sorular)
        ? kayit.sorular
        : [];

      const anahtarlar = Array.isArray(kayit.anahtarlar)
        ? kayit.anahtarlar
        : [];

      for (const ornek of ornekSorular) {
        const ornekNorm = normalize(ornek);

        if (aranan === ornekNorm) {
          puan += 25;
        }

        for (const kelime of kelimeler) {
          if (ornekNorm.includes(kelime)) {
            puan += 4;
          }
        }
      }

      for (const anahtar of anahtarlar) {
        const anahtarNorm = normalize(anahtar);

        if (anahtarNorm && aranan.includes(anahtarNorm)) {
          puan += anahtarNorm.includes(" ") ? 7 : 4;
        }
      }

      if (puan > enYuksekPuan) {
        enYuksekPuan = puan;
        enIyi = kayit;
      }
    }

    if (enIyi && enYuksekPuan >= 4) {
      return res.json({
        bulundu: true,
        baslik: enIyi.kategori || "Bilgilendirme",
        cevap: enIyi.cevap || "Bu konuda kayıtlı bir açıklama bulunamadı.",
        link: enIyi.link || "",
        kaynak: enIyi.kaynak || ""
      });
    }

    return res.json({
      bulundu: false,
      baslik: "Uygun kayıt bulunamadı",
      cevap: "Sorunuz mevcut soru havuzumuzda bulunamadı. Resmî bilgi için e-Devlet Kapısı'nı ziyaret edebilir veya ilgili kamu kurumuna başvurabilirsiniz.",
      link: "https://www.turkiye.gov.tr/",
      kaynak: "e-Devlet Kapısı"
    });

  } catch (hata) {
    console.error("Soru hatası:", hata);

    res.status(500).json({
      bulundu: false,
      cevap: "Bir hata oluştu. Lütfen tekrar deneyin."
    });
  }
});

// Yönetici: Tüm soruları getir
app.get("/api/admin/sorular", yonetici, (req, res) => {
  try {
    res.json(oku());
  } catch (hata) {
    res.status(500).json({ mesaj: "Sorular okunamadı." });
  }
});

// Yönetici: Yeni soru ekle
app.post("/api/admin/sorular", yonetici, (req, res) => {
  try {
    const sorular = oku();
    const yeni = {
      id: Date.now().toString(),
      kategori: req.body.kategori || "",
      sorular: Array.isArray(req.body.sorular) ? req.body.sorular : [],
      anahtarlar: Array.isArray(req.body.anahtarlar) ? req.body.anahtarlar : [],
      cevap: req.body.cevap || "",
      link: req.body.link || "",
      kaynak: req.body.kaynak || ""
    };

    sorular.push(yeni);
    kaydet(sorular);

    res.json({ basarili: true, mesaj: "Soru eklendi.", soru: yeni });
  } catch (hata) {
    res.status(500).json({ basarili: false, mesaj: "Soru eklenemedi." });
  }
});

// Yönetici: Soru düzenle
app.put("/api/admin/sorular/:id", yonetici, (req, res) => {
  try {
    const sorular = oku();
    const index = sorular.findIndex(
      s => String(s.id) === String(req.params.id)
    );

    if (index === -1) {
      return res.status(404).json({ mesaj: "Soru bulunamadı." });
    }

    sorular[index] = {
      ...sorular[index],
      ...req.body,
      id: sorular[index].id
    };

    kaydet(sorular);

    res.json({ basarili: true, mesaj: "Soru güncellendi." });
  } catch (hata) {
    res.status(500).json({ basarili: false, mesaj: "Soru güncellenemedi." });
  }
});

// Yönetici: Soru sil
app.delete("/api/admin/sorular/:id", yonetici, (req, res) => {
  try {
    const sorular = oku();
    const yeniListe = sorular.filter(
      s => String(s.id) !== String(req.params.id)
    );

    if (yeniListe.length === sorular.length) {
      return res.status(404).json({ mesaj: "Soru bulunamadı." });
    }

    kaydet(yeniListe);

    res.json({ basarili: true, mesaj: "Soru silindi." });
  } catch (hata) {
    res.status(500).json({ basarili: false, mesaj: "Soru silinemedi." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("TAHAM yayında: " + PORT);
});
