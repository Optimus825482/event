/** Excel içe aktarma sınırları (tek yerde; testler de buradan okur). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DATA_ROWS = 5000;
export const MAX_CELL_LENGTH = 500;
/** Sıkıştırma bombasına karşı: girdilerin GERÇEKTEN açılmış boyutlarının toplamı (başlıktaki bildirime güvenilmez). */
export const MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 500;
/** Sayfada taranacak en çok satır numarası (boş/seyrek sayfalarla döngü şişirilemesin). */
export const MAX_SCAN_ROWS = 20_000;
export const MAX_COLUMNS = 40;
