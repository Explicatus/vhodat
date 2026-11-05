# 🏠 Входът — SaaS за управление на етажна собственост

Платформа за домоуправители, управителни съвети и фирми за професионално управление на сгради в България.

## Функционалност
| Модул | Управител | Собственик / обитател |
|---|---|---|
| **Обекти** | Апартаменти, магазини, гаражи; ид. части, живущи, такса; импорт от Excel; разпределяне на таксата; **Книга на ЕС** (печат/PDF) | — |
| **Такси и плащания** | Месечни такси и фонд „Ремонт“, еднократни вноски, плащания, разписки, CSV, **напомняне до длъжниците** | Салдо, история, разписки |
| **💳 Плащане с карта** | Свързване на банковата сметка на ЕС чрез Stripe Connect | Плащане с карта / Apple Pay / Google Pay |
| **🏦 Банков импорт** | CSV извлечение → автоматично разпознаване на обекта по „ап. N“ или име → потвърждение; без дублиране | — |
| **🔔 Известия** | Автоматични при такси, плащания, обяви, гласувания, сигнали | В приложението + имейл, SMS, Viber (по избор) |
| **Разходи / Обяви / Сигнали** | Въвеждане, публикуване, статуси | Преглед, сигнали |
| **🗳️ Гласувания** | **Протокол от ОС** с кворум (чл. 15) и мнозинство (чл. 17 ЗУЕС), печат/PDF | Гласуване с тежест по ид. части |
| **⭐ Абонамент** | Вход: до 10 обекта безплатно · Професионален: 0,50 €/обект/месец (Stripe Billing) | — |

Дизайн: **Liquid Glass** — полупрозрачни стъклени повърхности, светъл и тъмен режим, мобилна версия.

## Стек
Next.js 15 (App Router, Server Actions) · TypeScript · Prisma · SQLite (dev) / PostgreSQL (prod) · Tailwind CSS · JWT сесии · Stripe (Connect + Billing) · Nodemailer (SMTP) · Infobip (SMS/Viber)

## Стартиране
```bash
npm install
cp .env.example .env
npx prisma db push
npm run db:seed      # демо данни
npm run dev          # http://localhost:3000
```
Демо акаунти: `manager@demo.bg` / `demo1234` (управител), `resident@demo.bg` / `demo1234` (собственик, ап. 2). Код за покана: `DEMO2026`.

## Тестов режим
С `PAYMENTS_MOCK="1"` и без `STRIPE_SECRET_KEY` плащанията с карта и абонаментите се симулират, а имейлите/SMS/Viber се извеждат в конзолата на сървъра. Така цялата платформа работи локално без външни услуги.

## Продукция
1. **База данни:** в `prisma/schema.prisma` сменете `provider = "postgresql"`, задайте `DATABASE_URL` (Neon, Supabase, Railway).
2. **Сигурност:** дълъг случаен `SESSION_SECRET`, `APP_URL` = публичният адрес, `PAYMENTS_MOCK="0"`.
3. **Stripe** (dashboard.stripe.com):
   - Активирайте **Connect** (Express акаунти) — за плащанията на собствениците към ЕС.
   - Създайте продукт „Професионален“ с recurring цена **0,50 EUR / месец, per unit** → `STRIPE_PRO_PRICE_ID`.
   - Включете **Customer Portal**.
   - Webhook към `https://<домейн>/api/stripe/webhook` със събития `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `customer.subscription.created|updated|deleted`, `account.updated` (+ „Listen to events on Connected accounts“) → `STRIPE_WEBHOOK_SECRET`.
4. **Имейл:** SMTP данни (напр. Brevo, Postmark, Amazon SES).
5. **SMS / Viber:** акаунт в Infobip → `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, регистриран подател за SMS и Viber Business.
6. **Деплой:**
   - **Vercel:** импортирайте репото, задайте env променливите, build командата е `npm run build`.
   - **Docker:** `docker compose up --build` (PostgreSQL + приложението).

## Следващи стъпки
- Мобилно приложение (PWA с push известия)
- Качване на снимки към сигнали и документи (договори, фактури)
- Автоматично месечно начисляване (cron) и автоматични напомняния
- Регистрация на ЕС в общината и шаблони на документи
