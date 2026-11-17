import type { OrderStatus } from "../../enums/order.js";
import type { Product } from "../../catalog/entities/product.js";

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  amount: number;
  price: number;
  product?: Product;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  total: number;
  discountAmount: number;
  couponId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    name: string;
    email: string;
  };
  trackingNumber?: string | null;
}
