import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const aiConnections=sqliteTable('ai_connections',{
 userId:text('user_id').primaryKey(),
 encryptedKey:text('encrypted_key').notNull(),
 updatedAt:text('updated_at').notNull(),
});

export const siteUsers=sqliteTable('site_users',{userId:text('user_id').primaryKey(),name:text('name').notNull(),email:text('email').notNull(),firstSeen:text('first_seen').notNull(),lastSeen:text('last_seen').notNull(),aiRequests:integer('ai_requests').notNull().default(0),lastAiAt:text('last_ai_at')});

export const accountResets=sqliteTable('account_resets',{
 userId:text('user_id').primaryKey(),
 resetAt:text('reset_at').notNull(),
});

export const aiAccessBlocks=sqliteTable('ai_access_blocks',{
 userId:text('user_id').primaryKey(),
 revokedAt:text('revoked_at').notNull(),
});

export const feedback=sqliteTable('feedback',{id:text('id').primaryKey(),userId:text('user_id').notNull(),name:text('name').notNull(),email:text('email').notNull(),message:text('message').notNull(),area:text('area').notNull(),createdAt:text('created_at').notNull(),screenshotCount:integer('screenshot_count').notNull().default(0),status:text('status').notNull().default('open'),notifiedAt:text('notified_at'),respondedAt:text('responded_at'),followups:text('followups').notNull().default('[]')});

export const aiSignupPolicy=sqliteTable('ai_signup_policy',{
 id:text('id').primaryKey(),
 included:integer('included').notNull().default(1),
});
export const aiAccountFunding=sqliteTable('ai_account_funding',{
 userId:text('user_id').primaryKey(),
 included:integer('included').notNull().default(1),
});
export const billingAccounts=sqliteTable('billing_accounts',{userId:text('user_id').primaryKey(),stripeCustomerId:text('stripe_customer_id'),balanceMicros:integer('balance_micros').notNull().default(0),updatedAt:text('updated_at').notNull()});
export const billingTopups=sqliteTable('billing_topups',{checkoutSessionId:text('checkout_session_id').primaryKey(),userId:text('user_id').notNull(),amountMicros:integer('amount_micros').notNull(),appliedAt:text('applied_at').notNull()});
export const aiUsageCharges=sqliteTable('ai_usage_charges',{id:text('id').primaryKey(),userId:text('user_id').notNull(),model:text('model').notNull(),inputTokens:integer('input_tokens').notNull(),cachedInputTokens:integer('cached_input_tokens').notNull(),outputTokens:integer('output_tokens').notNull(),costMicros:integer('cost_micros').notNull(),createdAt:text('created_at').notNull()});
