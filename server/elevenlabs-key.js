/* Shared ElevenLabs key for VEGA's voice (/api/tts) and speech-to-text (/api/stt).
   Committed on purpose: the team chose to make this one key public so every clone gets
   the voice with no setup (see CLAUDE.md "Public repo rules"). ELEVENLABS_API_KEY in
   .env overrides it. No other secret belongs in this file. */
module.exports = "sk_6c64abaafb07ebf4dc4fd38c158b7dec6de427ecfe3c4886";
