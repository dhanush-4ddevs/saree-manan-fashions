const SUPPLIERS_STORAGE_KEY = 'voucher_suppliers';

export interface SupplierSuggestion {
  name: string;
  count: number; // How many times this supplier has been used
  lastUsed: string; // ISO date string
}

export const getStoredSuppliers = (): SupplierSuggestion[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading suppliers from localStorage:', error);
    return [];
  }
};

export const saveSupplier = (supplierName: string): void => {
  if (typeof window === 'undefined' || !supplierName.trim()) return;

  try {
    const suppliers = getStoredSuppliers();
    const existingIndex = suppliers.findIndex(s => s.name.toLowerCase() === supplierName.toLowerCase());

    if (existingIndex >= 0) {
      // Update existing supplier
      suppliers[existingIndex].count += 1;
      suppliers[existingIndex].lastUsed = new Date().toISOString();
    } else {
      // Add new supplier
      suppliers.push({
        name: supplierName.trim(),
        count: 1,
        lastUsed: new Date().toISOString()
      });
    }

    // Sort by count (descending) and then by last used (most recent first)
    suppliers.sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });

    // Keep only top 50 suppliers to avoid storage bloat
    const trimmedSuppliers = suppliers.slice(0, 50);

    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(trimmedSuppliers));
  } catch (error) {
    console.error('Error saving supplier to localStorage:', error);
  }
};

export const getSupplierSuggestions = (query: string): string[] => {
  if (!query.trim()) return [];

  const suppliers = getStoredSuppliers();
  const queryLower = query.toLowerCase();

  return suppliers
    .filter(supplier => supplier.name.toLowerCase().startsWith(queryLower))
    .map(supplier => supplier.name)
    .slice(0, 10); // Limit to 10 suggestions
};

export const clearSupplierHistory = (): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(SUPPLIERS_STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing supplier history:', error);
  }
};
