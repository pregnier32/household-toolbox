'use client';

import { useState } from 'react';

type CalculationBox = {
  id: string;
  vendor: string;
  orderTotal: string;
  discountPercent: string;
};

export function PercentOfOrderTool() {
  const [boxes, setBoxes] = useState<CalculationBox[]>([
    { id: '1', vendor: '', orderTotal: '', discountPercent: '' }
  ]);

  const formatCurrency = (value: string) => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    // Handle multiple decimal points
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    return numericValue;
  };

  const formatPercentage = (value: string) => {
    // Remove all non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    
    // Handle multiple decimal points
    const parts = numericValue.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 2 decimal places
    if (parts[1] && parts[1].length > 2) {
      return parts[0] + '.' + parts[1].substring(0, 2);
    }
    
    // Limit percentage to 0-100
    const numValue = parseFloat(numericValue);
    if (!isNaN(numValue) && numValue > 100) {
      return '100';
    }
    
    return numericValue;
  };

  const handleVendorChange = (boxId: string, value: string) => {
    setBoxes(prev => prev.map(box => 
      box.id === boxId ? { ...box, vendor: value } : box
    ));
  };

  const handleOrderTotalChange = (boxId: string, value: string) => {
    const formatted = formatCurrency(value);
    setBoxes(prev => prev.map(box => 
      box.id === boxId ? { ...box, orderTotal: formatted } : box
    ));
  };

  const handleDiscountPercentChange = (boxId: string, value: string) => {
    const formatted = formatPercentage(value);
    setBoxes(prev => prev.map(box => 
      box.id === boxId ? { ...box, discountPercent: formatted } : box
    ));
  };

  const addBox = () => {
    const newId = Date.now().toString();
    setBoxes(prev => [...prev, { id: newId, vendor: '', orderTotal: '', discountPercent: '' }]);
  };

  const removeBox = (boxId: string) => {
    if (boxes.length > 1) {
      setBoxes(prev => prev.filter(box => box.id !== boxId));
    }
  };

  const formatDisplayValue = (value: string) => {
    if (!value) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue);
  };

  const formatPercentageDisplay = (value: string) => {
    if (!value) return '';
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';
    return `${numValue.toFixed(2)}%`;
  };

  // Calculate discount amount and what user paid for a specific box
  const calculateValues = (box: CalculationBox) => {
    const orderTotalNum = parseFloat(box.orderTotal) || 0;
    const discountPercentNum = parseFloat(box.discountPercent) || 0;
    
    const discountAmount = (orderTotalNum * discountPercentNum) / 100;
    const whatYouPaid = orderTotalNum - discountAmount;
    
    return {
      discountAmount,
      whatYouPaid,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-50 mb-2">Percent of my Order</h2>
          <p className="text-slate-400 text-sm">
            Enter your order total and discount percentage to calculate what you paid.
          </p>
        </div>
        <button
          onClick={addBox}
          disabled={boxes.length >= 4}
          className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Box
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {boxes.map((box) => {
          const { discountAmount, whatYouPaid } = calculateValues(box);
          const hasValidInputs = box.orderTotal && parseFloat(box.orderTotal) > 0 && box.discountPercent && parseFloat(box.discountPercent) > 0;

          return (
            <form
              key={box.id}
              className="relative rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6"
            >
              {boxes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBox(box.id)}
                  className="absolute top-3 right-3 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label="Remove box"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              <div>
                <label htmlFor={`vendor-${box.id}`} className="block text-sm font-medium text-slate-300 mb-2 uppercase">
                  Vendor
                </label>
                <input
                  type="text"
                  id={`vendor-${box.id}`}
                  value={box.vendor}
                  onChange={(e) => handleVendorChange(box.id, e.target.value)}
                  placeholder="Enter vendor name"
                  className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-lg"
                />
              </div>
              <div>
                <label htmlFor={`orderTotal-${box.id}`} className="block text-sm font-medium text-slate-300 mb-2 uppercase">
                  Your Order Total
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
                  <input
                    type="text"
                    id={`orderTotal-${box.id}`}
                    value={box.orderTotal}
                    onChange={(e) => handleOrderTotalChange(box.id, e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-4 py-3 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={`discountPercent-${box.id}`} className="block text-sm font-medium text-slate-300 mb-2 uppercase">
                  Your Discount %
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id={`discountPercent-${box.id}`}
                    value={box.discountPercent}
                    onChange={(e) => handleDiscountPercentChange(box.id, e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-4 pr-8 py-3 rounded-lg border border-slate-700 bg-slate-900/70 text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 text-lg"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">%</span>
                </div>
              </div>

              {hasValidInputs && (
                <div className="border-t border-slate-700 pt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 uppercase">
                      What you paid
                    </label>
                    <p className="text-3xl font-bold text-emerald-400">
                      {formatDisplayValue(whatYouPaid.toString())}
                    </p>
                  </div>
                  <div className="border-t border-slate-700 pt-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2 uppercase">
                      Discount amount
                    </label>
                    <p className="text-2xl font-semibold text-emerald-300">
                      {formatDisplayValue(discountAmount.toString())}
                    </p>
                  </div>
                </div>
              )}
            </form>
          );
        })}
      </div>
    </div>
  );
}

