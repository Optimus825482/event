export type PaymentRequest = { provider: "demo"; action: "approve" | "decline" };

export type PaymentResult = { outcome: "approved" | "declined"; providerRef: string };

export interface PaymentProvider {
  readonly id: string;
  /** Gerçek ödeme almayan sağlayıcılar true döner. */
  readonly isDemo: boolean;
  start(input: { orderId: string; amount: string; currency: string; request: PaymentRequest }): Promise<PaymentResult>;
  verifyCallback?(payload: unknown): Promise<PaymentResult>;
  refund?(input: { orderId: string; amount: string }): Promise<void>;
}
