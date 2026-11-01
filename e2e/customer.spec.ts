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

test("home is a simple launcher with services and open stores", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /What do you need today|Salam,/ }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Search food, groceries, rides…")).toBeVisible();
  await expect(page.getByRole("link", { name: /Food to go/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Grocery/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Pharmacy/ }).first()).toBeVisible();
  await expect(page.locator(".promo-ticker")).toBeVisible();
  await expect(page.getByRole("link", { name: /See all restaurants and cafés/ })).toBeVisible();
  await expect(page.getByText("Open now in Dakhla")).toBeVisible();
  await expect(page.locator(".tabbar a")).toHaveCount(5);
  await expect(page.locator(".tabbar a").nth(1)).toContainText("Food");
});

test("pharmacy lists licensed partners and over-the-counter products", async ({
  page,
}) => {
  await page.goto("/pharmacy?city=dakhla");
  await expect(
    page.getByRole("heading", { name: "Pharmacy, at your door." }),
  ).toBeVisible();
  await expect(page.getByText("No pharmacy partner in Dakhla yet.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pharmacies in Laayoune" }),
  ).toBeVisible();
  await expect(page.getByText("Pharmacie Al Wafa").first()).toBeVisible();
  await expect(
    page.getByText(/Prescription medicines are not sold on Wassl/),
  ).toBeVisible();
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

test("shopping assistant turns couscous into an editable basket", async ({
  page,
}) => {
  await page.goto("/grocery/assistant");
  await page.getByLabel("What do you need?").fill("Prepare ingredients for couscous");
  await page.getByRole("button", { name: "Build my list" }).click();
  await expect(page.getByText("Couscous night")).toBeVisible();
  await expect(page.getByText("Couscous 1kg")).toBeVisible();
  await page.getByRole("button", { name: "Add all to basket" }).click();
  await expect(page.getByText("Added to Wassl Basket")).toBeVisible();
  await page.getByRole("link", { name: "Review basket" }).click();
  await expect(page).toHaveURL(/\/grocery\/basket/);
  await expect(page.getByText("Couscous 1kg").first()).toBeVisible();
});

test("Wassl Club dashboard shows tier, points and rewards", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("customer@wassl.ma");
  await page.getByLabel("Password", { exact: true }).fill("Wsl-Customer-2Dkh!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(taxi|account|orders)/);
  await page.goto("/account/loyalty");
  await expect(page.getByText("Wassl Club").first()).toBeVisible();
  await expect(page.getByText("Available points")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Points history" })).toBeVisible();
  await expect(page.getByText("10 MAD grocery credit")).toBeVisible();
});

test("customer chats with support and receives a saved reply", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("customer@wassl.ma");
  await page.getByLabel("Password", { exact: true }).fill("Wsl-Customer-2Dkh!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(taxi|account|orders)/);

  const created = await page.request.post("/api/chat/threads", {
    data: {
      topic: "support",
      subject: "E2E support thread",
      initialMessage: "I need help with a late order.",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { thread } = (await created.json()) as { thread: { id: string } };

  await page.goto(`/messages?thread=${thread.id}`);
  await expect(page.getByText("E2E support thread").first()).toBeVisible();
  await page.getByLabel("Message").fill("My grocery order is late.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/human agent|Wassl Assistant/).first()).toBeVisible({
    timeout: 20_000,
  });
});

test("a delivered order accepts one customer rating", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("customer@wassl.ma");
  await page.getByLabel("Password", { exact: true }).fill("Wsl-Customer-2Dkh!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(taxi|account|orders)/);

  const created = await page.request.post("/api/orders", {
    data: {
      citySlug: "dakhla",
      storeId: "store_dakhla_grill",
      customerName: "Mariam K.",
      customerPhone: "+212600000000",
      address: "12 Rue de la Plage",
      landmark: "Lighthouse",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: "product_001", qty: 2 }],
    },
  });
  expect(created.ok()).toBeTruthy();
  const { order } = (await created.json()) as { order: { id: string } };

  const admin = await page.context().browser()!.newContext();
  await admin.request.post("/api/auth/login", {
    data: { email: "admin@wassl.ma", password: "admin" },
  });
  const state = (await (await admin.request.get("/api/admin/state")).json()) as {
    drivers: Array<{ id: string; active: boolean; citySlug: string }>;
  };
  const driver = state.drivers.find(
    (entry) => entry.active && entry.citySlug === "dakhla",
  )!;
  for (const status of ["accepted", "preparing", "ready"]) {
    expect(
      (
        await admin.request.post(`/api/orders/${order.id}/status`, {
          data: { status },
        })
      ).ok(),
    ).toBeTruthy();
  }
  expect(
    (
      await admin.request.post(`/api/orders/${order.id}/assign`, {
        data: { driverId: driver.id },
      })
    ).ok(),
  ).toBeTruthy();
  for (const status of ["picked_up", "en_route", "delivered"]) {
    expect(
      (
        await admin.request.post(`/api/orders/${order.id}/status`, {
          data: { status },
        })
      ).ok(),
    ).toBeTruthy();
  }
  await admin.close();

  await page.goto(`/orders/${order.id}`);
  await expect(page.getByText("How was your order?")).toBeVisible();
  await page.getByRole("button", { name: "5 stars" }).click();
  await page.getByLabel("Optional comment").fill("E2E rating");
  await page.getByRole("button", { name: "Send rating" }).click();
  await expect(page.getByText("Thank you for rating")).toBeVisible();
});

test("parcel booking moves through driver pickup and recipient handover", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("customer@wassl.ma");
  await page.getByLabel("Password", { exact: true }).fill("Wsl-Customer-2Dkh!2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(taxi|account|orders)/);

  await page.goto("/express");
  await page.getByLabel("Your name").fill("Mariam K.");
  await page.getByLabel("Your phone").fill("+212600000000");
  await page.getByLabel("Pickup point").fill("Avenue Mohammed V");
  await page.getByLabel("Drop-off point").fill("Corniche Hotel");
  await page.getByLabel("Recipient name").fill("Youssef");
  await page.getByLabel("Recipient phone").fill("+212611111111");
  await page.getByLabel("What is inside?").fill("Documents");
  await page.getByRole("button", { name: /Book parcel/ }).click();
  await expect(page.getByText(/Parcel WX-/)).toBeVisible();

  const tracking = page.locator('a[href^="/express/"]').first();
  await tracking.click();
  await expect(page).toHaveURL(/\/express\/parcel_/);
  const pickupLabel = await page
    .getByLabel(/Pickup code:/)
    .first()
    .getAttribute("aria-label");
  const deliveryLabel = await page
    .getByLabel(/Recipient delivery code:/)
    .first()
    .getAttribute("aria-label");
  const pickupCode = pickupLabel?.replace(/\D/g, "").slice(-4) ?? "";
  const deliveryCode = deliveryLabel?.replace(/\D/g, "").slice(-4) ?? "";
  expect(pickupCode).toMatch(/^\d{4}$/);
  expect(deliveryCode).toMatch(/^\d{4}$/);

  const driver = await page.context().browser()!.newContext();
  await driver.request.post("/api/auth/login", {
    data: { email: "driver@wassl.ma", password: "Wsl-Driver-9Lay!2026" },
  });
  const driverPage = await driver.newPage();
  await driverPage.goto("/driver/express");
  await expect(
    driverPage.getByText("Nearby parcel requests"),
  ).toBeVisible();
  await driverPage.getByRole("button", { name: "Accept" }).first().click();
  driverPage.once("dialog", (dialog) => dialog.accept(pickupCode));
  await driverPage.getByRole("button", { name: "Confirm collection" }).click();
  await driverPage.getByRole("button", { name: "Start delivery" }).click();
  driverPage.once("dialog", (dialog) => dialog.accept(deliveryCode));
  await driverPage.getByRole("button", { name: "Complete handover" }).click();
  await expect(driverPage.getByText("Delivered").first()).toBeVisible({
    timeout: 15_000,
  });
  await driver.close();
});
