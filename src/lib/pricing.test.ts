import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kidCard, listPriceForKeep, parseMoneyInput } from "./pricing.ts";

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
