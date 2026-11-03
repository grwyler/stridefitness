const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve('chatgpt-plugin-release');
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
const mcp = JSON.parse(fs.readFileSync(path.join(root, 'mcp.json'), 'utf8'));
const listing = plugin.extensions['com.openai'].interface;
const server = mcp.mcpServers['stride-fitness'];
const review = plugin.extensions['com.openai'].review.test_cases;

assert.equal(plugin.name, 'stride-fitness-tracker');
assert.equal(listing.displayName, 'Stride Fitness Tracker');
assert(listing.displayName.length <= 30);
assert(listing.shortDescription.length <= 30);
assert(listing.longDescription.length <= 4000);
assert.equal(listing.websiteURL, 'https://stridefitness.app');
for (const prompt of listing.defaultPrompt) assert(prompt.length <= 128);
assert.equal(review.positive.length, 5);
assert.equal(review.negative.length, 3);
assert.equal(server.url, 'https://stridefitness.app/api/mcp');
assert.equal(server.type, 'streamable-http');
assert.equal(server.extensions['com.openai'].auth.type, 'oauth');
assert.equal(server.extensions['com.openai'].auth.client.mode, 'dcr');
assert(!Object.hasOwn(server, 'headers'), 'the public manifest contains no fixed credential headers');
assert(fs.existsSync(path.join(root, 'assets', 'stride-512.png')));
assert(plugin.extensions['com.openai'].onboardingSkill === './skills/get-started/SKILL.md');
assert(fs.existsSync(path.join(root, 'skills', 'get-started', 'SKILL.md')));
assert.match(listing.longDescription, /cannot currently log completed workouts, food entries, or activity entries/i, 'listing must disclose unavailable log writes');
assert.match(listing.longDescription, /Workout plan archiving is also unavailable/i);
assert.equal(listing.supportURL, 'https://stridefitness.app/support.html');
assert.equal(listing.privacyPolicyURL, 'https://stridefitness.app/privacy.html');
assert.equal(listing.termsOfServiceURL, 'https://stridefitness.app/terms.html');
for (const page of ['support.html', 'privacy.html', 'terms.html']) assert(fs.existsSync(path.resolve('public', page)), `${page} is included in the website source`);
assert.equal(plugin.author.email, 'support@stridefitness.app');

console.log('PASS: draft plugin metadata limits, DCR OAuth MCP endpoint, icon, review case counts, and capability claims.');
