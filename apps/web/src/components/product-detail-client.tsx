"use client";
import { Loader2, ShoppingBag as ShoppingBagIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/hooks/use-cart";
import { useProductAvailability } from "@/hooks/use-product-availability";
import { Button } from "./ui/button";

type Product = { id: string; title: string; price?: number; stock?: number };

export default function ProductDetailClient({ product }: { product: Product }) {
    const { addItem } = useCart();
    const { available, heldByOther } = useProductAvailability({
        productId: product.id,
        fallbackStock: product.stock,
    });
    const [qty, setQty] = useState(1);
    const [loading, setLoading] = useState(false);
    const inStock = (available ?? 0) > 0;

    const handleAdd = async () => {
        if (qty < 1) return;
        if (heldByOther) return;

        // Validate quantity against live availability (stock minus holds).
        if (available !== undefined && qty > available) {
            toast.error(`Solo hay ${available} unidades disponibles`);
            return;
        }

        setLoading(true);
        try {
            // Send quantity in a single request
            await addItem(product.id, product.title, qty);
            setQty(1); // Reset quantity after successful add
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full">
            <div className="relative flex-1 group">
                <label
                    htmlFor="product-quantity"
                    className="absolute -top-2 left-4 bg-foreground text-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest z-10 rounded-full"
                >
                    Cantidad
                </label>
                <input
                    id="product-quantity"
                    type="number"
                    min={1}
                    max={available}
                    value={qty}
                    onChange={(e) => {
                        const rawValue = e.target.value;
                        if (!rawValue) {
                            setQty(1);
                            return;
                        }
                        const value = Number(rawValue);
                        setQty(
                            Number.isFinite(value) && value > 0
                                ? Math.floor(value)
                                : 1,
                        );
                    }}
                    className="w-full h-16 bg-background border-2 border-border text-foreground px-6 font-bold text-2xl outline-none focus:border-foreground transition-[color,background-color,border-color,box-shadow,opacity,transform] rounded-xl"
                />
            </div>

            <Button
                onClick={handleAdd}
                disabled={loading || !inStock || heldByOther}
                data-add-state={
                    heldByOther
                        ? "held-by-other"
                        : inStock
                          ? "available"
                          : "out-of-stock"
                }
                className="h-16 px-12 bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-widest text-[11px] rounded-xl transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98] group border-none shadow-xl shadow-foreground/10"
            >
                {loading ? (
                    <div className="flex items-center gap-3">
                        <Loader2 className="size-5 animate-spin" />
                        <span>Procesando</span>
                    </div>
                ) : heldByOther ? (
                    <div className="flex items-center gap-3">
                        <ShoppingBagIcon className="size-5" />
                        <span>lo está agregando otro usuario</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <ShoppingBagIcon className="size-5" />
                        <span>Agregar al Carrito</span>
                    </div>
                )}
            </Button>
        </div>
    );
}
