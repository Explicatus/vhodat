import "server-only";
import { createToken } from "./tokens";
import { sendEmail } from "./notify";

/** НЕ е server action — извиква се само от сървъра. */
export async function sendVerification(userId: string, email: string) {
  const token = await createToken(userId, "VERIFY", 7 * 24 * 60);
  await sendEmail(email, {
    title: "Потвърдете имейла си във „Входът“",
    body: "Натиснете бутона, за да потвърдите имейл адреса си. Линкът е валиден 7 дни.",
    link: `/verify?token=${token}`,
  }).catch((e) => console.error("[verify mail]", e));
}

