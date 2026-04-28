/**
 * Batch translation for the Engagement Lifecycle Coverage feature (15.5).
 *
 * Run after each Phase to keep fr/es/sk caught up with English placeholders.
 * Re-running is idempotent (only overwrites keys that exist in the dict).
 *
 *   node scripts/i18n/apply-lifecycle-translations.js
 */
const fs = require('fs');
const path = require('path');

const I18N_DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'assets', 'i18n');

// ─── Phase A — Chemistry call ────────────────────────────────────────────────

const COACHING_FR = {
  advanceToContractedAction: 'Passer à Sous contrat',
  advanceToContractedDesc: 'L\'appel de découverte est terminé. Prêt·e à faire passer cet engagement à la phase « sous contrat » ?',
  advanceToContractedError: 'Impossible de faire avancer l\'engagement. Réessayez.',
  advanceToContractedSuccess: 'Engagement passé au statut Sous contrat',
  advanceToContractedTitle: 'Prêt·e à démarrer l\'engagement ?',
  allStatuses: 'Tous',
  alumniReadOnlyDesc: 'Cet engagement est en mode alumni. Votre plan de développement et vos notes de séance restent disponibles en lecture seule.',
  alumniReadOnlyTitle: 'Alumni — accès en lecture seule',
  chemistryCall: 'Appel de découverte',
  chemistryCallDesc: 'Appel gratuit avant la signature du contrat. Ne décompte pas du quota de séances.',
  chemistryCallTooltip: 'Appel de découverte gratuit — ne consomme pas le quota de séances',
  reactivateAction: 'Réactiver l\'engagement',
  reactivateConfirmMsg: 'Ceci replacera l\'engagement au statut « Sous contrat » et rétablira l\'accès du coaché·e. Les rappels alumni en attente seront annulés.',
  reactivateConfirmTitle: 'Réactiver cet engagement ?',
  reactivateDesc: 'L\'engagement est en mode alumni. Le réactiver redonne au coaché·e l\'accès aux réservations.',
  reactivateError: 'Impossible de réactiver l\'engagement. Réessayez.',
  reactivateSuccess: 'Engagement réactivé',
  reactivateTitle: 'Faire revenir le coaché·e ?',
};

const COACHING_ES = {
  advanceToContractedAction: 'Avanzar a Contratado',
  advanceToContractedDesc: 'La sesión de química está completa. ¿Listo/a para pasar este compromiso a la fase contratada?',
  advanceToContractedError: 'No se pudo avanzar el compromiso. Inténtalo de nuevo.',
  advanceToContractedSuccess: 'Compromiso avanzado a Contratado',
  advanceToContractedTitle: '¿Listo/a para comenzar el compromiso?',
  allStatuses: 'Todos',
  alumniReadOnlyDesc: 'Este compromiso está en modo alumni. Tu plan de desarrollo y notas de sesión siguen disponibles en solo lectura.',
  alumniReadOnlyTitle: 'Alumni — acceso de solo lectura',
  chemistryCall: 'Sesión de química',
  chemistryCallDesc: 'Llamada gratuita antes de contratar. No consume el cupo de sesiones.',
  chemistryCallTooltip: 'Sesión de química gratuita — no consume el cupo de sesiones',
  reactivateAction: 'Reactivar compromiso',
  reactivateConfirmMsg: 'Esto devolverá el compromiso a Contratado y restablecerá el acceso del coachee. Los recordatorios alumni pendientes se cancelarán.',
  reactivateConfirmTitle: '¿Reactivar este compromiso?',
  reactivateDesc: 'El compromiso está en modo alumni. Reactivarlo permite al coachee reservar sesiones de nuevo.',
  reactivateError: 'No se pudo reactivar el compromiso. Inténtalo de nuevo.',
  reactivateSuccess: 'Compromiso reactivado',
  reactivateTitle: '¿Darle la bienvenida de nuevo?',
};

const COACHING_SK = {
  advanceToContractedAction: 'Posunúť na Zmluvné',
  advanceToContractedDesc: 'Úvodný rozhovor je dokončený. Pripravený posunúť tento koučovací vzťah do zmluvnej fázy?',
  advanceToContractedError: 'Nepodarilo sa posunúť koučovací vzťah. Skúste znova.',
  advanceToContractedSuccess: 'Koučovací vzťah posunutý na Zmluvné',
  advanceToContractedTitle: 'Pripravený začať koučovací vzťah?',
  allStatuses: 'Všetky',
  alumniReadOnlyDesc: 'Tento koučovací vzťah je v alumni režime. Váš rozvojový plán a poznámky zo stretnutí zostávajú prístupné len na čítanie.',
  alumniReadOnlyTitle: 'Alumni — prístup len na čítanie',
  chemistryCall: 'Úvodný rozhovor',
  chemistryCallDesc: 'Nezáväzný rozhovor pred uzavretím zmluvy. Nezapočítava sa do kvóty stretnutí.',
  chemistryCallTooltip: 'Nezáväzný úvodný rozhovor — nespotrebúva kvótu stretnutí',
  reactivateAction: 'Obnoviť koučovací vzťah',
  reactivateConfirmMsg: 'Toto vráti koučovací vzťah na Zmluvné a obnoví prístup koučovaného. Čakajúce alumni pripomienky budú zrušené.',
  reactivateConfirmTitle: 'Obnoviť tento koučovací vzťah?',
  reactivateDesc: 'Koučovací vzťah je v alumni režime. Jeho obnovenie umožní koučovanému opäť rezervovať stretnutia.',
  reactivateError: 'Nepodarilo sa obnoviť koučovací vzťah. Skúste znova.',
  reactivateSuccess: 'Koučovací vzťah obnovený',
  reactivateTitle: 'Privítať ho späť?',
};

const TRANSLATIONS = {
  fr: { COACHING: COACHING_FR },
  es: { COACHING: COACHING_ES },
  sk: { COACHING: COACHING_SK },
};

for (const lang of ['fr', 'es', 'sk']) {
  const file = path.join(I18N_DIR, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  let updated = 0;
  for (const ns of Object.keys(TRANSLATIONS[lang])) {
    if (!data[ns]) data[ns] = {};
    for (const [key, value] of Object.entries(TRANSLATIONS[lang][ns])) {
      if (data[ns][key] !== value) {
        data[ns][key] = value;
        updated++;
      }
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  console.log(`  ${lang}.json: ${updated} keys translated`);
}
