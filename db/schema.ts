import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const aiConnections=sqliteTable('ai_connections',{
 userId:text('user_id').primaryKey(),
 encryptedKey:text('encrypted_key').notNull(),
 updatedAt:text('updated_at').notNull(),
});

export const siteUsers=sqliteTable('site_users',{userId:text('user_id').primaryKey(),name:text('name').notNull(),email:text('email').notNull(),firstSeen:text('first_seen').notNull(),lastSeen:text('last_seen').notNull(),aiRequests:integer('ai_requests').notNull().default(0),lastAiAt:text('last_ai_at')});
