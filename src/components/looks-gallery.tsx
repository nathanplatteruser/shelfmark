import { useMemo, useState } from "react";
import { DESK_CATALOG } from "@/lib/desk-catalog";
import { kidCard, kidListPrice, money, PRACTICE_ISBNS, type KidCard, type KidChoice } from "@/lib/pricing";
import "@/looks.css";

type LookId = "bench" | "ticket" | "ledger" | "flow" | "film";

const LOOKS: { id: LookId; n: string; title: string; card: string; tag: string }[] = [
  { id: "bench", n: "01", title: "Packing bench", card: "Hallmark", tag: "split-lane" },
  { id: "ticket", n: "02", title: "Ticket window", card: "Hallmark", tag: "single-stage" },
  { id: "ledger", n: "03", title: "Hanging ledger", card: "Hallmark", tag: "index" },
  { id: "flow", n: "04", title: "Sell-once path", card: "Archify", tag: "sequence" },
  { id: "film", n: "05", title: "Six takes", card: "OpenMontage", tag: "filmstrip" },
];

const SHORT: Record<string, string> = {
  "9781285741550": "Calculus",
  "9780743273565": "Gatsby",
  "9780807508527": "Boxcar",
  "9781451673319": "F451",
  "9780618260300": "Hobbit",
  "9780553212679": "Huck",
};

function usePractice(isbn: string) {
  const book = DESK_CATALOG[isbn];
  const card = useMemo(() => {
    if (!book) return null;
    const listPrice = kidListPrice(
      book.isbn13,
      book.format === "textbook" ? 24.99 : book.format === "hardcover" ? 11.99 : 8.99,
    );
    return kidCard({ listPrice, format: book.format, wePayStamp: true });
  }, [book]);
  return { book, card };
}

export function LooksGallery() {
  const [look, setLook] = useState<LookId>("bench");
  const [isbn, setIsbn] = useState<string>(PRACTICE_ISBNS[0]);
  const { book, card } = usePractice(isbn);

  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Design rolodex</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Same shop. Different bones.</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
          Hallmark asked for new structure, not a recolor. Three ways to sort a book, an Archify path
          of what we built, then six stills. Live Shop stays as it is.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row-reverse lg:items-start">
        <ol className="look-index w-full shrink-0 lg:w-64">
          {LOOKS.map((item) => (
            <li key={item.id}>
              <button type="button" className={look === item.id ? "is-on" : ""} onClick={() => setLook(item.id)}>
                <span className="look-num">{item.n}</span>
                <span>
                  <span className="block font-display text-xl font-semibold leading-tight">{item.title}</span>
                </span>
                <span className="look-tag">
                  {item.card} · {item.tag}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="min-w-0 flex-1">
          {look === "bench" && book && card && (
            <Bench isbn={isbn} setIsbn={setIsbn} title={book.title} author={book.author} card={card} />
          )}
          {look === "ticket" && book && card && (
            <Ticket isbn={isbn} setIsbn={setIsbn} title={book.title} author={book.author} card={card} />
          )}
          {look === "ledger" && <Ledger isbn={isbn} setIsbn={setIsbn} />}
          {look === "flow" && <Flow />}
          {look === "film" && <Film />}
        </div>
      </div>
    </div>
  );
}

function Bins({ card, classPrefix }: { card: KidCard; classPrefix: "look-till" | "look-ticket-pedals" | "look-drawer" }) {
  const bins: { id: KidChoice; cls: string; label: string; hint: string }[] = [
    { id: "SELL IT", cls: "sell", label: "Sell it", hint: "Green bin" },
    { id: "TRY THE OTHER SHOP", cls: "other", label: "Other shop", hint: "Ochre bin" },
    { id: "GIVE IT AWAY", cls: "give", label: "Give it away", hint: "Oxblood bin" },
  ];
  return (
    <div className={classPrefix}>
      {bins.map((b) => (
        <button key={b.id} type="button" className={`${b.cls}${card.choice === b.id ? " is-hint" : ""}`}>
          {classPrefix === "look-ticket-pedals" ? (
            <>
              <small>{b.hint}</small>
              {b.label}
            </>
          ) : (
            <>
              <span className="block font-semibold">{b.label}</span>
              <span className="mt-1 block opacity-80">{b.hint}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

function Bench({
  isbn,
  setIsbn,
  title,
  author,
  card,
}: {
  isbn: string;
  setIsbn: (v: string) => void;
  title: string;
  author: string;
  card: KidCard;
}) {
  return (
    <div className="look-bench">
      <aside className="look-bench-well">
        <p className="text-xs uppercase tracking-[0.22em] text-cloth-fg/60">Lane one</p>
        <h2>Hold the spine. The ticket prints itself.</h2>
        <div className="look-spines">
          {PRACTICE_ISBNS.map((code) => (
            <button
              key={code}
              type="button"
              className={isbn === code ? "look-spine is-on" : "look-spine"}
              onClick={() => setIsbn(code)}
            >
              {SHORT[code]}
            </button>
          ))}
        </div>
      </aside>
      <div className="look-bench-ticket">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Media mail already counted</p>
        <p className="font-display text-3xl font-semibold leading-tight">{title}</p>
        <p className="text-muted">{author}</p>
        <div className="look-receipt">
          <div>Buyer pays {money(card.buyerPays)}</div>
          <div>Shop {money(card.shopTakes)} · envelope {money(card.mailer)} · stamp {money(card.stamp)}</div>
          <span className="keep">{money(card.keepAmazon)}</span>
          we keep
        </div>
        <Bins card={card} classPrefix="look-till" />
      </div>
    </div>
  );
}

function Ticket({
  isbn,
  setIsbn,
  title,
  author,
  card,
}: {
  isbn: string;
  setIsbn: (v: string) => void;
  title: string;
  author: string;
  card: KidCard;
}) {
  const i = PRACTICE_ISBNS.indexOf(isbn as (typeof PRACTICE_ISBNS)[number]);
  const next = PRACTICE_ISBNS[(i + 1) % PRACTICE_ISBNS.length];
  return (
    <div className="look-ticket">
      <div className="flex items-end justify-between gap-3">
        <p className="look-ticket-mark">Window 2 · one copy</p>
        <button
          type="button"
          className="h-10 border-0 bg-transparent text-sm uppercase tracking-[0.16em] text-cloth-fg/80"
          onClick={() => setIsbn(next)}
        >
          Next spine →
        </button>
      </div>
      <div className="look-stub">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Admit one · {SHORT[isbn]}</p>
        <h2>{title}</h2>
        <p className="text-muted">{author}</p>
        <p className="mt-6 font-display text-4xl font-semibold tabular-nums">{money(card.keepAmazon)}</p>
        <p className="text-sm text-muted">after the shop, the envelope, and the stamp. Buyer pays {money(card.buyerPays)}.</p>
      </div>
      <Bins card={card} classPrefix="look-ticket-pedals" />
    </div>
  );
}

function Ledger({ isbn, setIsbn }: { isbn: string; setIsbn: (v: string) => void }) {
  const { card } = usePractice(isbn);
  return (
    <div className="look-ledger">
      <div className="look-run">
        <span>Shelfmark · practice ledger</span>
        <span>Count the stamp · 09 Sept 2026</span>
      </div>
      {PRACTICE_ISBNS.map((code, n) => {
        const b = DESK_CATALOG[code];
        const listPrice = kidListPrice(code, 8.99);
        const row = kidCard({ listPrice, format: b?.format ?? "paperback", wePayStamp: true });
        return (
          <div key={code}>
            <button
              type="button"
              className={isbn === code ? "look-row is-on" : "look-row"}
              onClick={() => setIsbn(code)}
            >
              <span className="n">{String(n + 1).padStart(2, "0")}</span>
              <span className="font-semibold">{b?.title}</span>
              <span className="author text-muted">{b?.author}</span>
              <span className="keep">{money(row.keepAmazon)}</span>
            </button>
            {isbn === code && card ? <Bins card={card} classPrefix="look-drawer" /> : null}
          </div>
        );
      })}
    </div>
  );
}

function Flow() {
  return (
    <div className="space-y-4">
      <p className="look-flow-note">
        Evidence from this build, not a dream stack. Kid lane is the three bins. Grown lane is
        desk, reel, and the sell-once take-down. The stamp is the same number on every channel.
      </p>
      <div className="look-flow">
        <svg viewBox="0 0 1100 420" role="img" aria-label="Scan to sell-once sequence">
          <rect width="1100" height="420" fill="#f3eee4" />
          <text x="24" y="36" fill="#8b3a2a" fontSize="11" letterSpacing="3" fontFamily="Source Sans 3, sans-serif">
            KID LANE
          </text>
          <text x="24" y="230" fill="#8b3a2a" fontSize="11" letterSpacing="3" fontFamily="Source Sans 3, sans-serif">
            GROWN LANE
          </text>
          {[
            [40, 70, "Scan ISBN"],
            [250, 70, "Count stamp"],
            [460, 70, "Three bins"],
            [670, 70, "Jar"],
          ].map(([x, y, label]) => (
            <g key={String(label)}>
              <rect x={x as number} y={y as number} width="170" height="72" fill="#faf7f1" stroke="#2f463c" />
              <text
                x={(x as number) + 14}
                y={(y as number) + 42}
                fill="#1c1916"
                fontSize="18"
                fontFamily="Fraunces, serif"
              >
                {label}
              </text>
            </g>
          ))}
          {[
            [40, 264, "Desk grade"],
            [250, 264, "One-minute reel"],
            [460, 264, "List everywhere"],
            [670, 264, "First sale"],
            [880, 264, "Take-down"],
          ].map(([x, y, label]) => (
            <g key={String(label)}>
              <rect x={x as number} y={y as number} width="170" height="72" fill="#2f463c" />
              <text
                x={(x as number) + 14}
                y={(y as number) + 42}
                fill="#f3eee4"
                fontSize="16"
                fontFamily="Fraunces, serif"
              >
                {label}
              </text>
            </g>
          ))}
          <path
            d="M210 106 H250 M420 106 H460 M630 106 H670 M755 142 V264"
            fill="none"
            stroke="#8b3a2a"
            strokeWidth="1.5"
          />
          <path
            d="M210 300 H250 M420 300 H460 M630 300 H670 M840 300 H880"
            fill="none"
            stroke="#c9c3b8"
            strokeWidth="1.5"
          />
          <text x="24" y="400" fill="#6f6a62" fontSize="13" fontFamily="Source Sans 3, sans-serif">
            One SKU. One bin. The first channel to sell kills the rest.
          </text>
        </svg>
      </div>
    </div>
  );
}

function Film() {
  const takes = [
    { n: "01", t: "ISBN", d: "Hold still. Two seconds." },
    { n: "02", t: "Stamp", d: "Count it before the bin." },
    { n: "03", t: "Bin", d: "Green, ochre, or oxblood." },
    { n: "04", t: "Jar", d: "Buyer paid is not we keep." },
    { n: "05", t: "Reel", d: "Twenty books a minute." },
    { n: "06", t: "Once", d: "First sale closes the rest." },
  ];
  return (
    <div className="space-y-3">
      <p className="look-flow-note">
        OpenMontage posture: a quiet takt film, not a trailer. Six stills. No stock grammar.
      </p>
      <div className="look-film">
        {takes.map((take) => (
          <article key={take.n} className="look-cell">
            <p className="take">Take {take.n}</p>
            <h3>{take.t}</h3>
            <p>{take.d}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
