export const FAQ_INTRO = {
  eyebrow: "Bilmeniz Gerekenler",
  title: "Sık Sorulan Sorular",
} as const;

export const FAQ: readonly { q: string; a: string }[] = [
  {
    q: "Biletimi nasıl alırım?",
    a: "Etkinlik sayfasında kişi sayısını seçin, salon planından masanızı (sandalye bazlı etkinliklerde sandalyelerinizi) belirleyin ve ödeme adımını tamamlayın. E-biletiniz ekranda oluşur ve e-posta adresinize gönderilir. Dilediğiniz zaman Biletim (PNR) sayfasından PNR kodunuz ve soyadınızla yeniden açabilirsiniz.",
  },
  {
    q: "Masa ve sandalye düzeni nasıl işliyor?",
    a: "Etkinliğe göre satış masa bazlı ya da sandalye bazlıdır. Sandalye bazlı etkinliklerde numaralı sandalyelerinizi tek tek seçersiniz; masa bazlı etkinliklerde ve localarda masa bütün olarak satılır. Fiyatlar kategoriye göre değişir.",
  },
  {
    q: "Yaş sınırı var mı?",
    a: "Etkinliklere ait yaş sınırı bilgisi ilgili etkinlik sayfasında yer almaktadır.",
  },
  {
    q: "Kıyafet kuralı nedir?",
    a: "Kıyafet kuralı bilgisi ilgili etkinlik sayfasında belirtilmektedir.",
  },
  {
    q: "İptal ve iade koşulları nelerdir?",
    a: "İptal, devir ve iade esasları İade Koşulları sayfasında yazar.",
  },
  {
    q: "Kapı açılış ve gala yemeği saatleri nasıldır?",
    a: "Kapı açılış ve konser saatleri ilgili etkinlik sayfasında yer almaktadır.",
  },
  {
    q: "Otopark ve vale hizmeti mevcut mu?",
    a: "Evet. Tüm konser ve gala gecelerimizde konuklarımız için otel girişinde ücretsiz vale ve otopark hizmeti sunulmaktadır.",
  },
  {
    q: "Konser sırasında fotoğraf ve video çekilebilir mi?",
    a: "Cep telefonu ile anı amaçlı kısa fotoğraf ve video çekimi serbesttir. Diğer konukların görüş açısını engellememek adına profesyonel kamera, tripod ve flaş kullanımına izin verilmemektedir.",
  },
  {
    q: "Özel loca veya kurumsal rezervasyon yapabilir miyim?",
    a: "Evet. Locanın tamamını veya kurumsal gruplar için özel düzenlemeleri entertainment@merithotels.com adresinden ya da +90 392 650 40 00 numaralı hattımızdan planlayabiliriz.",
  },
];
