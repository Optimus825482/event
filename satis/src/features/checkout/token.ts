/** Sipariş belirteci biçimi (`<base64url(uuid)>.<base64url(HMAC)>`); ağa gitmeden elenen bozuk girdiler için. */
const ORDER_TOKEN_SHAPE = /^[A-Za-z0-9_-]{8,200}\.[A-Za-z0-9_-]{16,128}$/;

export function isOrderTokenShape(token: string): boolean {
  return ORDER_TOKEN_SHAPE.test(token);
}
