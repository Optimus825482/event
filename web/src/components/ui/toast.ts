/**
 * Bildirim (toast) yardımcısı. `ToastProvider` `(app)/layout.tsx` içinde bağlıdır; istemci
 * bileşenlerinde `const toast = useToast(); toast.success("Kaydedildi")` biçiminde kullanılır.
 */
export { ToastProvider, useToast } from "./toast-notification";
