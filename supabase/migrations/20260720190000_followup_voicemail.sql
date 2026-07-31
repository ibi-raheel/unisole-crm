-- Add "Voicemail" as a follow-up type. Run alone. Safe to run once.
alter type follow_up_type add value if not exists 'Voicemail';
