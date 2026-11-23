// 品类默认参考表（PRD FR-3.1）：可编辑的内置种子数据
// lifeMonths = 平均使用寿命（月）；warrantyMonths = 常见质保（月）
// 来源：国家推荐报废年限 + 行业惯例，仅供默认值，用户可改。

export interface BuiltinCategory {
  key: string;
  name: string;
  icon: string; // Phosphor 图标名
  parent?: string;
  lifeMonths?: number;
  warrantyMonths?: number;
  /** 品类年均价格上涨参考（%），用于账单预估（PRD FR-4.2） */
  inflationRate?: number;
}

export const BUILTIN_CATEGORIES: BuiltinCategory[] = [
  // ── 大家电 ──
  { key: 'major', name: '大家电', icon: 'HouseLine', parent: undefined },
  { key: 'fridge', name: '冰箱', icon: 'Refrigerator', parent: 'major', lifeMonths: 156, warrantyMonths: 36, inflationRate: 3 },
  { key: 'washer', name: '洗衣机', icon: 'WashingMachine', parent: 'major', lifeMonths: 120, warrantyMonths: 36, inflationRate: 3 },
  { key: 'ac', name: '空调', icon: 'Airplay', parent: 'major', lifeMonths: 144, warrantyMonths: 72, inflationRate: 3 },
  { key: 'tv', name: '电视', icon: 'TelevisionSimple', parent: 'major', lifeMonths: 120, warrantyMonths: 12, inflationRate: -2 },
  { key: 'water_heater', name: '电热水器', icon: 'ThermometerHot', parent: 'major', lifeMonths: 96, warrantyMonths: 12, inflationRate: 3 },
  { key: 'gas_heater', name: '燃气热水器', icon: 'Fire', parent: 'major', lifeMonths: 96, warrantyMonths: 12, inflationRate: 3 },
  { key: 'range_hood', name: '油烟机', icon: 'Wind', parent: 'major', lifeMonths: 120, warrantyMonths: 12, inflationRate: 3 },
  { key: 'dishwasher', name: '洗碗机', icon: 'SoapDispenserDroplet', parent: 'major', lifeMonths: 120, warrantyMonths: 36, inflationRate: 3 },
  { key: 'microwave', name: '微波炉', icon: 'WaveSine', parent: 'major', lifeMonths: 120, warrantyMonths: 12, inflationRate: 2 },

  // ── 小家电 ──
  { key: 'small', name: '小家电', icon: 'Plug', parent: undefined },
  { key: 'rice_cooker', name: '电饭煲', icon: 'CookingPot', parent: 'small', lifeMonths: 72, warrantyMonths: 12, inflationRate: 2 },
  { key: 'kettle', name: '电水壶', icon: 'Coffee', parent: 'small', lifeMonths: 48, warrantyMonths: 12, inflationRate: 2 },
  { key: 'purifier', name: '净水器', icon: 'Drop', parent: 'small', lifeMonths: 60, warrantyMonths: 12, inflationRate: 3 },
  { key: 'purifier_filter', name: '净水滤芯', icon: 'FunnelSimple', parent: 'small', lifeMonths: 9, warrantyMonths: 0, inflationRate: 3 },
  { key: 'vacuum', name: '吸尘器', icon: 'Broadcast', parent: 'small', lifeMonths: 72, warrantyMonths: 24, inflationRate: 2 },
  { key: 'fan', name: '电风扇', icon: 'Fan', parent: 'small', lifeMonths: 96, warrantyMonths: 12, inflationRate: 2 },
  { key: 'humidifier', name: '加湿器', icon: 'CloudRain', parent: 'small', lifeMonths: 60, warrantyMonths: 12, inflationRate: 2 },
  { key: 'air_purifier', name: '空气净化器', icon: 'Sparkle', parent: 'small', lifeMonths: 72, warrantyMonths: 12, inflationRate: 2 },

  // ── 家具 ──
  { key: 'furniture', name: '家具', icon: 'Armchair', parent: undefined },
  { key: 'bed', name: '床', icon: 'Bed', parent: 'furniture', lifeMonths: 180, warrantyMonths: 12, inflationRate: 4 },
  { key: 'mattress', name: '床垫', icon: 'Bed', parent: 'furniture', lifeMonths: 108, warrantyMonths: 120, inflationRate: 4 },
  { key: 'sofa', name: '沙发', icon: 'Couch', parent: 'furniture', lifeMonths: 108, warrantyMonths: 12, inflationRate: 4 },
  { key: 'wardrobe', name: '衣柜', icon: 'Database', parent: 'furniture', lifeMonths: 180, warrantyMonths: 12, inflationRate: 4 },
  { key: 'dining_table', name: '餐桌', icon: 'ForkKnife', parent: 'furniture', lifeMonths: 180, warrantyMonths: 12, inflationRate: 4 },
  { key: 'desk_chair', name: '书桌椅', icon: 'Desk', parent: 'furniture', lifeMonths: 120, warrantyMonths: 12, inflationRate: 3 },

  // ── 厨卫 ──
  { key: 'kitchen_bath', name: '厨卫', icon: 'Bathtub', parent: undefined },
  { key: 'gas_stove', name: '燃气灶', icon: 'Flame', parent: 'kitchen_bath', lifeMonths: 96, warrantyMonths: 12, inflationRate: 3 },
  { key: 'toilet', name: '马桶', icon: 'Toilet', parent: 'kitchen_bath', lifeMonths: 120, warrantyMonths: 36, inflationRate: 3 },
  { key: 'shower', name: '花洒', icon: 'Shower', parent: 'kitchen_bath', lifeMonths: 60, warrantyMonths: 12, inflationRate: 3 },

  // ── 耗材 ──
  { key: 'consumable', name: '耗材', icon: 'Package', parent: undefined },
  { key: 'toothbrush_head', name: '牙刷头', icon: 'Tooth', parent: 'consumable', lifeMonths: 3, warrantyMonths: 0, inflationRate: 2 },
  { key: 'water_filter', name: '滤水壶滤芯', icon: 'Funnel', parent: 'consumable', lifeMonths: 2, warrantyMonths: 0, inflationRate: 3 },
  { key: 'ac_filter', name: '空调滤网', icon: 'WindLogo', parent: 'consumable', lifeMonths: 6, warrantyMonths: 0, inflationRate: 2 },
  { key: 'range_hood_filter', name: '油烟机滤油网', icon: 'GridLayout', parent: 'consumable', lifeMonths: 12, warrantyMonths: 0, inflationRate: 2 },
  { key: 'battery', name: '电池', icon: 'BatteryCharging', parent: 'consumable', lifeMonths: 12, warrantyMonths: 0, inflationRate: 2 },
  { key: 'bulb', name: '灯泡/灯管', icon: 'LightbulbFilament', parent: 'consumable', lifeMonths: 36, warrantyMonths: 12, inflationRate: 2 },

  // ── 工具与其他 ──
  { key: 'tool', name: '工具', icon: 'Wrench', parent: undefined },
  { key: 'other', name: '其他', icon: 'SquaresFour', parent: undefined },
];
