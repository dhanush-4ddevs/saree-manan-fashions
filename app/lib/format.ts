import numWords from 'num-words';

export function formatIndianCurrency(amount: number) {
  if (amount === undefined || amount === null) {
    return '₹ 0';
  }
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export function formatIndianQuantity(quantity: number) {
  if (quantity === undefined || quantity === null) {
    return '0';
  }
  const formatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(quantity);
}

export function convertToWords(amount: number) {
  if (amount === undefined || amount === null) {
    return '';
  }
  const words = numWords(amount);
  return `${words.charAt(0).toUpperCase() + words.slice(1)} rupees only`;
}
