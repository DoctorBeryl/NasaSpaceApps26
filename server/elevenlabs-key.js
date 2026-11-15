/* Shared ElevenLabs keys for ASTRA's voice (/api/tts) and speech-to-text (/api/stt).
   Committed on purpose: the team chose to make these keys public so every clone gets
   the voice with no setup (see CLAUDE.md "Public repo rules"). ELEVENLABS_API_KEY in
   .env (one key, or several separated by commas) is tried first.
   server.js uses them in order and moves to the next key when one runs out of credits
   or is rejected (401, 402, 429). No other secret belongs in this file. */
module.exports = [
  "sk_6c64abaafb07ebf4dc4fd38c158b7dec6de427ecfe3c4886",
  "sk_1260d2036410b073968b94223594c838f54783be0f8a7e02",
  "sk_0858b66e01d00ac8ea185a4c66413c1246a130669185d8a5",
];
