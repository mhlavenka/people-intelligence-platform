const fs = require('fs');
const path = require('path');

const newKeys = {
  COMMON: {
    deleteFailed: {
      en: 'Delete failed',
      fr: "\u00C9chec de la suppression",
      es: 'Error al eliminar'
    },
    typeAndPressEnter: {
      en: 'Type and press Enter',
      fr: 'Saisissez et appuyez sur Entr\u00E9e',
      es: 'Escriba y presione Enter'
    }
  },
  ADMIN: {
    orgProfileSaved: { en: 'Organization profile saved', fr: "Profil de l\u2019organisation enregistr\u00E9", es: 'Perfil de la organizaci\u00F3n guardado' },
    billingDetailsSaved: { en: 'Billing details saved', fr: "D\u00E9tails de facturation enregistr\u00E9s", es: 'Datos de facturaci\u00F3n guardados' },
    themeSaved: { en: 'Theme saved', fr: "Th\u00E8me enregistr\u00E9", es: 'Tema guardado' },
    logoFileTooLarge: { en: 'Logo file must be under 2 MB', fr: "Le fichier du logo doit faire moins de 2 Mo", es: 'El archivo del logo debe ser inferior a 2 MB' },
    logoSaved: { en: 'Logo saved', fr: "Logo enregistr\u00E9", es: 'Logo guardado' },
    logoSaveFailed: { en: 'Logo save failed', fr: "\u00C9chec de l\u2019enregistrement du logo", es: 'Error al guardar el logo' },
    logoRemoved: { en: 'Logo removed', fr: "Logo supprim\u00E9", es: 'Logo eliminado' },
    removeFailed: { en: 'Remove failed', fr: "\u00C9chec de la suppression", es: 'Error al eliminar' },
    defaultRateSaved: { en: 'Default rate saved', fr: "Tarif par d\u00E9faut enregistr\u00E9", es: 'Tarifa predeterminada guardada' },
    departmentExists: { en: 'Department already exists', fr: "Ce d\u00E9partement existe d\u00E9j\u00E0", es: 'El departamento ya existe' },
    departmentsSaved: { en: 'Departments saved', fr: "D\u00E9partements enregistr\u00E9s", es: 'Departamentos guardados' },
    moduleEnabled: { en: 'enabled', fr: "activ\u00E9", es: 'activado' },
    moduleDisabled: { en: 'disabled', fr: "d\u00E9sactiv\u00E9", es: 'desactivado' },
    systemRolePermsSaved: { en: 'System role permissions saved. Changes apply on next login.', fr: "Permissions des r\u00F4les syst\u00E8me enregistr\u00E9es. Les modifications s\u2019appliqueront \u00E0 la prochaine connexion.", es: 'Permisos de roles del sistema guardados. Los cambios se aplicar\u00E1n en el pr\u00F3ximo inicio de sesi\u00F3n.' },
  },
  BILLING: {
    paymentSuccessful: { en: 'Payment successful! Your invoice will be updated shortly.', fr: "Paiement r\u00E9ussi ! Votre facture sera mise \u00E0 jour sous peu.", es: 'Pago exitoso. Su factura se actualizar\u00E1 en breve.' },
    paymentCancelled: { en: 'Payment was cancelled.', fr: "Le paiement a \u00E9t\u00E9 annul\u00E9.", es: 'El pago fue cancelado.' },
    popupBlocked: { en: 'Pop-up blocked \u2014 please allow pop-ups to download invoices', fr: "Pop-up bloqu\u00E9 \u2014 veuillez autoriser les pop-ups pour t\u00E9l\u00E9charger les factures", es: 'Ventana emergente bloqueada \u2014 por favor permita las ventanas emergentes para descargar facturas' },
  },
  SUCCESSION: {
    journalEntrySaved: { en: 'Journal entry saved', fr: "Entr\u00E9e de journal enregistr\u00E9e", es: 'Entrada de diario guardada' },
    journalSaveFailed: { en: 'Failed to save entry', fr: "\u00C9chec de l\u2019enregistrement de l\u2019entr\u00E9e", es: 'Error al guardar la entrada' },
    entryDeleted: { en: 'Entry deleted', fr: "Entr\u00E9e supprim\u00E9e", es: 'Entrada eliminada' },
    idpRegenerated: { en: 'IDP regenerated successfully', fr: "PDI r\u00E9g\u00E9n\u00E9r\u00E9 avec succ\u00E8s", es: 'PDI regenerado con \u00E9xito' },
    regenerationFailed: { en: 'Regeneration failed', fr: "\u00C9chec de la r\u00E9g\u00E9n\u00E9ration", es: 'Error en la regeneraci\u00F3n' },
    idpDeactivated: { en: 'IDP deactivated', fr: "PDI d\u00E9sactiv\u00E9", es: 'PDI desactivado' },
    yourReflection: { en: 'Your reflection', fr: "Votre r\u00E9flexion", es: 'Su reflexi\u00F3n' },
    reflectionPlaceholder: { en: 'Reflect on progress, challenges, or insights...', fr: "R\u00E9fl\u00E9chissez \u00E0 vos progr\u00E8s, d\u00E9fis ou observations\u2026", es: 'Reflexione sobre el progreso, los desaf\u00EDos o las perspectivas\u2026' },
    deactivateIdp: { en: 'Deactivate IDP', fr: "D\u00E9sactiver le PDI", es: 'Desactivar el PDI' },
    eqiDimensions: { en: 'EQ-i dimensions', fr: "Dimensions EQ-i", es: 'Dimensiones EQ-i' },
    scored: { en: 'scored', fr: "\u00E9valu\u00E9es", es: 'evaluadas' },
  },
  SYSADMIN: {
    planDeleteFailed: { en: 'Failed to delete plan.', fr: "\u00C9chec de la suppression du plan.", es: 'Error al eliminar el plan.' },
    resetToDefaultsTooltip: { en: 'Reset all settings to factory defaults', fr: "R\u00E9initialiser tous les param\u00E8tres aux valeurs par d\u00E9faut", es: 'Restablecer todos los ajustes a los valores predeterminados' },
  },
  NEURO: {
    yourRole: { en: 'Your Role', fr: "Votre r\u00F4le", es: 'Su rol' },
    roleDescription: { en: 'Tell us about your role to contextualize the assessment.', fr: "Indiquez-nous votre r\u00F4le pour contextualiser l\u2019\u00E9valuation.", es: 'Ind\u00EDquenos su rol para contextualizar la evaluaci\u00F3n.' },
    roleHrManager: { en: 'HR Manager', fr: "Responsable RH", es: 'Gerente de Recursos Humanos' },
    roleExecutive: { en: 'Executive / C-Suite', fr: "Cadre dirigeant", es: 'Ejecutivo / Alta direcci\u00F3n' },
    rolePeopleManager: { en: 'People Manager', fr: "Manager d\u2019\u00E9quipe", es: 'Gerente de personal' },
    roleIndividualContributor: { en: 'Individual Contributor', fr: "Contributeur individuel", es: 'Colaborador individual' },
    roleDeiSpecialist: { en: 'DEI Specialist', fr: "Sp\u00E9cialiste DEI", es: 'Especialista DEI' },
    continue: { en: 'Continue', fr: "Continuer", es: 'Continuar' },
    rateMaturity: { en: "Rate your organization's current maturity in this dimension:", fr: "\u00C9valuez la maturit\u00E9 actuelle de votre organisation dans cette dimension :", es: 'Califique la madurez actual de su organizaci\u00F3n en esta dimensi\u00F3n:' },
    beginner: { en: 'Beginner', fr: "D\u00E9butant", es: 'Principiante' },
    advanced: { en: 'Advanced', fr: "Avanc\u00E9", es: 'Avanzado' },
    reviewSubmit: { en: 'Review & Submit', fr: "V\u00E9rification et soumission", es: 'Revisi\u00F3n y env\u00EDo' },
    reviewYourScores: { en: 'Review Your Scores', fr: "V\u00E9rifiez vos scores", es: 'Revise sus puntuaciones' },
    generateAIAnalysis: { en: 'Generate AI Analysis', fr: "G\u00E9n\u00E9rer l\u2019analyse IA", es: 'Generar an\u00E1lisis de IA' },
  },
  BOOKING: {
    copyFirstDayHours: { en: "Copy first enabled day's hours to all days", fr: "Copier les horaires du premier jour actif vers tous les jours", es: 'Copiar las horas del primer d\u00EDa habilitado a todos los d\u00EDas' },
    removeExclusion: { en: 'Remove exclusion', fr: "Supprimer l\u2019exclusion", es: 'Eliminar exclusi\u00F3n' },
    descriptionPlaceholder: { en: 'Brief description shown on your booking page...', fr: "Br\u00E8ve description affich\u00E9e sur votre page de r\u00E9servation\u2026", es: 'Breve descripci\u00F3n que se muestra en su p\u00E1gina de reserva\u2026' },
  },
  COACHING: {
    notesPlaceholder: { en: "Anything you'd like to discuss or prepare for...", fr: "Tout ce que vous souhaitez aborder ou pr\u00E9parer\u2026", es: 'Cualquier tema que desee discutir o preparar\u2026' },
  },
  HUB: {
    writeMessage: { en: 'Write your message\u2026', fr: "\u00C9crivez votre message\u2026", es: 'Escriba su mensaje\u2026' },
    reply: { en: 'Reply\u2026', fr: "R\u00E9pondre\u2026", es: 'Responder\u2026' },
  },
  JOURNAL: {
    titlePlaceholder: { en: "What's on your mind?", fr: "Qu\u2019avez-vous \u00E0 l\u2019esprit ?", es: '\u00BFQu\u00E9 tiene en mente?' },
    reflectionPlaceholder: { en: 'Write freely about your coaching practice, observations, or professional growth...', fr: "\u00C9crivez librement sur votre pratique de coaching, vos observations ou votre d\u00E9veloppement professionnel\u2026", es: 'Escriba libremente sobre su pr\u00E1ctica de coaching, observaciones o crecimiento profesional\u2026' },
    addTagPlaceholder: { en: 'Add tag + Enter', fr: "Ajouter un tag + Entr\u00E9e", es: 'Agregar etiqueta + Enter' },
    openingStatePlaceholder: { en: 'How did the coachee present at the start?', fr: "Comment le coachee se pr\u00E9sentait-il au d\u00E9but ?", es: '\u00BFC\u00F3mo se present\u00F3 el coachee al inicio?' },
    addThemePlaceholder: { en: 'Add theme + Enter', fr: "Ajouter un th\u00E8me + Entr\u00E9e", es: 'Agregar tema + Enter' },
    observationsPlaceholder: { en: 'What did you observe during the session?', fr: "Qu\u2019avez-vous observ\u00E9 pendant la s\u00E9ance ?", es: '\u00BFQu\u00E9 observ\u00F3 durante la sesi\u00F3n?' },
    quotePlaceholder: { en: 'Quote...', fr: "Citation\u2026", es: 'Cita\u2026' },
    coachInterventionsPlaceholder: { en: 'What coaching tools or interventions did you use?', fr: "Quels outils ou interventions de coaching avez-vous utilis\u00E9s ?", es: '\u00BFQu\u00E9 herramientas o intervenciones de coaching utiliz\u00F3?' },
    energyShiftsPlaceholder: { en: 'Were there notable shifts in energy or engagement?', fr: "Y a-t-il eu des changements notables d\u2019\u00E9nergie ou d\u2019engagement ?", es: '\u00BFHubo cambios notables en la energ\u00EDa o el compromiso?' },
  },
  ORGCHART: {
    discard: { en: 'Discard', fr: "Annuler", es: 'Descartar' },
    dragToReassign: { en: 'Drag to reassign', fr: "Glisser pour r\u00E9assigner", es: 'Arrastre para reasignar' },
    removeFromReportingLine: { en: 'Remove from reporting line', fr: "Retirer de la ligne hi\u00E9rarchique", es: 'Eliminar de la l\u00EDnea jer\u00E1rquica' },
  },
  SPONSOR: {
    viewPrint: { en: 'View / Print', fr: "Voir / Imprimer", es: 'Ver / Imprimir' },
    backToBilling: { en: 'Back to billing', fr: "Retour \u00E0 la facturation", es: 'Volver a facturaci\u00F3n' },
  },
};

for (const lang of ['en', 'fr', 'es']) {
  const filePath = path.join(__dirname, '..', 'frontend', 'src', 'assets', 'i18n', lang + '.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const [section, keys] of Object.entries(newKeys)) {
    if (!data[section]) data[section] = {};
    for (const [key, translations] of Object.entries(keys)) {
      if (!data[section][key]) {
        data[section][key] = translations[lang];
      }
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log('Updated ' + lang + '.json');
}
console.log('Done!');
