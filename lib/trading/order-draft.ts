import type { OrderRequest } from "@/app/services/schwab/client"

export type OrderSide = "BUY" | "SELL"
export type QuantityMode = "CUSTOM" | "ALL"
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT"

export interface OrderDraft {
    accountId?: string
    symbol: string
    side: OrderSide
    quantityMode: QuantityMode
    quantity?: number
    orderType: OrderType
    limitPrice?: number
    stopPrice?: number
    duration: OrderRequest["duration"]
    session: OrderRequest["session"]
}

const DEFAULT_ORDER_DRAFT: Omit<OrderDraft, "symbol" | "side"> = {
    quantityMode: "CUSTOM",
    orderType: "MARKET",
    duration: "DAY",
    session: "NORMAL",
}

export function createOrderDraft(
    input: Pick<OrderDraft, "symbol" | "side"> & Partial<OrderDraft>
): OrderDraft {
    return {
        ...DEFAULT_ORDER_DRAFT,
        ...input,
        symbol: input.symbol.toUpperCase().trim(),
        side: input.side,
    }
}

export function serializeOrderDraft(draft: OrderDraft) {
    const params = new URLSearchParams()

    params.set("symbol", draft.symbol)
    params.set("side", draft.side)
    params.set("quantityMode", draft.quantityMode)
    params.set("orderType", draft.orderType)
    params.set("duration", draft.duration)
    params.set("session", draft.session)

    if (draft.accountId) {
        params.set("accountId", draft.accountId)
    }

    if (typeof draft.quantity === "number" && Number.isFinite(draft.quantity)) {
        params.set("quantity", String(draft.quantity))
    }

    if (typeof draft.limitPrice === "number" && Number.isFinite(draft.limitPrice)) {
        params.set("limitPrice", String(draft.limitPrice))
    }

    if (typeof draft.stopPrice === "number" && Number.isFinite(draft.stopPrice)) {
        params.set("stopPrice", String(draft.stopPrice))
    }

    return params.toString()
}

export function parseOrderDraft(
    params: URLSearchParams | ReadonlyURLSearchParams | URLSearchParams
): OrderDraft | null {
    const symbol = params.get("symbol")?.trim()
    const side = params.get("side")

    if (!symbol || (side !== "BUY" && side !== "SELL")) {
        return null
    }

    const quantityValue = params.get("quantity")
    const limitPriceValue = params.get("limitPrice")
    const stopPriceValue = params.get("stopPrice")

    return createOrderDraft({
        accountId: params.get("accountId") || undefined,
        symbol,
        side,
        quantityMode: params.get("quantityMode") === "ALL" ? "ALL" : "CUSTOM",
        quantity: quantityValue ? Number(quantityValue) : undefined,
        orderType: parseOrderType(params.get("orderType")),
        duration: parseDuration(params.get("duration")),
        session: parseSession(params.get("session")),
        limitPrice: limitPriceValue ? Number(limitPriceValue) : undefined,
        stopPrice: stopPriceValue ? Number(stopPriceValue) : undefined,
    })
}

export function resolveDraftQuantity(
    draft: OrderDraft,
    positionQuantity?: number
) {
    if (draft.quantityMode === "ALL") {
        return positionQuantity ?? 0
    }

    return draft.quantity ?? 0
}

export function buildOrderRequestFromDraft(
    draft: OrderDraft,
    positionQuantity?: number
): OrderRequest {
    const quantity = resolveDraftQuantity(draft, positionQuantity)

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Quantity must be greater than zero.")
    }

    return {
        symbol: draft.symbol,
        quantity,
        orderType: draft.orderType,
        instruction: draft.side === "BUY" ? "BUY" : "SELL",
        duration: draft.duration,
        session: draft.session,
        price: draft.limitPrice,
        stopPrice: draft.stopPrice,
    }
}

function parseOrderType(value: string | null): OrderType {
    if (value === "LIMIT" || value === "STOP" || value === "STOP_LIMIT") {
        return value
    }

    return "MARKET"
}

function parseDuration(value: string | null): OrderRequest["duration"] {
    if (value === "GTC" || value === "FILL_OR_KILL") {
        return value
    }

    return "DAY"
}

function parseSession(value: string | null): OrderRequest["session"] {
    if (value === "AM" || value === "PM" || value === "SEAMLESS") {
        return value
    }

    return "NORMAL"
}

type ReadonlyURLSearchParams = Pick<URLSearchParams, "get">
