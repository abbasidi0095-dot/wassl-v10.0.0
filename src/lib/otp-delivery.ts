import type { PhoneOtpChannel } from "./types";
import { sendSms, otpSmsBody } from "./sms";
import { sendWhatsAppOtp } from "./whatsapp";

export type PhoneDeliveryResult =
  | { ok: true; id?: string }
  | {
      ok: false;
      error: string;
      code?: "not_on_whatsapp" | "not_ready" | "provider" | "not_configured";
    };

export async function deliverPhoneOtp(
  phone: string,
  code: string,
  channel: PhoneOtpChannel,
): Promise<PhoneDeliveryResult> {
  if (channel === "sms") {
    return sendSms(phone, otpSmsBody(code));
  }
  return sendWhatsAppOtp(phone, code);
}
