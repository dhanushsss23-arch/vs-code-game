"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

type StoreItem = {
  id: string;
  sku: string;
  kind: string;
  priceCoins: number;
  localizedName: string;
  localizedDescription: string | null;
  owned: boolean;
};
type InventoryEntry = {
  id: string;
  equipped: boolean;
  storeItem: { id: string; sku: string; kind: string; localizedName: string; localizedDescription: string | null };
};
type StoreState = { balance: number; items: StoreItem[]; inventory: InventoryEntry[] };
type Props = { locale: "EN" | "TA" };
const labels = {
  EN: { title: "The little things that make it yours", balance: "Your coins", catalog: "Marketplace", inventory: "Your collection", empty: "No items are available yet. Check back when the shop is stocked.", noInventory: "Your collection will grow as you unlock rewards.", buy: "Get this", owned: "In your collection", equip: "Equip", unequip: "Unequip", loading: "Loading the shop...", back: "Back to learning", error: "The marketplace is unavailable." },
  TA: { title: "உங்களுக்கான சிறிய தனிப்பயனாக்கங்கள்", balance: "உங்கள் நாணயங்கள்", catalog: "சந்தை", inventory: "உங்கள் சேகரிப்பு", empty: "பொருட்கள் இன்னும் சேர்க்கப்படவில்லை. பின்னர் மீண்டும் பாருங்கள்.", noInventory: "வெகுமதிகளைப் பெறும்போது உங்கள் சேகரிப்பு வளரும்.", buy: "பெறுக", owned: "உங்களிடம் உள்ளது", equip: "அணியவும்", unequip: "அகற்றவும்", loading: "சந்தை ஏற்றப்படுகிறது...", back: "கற்றலுக்குத் திரும்பு", error: "சந்தையை ஏற்ற முடியவில்லை." },
};

const icons: Record<string, string> = { AVATAR: "✦", THEME: "◐", COSMETIC: "✧", CLUE: "⌕" };

export function Marketplace({ locale }: Props) {
  const text = labels[locale];
  const [store, setStore] = useState<StoreState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/store");
      const result = await response.json() as StoreState & { error?: string };
      if (!response.ok) throw new Error(result.error ?? text.error);
      setStore(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.error);
    } finally {
      setLoading(false);
    }
  }, [text.error]);

  useEffect(() => { void load(); }, [load]);

  async function purchase(itemId: string) {
    setPendingId(itemId);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeItemId: itemId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? text.error);
      setMessage(locale === "TA" ? "வெகுமதி சேர்க்கப்பட்டது!" : "Reward added to your collection!");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.error);
    } finally {
      setPendingId("");
    }
  }

  async function equip(inventoryId: string, equipped: boolean) {
    setPendingId(inventoryId);
    setError("");
    try {
      const response = await fetch(`/api/inventory/${inventoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipped }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? text.error);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.error);
    } finally {
      setPendingId("");
    }
  }

  return (
    <main className="console-page">
      <header className="topbar app-topbar">
        <Link className="brand" href="/">eduverse<span>.</span></Link>
        <nav className="app-nav" aria-label="Marketplace navigation">
          <Link href="/student">{text.back}</Link><LanguageToggle locale={locale} /><ThemeToggle label="Toggle color theme" /><LogoutButton />
        </nav>
      </header>
      <section className="console-heading"><p className="eyebrow"><span className="eyebrow-dot" /> EDUVERSE MARKETPLACE</p><h1>{text.title}</h1>
        <div className="market-balance"><span>{text.balance}</span><strong>◈ {store?.balance ?? 0}</strong></div>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <section className="console-panel"><div className="section-heading"><div><p className="eyebrow">REWARDS</p><h2>{text.catalog}</h2></div></div>
        {loading ? <div className="list-skeleton"><span /><span /><span /></div> : !store?.items.length ? <div className="empty-panel"><p>{text.empty}</p></div> : (
          <div className="store-grid">{store.items.map((item) => <article className="store-card" key={item.id}>
            <div className={`store-art store-art-${item.kind.toLowerCase()}`}>{icons[item.kind] ?? "✧"}</div><span className="store-kind">{item.kind.toLowerCase()}</span>
            <h3>{item.localizedName}</h3><p>{item.localizedDescription}</p><div className="store-buy-row"><strong>◈ {item.priceCoins}</strong>
              <button className={item.owned ? "button button-small owned-button" : "button button-small"} disabled={item.owned || pendingId === item.id || (store.balance < item.priceCoins)} onClick={() => void purchase(item.id)} type="button">{item.owned ? text.owned : pendingId === item.id ? "..." : text.buy}</button>
            </div>
          </article>)}</div>
        )}
      </section>
      <section className="console-panel inventory-panel"><div className="section-heading"><div><p className="eyebrow">YOUR REWARDS</p><h2>{text.inventory}</h2></div></div>
        {!store?.inventory.length ? <div className="empty-panel"><p>{text.noInventory}</p></div> : <div className="inventory-grid">{store.inventory.map((item) => <article className="inventory-card" key={item.id}>
          <span className={`store-art store-art-${item.storeItem.kind.toLowerCase()}`}>{icons[item.storeItem.kind] ?? "✧"}</span><div><b>{item.storeItem.localizedName}</b><small>{item.storeItem.kind.toLowerCase()}</small></div>
          <button className="text-button" disabled={pendingId === item.id} onClick={() => void equip(item.id, !item.equipped)} type="button">{item.equipped ? text.unequip : text.equip}</button>
        </article>)}</div>}
      </section>
    </main>
  );
}
