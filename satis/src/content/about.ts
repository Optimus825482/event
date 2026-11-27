/**
 * Hakkımızda: bölüm yapısı bilet2 kurumsal sayfasını izler (hikâye + görsel, kısa bilgiler, organizasyonun kurgusu);
 * metinler bilet1 ve bilet2 kurumsal metinlerinin birleşimidir. Bilet1'in üç kartı ve bilet2 mekân görselleri
 * ek bölümler olarak sonda yer alır.
 */
export const ABOUT = {
  eyebrow: "Hakkımızda",
  title: "Merit Entertainment",
  lead: "Merit International bünyesindeki organizasyonların planlama aşamasından sonuçlandırılmasına kadar tüm süreçlerini yürüten departmandır.",
  story: [
    "Dünya çapında ünlü sanatçıların sahne aldığı, uluslararası bir etkileşim ile göz kamaştırıcı konserlerin, koreografilerin ve birbirinden eşsiz sahne şovlarının buluştuğu sahneleriyle size özel eğlence ortamları sunuyor.",
    "Merit Entertainment, 1988'den bu yana konaklama ve eğlenceyi aynı çatı altında sunan Merit International bünyesinde faaliyet gösterir. Girne'deki Merit Royal Diamond'dan Lefkoşa, Park, Crystal Cove ve Royal Gardens'a; Bulgaristan'daki Grand Mosta'dan Karadağ'daki Starlit'e uzanan otel sahnelerinde, alanında uzman ve deneyimli ekibiyle Türkiye'nin ve dünyanın sevilen sanatçılarını misafirleriyle buluşturur.",
    "Organizasyonları tek bir konser olarak değil, bütün bir gece olarak ele alır. Sahne tasarımını, ışık ve ses prodüksiyonunu, koreografiyi ve salon akışını aynı takvim içinde planlar; her etkinliği, sanatçının performansını öne çıkaracak ve salonun her noktasına aynı heyecanı taşıyacak biçimde tasarlar.",
  ],
  storyCta: { href: "/etkinlikler", label: "Konser programını inceleyin →" },
  storyImage: {
    src: "/hakkimizda/sibelcan.webp",
    alt: "Sibelcan, Merit Royal Diamond sahnesinde",
    width: 720,
    height: 1280,
    name: "Sibelcan",
    caption: "Merit Royal Diamond Hotel · Yılbaşı gecesi",
  },
  factsLabel: "Merit International",
  facts: [
    { label: "Kuruluş", value: "1988" },
    { label: "Otel", value: "10" },
    { label: "Ülke", value: "3" },
    { label: "Sahne programı", value: "Yıl boyu" },
    { label: "Merkez", value: "Girne, KKTC" },
  ],
  editorial: {
    title: "Organizasyonun",
    titleAccent: "kurgusu",
    paragraphs: [
      "Bir organizasyonu, sahne kurulmadan haftalar önce planlamaya başlar. Sanatçının repertuvarını, sahne yerleşimini, ışık ve ses planını otelin o geceki akışıyla birlikte ele alır. Merit Royal Diamond'da programı doğrudan sanatçının etrafında kurar; 12 kişilik yuvarlak masalar ve loca katıyla salonun her noktasını sahneye bağlayan bir düzen oluşturur. Maxim Royal'de ise Türk kabare geleneğini canlı müzik, temalı kostüm ve dansla sürdürür.",
      "Sezon programını otel sahnelerinin takvimiyle birlikte yürütür. Böylece aynı hafta içinde Girne'de bir konser, Lefkoşa'da bir gala ve Grand Mosta'da bir yılbaşı gecesi eşzamanlı olarak planlanabilir.",
    ],
    link: { href: "/takvim", label: "Etkinlik takvimini inceleyin →" },
  },
  cardsTitle: "Merit ayrıcalığı",
  cards: [
    {
      title: "Modern Organizasyon Alanları",
      text: "Sanatçıyı ön plana çıkaran sahne yerleşimi ve konforlu oturma düzeni.",
    },
    {
      title: "Ses, Işık & Sahne Teknolojisi",
      text: "Gelişmiş ses akustiği, LED ekranlar ve profesyonel sahne aydınlatması.",
    },
    {
      title: "Seçkin Misafir Deneyimi",
      text: "Online masa seçiminden kapıda hızlı girişe kadar her ayrıntıda Merit ayrıcalığı.",
    },
  ],
  venuesTitle: "Sahnelerimiz",
  venues: [
    {
      name: "Merit Royal Diamond",
      place: "Alsancak, Girne",
      src: "/hakkimizda/merit-royal-diamond.webp",
      alt: "Merit Royal Diamond otelinin gece havadan görünümü",
      width: 720,
      height: 1187,
    },
    {
      name: "Gala Salonu",
      place: "Merit Royal Diamond",
      src: "/hakkimizda/gala-salonu.webp",
      alt: "Yuvarlak gala masaları kurulmuş Merit gala salonu",
      width: 720,
      height: 1241,
    },
    {
      name: "Merit Lefkoşa",
      place: "Lefkoşa",
      src: "/hakkimizda/merit-lefkosa.webp",
      alt: "Merit Lefkoşa Hotel binasının gece görünümü",
      width: 720,
      height: 1150,
    },
  ],
} as const;
