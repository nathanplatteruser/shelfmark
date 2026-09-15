import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { requestTour } from "@/lib/tour";

export const Route = createFileRoute("/playbook")({ component: PlaybookPage });

const TOOLS: { name: string; cost: string; mac: string; phone: string; scan: string; ebay: string; bulk: string; price: string; inv: string; curve: string; speed: string; use: string }[] = [
  {
    name: "eBay Seller Hub + Reports",
    cost: "Free (Store $5–$350/mo)",
    mac: "Yes",
    phone: "eBay app",
    scan: "App camera; ISBN autofill on create",
    ebay: "Native",
    bulk: "CSV / File Exchange via Reports",
    price: "Terapeak (store)",
    inv: "Seller Hub only",
    curve: "Medium",
    speed: "20–40/hr with templates",
    use: "Always the upload target",
  },
  {
    name: "Shelfmark (this desk)",
    cost: "This app",
    mac: "Yes",
    phone: "Camera upload",
    scan: "USB gun, video reel, webcam ISBN",
    ebay: "API + CSV, plus Amazon / AbeBooks / Biblio / Alibris",
    bulk: "One scan / one-minute reel, list everywhere",
    price: "Heuristic + Grok polish",
    inv: "SKU + bin + sell-once sync",
    curve: "Low — checklist",
    speed: "Capture 20/min; list 60–120/hr practiced",
    use: "Daily listing lane + homebase",
  },
  {
    name: "3Dsellers",
    cost: "~$15–$45/mo by listing count",
    mac: "Browser",
    phone: "Camera",
    scan: "UPC/EAN/ISBN/ASIN, batches of 100",
    ebay: "Direct publish",
    bulk: "CSV + AI drafts",
    price: "Suggested",
    inv: "Yes",
    curve: "Medium",
    speed: "40–80/hr",
    use: "If you want API-direct listing later",
  },
  {
    name: "List My Media",
    cost: "Beta; confirm live",
    mac: "Browser",
    phone: "Browser",
    scan: "ISBN via Open Library",
    ebay: "CSV",
    bulk: "Yes",
    price: "Batch",
    inv: "SKU + analytics",
    curve: "Low",
    speed: "40–90/hr",
    use: "Closest cousin; books/yearbooks",
  },
  {
    name: "ScoutIQ / Scoutly",
    cost: "$10–$69/mo",
    mac: "Limited",
    phone: "Excellent",
    scan: "Fast ISBN",
    ebay: "No (Amazon FBA)",
    bulk: "Sourcing, not listing",
    price: "Amazon rank",
    inv: "No eBay bins",
    curve: "Low",
    speed: "Scan 300+/hr sourcing",
    use: "Do not buy for an eBay-first shop",
  },
  {
    name: "BookScouter",
    cost: "Free / ~$10 Pro",
    mac: "Web",
    phone: "Yes",
    scan: "ISBN",
    ebay: "No",
    bulk: "Buyback cart",
    price: "Vendor offers",
    inv: "No",
    curve: "Low",
    speed: "Instant quotes",
    use: "Cull low-value books to buyback",
  },
  {
    name: "Flippr",
    cost: "Free credits; Pro ~$20/mo or ~$8/mo yearly",
    mac: "Web/app",
    phone: "Excellent",
    scan: "Photo of a shelf/stack; barcode; live video on Pro roadmap",
    ebay: "Autolist from scan",
    bulk: "Many spines in one photo",
    price: "eBay sold comps + sell-through",
    inv: "Collections, not bins",
    curve: "Low",
    speed: "Sourcing: dozens per photo",
    use: "Decide what is worth listing. Not a bin homebase.",
  },
  {
    name: "TurboLister (mobile)",
    cost: "Free + in-app plans",
    mac: "No (iPhone/iPad)",
    phone: "Yes",
    scan: "Camera barcode → draft in ~10s",
    ebay: "Direct API draft",
    bulk: "One at a time, fast",
    price: "Sold comps",
    inv: "No",
    curve: "Low",
    speed: "Retail UPC, not condition",
    use: "Barcoded new-in-box. Weak on used books.",
  },
  {
    name: "FlowLister / Snap2List",
    cost: "~$10–$20/mo + per listing",
    mac: "Browser",
    phone: "Photos",
    scan: "Photo-first, not ISBN-first",
    ebay: "Direct publish",
    bulk: "Batch photo drafts",
    price: "Sold comps",
    inv: "Light",
    curve: "Low",
    speed: "Clothing/general; extra cost per listing",
    use: "Skip — per-listing fees eat book margins",
  },
  {
    name: "eBay Magical Bulk Listing",
    cost: "Free in Seller Hub",
    mac: "Yes",
    phone: "Photos",
    scan: "Photo identify; UPC helps",
    ebay: "Native drafts",
    bulk: "Multiple listings from photos",
    price: "None built-in",
    inv: "Hub only",
    curve: "Low",
    speed: "Varies; hints not always prefills",
    use: "Occasional photo piles. Not 100 books/day.",
  },
];

function PlaybookPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-10">
        <header>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Operations manual</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
            How this shop lists a hundred books a day
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            Built for a lister who is strong at scanning, bins, and checklists, and should not be
            asked to type titles. The desk is a homebase: one scan, every used-book shelf, and the
            first sale kills the other listings. Research current as of September 2026. Confirmed
            facts are labeled. Speeds are estimates.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Click-along for a new shop</h2>
          <Card className="space-y-3 p-5 leading-relaxed">
            <p>
              First visit gets a short popup: want a click-along? Yes points at the real buttons —
              Start practice, Camera, Count the stamp, Jar, then Reel (Quick drill, One minute,
              Camera and gun). No video. No document. If this browser has already sorted a book or
              finished that walk-through, the popup stays quiet.
            </p>
            <button
              type="button"
              className="h-12 rounded-md bg-cloth px-4 text-sm font-medium text-cloth-fg"
              onClick={() => requestTour()}
            >
              Replay the click tour
            </button>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Eight minutes with an owner</h2>
          <Card className="space-y-4 p-5 leading-relaxed">
            <p>
              Do not tour the whole product. Prove one copy cannot sell twice, and that the stamp is
              counted before the bin. If eBay is not connected, List on eBay still drops a file —
              never apologize for a toast.
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                <strong>Shop · Calculus.</strong> Start practice. Count the stamp. Green bin. Buyer
                paid is not we keep.
              </li>
              <li>
                <strong>Shop · Huck.</strong> Same stamp math, oxblood. After fees this copy is a
                gift, not a listing. That is the margin lesson.
              </li>
              <li>
                <strong>Jar.</strong> The number in the jar is keep, not the tag.
              </li>
              <li>
                <strong>Listings · any ready copy.</strong> List on eBay. Connected: live item.
                Not connected: Seller Hub file, same ISBN and price. Either way the owner sees a
                listing leave the desk.
              </li>
              <li>
                <strong>Channels · Boxcar.</strong> Mark sold on one shelf. The others pull. One
                spine, one buyer.
              </li>
              <li>
                <strong>Connect, last.</strong> Parent keys, not a kid screen. Amazon tonight is
                the Inventory Loader unless they already have SP-API.
              </li>
            </ol>
          </Card>
          <Card className="space-y-3 p-5 leading-relaxed">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">If they try to break it</p>
            <p>
              <strong>“Amazon without a developer app?”</strong> Yes. Loader file, Seller Central
              upload. SP-API is optional and slow to approve.
            </p>
            <p>
              <strong>“eBay keys aren’t ready.”</strong> File Exchange CSV. Same CustomLabel as the
              SKU. Connect later; listing does not wait.
            </p>
            <p>
              <strong>“We listed it twice.”</strong> Channels. First inbound sale closes the copy
              and takes the other shelves down.
            </p>
            <p>
              <strong>“Kids typing titles?”</strong> No. ISBN in, bins out. Typing is the skip.
            </p>
            <p>
              <strong>“What if the API is angry about policies?”</strong> The desk says so in
              English, then still hands you the file. The demo continues.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">No keys tonight</h2>
          <Card className="space-y-3 p-5 leading-relaxed">
            <p>
              The scan still hydrates the book. After the pile, Listings (and the jar) offer three
              files: an eBay CSV for File Exchange, an Amazon Inventory Loader, and a Shelfmark
              ledger of what this session actually captured. Upload those in Seller Hub / Seller
              Central. That is the workaround until App ID and LWA exist.
            </p>
            <p className="text-muted">
              Hands (typing) is the skip. File is tonight. Wire is later. Listed is not sold — a
              copy can wait days on Media Mail time and still be the right price. Patience is the
              shop.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">The rule</h2>
          <Card className="space-y-3 p-5 leading-relaxed">
            <p>
              Automate every keystroke that is the same on every book. Keep every judgment that
              teaches a business: condition, price feel, whether to skip, how a photo sells, how a
              package is packed, how a buyer is answered.
            </p>
            <p className="text-muted">
              Default format is Buy It Now with Best Offer, USPS Media Mail, same ship-from,
              same return window. Auctions are the exception, not the day — and auctions are
              eBay-only. BIN copies go everywhere.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">One scan, list everywhere, sell once</h2>
          <Card className="space-y-3 p-5 leading-relaxed">
            <p>
              Shelfmark is the inventory of record. A physical copy gets one SKU and one bin. That
              SKU is the vendor book ID on AbeBooks, the seller-sku on Amazon, the CustomLabel on
              eBay, the Book ID on Biblio and Alibris. When any channel reports a sale, the copy
              closes here and a one-time take-down goes to every other live listing for that SKU.
            </p>
            <p className="text-muted">
              That is the whole product. Not a better eBay form — a homebase so the same spine
              cannot sell twice.
            </p>
          </Card>
          <div className="overflow-x-auto rounded-xl border border-rule bg-elevated">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="border-b border-rule text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  {["Shelf", "How you list", "How a sale comes back", "How you take it down", "Honest status"].map(
                    (h) => (
                      <th key={h} className="px-3 py-3 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "eBay",
                    "Inventory API, or Seller Hub CSV",
                    "Notification API / order created (push)",
                    "EndItem or quantity 0",
                    "Best real-time pair. OAuth app required.",
                  ],
                  [
                    "Amazon",
                    "SP-API Listings Items, used as merchant-fulfilled",
                    "ORDER_CHANGE notification (push)",
                    "PATCH quantity 0",
                    "Selling-partner approval. Buyer street needs a Restricted Data Token.",
                  ],
                  [
                    "AbeBooks",
                    "Inventory Update API — XML add, vendorBookID = SKU",
                    "Order Update API (poll, no webhook)",
                    "XML delete by vendorBookID",
                    "The used/rare native. Closest cousin to the old B&N feed.",
                  ],
                  [
                    "Biblio",
                    "FTP / UIEE / tab file",
                    "Order files and dashboard, not REST",
                    "Delete-status row or bulk-delete SKUs",
                    "No public listing REST API. Reliable files.",
                  ],
                  [
                    "Alibris",
                    "Skinny file: ISBN, condition, price",
                    "Order files / email, not REST",
                    "Quantity 0 in the next drop",
                    "1,200+ upload formats. File in, file out.",
                  ],
                  [
                    "Barnes & Noble",
                    "—",
                    "—",
                    "—",
                    "Marketplace ended 26 March 2020. Do not plan on it.",
                  ],
                ].map((row) => (
                  <tr key={row[0]} className="border-b border-rule/70 align-top last:border-0">
                    {row.map((cell, i) => (
                      <td key={i} className="px-3 py-3 text-muted first:font-medium first:text-ink">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted">
            PangoBooks is a consumer listing app with no public seller API as of 2026. BookFinder
            is an aggregator, not a place you list. Half.com is dead.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">What eBay already gives you</h2>
          <Card className="space-y-3 p-5 leading-relaxed text-muted">
            <p>
              Confirmed from eBay Seller Center: Seller Hub Reports (formerly File Exchange)
              uploads CSV/XLS to add listings in bulk. The in-Hub bulk listing tool is for medium
              volume. The create-listing form still autofills from ISBN / UPC / EAN when the book
              is in eBay’s catalog. The mobile app can scan a barcode for a single listing.
            </p>
            <p>
              Fees, from eBay’s seller-center table: Books & Magazines final value fee is{" "}
              <span className="text-ink">15.3%</span> of the total sale (price + shipping + tax) up
              to $7,500, plus a per-order fee of $0.30 under $10 or $0.40 over $10. Casual accounts
              get 250 free insertions a month, then $0.35. Verify live before a big month — eBay
              edits this table.
            </p>
            <p>
              File Exchange historically required ~90 days on eBay and ~50 listings/month. Reports
              inside Seller Hub is the path eBay now points high-volume sellers to. Use{" "}
              <span className="font-mono text-ink">P:ISBN</span> so catalog details attach. Never
              open the CSV in Excel as numbers — ISBNs lose leading zeros.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Tool comparison</h2>
          <div className="overflow-x-auto rounded-xl border border-rule bg-elevated">
            <table className="w-full min-w-[64rem] text-left text-sm">
              <thead className="border-b border-rule text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  {[
                    "Tool",
                    "Cost",
                    "Mac",
                    "Phone",
                    "ISBN scan",
                    "eBay",
                    "Bulk",
                    "Pricing",
                    "Inventory",
                    "Curve",
                    "Speed",
                    "Use",
                  ].map((h) => (
                    <th key={h} className="px-3 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOOLS.map((t) => (
                  <tr key={t.name} className="border-b border-rule/70 align-top last:border-0">
                    <td className="px-3 py-3 font-medium">{t.name}</td>
                    <td className="px-3 py-3 text-muted">{t.cost}</td>
                    <td className="px-3 py-3">{t.mac}</td>
                    <td className="px-3 py-3">{t.phone}</td>
                    <td className="px-3 py-3 text-muted">{t.scan}</td>
                    <td className="px-3 py-3">{t.ebay}</td>
                    <td className="px-3 py-3 text-muted">{t.bulk}</td>
                    <td className="px-3 py-3 text-muted">{t.price}</td>
                    <td className="px-3 py-3 text-muted">{t.inv}</td>
                    <td className="px-3 py-3">{t.curve}</td>
                    <td className="px-3 py-3 text-muted">{t.speed}</td>
                    <td className="px-3 py-3 text-muted">{t.use}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-subtle">
            3Dsellers Essential cited at $19/month for 100 listings (vendor page, 2026) — confirm
            live. ScoutIQ is an Amazon FBA scout, not an eBay lister. Flippr Pro pricing from
            useflippr.com/pro ($20/mo; yearly advertised cheaper). List My Media is a 2026
            browser tool aimed at books. Speeds are estimates.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Three jewels on every book</h2>
          <Card className="space-y-3 p-5 leading-relaxed">
            <p>
              After a single ISBN lands, Shelfmark prices the copy and runs a small cash-flow ticket
              against every live shelf. Shipping is the same Media Mail stamp on all of them — the
              only things that change are fees and how fast that shelf usually moves.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-muted">
              <li>
                <span className="text-ink">The jewel — highest net per day.</span> Net proceeds
                divided by estimated days-to-sale. This is the working-capital number.
              </li>
              <li>
                <span className="text-ink">Most money — highest net, ignore speed.</span> What you
                keep after fees and the stamp if you can wait.
              </li>
              <li>
                <span className="text-ink">Sells first — fastest shelf, even at a loss.</span> Use
                this when the jar needs cash more than it needs a better ticket.
              </li>
            </ul>
            <p className="text-muted">
              A one-book scan or a title-page photo runs the three jewels immediately. A video reel
              does not. Capture every ISBN first; then the pile is scored top to bottom. Over ten
              books, a progress bar counts each ticket the way a software update does.
            </p>
            <p className="text-sm text-subtle">
              Fees: eBay 15.3% + $0.30/$0.40 (confirmed). Amazon media 15% + $1.80 closing
              (confirmed). AbeBooks Premium 8% + 5.5% processing (confirmed). Biblio Option A 12% +
              $0.25 + processing (confirmed). Alibris 15% + a ~$0.99 closing stand-in (closing is
              variable — estimate). Days-to-sale are estimates, not sold comps. Monthly store fees
              are left out on purpose.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Lane workflow</h2>
          <Card className="space-y-4 p-5 leading-relaxed">
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                <span className="text-ink">Pick up one book.</span> Do not pre-sort a hundred titles
                in your head.
              </li>
              <li>
                <span className="text-ink">Scan the Bookland EAN.</span> Cheap USB guns type 13
                digits and Enter. Shelfmark is listening. No barcode? Photo the title page.
              </li>
              <li>
                <span className="text-ink">Look, don’t type.</span> Confirm the cover matches. Tap
                Like New / Very Good / Good / Acceptable (keys 1–4).
              </li>
              <li>
                <span className="text-ink">Tap defects.</span> Highlight, name inside, ex-library,
                water, tear. That is the whole English of condition.
              </li>
              <li>
                <span className="text-ink">Photo only when it sells.</span> Catalog cover is enough
                under ~$15. Over that, snap jacket flaws.
              </li>
              <li>
                <span className="text-ink">Hear the three jewels.</span> Highest net per day, most
                money, fastest sale. + / − if her gut disagrees. Skip if every shelf is red.
              </li>
              <li>
                <span className="text-ink">List it.</span> SKU and bin are assigned. Pencil the SKU
                on a slip, drop the book in that bin, next scan. Target 30–50 seconds once practiced.
              </li>
              <li>
                <span className="text-ink">List everywhere.</span> API shelves go live from the
                desk. Export Biblio and Alibris files if those are on.
              </li>
              <li>
                <span className="text-ink">When it sells anywhere:</span> that channel informs
                Shelfmark. The copy closes. A one-time take-down hits every other listing. Then
                pick list → bin → wrap → Media Mail → mark shipped.
              </li>
            </ol>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Hardware that actually speeds this up</h2>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-rule">
                {[
                  ["USB HID 1D scanner", "$20–40", "Tera / Inateck / NETUM. EAN-13 is ISBN. Plug in, it types. This is the whole unlock."],
                  ["2D scanner (optional)", "$60–100", "Only if you will scan from a phone screen. Not needed for paper barcodes."],
                  ["SKU labels", "$15 paper + $80 printer later", "Week 1: write SM-YYMMDD-0001 on a slip. Add a Brother QL or DYMO when volume is real."],
                  ["Kitchen / USB scale", "$15–35", "Media Mail is weight-based. Estimate is fine until 20 ships/day."],
                  ["Clamp lamp", "$15", "Webcam grading fails in yellow room light."],
                  ["Sterilite bins + shelf labels", "$40–80", "Bins A-01…H-24. One location per copy. Never “the pile.”"],
                  ["iPhone tripod (optional)", "$15", "Better photos than the 2018 FaceTime camera for $20+ books."],
                ].map(([item, cost, why]) => (
                  <tr key={item}>
                    <td className="px-5 py-3 font-medium">{item}</td>
                    <td className="px-5 py-3 tabular-nums text-muted">{cost}</td>
                    <td className="px-5 py-3 text-muted">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-sm text-muted">
            Starter kit if you buy today: scanner $30 + bins $50 + lamp $15 + slips of paper = about
            $95. Add scale and label printer after the first 200 live listings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Auctions vs Buy It Now</h2>
          <Card className="space-y-3 p-5 leading-relaxed text-muted">
            <p>
              For used books in 2026, Buy It Now wins on common titles. Auctions win on scarce
              copies. That split is consistent across seller data writeups (Instica, Power Selling
              Mom, category notes on media).
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="text-ink">BIN + Best Offer</span> — paperbacks, recent hardcovers,
                anything with a tight sold band. Price control. Lets her learn merchandising
                without a 7-day clock.
              </li>
              <li>
                <span className="text-ink">Auction, 7 days, end Sunday evening Central</span> —
                signed, true firsts, pre-1975 hardcovers, or stale BIN stock you would rather free
                the bin than keep.
              </li>
              <li>
                <span className="text-ink">Do not auction $6 copies.</span> Fees and no-bids waste
                the insertion. Skip or BIN.
              </li>
            </ul>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">What she does vs what the desk does</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Desk (machine)</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li>ISBN capture from the gun</li>
                <li>Title, author, publisher, cover, category</li>
                <li>80-character title + description + shipping FAQ</li>
                <li>SKU, bin, CSV for Seller Hub</li>
                <li>Fee math and skip warning</li>
              </ul>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Her job (the business)</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
                <li>Condition — the whole craft</li>
                <li>Override price when the copy is special</li>
                <li>Choose BIN vs auction on collectible copies</li>
                <li>Photo merchandising on $15+ books</li>
                <li>Bin discipline and pick/pack</li>
                <li>Buyer messages (short, polite, same template)</li>
                <li>Saturday numbers: listed, sold, skipped, net</li>
              </ul>
            </Card>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Timetable to 100+ a day</h2>
          <Card className="p-5">
            <ol className="space-y-3 text-sm leading-relaxed">
              <li>
                <span className="font-medium">Day 1.</span> Plug in the scanner. Run the eight-book
                reel drill. Grade those copies. Export one CSV. Get the first live listing on eBay.
              </li>
              <li>
                <span className="font-medium">Days 2–4.</span> 40–60/day. Muscle memory on 1–4 keys.
                Build bins A and B.
              </li>
              <li>
                <span className="font-medium">Week 2.</span> 80–100/day in two 90-minute blocks.
                First shipped orders. First buyer question.
              </li>
              <li>
                <span className="font-medium">Week 3–4.</span> 100–150/day. Skip rate should be
                conscious, not accidental. Saturday review of sell-through.
              </li>
              <li>
                <span className="font-medium">After that.</span> 200–300 is a full workday plus
                shipping. Only add hours if sell-through stays healthy. Listing into a dead bin is
                not a business.
              </li>
            </ol>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">The one-minute reel</h2>
          <Card className="space-y-3 p-5 leading-relaxed">
            <p>
              This is the packing-line motion those three-second factory videos are teaching: one
              object, one beat, no typing. Takt is three seconds — ISBN held 1.8s, turn 1.2s,
              twenty books a minute. Capture is not listing. Listing still needs a human grade.
            </p>
            <ul className="list-disc space-y-2 pl-5 text-muted">
              <li>
                <span className="text-ink">Confirmed:</span> Chromium{" "}
                <span className="font-mono text-ink">BarcodeDetector</span> reads EAN-13 from a
                webcam or a recorded video. A USB HID gun is more reliable in yellow room light and
                still fires the same capture.
              </li>
              <li>
                <span className="text-ink">Confirmed:</span> Flippr (2026) photographs a whole
                shelf and returns eBay sold comps. Their Pro page lists live video scanning as an
                upcoming capability. They price a stack. They do not own your bins or kill a
                double-sale.
              </li>
              <li>
                <span className="text-ink">Estimate:</span> practiced capture 15–20/min; practiced
                grade+list 2–4/min. One hundred listed books is about 45 minutes of reel plus 40–60
                minutes of grading, not an eight-hour type-athon.
              </li>
            </ul>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">Kids, stations, what stays human</h2>
          <Card className="space-y-3 p-5 leading-relaxed text-muted">
            <p>
              Crew is roles, not names. Five-year-olds can hold a barcode still. Ten-year-olds can
              tap 1–4. Fourteen-year-olds can override a price. The machine must never steal the
              judgment that is the business lesson.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="text-ink">Reel (5+).</span> Hold, beep, turn, pile.
              </li>
              <li>
                <span className="text-ink">Scan (8+).</span> USB gun on the desk, one book one beep.
              </li>
              <li>
                <span className="text-ink">Grade (10+).</span> Keys 1–4, tap defects, skip incompletes.
              </li>
              <li>
                <span className="text-ink">Pack (10+).</span> Pick list → bin → wrap → Media Mail.
              </li>
              <li>
                <span className="text-ink">Count (12+).</span> Saturday listed / sold / skipped / net.
              </li>
              <li>
                <span className="text-ink">Helm (14–18).</span> Price overrides, auctions, buyer replies.
              </li>
            </ul>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl font-semibold">What is hard to copy — and stays in-house</h2>
          <Card className="space-y-3 p-5 leading-relaxed text-muted">
            <p>
              Conglomerates sell listing credits. They do not sit in your dining room. The moat is
              the motion plus the homebase, not a prettier title generator.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Takt trainer that teaches a kid a 3-second cycle without English sentences.</li>
              <li>ISBN-triggered stills from a rolling camera, not a form with twelve boxes.</li>
              <li>One physical copy, many shelves, first sale kills the rest.</li>
              <li>Voice + keys 1–4, so typing is never the bottleneck.</li>
              <li>Crew scoreboard that is operations, not a social network.</li>
              <li>
                Honest catalog, honest defects, no per-listing fee. Later the same UPC path extends
                past books.
              </li>
            </ul>
          </Card>
        </section>

        <section className="space-y-3 pb-8">
          <h2 className="font-display text-2xl font-semibold">Sources</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              eBay Seller Center — bulk listing tools; fees and features table (Books & Magazines
              15.3% FVF).
            </li>
            <li>eBay community — P:ISBN on File Exchange / Reports templates.</li>
            <li>Open Library Books API and Covers API — free ISBN catalog used by this desk.</li>
            <li>3Dsellers barcode-to-listing and pricing pages, 2026 (~$19/mo Essential).</li>
            <li>List My Media (listmymedia.com) — book CSV lister, 2026.</li>
            <li>
              Flippr (useflippr.com) — shelf/stack photo comps; Pro ~$20/mo; live video listed as
              upcoming on the Pro page, August 2026.
            </li>
            <li>TurboLister iOS — barcode to eBay draft, App Store 2026.</li>
            <li>FlowLister 2026 ranking of photo listers; eBay Magical Bulk Listing (Seller Hub).</li>
            <li>eBay: native listing video, MP4/MOV, 150 MB, gallery slot two.</li>
            <li>BISG barcoding guidelines (updated 2025) — Bookland EAN is ISBN-13.</li>
            <li>WICG Barcode Detection API — Chromium; not in Firefox.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
