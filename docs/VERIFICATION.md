# Benzeen – Email & Phone Verification

How to verify a domain (send codes to any email) and how to send codes by phone (SMS).

---

## 1. Domain verification (send emails to any address)

By default, Resend only allows sending **test emails to the address that owns the API key**. To send verification codes to **any user email** (e.g. signup, password reset), you must verify a domain and use a “from” address on that domain.

### Step 1: Verify your domain at Resend

1. Go to **[resend.com/domains](https://resend.com/domains)**.
2. Log in (or create an account).
3. Click **Add Domain**.
4. Enter your domain (e.g. `benzeen.uz` or `yourcompany.com`).
5. Resend will show **DNS records** (TXT, MX, etc.). Add these in your domain’s DNS (where you bought the domain: Cloudflare, GoDaddy, etc.).
6. Wait until Resend shows the domain as **Verified** (can take a few minutes to 48 hours).

### Step 2: Set the “from” address in Benzeen

1. In Resend, after the domain is verified, you can send from any address on that domain, e.g. `noreply@benzeen.uz` or `verify@yourdomain.com`.
2. In your project `.env` add:

```env
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

Use the **exact** address you want to appear as the sender (must be on the verified domain).

3. Restart the app (`npm run dev` or restart your server).

After this, verification emails can be sent to **any recipient**; the “you can only send to your own email” restriction no longer applies.

---

## 2. Get codes by phone (SMS verification)

To send verification codes by **phone number** (e.g. “Подтвердить по телефону”), you need **Twilio** and the right env vars.

### Step 1: Twilio account and phone number

1. Sign up at **[twilio.com](https://www.twilio.com)**.
2. In the Twilio Console:
   - Note your **Account SID** and **Auth Token** (Dashboard).
   - Go to **Phone Numbers → Manage → Buy a number** (or use a trial number). For trial accounts you can only send to verified numbers; for production you buy a number and can send to any number (subject to Twilio’s pricing).
3. Note the phone number in **E.164** format (e.g. `+998901234567` for Uzbekistan).

### Step 2: Install Twilio and set env vars

In the project folder:

```bash
npm install twilio
```

In `.env` add (use your real values):

```env
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+998901234567"
```

Use the Twilio number you bought or the trial number. The number must be in E.164 (e.g. `+998` for Uzbekistan, `+1` for US).

### Step 3: Restart the app

```bash
npm run dev
```

When a user chooses **“Подтвердить по телефону”** (Confirm by phone) and enters their phone number, the app will send an SMS with the 6-digit code via Twilio.

**Phone number format:** Users should enter the number with country code, e.g. `+998901234567` or `998901234567`. Twilio expects E.164.

### If Twilio is not configured

- **Development:** If `TWILIO_*` is not set, the app still creates the code and logs it in the **terminal** (where `npm run dev` runs). Use that code in the form to continue.
- **Production:** If `TWILIO_*` is not set, the user sees an error that SMS is not configured; they can use **email** verification instead.

---

## Summary

| Goal                         | What to do |
|-----------------------------|------------|
| Send codes to any email     | Verify domain at [resend.com/domains](https://resend.com/domains), then set `RESEND_FROM_EMAIL=noreply@yourdomain.com` in `.env`. |
| Send codes by phone (SMS)   | Sign up at Twilio, buy/use a number, run `npm install twilio`, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in `.env`. |
