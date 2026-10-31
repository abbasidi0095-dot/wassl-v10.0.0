import { expect, test } from "@playwright/test";

test("customer orders with a modifier and a promo, then reorders", async ({
  page,
}) => {
  await page.goto("/store/snack-bahja-f1066b");
  await expect(page.getByRole("heading", { name: "Menu" })).toBeVisible();

  await page.getByRole("button", { name: "Add Classic Smash to cart" }).click();
  const sheet = page.getByRole("dialog", { name: "Classic Smash" });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: /Double/ }).click();
  await sheet.getByRole("button", { name: /Add to cart ·/ }).click();

  await page.goto("/cart");
  await expect(page.getByText("Classic Smash", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Double", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: /Continue to delivery/ }).click();

  await page.getByLabel("Full name").fill("E2E Customer");
  await page.getByLabel("Phone number").fill("+212 600 999 888");
  await page.getByLabel("Address").fill("12 Rue de la Plage");
  await page.getByLabel("Landmark · repère").fill("Near the lighthouse");

  await page.getByLabel("Promo code").fill("WASSAL10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Promo WASSAL10")).toBeVisible();
  await expect(page.getByText("−7 MAD")).toBeVisible();

  await page.getByRole("button", { name: /Place COD order/ }).click();
  await expect(page).toHaveURL(/\/orders\/order_/);
  await expect(page.getByText(/WSL-/).first()).toBeVisible();
  await expect(page.getByText("Order placed").first()).toBeVisible();

  await page.goto("/orders");
  await page.getByRole("button", { name: /Reorder/ }).click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByText("Classic Smash", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Double", { exact: true }).first()).toBeVisible();
});

test("filters stores by diet and exposes the map link", async ({ page }) => {
  await page.goto("/city/dakhla");
  await expect(page.getByLabel("Dietary filter")).toBeVisible();

  await page.getByLabel("Dietary filter").selectOption("Seafood");
  await expect(page.getByText(/· Seafood/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /on Google Maps/ }).first(),
  ).toBeVisible();
});
