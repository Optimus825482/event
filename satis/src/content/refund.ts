export const REFUND_INTRO = {
  eyebrow: "Yasal & Satış Politikası",
  title: "İptal & İade Koşulları",
  lead: "Merit Entertainment konser ve gala organizasyonlarında bilet satın alma, iptal, devir ve geri ödeme esasları aşağıda düzenlenmiştir.",
} as const;

export const POLICY_DRAFT_NOTICE =
  "Bu metin taslaktır. Yayına almadan önce işletmenin onayladığı metinle değiştirilmelidir.";

export const REFUND_CLAUSES: readonly {
  title: string;
  paragraphs: readonly string[];
  items?: readonly string[];
}[] = [
  {
    title: "1. 72 Saat Kuralı ve Tam İade Hakkı",
    paragraphs: [
      "Konser ve gala etkinliklerinde, etkinlik başlangıç saatinden en az 72 saat öncesine kadar yapılan yazılı iptal taleplerinde bilet bedelinin %100'ü kesintisiz olarak iade edilir.",
    ],
    items: [
      "İade taleplerinizi PNR numaranızla birlikte entertainment@merithotels.com adresine iletebilirsiniz.",
      "Onaylanan iadeler, ödemenin yapıldığı kredi veya banka kartına 3 ila 5 iş günü içinde otomatik olarak yansıtılır.",
    ],
  },
  {
    title: "2. Son 72 Saat İçinde İsim Devri ve Sezon Aktarımı",
    paragraphs: [
      "Etkinliğe 72 saatten az bir süre kala yapılan taleplerde nakit iade yapılmamaktadır. Ancak konuklarımızın mağdur olmaması için iki esnek hak tanınır:",
    ],
    items: [
      "İsim Devri: Biletinizi etkinlik saatinden en geç 6 saat öncesine kadar ücretsiz olarak başka bir misafir adına devredebilirsiniz.",
      "Tarih / Etkinlik Aktarımı: Aynı sezon içerisinde yer alan ve müsaitliği bulunan başka bir Merit Entertainment gala gecesine masa farkı gözetilerek aktarılabilir.",
    ],
  },
  {
    title: "3. Katılmama (No-Show) ve Geç Kalma",
    paragraphs: [
      "Etkinlik saatinde salona gelinmemesi (No-Show) halinde bilet bedeli iade edilmez ve masa rezervasyonu gala başlangıcından 60 dakika sonra sona erer.",
    ],
  },
  {
    title: "4. Etkinliğin İptali veya Ertelenmesi",
    paragraphs: [
      "Sanatçı kaynaklı sağlık sorunları veya mücbir sebeplerle organizasyonun iptal edilmesi halinde tüm bilet bedelleri başvuru gerektirmeksizin 5 iş günü içinde tam iade edilir. Tarih değişikliği halinde biletler yeni tarihe aynı masa konumuyla geçerli olur veya konuk isterse tam iade alabilir.",
    ],
  },
  {
    title: "5. 18 Yaş Sınırı ve Giriş Kuralları",
    paragraphs: [
      "Tüm gala ve konser etkinliklerimiz 18 yaş ve üzeri konuklarımız içindir. 18 yaş altı konuklar refakatçi eşliğinde dahi salona kabul edilmez; yaş kuralına uymayan bilet alımlarında kapıda giriş sağlanamaz ve ücret iadesi yapılmaz.",
    ],
  },
];
