// ask.js: rules questions to Claude, straight from this phone to Anthropic's API with the owner's own key.
// Loaded only when the chat is used. The key is kept in this browser's storage on this device (Settings);
// it is sent to api.anthropic.com and nowhere else. The SDK is bundled in vendor/ (no third-party script
// is loaded at run time): @anthropic-ai/sdk 0.131.0, MIT (vendor/LICENSE-anthropic-sdk.txt).
import { Anthropic } from './vendor/anthropic-sdk-0.131.0.mjs';

const client = key => new Anthropic({ apiKey:key, dangerouslyAllowBrowser:true, maxRetries:2 });
// models with a server-side fallback when a safety classifier declines (Haiku has none)
const FALLBACK = new Set(['claude-opus-5-5', 'claude-sonnet-5-5']);

// one answer, streamed: onText(snapshot) as the text grows; returns the final message (append its content
// to the history unchanged, thinking blocks included) and why it stopped
export async function ask({ key, model, system, messages, onText, signal }){
  const params = {
    model, max_tokens:16000,
    output_config:{ effort:'medium' },
    // the rules and the lists are the same for every question of a game: cached for an hour
    cache_control:{ type:'ephemeral', ttl:'1h' },
    system, messages
  };
  if(FALLBACK.has(model)) Object.assign(params, { betas:['server-side-fallback-2026-07-01'], fallbacks:'default' });
  const stream = client(key).beta.messages.stream(params, { signal });
  stream.on('text', (delta, snapshot) => onText && onText(snapshot));
  const message = await stream.finalMessage();
  return { message, refused:message.stop_reason === 'refusal', cut:message.stop_reason === 'max_tokens' };
}

// a cheap check that the key works (lists one model)
export async function checkKey({ key }){
  const page = await client(key).models.list({ limit:1 });
  return !!page;
}
