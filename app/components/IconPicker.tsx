'use client';

import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search } from 'lucide-react';

// Popular icons for household tools - you can expand this list
const POPULAR_ICONS = [
  'Home', 'Wrench', 'Hammer', 'Tool', 'Settings', 'Calendar', 'CheckSquare',
  'FileText', 'Folder', 'Clipboard', 'List', 'Bell', 'Clock', 'MapPin',
  'Droplet', 'Flame', 'Zap', 'Shield', 'Lock', 'Key', 'Car', 'Bike',
  'TreePine', 'Leaf', 'Sun', 'Moon', 'Star', 'Heart', 'ShoppingCart',
  'CreditCard', 'DollarSign', 'TrendingUp', 'BarChart', 'PieChart',
  'Users', 'User', 'Mail', 'Phone', 'MessageSquare', 'Camera', 'Image',
  'Video', 'Music', 'Book', 'BookOpen', 'GraduationCap', 'Briefcase',
  'Package', 'Box', 'Archive', 'Database', 'Server', 'Cloud', 'Wifi',
  'Monitor', 'Laptop', 'Smartphone', 'Tablet', 'Headphones', 'Speaker',
  'Gamepad2', 'Tv', 'Radio', 'Thermometer', 'Wind', 'Umbrella', 'CloudRain',
  'Snowflake', 'Sunrise', 'Sunset', 'Compass', 'Navigation', 'Map',
  'Route', 'Flag', 'Target', 'Award', 'Trophy', 'Medal', 'Gift', 'PartyPopper',
  'Cake', 'Coffee', 'Utensils', 'Apple', 'Beer', 'Wine', 'ChefHat',
  'Bed', 'Bath', 'Sofa', 'Armchair', 'Lamp', 'Lightbulb', 'Couch',
  'DoorOpen', 'Window', 'Fence', 'FenceIcon', 'Tree', 'Flower', 'Bug',
  'Dog', 'Cat', 'Fish', 'Bird', 'Rabbit', 'PawPrint', 'Bone',
  'Baby', 'BabyCarriage', 'Stroller', 'Gamepad', 'Puzzle', 'Blocks',
  'Palette', 'Paintbrush', 'Brush', 'Scissors', 'Ruler', 'Pen', 'Pencil',
  'Highlighter', 'Eraser', 'Notebook', 'StickyNote', 'Bookmark', 'Tag',
  'Label', 'Hash', 'AtSign', 'Percent', 'Plus', 'Minus', 'X', 'Check',
  'AlertCircle', 'AlertTriangle', 'Info', 'HelpCircle', 'QuestionMark',
  'XCircle', 'CheckCircle', 'AlertOctagon', 'Ban', 'ShieldAlert', 'ShieldCheck',
];

type IconPickerProps = {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
};

export function IconPicker({ value, onChange, label = 'Select Icon' }: IconPickerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Filter icons based on search
  const filteredIcons = POPULAR_ICONS.filter(iconName =>
    iconName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get the icon component for preview
  const SelectedIcon = value ? (LucideIcons[value as keyof typeof LucideIcons] as typeof LucideIcons.Home) : null;

  return (
    <div className="relative z-30">
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}
      </label>
      
      {/* Selected Icon Display / Picker Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          {SelectedIcon ? (
            <>
              <SelectedIcon className="h-5 w-5 text-slate-300" />
              <span className="text-slate-300">{value}</span>
            </>
          ) : (
            <span className="text-slate-500">Click to select an icon</span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-4xl rounded-lg border border-slate-700 bg-slate-900 shadow-xl h-[600px] overflow-hidden flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search icons..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  autoFocus
                />
              </div>
            </div>

            {/* Icon Grid */}
            <div className="overflow-y-auto flex-1 p-4">
              {filteredIcons.length > 0 ? (
                <div className="grid grid-cols-8 gap-3">
                  {filteredIcons.map((iconName) => {
                    const IconComponent = LucideIcons[iconName as keyof typeof LucideIcons] as typeof LucideIcons.Home;
                    const isSelected = value === iconName;
                    
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => {
                          onChange(iconName);
                          setIsOpen(false);
                          setSearchTerm('');
                        }}
                        className={`p-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                        title={iconName}
                      >
                        {IconComponent && <IconComponent className="h-6 w-6 mx-auto" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No icons found matching "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

