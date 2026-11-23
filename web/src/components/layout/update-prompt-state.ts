/**
 * "Sistem güncellendi" isteminin saf durum mantığı. İki ayrı işaret istemi açar:
 *
 * 1. Sunucunun güncelleme numarası bu sekmedeki paketinkinden farklı (`onServerBuild`): her dağıtımda olur.
 * 2. Yeni service worker devraldı (`onControllerChange`): yalnızca `public/sw.js` değiştiğinde olur. Worker
 *    kurulumda koşulsuz `skipWaiting()` çağırdığı için "waiting" evresi hiç oluşmaz; devralma sayfada
 *    `controllerchange` olarak görünür. Sayfa ilk yüklendiğinde hiç denetleyici yoksa (ilk kurulum,
 *    `clients.claim()`) bu bir güncelleme değildir.
 */
export type UpdatePromptState = {
  /** Sayfa açıldığında zaten bir worker tarafından denetleniyor muydu? */
  readonly hadController: boolean;
  /** Yeni sürüm var ve kullanıcıya gösterilmeli mi? */
  readonly visible: boolean;
  /** Sunucuda görülen, bu sekmeninkinden farklı güncelleme numarası (istemde gösterilir). */
  readonly serverBuild: string | null;
};

export function initialUpdateState(hadController: boolean): UpdatePromptState {
  return { hadController, visible: false, serverBuild: null };
}

export function onControllerChange(state: UpdatePromptState): UpdatePromptState {
  if (!state.hadController) return { ...state, hadController: true };
  return state.visible ? state : { ...state, visible: true };
}

/**
 * Numarası olmayan taraf (yerel geliştirme) karşılaştırılmaz. Aynı numara ikinci kez gelirse durum değişmez:
 * "Sonra" denmiş bir güncelleme her yoklamada yeniden açılmaz; daha yeni bir numara yeniden açar.
 */
export function onServerBuild(state: UpdatePromptState, clientBuild: string | null, serverBuild: string | null): UpdatePromptState {
  if (!clientBuild || !serverBuild || serverBuild === clientBuild) return state;
  if (state.serverBuild === serverBuild) return state;
  return { ...state, serverBuild, visible: true };
}

export function dismissUpdate(state: UpdatePromptState): UpdatePromptState {
  return state.visible ? { ...state, visible: false } : state;
}
