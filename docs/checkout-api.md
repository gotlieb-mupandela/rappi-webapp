# Checkout totals API

The server prices every checkout. The mobile app displays these responses and does not compute shipping, VAT, or line prices itself.

The signed-in bag loads current unit prices from `POST /api/cart/prices`. That replaces a direct read of `products.price`. When the shopper is choosing shipping and country, call `POST /api/checkout/quote`. `total` on that response is the amount `POST /api/payments/dpo/create` sends to DPO as `PaymentAmount`.

`POST /api/checkout/quote` and `POST /api/cart/prices` need no sign-in. Prices and stock are public.

No API key, DPO token, or service role key is sent by the client. Prices on the request are ignored. Only `POST` is accepted. Both read routes are limited to 60 requests per minute per IP through the existing `consume_rate_limit` database function. There is no new environment variable. That per-IP limit reads `x-forwarded-for`. It is safe only because Vercel overwrites that header. Do not trust it behind any other proxy.

Catalog codes and sizes on a successful response are the database values. Error strings that include a rejected code or size are HTML-escaped.

## Which route to call

| Screen | Route | What you show |
| --- | --- | --- |
| Signed-in bag | `POST /api/cart/prices` | `items[].unitPrice`, `items[].lineTotal`, `subtotal` |
| Checkout summary | `POST /api/checkout/quote` | `subtotal`, `shipping`, `vat`, `total` |
| About to pay | `POST /api/payments/dpo/create` | The same totals, plus the existing payment fields |

`/api/cart/prices` is merchandise only. It does not add shipping or VAT. `/api/checkout/quote` is the payable total.

## POST /api/checkout/quote

Read-only. No sign-in. Prices and stock are public.

### Request

| Field | Type | Rules |
| --- | --- | --- |
| `lines` | array | 1 to 50 objects. Each object is `code`, `size`, `qty`. |
| `lines[].qty` | number | A JSON number that is an integer from 1 to 99. Strings such as `"5"`, booleans, null, floats, and NaN are rejected. |
| `shippingMethod` | string | `standard` (100), `express` (150), or `pickup` (0). NAD. |
| `country` | string | VAT country name or alias (`NA`, `France`, `za`). |

Any `price`, `unitPrice`, or `lineTotal` on a line is ignored. Unknown product codes are rejected. Pickup with an empty or unknown country uses Namibia, the same fallback as payment create. Any other method with an unknown country is rejected.

Lines with the same `code` and `size` are merged by summing `qty` before the stock check. Quote, bag prices, and payment create share that step, then `checkoutPaymentQuote` merges again and returns one item per code and size. The merged quantity must stay from 1 to 99. A merged quantity above 99 is rejected. Stock is checked against that summed quantity, so duplicate lines cannot each pass a separate stock check.

### Response `200`

| Field | Type | Meaning |
| --- | --- | --- |
| `items` | array | `{ code, size, qty, unitPrice, lineTotal }` |
| `subtotal` | number | Merchandise sum, rounded to cents. |
| `shipping` | number | Server shipping cost for `shippingMethod`. |
| `vat.rate` | number | Percent, for example `15` or `25.5`. |
| `vat.amount` | number | VAT on merchandise plus shipping. |
| `total` | number | Amount charged. Equals DPO `PaymentAmount`. |
| `currency` | string | `DPO_CURRENCY`, or `NAD` when that variable is unset. |

`Cache-Control: no-store`.

## POST /api/cart/prices

Read-only. No sign-in. Prices and stock are public. Same line rules as the quote. Shipping method and country are not required.

### Response `200`

| Field | Type | Meaning |
| --- | --- | --- |
| `items` | array | Same item shape as the quote. `unitPrice` is the catalog price used for DPO. |
| `subtotal` | number | Same merchandise subtotal the quote would return for these lines. |
| `currency` | string | Same currency as the quote. |

## POST /api/payments/dpo/create

Unchanged request. Unchanged behaviour: sign-in, the same line checks, and the same charge.

Existing response fields stay as they are:

| Field | Meaning |
| --- | --- |
| `paymentUrl` | DPO hosted payment page. |
| `companyRef` | Shop reference stored on the payment. |
| `transToken` | DPO transaction token. |

Added fields, same names and meaning as `POST /api/checkout/quote`:

| Field | Type |
| --- | --- |
| `items` | array `{ code, size, qty, unitPrice, lineTotal }` |
| `subtotal` | number |
| `shipping` | number |
| `vat` | `{ rate, amount }` |
| `total` | number |
| `currency` | string |

`total` is the number passed to DPO as `PaymentAmount` (two decimal places in the XML).

## Errors

| Status | When |
| --- | --- |
| `400` | Invalid JSON, a quantity that is not an integer number from 1 to 99, a merged quantity above 99, more than 50 lines, unknown code, unknown size, merged quantity above stock, missing shipping method, or missing country. |
| `429` | Rate limit. |

Payment create still returns its existing errors, including `401` when signed out. A quote total of zero is returned by the read routes. Payment create rejects a total that is not finite or not greater than zero. A catalog price that is missing, not a finite number, zero, or negative is rejected before that total is built.
