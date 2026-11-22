/**
 * "Yeni sürüm hazır" isteminin saf durum mantığı.
 *
 * Worker (`public/sw.js`) kurulumda koşulsuz `skipWaiting()` çağırdığı için "waiting" evresi hiç
 * oluşmaz; yeni sürümün devralması sayfada `controllerchange` olarak görünür. Sayfa ilk yüklendiğinde
 * hiç denetleyici yoksa (ilk kurulum, `clients.claim()`) bu bir güncelleme değildir.
 */
export type UpdatePromptState = {
  /** Sayfa açıldığında zaten bir worker tarafından denetleniyor muydu? */
  readonly hadController: boolean;
  /** Yeni sürüm devraldı ve kullanıcıya gösterilmeli mi? */
  readonly visible: boolean;
};

export function initialUpdateState(hadController: boolean): UpdatePromptState {
  return { hadController, visible: false };
}

export function onControllerChange(state: UpdatePromptState): UpdatePromptState {
  if (!state.hadController) return { ...state, hadController: true };
  return state.visible ? state : { ...state, visible: true };
}

export function dismissUpdate(state: UpdatePromptState): UpdatePromptState {
  return state.visible ? { ...state, visible: false } : state;
}
