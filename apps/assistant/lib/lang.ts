/**
 * Lightweight, dependency-free i18n used by both the server (keyless fallback)
 * and the browser widget (voice language). Full content localization in
 * conversation is handled by Claude (see prompt.ts "Language" rule); this module
 * gives the keyless fallback localized framing and drives STT/TTS language.
 *
 * Supported framing languages: en, es, fr, de, pt, hi. Detection also recognizes
 * a few script-based languages (zh, ar, ru, ja) so voice can match even when we
 * don't have localized phrases (text then stays in the source language).
 */

export type Lang = string;

const BCP47: Record<string, string> = {
  en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE", pt: "pt-BR",
  hi: "hi-IN", it: "it-IT", zh: "zh-CN", ar: "ar-SA", ru: "ru-RU", ja: "ja-JP",
};

export const toBCP47 = (lang: Lang): string => BCP47[lang] ?? "en-US";

/** Best-effort language detection from a short message. Defaults to English. */
export function detectLanguage(text: string): Lang {
  const raw = text ?? "";
  if (!raw.trim()) return "en";
  if (/[ऀ-ॿ]/.test(raw)) return "hi";
  if (/[一-鿿]/.test(raw)) return "zh";
  if (/[؀-ۿ]/.test(raw)) return "ar";
  if (/[Ѐ-ӿ]/.test(raw)) return "ru";
  if (/[぀-ヿ]/.test(raw)) return "ja";

  const t = raw.toLowerCase();
  const has = (words: string[]) =>
    words.some((w) => new RegExp(`(^|\\W)${w}(\\W|$)`).test(t));
  const score: Record<string, number> = { es: 0, fr: 0, de: 0, pt: 0, it: 0 };

  if (/[ñ¿¡]/.test(raw)) score.es += 2;
  if (/[œàâêîôûëï]/.test(raw)) score.fr += 1;
  if (/[äöüß]/.test(raw)) score.de += 2;
  if (/[ãõ]/.test(raw)) score.pt += 2;

  if (has(["hola", "gracias", "donde", "dónde", "cita", "quiero", "cuanto", "cuánto", "horario", "reservar", "perro", "gato", "estan", "están", "ubicados"])) score.es += 2;
  if (has(["bonjour", "merci", "ou", "où", "rendez-vous", "voudrais", "chien", "chat", "heures", "réserver", "adresse"])) score.fr += 2;
  if (has(["hallo", "danke", "wo", "termin", "ich", "möchte", "hund", "katze", "öffnungszeiten", "buchen", "wann"])) score.de += 2;
  if (has(["ola", "olá", "obrigado", "obrigada", "onde", "quero", "cao", "cão", "gato", "marcar", "horario", "horário"])) score.pt += 2;
  if (has(["ciao", "grazie", "dove", "vorrei", "cane", "gatto", "prenotare", "orari"])) score.it += 2;

  const [best, value] = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  return value >= 2 ? best : "en";
}

const fill = (s: string, v: Record<string, string | undefined>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

type Phrase =
  | "greetingNew" | "greetingReturning" | "petQ" | "slotsLead" | "noOpenings"
  | "askWhichService" | "catchAll" | "upcoming" | "askPhone" | "noAdvice" | "booked";

const DICT: Record<Lang, Record<Phrase, string>> = {
  en: {
    greetingNew: "Hi there — I'm {assistant} at {business}. How can I help you and your pet today?",
    greetingReturning: "Welcome back, {first}! {petQ}What can I help you with today?",
    petQ: "How's {pet}? ",
    slotsLead: "Lovely — here are the next open times for a {service}. Which one suits you best?",
    noOpenings: "I'm so sorry — I don't see any openings for {service} just now. Would you like me to take a message for the team?",
    askWhichService: "Of course — I'd be glad to help you book. Which of these would you like?",
    catchAll: "I can share our hours, location, services and pricing, or book a visit. What would help most?",
    upcoming: "You're booked for a {service} on {when}, {first}. Shall I help with anything else?",
    askPhone: "I can check that for you — what's the phone number on the booking?",
    noAdvice: "Oh no, I'm so sorry — that's worrying. I can't give medical advice, but please call our emergency line right away at {emergency}, or I can help you book the very next available visit.",
    booked: "Wonderful — you're all set, {first}. I've booked {service} for {when} with {withName}. We'll send a confirmation email shortly.",
  },
  es: {
    greetingNew: "¡Hola! Soy {assistant} de {business}. ¿Cómo puedo ayudarte a ti y a tu mascota hoy?",
    greetingReturning: "¡Bienvenida de nuevo, {first}! {petQ}¿En qué puedo ayudarte hoy?",
    petQ: "¿Cómo está {pet}? ",
    slotsLead: "Perfecto — estos son los próximos horarios disponibles para {service}. ¿Cuál te viene mejor?",
    noOpenings: "Lo siento mucho — no veo horarios para {service} por ahora. ¿Quieres que tome un mensaje para el equipo?",
    askWhichService: "Claro — con gusto te ayudo a reservar. ¿Cuál de estos te gustaría?",
    catchAll: "Puedo darte nuestros horarios, ubicación, servicios y precios, o reservar una cita. ¿Qué te ayudaría más?",
    upcoming: "Tienes una cita de {service} el {when}, {first}. ¿Te ayudo con algo más?",
    askPhone: "Con gusto lo verifico — ¿cuál es el número de teléfono de la reserva?",
    noAdvice: "Ay, lo siento mucho — eso es preocupante. No puedo dar consejos médicos, pero por favor llama de inmediato a nuestra línea de emergencia al {emergency}, o puedo ayudarte a reservar la próxima cita disponible.",
    booked: "¡Perfecto, {first}, todo listo! He reservado {service} para el {when} con {withName}. Te enviaremos un correo de confirmación en breve.",
  },
  fr: {
    greetingNew: "Bonjour ! Je suis {assistant} de {business}. Comment puis-je vous aider, vous et votre animal, aujourd'hui ?",
    greetingReturning: "Ravie de vous revoir, {first} ! {petQ}Comment puis-je vous aider aujourd'hui ?",
    petQ: "Comment va {pet} ? ",
    slotsLead: "Parfait — voici les prochains créneaux disponibles pour {service}. Lequel vous convient le mieux ?",
    noOpenings: "Je suis vraiment désolée — je ne vois aucun créneau pour {service} pour le moment. Voulez-vous que je transmette un message à l'équipe ?",
    askWhichService: "Bien sûr — je serais ravie de vous aider à réserver. Lequel souhaitez-vous ?",
    catchAll: "Je peux vous donner nos horaires, notre adresse, nos services et tarifs, ou réserver un rendez-vous. Que puis-je faire pour vous ?",
    upcoming: "Vous avez un rendez-vous {service} le {when}, {first}. Puis-je vous aider pour autre chose ?",
    askPhone: "Je peux vérifier cela — quel est le numéro de téléphone de la réservation ?",
    noAdvice: "Oh non, je suis vraiment désolée — c'est inquiétant. Je ne peux pas donner de conseils médicaux, mais appelez immédiatement notre ligne d'urgence au {emergency}, ou je peux vous aider à réserver le prochain rendez-vous disponible.",
    booked: "Parfait, {first}, c'est réservé ! J'ai noté {service} le {when} avec {withName}. Vous recevrez un e-mail de confirmation très bientôt.",
  },
  de: {
    greetingNew: "Hallo! Ich bin {assistant} von {business}. Wie kann ich Ihnen und Ihrem Tier heute helfen?",
    greetingReturning: "Schön, Sie wiederzusehen, {first}! {petQ}Wie kann ich Ihnen heute helfen?",
    petQ: "Wie geht es {pet}? ",
    slotsLead: "Wunderbar — hier sind die nächsten freien Termine für {service}. Welcher passt Ihnen am besten?",
    noOpenings: "Es tut mir sehr leid — ich sehe gerade keine freien Termine für {service}. Soll ich dem Team eine Nachricht hinterlassen?",
    askWhichService: "Natürlich — gerne helfe ich Ihnen bei der Buchung. Welche davon möchten Sie?",
    catchAll: "Ich kann Ihnen unsere Öffnungszeiten, Adresse, Leistungen und Preise nennen oder einen Termin buchen. Womit kann ich helfen?",
    upcoming: "Sie haben einen Termin für {service} am {when}, {first}. Kann ich sonst noch helfen?",
    askPhone: "Das prüfe ich gern — wie lautet die Telefonnummer der Buchung?",
    noAdvice: "Oh nein, das tut mir sehr leid — das ist beunruhigend. Ich kann keine medizinischen Ratschläge geben, aber bitte rufen Sie sofort unsere Notfallnummer {emergency} an, oder ich helfe Ihnen, den nächsten freien Termin zu buchen.",
    booked: "Wunderbar, {first}, alles erledigt! Ich habe {service} am {when} bei {withName} gebucht. Sie erhalten in Kürze eine Bestätigungs-E-Mail.",
  },
  pt: {
    greetingNew: "Olá! Sou {assistant} da {business}. Como posso ajudar você e o seu pet hoje?",
    greetingReturning: "Que bom te ver de novo, {first}! {petQ}Como posso ajudar hoje?",
    petQ: "Como está {pet}? ",
    slotsLead: "Ótimo — aqui estão os próximos horários disponíveis para {service}. Qual fica melhor para você?",
    noOpenings: "Sinto muito — não vejo horários para {service} no momento. Quer que eu anote um recado para a equipe?",
    askWhichService: "Claro — terei prazer em ajudar a agendar. Qual destes você gostaria?",
    catchAll: "Posso informar nossos horários, localização, serviços e preços, ou agendar uma visita. Como posso ajudar?",
    upcoming: "Você tem um agendamento de {service} no dia {when}, {first}. Posso ajudar em mais alguma coisa?",
    askPhone: "Posso verificar — qual é o telefone do agendamento?",
    noAdvice: "Ah, sinto muito — isso é preocupante. Não posso dar conselhos médicos, mas por favor ligue já para a nossa linha de emergência {emergency}, ou posso ajudar a agendar a próxima visita disponível.",
    booked: "Perfeito, {first}, tudo certo! Agendei {service} para {when} com {withName}. Enviaremos um e-mail de confirmação em breve.",
  },
  hi: {
    greetingNew: "नमस्ते! मैं {business} की {assistant} हूँ। आज मैं आपकी और आपके पालतू की कैसे मदद कर सकती हूँ?",
    greetingReturning: "आपको फिर से देखकर अच्छा लगा, {first}! {petQ}आज मैं आपकी कैसे मदद करूँ?",
    petQ: "{pet} कैसा है? ",
    slotsLead: "बढ़िया — {service} के लिए ये अगले उपलब्ध समय हैं। आपको कौन-सा ठीक रहेगा?",
    noOpenings: "मुझे बहुत खेद है — अभी {service} के लिए कोई समय उपलब्ध नहीं है। क्या मैं टीम के लिए संदेश ले लूँ?",
    askWhichService: "ज़रूर — मैं आपकी बुकिंग में खुशी से मदद करूँगी। इनमें से आप कौन-सा चाहेंगे?",
    catchAll: "मैं आपको हमारे समय, पता, सेवाएँ और कीमतें बता सकती हूँ, या अपॉइंटमेंट बुक कर सकती हूँ। किसमें मदद करूँ?",
    upcoming: "{first}, आपकी {service} की अपॉइंटमेंट {when} को है। क्या किसी और चीज़ में मदद करूँ?",
    askPhone: "मैं देख लेती हूँ — बुकिंग पर कौन-सा फ़ोन नंबर है?",
    noAdvice: "ओह नहीं, मुझे बहुत खेद है — यह चिंताजनक है। मैं चिकित्सा सलाह नहीं दे सकती, लेकिन कृपया तुरंत हमारी आपातकालीन लाइन {emergency} पर कॉल करें, या मैं अगली उपलब्ध अपॉइंटमेंट बुक करने में मदद कर सकती हूँ।",
    booked: "बढ़िया, {first}, सब तैयार है! मैंने {when} को {withName} के साथ {service} बुक कर दी है। हम जल्द ही पुष्टि ईमेल भेजेंगे।",
  },
};

export const isLocalized = (lang: Lang): boolean => lang in DICT;

export function t(lang: Lang, key: Phrase, vars: Record<string, string | undefined> = {}): string {
  const table = DICT[lang] ?? DICT.en;
  return fill(table[key] ?? DICT.en[key], vars);
}
