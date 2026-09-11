import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const aiConnections=sqliteTable('ai_connections',{
 userId:text('user_id').primaryKey(),
 encryptedKey:text('encrypted_key').notNull(),
 updatedAt:text('updated_at').notNull(),
});
