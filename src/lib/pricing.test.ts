import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  kidCard,
  listPriceForKeep,
  maxAcquisition,
  parseMoneyInput,
  spokenHunt,
} from "./pricing.ts";

describe("listPriceForKeep", () => {
  it("parses dollars and cents", () => {
    assert.equal(parseMoneyInput("$5.00"), 5);
    assert.equal(parseMoneyInput("1.00"), 1);
    assert.equal(parseMoneyInput(" 5.5 "), 5.5);
    assert.equal(parseMoneyInput(""), null);
  });

  it("Amazon tag leaves at least the keep after shop, envelope, and stamp", () => {
    for (const keep of [1, 5, 5.25, 10]) {
      const price = listPriceForKeep({ keep, format: "paperback", shop: "amazon" });
      const card = kidCard({ listPrice: price, format: "paperback", wePayStamp: true });
      assert.ok(card.keepAmazon + 1e-9 >= keep, `keep ${keep} price ${price} got ${card.keepAmazon}`);
    }
  });

  it("eBay tag leaves at least the keep after fees, envelope, and stamp", () => {
    for (const keep of [1, 5, 5.25, 10]) {
      const price = listPriceForKeep({ keep, format: "paperback", shop: "ebay" });
      const card = kidCard({ listPrice: price, format: "paperback", wePayStamp: true });
      assert.ok(card.keepEbay + 1e-9 >= keep, `keep ${keep} price ${price} got ${card.keepEbay}`);
    }
  });
});

describe("maxAcquisition", () => {
  it("pay ceiling is sale minus fees minus the keep, rounded down", () => {
    const sale = 24.99;
    const keep = 5;
    const math = maxAcquisition({ expectedSale: sale, format: "textbook", keep });
    const card = kidCard({ listPrice: sale, format: "textbook", wePayStamp: true });
    const net = Math.max(card.keepAmazon, card.keepEbay);
    assert.ok(math.maxPay + keep - 1e-9 <= net);
    assert.equal(math.verdict, math.maxPay > 0 ? "buy" : math.maxPay === 0 ? "free" : "pass");
    assert.ok(math.costs > 0);
  });

  it("cheap mass-market with a $5 keep is a pass after the stamp", () => {
    const math = maxAcquisition({ expectedSale: 2.49, format: "mass-market", keep: 5 });
    assert.equal(math.verdict, "pass");
    assert.ok(math.maxPay < 0);
    assert.match(spokenHunt(math, "Huck Finn"), /Pass/);
  });

  it("textbook with a $1 keep still has room to buy", () => {
    const math = maxAcquisition({ expectedSale: 24.99, format: "textbook", keep: 1 });
    assert.equal(math.verdict, "buy");
    assert.ok(math.maxPay > 0);
    assert.match(spokenHunt(math, "Calculus: Early Transcendentals"), /Pay up to/);
    assert.match(spokenHunt(math, "Calculus: Early Transcendentals"), /^Calculus/);
  });

  it("changing keep recomputes the ceiling without changing the sale", () => {
    const a = maxAcquisition({ expectedSale: 18, format: "hardcover", keep: 1 });
    const b = maxAcquisition({ expectedSale: 18, format: "hardcover", keep: 5 });
    assert.equal(a.expectedSale, b.expectedSale);
    assert.ok(a.maxPay > b.maxPay);
  });
});
