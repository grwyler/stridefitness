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
