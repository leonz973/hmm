/**
 * 本地演示数据：给「先在本地跑起来」准备一个能看能点的家。
 *
 * 用法（仓库根目录）：
 *   npm run seed:demo
 *
 * 会清掉同邮箱的旧演示账号再重建，不动其他账号。
 * 演示账号：demo@hmm.local / hmm12345
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

// PrismaClient 不会自己读 .env，这里手动灌进去
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const prisma = new PrismaClient();
const EMAIL = 'demo@hmm.local';
const PASSWORD = 'hmm12345';

const addMonths = (iso, months) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

async function main() {
  const old = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (old) {
    const hs = await prisma.household.findMany({ where: { ownerUserId: old.id }, select: { id: true } });
    const ids = hs.map((h) => h.id);
    if (ids.length) {
      await prisma.invoiceAsset.deleteMany({ where: { invoice: { householdId: { in: ids } } } });
      await prisma.invoice.deleteMany({ where: { householdId: { in: ids } } });
      await prisma.utilityBill.deleteMany({ where: { householdId: { in: ids } } });
      await prisma.fixedExpense.deleteMany({ where: { householdId: { in: ids } } });
      await prisma.reminder.deleteMany({ where: { householdId: { in: ids } } });
      await prisma.asset.deleteMany({ where: { householdId: { in: ids } } });
      await prisma.membership.deleteMany({ where: { householdId: { in: ids } } });
      await prisma.household.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: old.id } });
    await prisma.user.delete({ where: { id: old.id } });
  }

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
      displayName: '小磊',
      emailVerifiedAt: new Date(),
    },
  });

  const household = await prisma.household.create({
    data: {
      name: '小磊的家',
      ownerUserId: user.id,
      warrantyLeadDays: 90,
      replaceLeadDays: 120,
      notifyEmail: false, // 本地没配 SMTP，先关着，免得每天跑日志里一串 skipped
      memberships: { create: { userId: user.id, role: 'owner' } },
    },
  });
  const householdId = household.id;
  const createdBy = user.id;

  // 资产：故意留几条「快到点」的，打开首页就能看到提醒
  const assets = [
    { name: '海尔冰箱 BCD-501', categoryKey: 'appliance_large', categoryName: '大家电', locationName: '厨房', purchaseDate: '2019-05-18', priceFen: 429900, warrantyMonths: 36, expectedLifeMonths: 156, usageLevel: 'mid' },
    { name: '小米空调 KFR-35GW', categoryKey: 'appliance_large', categoryName: '大家电', locationName: '主卧', purchaseDate: '2021-06-02', priceFen: 269900, warrantyMonths: 72, expectedLifeMonths: 144, usageLevel: 'high' },
    { name: '小米电视 65 寸', categoryKey: 'appliance_large', categoryName: '大家电', locationName: '客厅', purchaseDate: '2024-12-01', priceFen: 399900, warrantyMonths: 24, expectedLifeMonths: 120, usageLevel: 'mid' },
    { name: '扫地机器人', categoryKey: 'appliance_small', categoryName: '小家电', locationName: '客厅', purchaseDate: '2022-12-01', priceFen: 219900, warrantyMonths: 12, expectedLifeMonths: 60, usageLevel: 'high' },
    { name: '西门子洗衣机', categoryKey: 'appliance_large', categoryName: '大家电', locationName: '阳台', purchaseDate: '2020-09-25', priceFen: 389900, warrantyMonths: 36, expectedLifeMonths: 120, usageLevel: 'mid' },
    { name: '实木餐桌', categoryKey: 'furniture', categoryName: '家具', locationName: '餐厅', purchaseDate: '2021-11-08', priceFen: 560000, warrantyMonths: 12, expectedLifeMonths: 180, usageLevel: 'low' },
    { name: '儿童书桌', categoryKey: 'furniture', categoryName: '家具', locationName: '次卧', purchaseDate: '2017-02-01', priceFen: 128000, warrantyMonths: 12, expectedLifeMonths: 120, usageLevel: 'mid' },
    { name: '净水器滤芯', categoryKey: 'consumable', categoryName: '耗材', locationName: '厨房', purchaseDate: '2026-09-01', priceFen: 18900, warrantyMonths: 3, expectedLifeMonths: 9, usageLevel: 'mid' },
  ];
  const created = [];
  for (const a of assets) {
    created.push(
      await prisma.asset.create({
        data: { ...a, householdId, createdBy, status: 'in_use', qty: 1 },
      }),
    );
  }

  await prisma.fixedExpense.createMany({
    data: [
      { householdId, name: '房租', amountFen: 450000, cycle: '每月', dueDate: '2026-12-01', category: '居住', autoPay: true },
      { householdId, name: '物业费', amountFen: 32000, cycle: '每月', dueDate: '2026-12-05', category: '居住' },
      { householdId, name: '宽带', amountFen: 12900, cycle: '每年', dueDate: '2027-03-01', category: '通讯' },
      { householdId, name: '手机套餐', amountFen: 9900, cycle: '每月', dueDate: '2026-12-08', category: '通讯' },
      { householdId, name: '视频会员', amountFen: 2500, cycle: '每月', dueDate: '2026-12-12', category: '娱乐', autoPay: true },
      { householdId, name: '车险', amountFen: 468000, cycle: '每年', dueDate: '2027-05-20', category: '交通' },
      { householdId, name: '重疾险', amountFen: 1280000, cycle: '每年', dueDate: '2027-08-15', category: '保险' },
    ],
  });

  const bills = [
    { type: '电费', period: '2026-09', amountFen: 23860, usage: '312 度', dueDate: '2026-10-10', paidDate: '2026-10-08' },
    { type: '水费', period: '2026-09', amountFen: 8640, usage: '18 吨', dueDate: '2026-10-10', paidDate: '2026-10-08' },
    { type: '燃气费', period: '2026-09', amountFen: 11200, usage: '14 方', dueDate: '2026-10-10', paidDate: '2026-10-08' },
    { type: '电费', period: '2026-10', amountFen: 26120, usage: '341 度', dueDate: '2026-11-10', paidDate: '2026-11-09' },
    { type: '水费', period: '2026-10', amountFen: 9120, usage: '19 吨', dueDate: '2026-11-10', paidDate: '2026-11-09' },
    { type: '燃气费', period: '2026-10', amountFen: 9800, usage: '12 方', dueDate: '2026-11-10', paidDate: '2026-11-09' },
    { type: '电费', period: '2026-11', amountFen: 27430, usage: '355 度', dueDate: '2026-12-10' },
    { type: '水费', period: '2026-11', amountFen: 8960, usage: '18.6 吨', dueDate: '2026-12-10' },
  ];
  for (const b of bills) await prisma.utilityBill.create({ data: { ...b, householdId, createdBy } });

  const invoices = [
    { title: '小米电视 65 寸', kind: '家电', amountFen: 399900, invoiceDate: '2024-12-01', merchant: '京东商城', invoiceNo: '24320000000012345678', assetIdx: [2] },
    { title: '西门子洗衣机', kind: '家电', amountFen: 389900, invoiceDate: '2020-09-25', merchant: '苏宁易购', invoiceNo: '03200000000098765432', assetIdx: [4] },
    { title: '净水器滤芯（年度）', kind: '生活服务', amountFen: 18900, invoiceDate: '2026-09-01', merchant: '沁园官方旗舰店', assetIdx: [7] },
  ];
  for (const inv of invoices) {
    const { assetIdx, ...rest } = inv;
    const row = await prisma.invoice.create({ data: { ...rest, householdId, createdBy, files: '[]' } });
    for (const i of assetIdx) {
      await prisma.invoiceAsset.create({ data: { invoiceId: row.id, assetId: created[i].id, householdId } });
    }
  }

  const counts = {
    账号: `${EMAIL} / ${PASSWORD}`,
    资产: created.length,
    固定支出: await prisma.fixedExpense.count({ where: { householdId } }),
    账单: await prisma.utilityBill.count({ where: { householdId } }),
    发票: await prisma.invoice.count({ where: { householdId } }),
  };
  console.log('演示数据已就绪：', counts);
  console.log('示例：小米电视质保到', addMonths('2024-12-01', 24), '；扫地机器人预计换新', addMonths('2022-12-01', 48));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
