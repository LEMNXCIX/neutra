/**
 * Registry of the 20 request-schema modules ported from
 * `apps/api/core/application/dtos/requests/**`. Every module corresponds to
 * one API source file that carried class-validator decorators.
 */
import * as appointmentQuery from "../booking/schemas/appointment-query.js";
import * as appointment from "../booking/schemas/appointment.js";
import * as service from "../booking/schemas/service.js";
import * as staff from "../booking/schemas/staff.js";
import * as auth from "../auth/schemas/auth.js";
import * as banner from "../content/schemas/banner.js";
import * as cart from "../catalog/schemas/cart.js";
import * as category from "../catalog/schemas/category.js";
import * as coupon from "../catalog/schemas/coupon.js";
import * as feature from "../content/schemas/feature.js";
import * as listQuery from "../_common/schemas/list-query.js";
import * as loyalty from "../loyalty/schemas/loyalty.js";
import * as order from "../order/schemas/order.js";
import * as permission from "../user/schemas/permission.js";
import * as product from "../catalog/schemas/product.js";
import * as role from "../user/schemas/role.js";
import * as slide from "../content/schemas/slide.js";
import * as tenant from "../tenant/schemas/tenant.js";
import * as user from "../user/schemas/user.js";
import * as whatsapp from "../whatsapp/schemas/whatsapp.js";

export const requestSchemaModules = [
  appointmentQuery,
  appointment,
  service,
  staff,
  auth,
  banner,
  cart,
  category,
  coupon,
  feature,
  listQuery,
  loyalty,
  order,
  permission,
  product,
  role,
  slide,
  tenant,
  user,
  whatsapp,
] as const;

export type RequestSchemaModule = (typeof requestSchemaModules)[number];

export * from "../booking/schemas/index.js";
export * from "../auth/index.js";
export * from "../catalog/schemas/index.js";
export * from "../content/schemas/index.js";
export * from "../loyalty/schemas/index.js";
export * from "../order/schemas/index.js";
export * from "../tenant/schemas/index.js";
export * from "../user/schemas/index.js";
export * from "../whatsapp/schemas/index.js";
