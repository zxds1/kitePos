export {
  calculateServerStock,
  toStockNumber,
} from "../../../../utils/stock-calculator"

export function numbersMatch(left: number, right: number, epsilon = 0.0001) {
  return Math.abs(left - right) <= epsilon
}
