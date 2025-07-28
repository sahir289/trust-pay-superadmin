import { getMerchantByUserIdDao } from '../apis/merchants/merchantDao.js';
import { getUserHierarchysDao } from '../apis/userHierarchy/userHierarchyDao.js';

export async function enhanceMerchantsWithSubMerchants(data) {
  const subMerchantUserIds = new Set();
  for (const merchant of data) {
    const userHierarchys = await getUserHierarchysDao({
      user_id: merchant.user_id,
    });
    const userHierarchy = userHierarchys[0];
    if (userHierarchy?.config?.siblings?.sub_merchants) {
      const subMerchants = userHierarchy.config.siblings.sub_merchants;
      subMerchants.forEach((id) => subMerchantUserIds.add(id));
    }
  }
  const result = [];
  for (const merchant of data) {
    if (subMerchantUserIds.has(merchant.user_id)) {
      continue;
    }
    const userHierarchys = await getUserHierarchysDao({
      user_id: merchant.user_id,
    });
    const userHierarchy = userHierarchys[0];
    if (!userHierarchy?.config?.siblings?.sub_merchants) {
      merchant.subMerchants = [];
      result.push(merchant);
      continue;
    }
    const subMerchantIds = userHierarchy.config.siblings.sub_merchants;
    const heirs = [];
    for (const id of subMerchantIds) {
      const siblings = await getMerchantByUserIdDao(id);
      let heir = siblings[0];
      heirs.push(heir);
    }
    merchant.subMerchants = heirs;
    result.push(merchant);
  }
  return result;
}
