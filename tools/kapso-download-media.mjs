#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { TokenStore } from '/opt/data/home/.npm/_npx/62018dc35ec75f2a/node_modules/@kapso/cli/dist/services/token-store.js';
import { WhatsAppClient } from '/opt/data/home/.npm/_npx/62018dc35ec75f2a/node_modules/@kapso/whatsapp-cloud-api/dist/index.js';

const mediaId = process.argv[2];
const out = process.argv[3] || `/tmp/kapso-media-${mediaId}.bin`;
const phoneNumberId = process.argv[4] || process.env.KAPSO_PHONE_NUMBER_ID || '1329393980246912';
const projectId = process.env.KAPSO_PROJECT_ID || '9f8fd50b-be24-4307-ad59-0fc5746a5e8a';
if (!mediaId) throw new Error('usage: kapso-download-media.mjs <mediaId> <out> [phoneNumberId]');
const apiKey = process.env.KAPSO_API_KEY || await new TokenStore().getProjectApiKey(projectId);
if (!apiKey) throw new Error('No Kapso API key found; run kapso login/status first');
const client = new WhatsAppClient({ baseUrl: process.env.KAPSO_PROXY_BASE_URL || 'https://api.kapso.ai/meta/whatsapp', kapsoApiKey: apiKey });
const buf = Buffer.from(await client.media.download({ mediaId, phoneNumberId }));
writeFileSync(out, buf);
console.log(JSON.stringify({ ok: true, path: out, bytes: buf.length }));
