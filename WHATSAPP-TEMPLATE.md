# The WhatsApp OTP template

What to create in MSG91 so sign-in codes can be sent, and why each choice is
the one the API expects. `apps/api/src/lib/whatsapp.ts` sends against exactly
this shape — a template that differs in the ways marked **must** will be
rejected by Meta at send time, not at approval time.

---

## What you are creating

An **Authentication** template. Meta writes the words for this category: you
pick the options below and it composes the message. That is deliberate on
their side — authentication templates are the cheapest category, deliver at
the highest priority, and are the only ones allowed a copy-code button.

So there is no copy to write here. There is only a form to fill in correctly.

---

## In MSG91: WhatsApp → Templates → Add template

| Field | Value | Why |
| --- | --- | --- |
| Template name | `decora_shine_otp` | **must** be lowercase letters, digits and underscores. This exact string goes in `MSG91_WHATSAPP_OTP_TEMPLATE` |
| Category | **Authentication** | **must**. Utility or Marketing costs more, delivers slower, and cannot carry the copy-code button |
| Language | **English** | Whatever you pick must match `MSG91_WHATSAPP_OTP_LANGUAGE`. `en` and `en_US` are different to Meta |
| Body | Leave as generated | **must** have exactly one variable — the code |
| Button | **Copy code** | **must**. The API always sends the code as a button parameter, and Meta refuses a send with a parameter the template has no button for |
| Security disclaimer | On | Adds "For your security, do not share this code." Worth having: it is the sentence that stops somebody reading a code out to a caller |
| Expiry warning | On, **5 minutes** | Matches `EXPIRY_MINUTES` in `apps/api/src/modules/auth/otp.ts`. A template that claims 10 while the server expires at 5 teaches people the app is broken |
| Validity period | Leave default | This is Meta's own re-send window, not our expiry |

---

## What the message will look like

```
418264 is your verification code. For your security, do not share this code.

This code expires in 5 minutes.

[ Copy code ]
```

The number is filled in by us at send time. Nothing else varies.

---

## Then set these on the API

```
MSG91_AUTH_KEY=<your MSG91 auth key>
MSG91_WHATSAPP_NUMBER=<integrated number, digits only with country code>
MSG91_WHATSAPP_OTP_TEMPLATE=decora_shine_otp
MSG91_WHATSAPP_OTP_LANGUAGE=en
```

Leave `WHATSAPP_DRIVER=auto`. On `auto` the API uses MSG91 the moment those
three are present and writes codes to the log when they are not, so setting
them is the switch. Restart the API afterwards.

`MSG91_WHATSAPP_NUMBER` is digits only — `919876543210`, no `+` and no spaces.

`MSG91_WHATSAPP_NAMESPACE` is almost never needed. Fill it only if MSG91 shows
a namespace against the template.

---

## Checking it works

1. **The startup log.** With WhatsApp not live the API warns at boot —
   *"WhatsApp driver is 'console'. One-time codes go by SMS only."* Configured
   correctly, that line is gone.
2. **Sign in with a real number.** The code should arrive on WhatsApp, and the
   sign-in screen should read "We sent a code on WhatsApp to …".
3. **Not the review account.** Nothing is ever sent to `REVIEW_MOBILE`, by
   design — testing with it proves nothing.

---

## If sends are refused

The API throws rather than swallowing a refusal, and falls back to SMS when SMS
is live. Since SMS still waits on DLT registration, a WhatsApp failure right
now means no code arrives at all — so the first live send is worth watching.

| Symptom | Usually |
| --- | --- |
| `WhatsApp provider refused the message (400)` | The template name, or the language code, does not match what was approved |
| Refused despite an approved template | The template has no copy-code button. Meta rejects the button parameter the API always sends |
| Approved in MSG91, still refused | The number is not the *integrated* number on that MSG91 account |
| Nothing arrives, no error | The recipient has never messaged this business and the template is not Authentication — only that category opens a conversation |

---

## Hindi, later

The app ships in English and Hindi, and this sends one language to everybody.
Meta treats each language as a separate template with the same name, so the
Hindi version is approved as `decora_shine_otp` in Hindi, and the API then
needs to choose per person rather than from one setting. That is a small change
to `sendWhatsAppOtp` and a column on the user — worth doing once enough people
have chosen Hindi to make it visible, and not before.
