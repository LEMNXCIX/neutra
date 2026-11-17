/**
 * Registry of the 24 response-type modules ported from
 * `apps/api/core/application/dtos/responses/**` — one per source file.
 */
import * as appointmentList from "../booking/dtos/appointment-list.response.js";
import * as appointment from "../booking/dtos/appointment.response.js";
import * as banner from "../content/dtos/banner.response.js";
import * as cart from "../catalog/dtos/cart.response.js";
import * as category from "../catalog/dtos/category.response.js";
import * as couponValidation from "../catalog/dtos/coupon-validation.response.js";
import * as coupon from "../catalog/dtos/coupon.response.js";
import * as feature from "../content/dtos/feature.response.js";
import * as loyalty from "../loyalty/dtos/loyalty.response.js";
import * as order from "../order/dtos/order.response.js";
import * as permission from "../user/dtos/permission.response.js";
import * as product from "../catalog/dtos/product.response.js";
import * as role from "../user/dtos/role.response.js";
import * as service from "../booking/dtos/service.response.js";
import * as serviceMinimal from "../_common/dtos/service-minimal.response.js";
import * as staffMinimal from "../_common/dtos/staff-minimal.response.js";
import * as tenantMinimal from "../_common/dtos/tenant-minimal.response.js";
import * as userMinimal from "../_common/dtos/user-minimal.response.js";
import * as slide from "../content/dtos/slide.response.js";
import * as staff from "../booking/dtos/staff.response.js";
import * as tenant from "../tenant/dtos/tenant.response.js";
import * as userPublic from "../user/dtos/user-public.response.js";
import * as user from "../user/dtos/user.response.js";
import * as whatsappConfig from "../whatsapp/dtos/whatsapp-config.response.js";

export const responseTypeModules = [
  appointmentList,
  appointment,
  banner,
  cart,
  category,
  couponValidation,
  coupon,
  feature,
  loyalty,
  order,
  permission,
  product,
  role,
  service,
  serviceMinimal,
  staffMinimal,
  tenantMinimal,
  userMinimal,
  slide,
  staff,
  tenant,
  userPublic,
  user,
  whatsappConfig,
] as const;

export type ResponseTypeModule = (typeof responseTypeModules)[number];

export * from "../booking/dtos/index.js";
export * from "../catalog/dtos/index.js";
export * from "../content/dtos/index.js";
export * from "../loyalty/dtos/index.js";
export * from "../order/dtos/index.js";
export * from "../tenant/dtos/index.js";
export * from "../user/dtos/index.js";
export * from "../whatsapp/dtos/index.js";
