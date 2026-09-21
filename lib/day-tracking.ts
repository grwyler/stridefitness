export const trackingItems=['nutrition','hydration','activity','weight','bodyFat','measurements'] as const;
export type TrackingItem=typeof trackingItems[number];
export type DayTracking=Partial<Record<TrackingItem,boolean>>;

// Older accounts did not have a tracking plan. Keep their existing nutrition
// completion workflow useful without treating any other record as required.
export function tracked(plan:DayTracking|undefined,item:TrackingItem){
 return plan===undefined?item==='nutrition':plan[item]===true;
}

export function trackedItems(plan:DayTracking|undefined){
 return trackingItems.filter(item=>tracked(plan,item));
}
