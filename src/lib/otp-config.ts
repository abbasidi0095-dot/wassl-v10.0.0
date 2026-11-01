import type { PhoneOtpChannel } from "./types";

/**
 * Phone verification is staged. The master switch and each delivery channel
 * are independent so the app can be deployed and linked before any code is
 * sent to customers.
 */
export function phoneVerificationRequired(): boolean {
  return process.env.PHONE_VERIFICATION_REQUIRED === "1";
}

export function smsChannelConfigured(): boolean {
  return Boolean(
    process.env.OTP_SMS_ENABLED === "1" &&
      process.env.AION_API_KEY &&
      process.env.AION_SENDER_ID,
  );
}

export function whatsappChannelConfigured(): boolean {
  return Boolean(
    process.env.OTP_WHATSAPP_ENABLED === "1" &&
      process.env.OPENWA_API_KEY &&
      process.env.OPENWA_SESSION_ID &&
      (process.env.OPENWA_BASE_URL || "http://127.0.0.1:2785/api"),
  );
}

export function availablePhoneChannels(): PhoneOtpChannel[] {
  const channels: PhoneOtpChannel[] = [];
  if (smsChannelConfigured()) channels.push("sms");
  if (whatsappChannelConfigured()) channels.push("whatsapp");
  return channels;
}

export function isPhoneChannelEnabled(channel: string): channel is PhoneOtpChannel {
  return availablePhoneChannels().includes(channel as PhoneOtpChannel);
}

export function defaultPhoneChannel(): PhoneOtpChannel | null {
  const channels = availablePhoneChannels();
  const preferred = process.env.OTP_DEFAULT_CHANNEL;
  if (preferred === "sms" || preferred === "whatsapp") {
    if (channels.includes(preferred)) return preferred;
  }
  return channels[0] ?? null;
}
