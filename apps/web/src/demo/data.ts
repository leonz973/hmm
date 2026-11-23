// M1 阶段的演示数据：结构与后续 API 返回一致，接入后端时直接替换数据源即可。
import { calcReplacementDate, calcWarrantyEndDate } from '@hmm/shared';

export interface DemoAsset {
  id: string;
  name: string;
  category: string;
  location: string;
  purchaseDate: string;
  priceFen: number;
  lifeMonths: number;
  warrantyMonths: number;
  usageLevel: 'low' | 'mid' | 'high';
  estPriceFen: number;
  icon: string;
}

const raw: Array<Omit<DemoAsset, 'estPriceFen' | 'icon'> & { icon: string }> = [
  {
    id: 'a1',
    name: '海尔冰箱 BCD-501',
    category: '冰箱',
    location: '厨房',
    purchaseDate: '2019-05-18',
    priceFen: 429900,
    lifeMonths: 156,
    warrantyMonths: 36,
    usageLevel: 'mid',
    icon: 'Refrigerator',
  },
  {
    id: 'a2',
    name: '小米空调 1.5匹',
    category: '空调',
    location: '主卧',
    purchaseDate: '2021-06-02',
    priceFen: 269900,
    lifeMonths: 144,
    warrantyMonths: 72,
    usageLevel: 'high',
    icon: 'Airplay',
  },
  {
    id: 'a3',
    name: '林内燃气热水器',
    category: '燃气热水器',
    location: '卫生间',
    purchaseDate: '2018-03-11',
    priceFen: 318000,
    lifeMonths: 96,
    warrantyMonths: 12,
    usageLevel: 'mid',
    icon: 'Fire',
  },
  {
    id: 'a4',
    name: '西门子洗衣机',
    category: '洗衣机',
    location: '阳台',
    purchaseDate: '2020-09-25',
    priceFen: 389900,
    lifeMonths: 120,
    warrantyMonths: 36,
    usageLevel: 'mid',
    icon: 'WashingMachine',
  },
  {
    id: 'a5',
    name: '实木餐桌',
    category: '餐桌',
    location: '餐厅',
    purchaseDate: '2021-11-08',
    priceFen: 560000,
    lifeMonths: 180,
    warrantyMonths: 12,
    usageLevel: 'mid',
    icon: 'ForkKnife',
  },
  {
    id: 'a6',
    name: '净水滤芯（RO）',
    category: '净水滤芯',
    location: '厨房',
    purchaseDate: '2026-09-01',
    priceFen: 18900,
    lifeMonths: 9,
    warrantyMonths: 0,
    usageLevel: 'mid',
    icon: 'FunnelSimple',
  },
];

export const demoAssets: DemoAsset[] = raw.map((a) => ({
  ...a,
  estPriceFen: Math.round((a.priceFen * 1.08) / 100) * 100,
}));

export interface DemoReminder {
  id: string;
  type: 'warranty_expire' | 'replacement' | 'fixed_due';
  title: string;
  subtitle: string;
  date: string;
  amountFen?: number;
  severity: 'info' | 'warn' | 'urgent';
  icon: string;
}

const today = new Date('2026-11-23T00:00:00');

function daysBetween(a: Date, b: string): number {
  const target = new Date(b + 'T00:00:00');
  return Math.round((target.getTime() - a.getTime()) / 86400000);
}

/** 由资产推算提醒：质保到期（30 天窗口）+ 预计更换（90 天窗口） */
export function buildReminders(assets: DemoAsset[]): DemoReminder[] {
  const out: DemoReminder[] = [];
  for (const a of assets) {
    const warrantyEnd = calcWarrantyEndDate(a.purchaseDate, a.warrantyMonths);
    const replaceAt = calcReplacementDate(a.purchaseDate, a.lifeMonths, a.usageLevel);
    const qWarranty = daysBetween(today, warrantyEnd);
    const qReplace = daysBetween(today, replaceAt);

    if (a.warrantyMonths > 0 && qWarranty >= 0 && qWarranty <= 120) {
      out.push({
        id: `${a.id}-w`,
        type: 'warranty_expire',
        title: `${a.name} 质保到期`,
        subtitle: qWarranty === 0 ? '今天到期' : `还有 ${qWarranty} 天`,
        date: warrantyEnd,
        severity: qWarranty <= 30 ? 'warn' : 'info',
        icon: 'ShieldCheck',
      });
    }
    if (qReplace >= -30 && qReplace <= 365) {
      out.push({
        id: `${a.id}-r`,
        type: 'replacement',
        title: `${a.name} 预计更换`,
        subtitle: qReplace < 0 ? `已超期 ${-qReplace} 天` : `还有 ${qReplace} 天`,
        date: replaceAt,
        amountFen: a.estPriceFen,
        severity: qReplace < 0 ? 'urgent' : qReplace <= 90 ? 'warn' : 'info',
        icon: 'ArrowsClockwise',
      });
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

export interface DemoFixedExpense {
  id: string;
  name: string;
  amountFen: number;
  dueDate: string;
  cycle: string;
  autoPay: boolean;
  icon: string;
}

export const demoFixedExpenses: DemoFixedExpense[] = [
  { id: 'f1', name: '房租', amountFen: 450000, dueDate: '2026-12-01', cycle: '每月', autoPay: true, icon: 'House' },
  { id: 'f2', name: '物业费', amountFen: 32000, dueDate: '2026-12-05', cycle: '每月', autoPay: false, icon: 'Buildings' },
  { id: 'f3', name: '宽带', amountFen: 12900, dueDate: '2026-12-10', cycle: '每月', autoPay: true, icon: 'WifiHigh' },
  { id: 'f4', name: '车险', amountFen: 468000, dueDate: '2027-03-20', cycle: '每年', autoPay: false, icon: 'Car' },
  { id: 'f5', name: '视频会员', amountFen: 2500, dueDate: '2026-12-18', cycle: '每月', autoPay: true, icon: 'Television' },
];
