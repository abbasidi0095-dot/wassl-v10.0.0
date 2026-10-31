import { describe, expect, it } from "vitest";
import { renderVerificationEmail } from "@/lib/email";

describe("verification email", () => {
  it("contains the code, expiry and brand in both parts", () => {
    const message = renderVerificationEmail("482913", "Amina");
    expect(message.subject).toBe("Your Wassl verification code");
    expect(message.html).toContain("482913");
    expect(message.text).toContain("482913");
    expect(message.html).toContain("10 minutes");
    expect(message.text).toContain("10 minutes");
    expect(message.html).toContain("Hello Amina");
    expect(message.html).toContain("Wassl");
    expect(message.text).toContain("If you did not create a Wassl account");
  });

  it("escapes a customer name before injecting it into HTML", () => {
    const message = renderVerificationEmail(
      "111111",
      '<img src=x onerror="alert(1)">',
    );
    expect(message.html).not.toContain("<img src=x");
    expect(message.html).toContain("&lt;img src=x");
    expect(message.text).toContain('<img src=x onerror="alert(1)">');
  });
});
