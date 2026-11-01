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

test("grocery pickup reserves stock and returns a pickup code", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("customer@wassl.ma");
  await page.getByLabel("Password", { exact: true }).fill("Wsl-Customer-2Dkh!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(taxi|account|orders)/);

  await page.goto("/grocery/sahara-market");
  await expect(page.getByRole("heading", { name: "Sahara Market" })).toBeVisible();
  await page.getByRole("button", { name: /Add Whole Milk 1L to cart/ }).click();
  for (let index = 0; index < 3; index += 1) {
    await page.getByRole("button", { name: /Add Apples 1kg to cart/ }).click();
  }

  await page.goto("/cart");
  await page.getByRole("link", { name: /Continue to delivery/ }).click();
  await page.getByRole("button", { name: "Pickup", exact: true }).click();
  await page.getByLabel("Full name").fill("E2E Grocery");
  await page.getByLabel("Phone number").fill("+212 600 111 222");
  await page.getByRole("button", { name: /Place pickup order/ }).click();

  await expect(page).toHaveURL(/\/orders\/order_/);
  await expect(page.getByText("Pickup code")).toBeVisible();
  await expect(page.getByLabel(/Pickup code: \d{4}/)).toBeVisible();
});

test("global search tolerates a typo and links into a product", async ({
  page,
}) => {
  await page.goto("/search?q=dakhla%20gril");
  const storeLink = page.getByRole("link", { name: /Dakhla Grill/ }).first();
  await expect(storeLink).toBeVisible();
  await storeLink.click();
  await expect(page).toHaveURL(/\/store\/dakhla-grill/);

  await page.goto("/search?q=water");
  const productLink = page
    .getByRole("link", { name: /Water 6 x 1\.5L/ })
    .first();
  await expect(productLink).toBeVisible();
  await productLink.click();
  await expect(page).toHaveURL(/\/store\/sahara-market\?product=/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("home surfaces a deterministic For you feed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("For you", { exact: true })).toBeVisible();
  await expect(page.getByText("Popular in Dakhla")).toBeVisible();
});

test("barcode lookup adds a real product to the multi-store basket", async ({
  page,
}) => {
  await page.goto("/grocery/scan");
  await page.getByLabel("Barcode number").fill("6111200000017");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText("Water 6 x 1.5L").first()).toBeVisible();
  await page.getByRole("button", { name: "Add to basket" }).click();
  await expect(page.getByText(/added to your basket/)).toBeVisible();
  await page.getByRole("link", { name: /Open Wassl Basket/ }).click();
  await expect(page).toHaveURL(/\/grocery\/basket/);
  await expect(page.getByText("Water 6 x 1.5L").first()).toBeVisible();
});

test("a shopping list can become a recurring basket", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("customer@wassl.ma");
  await page.getByLabel("Password", { exact: true }).fill("Wsl-Customer-2Dkh!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(taxi|account|orders)/);

  const created = await page.request.post("/api/grocery/lists", {
    data: { productId: "product_017", qty: 2 },
  });
  expect(created.ok()).toBeTruthy();

  await page.goto("/grocery/lists");
  await page.getByRole("checkbox", { name: "Recurring basket" }).check();
  await page.getByLabel("Recurring frequency").selectOption("monthly");
  await expect(page.getByText(/Next reminder/)).toBeVisible();
  await expect(page.getByText("Monthly").first()).toBeVisible();
});
