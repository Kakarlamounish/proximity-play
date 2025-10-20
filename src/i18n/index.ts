import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      'nav.home': 'Home',
      'nav.discover': 'Discover',
      'nav.messages': 'Messages',
      'nav.live': 'Live',
      'nav.profile': 'Profile',
      'nav.settings': 'Settings',

      // Common
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
      'common.delete': 'Delete',
      'common.edit': 'Edit',
      'common.create': 'Create',
      'common.join': 'Join',
      'common.leave': 'Leave',
      'common.send': 'Send',
      'common.search': 'Search',
      'common.filter': 'Filter',

      // Auth
      'auth.signIn': 'Sign In',
      'auth.signUp': 'Sign Up',
      'auth.signOut': 'Sign Out',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.confirmPassword': 'Confirm Password',
      'auth.forgotPassword': 'Forgot Password?',

      // Bubbles
      'bubbles.title': 'Bubbles',
      'bubbles.create': 'Create Bubble',
      'bubbles.join': 'Join Bubble',
      'bubbles.members': 'Members',
      'bubbles.description': 'Description',
      'bubbles.location': 'Location',
      'bubbles.interests': 'Interests',

      // Messages
      'messages.title': 'Messages',
      'messages.placeholder': 'Type a message...',
      'messages.send': 'Send Message',
      'messages.noMessages': 'No messages yet',

      // Live Features
      'live.title': 'Live Features',
      'live.locationSharing': 'Location Sharing',
      'live.activity': 'Live Activity',
      'live.status': 'Status Updates',

      // Settings
      'settings.title': 'Settings',
      'settings.profile': 'Profile Settings',
      'settings.privacy': 'Privacy & Safety',
      'settings.notifications': 'Notifications',
      'settings.appearance': 'Appearance',
      'settings.language': 'Language',
      'settings.timezone': 'Timezone',

      // Errors
      'error.network': 'Network error. Please check your connection.',
      'error.server': 'Server error. Please try again later.',
      'error.validation': 'Please check your input and try again.',
      'error.permission': 'You don\'t have permission to perform this action.',

      // Success
      'success.saved': 'Changes saved successfully',
      'success.created': 'Created successfully',
      'success.deleted': 'Deleted successfully',
      'success.sent': 'Message sent successfully',
    }
  },
  es: {
    translation: {
      // Navigation
      'nav.home': 'Inicio',
      'nav.discover': 'Descubrir',
      'nav.messages': 'Mensajes',
      'nav.live': 'En Vivo',
      'nav.profile': 'Perfil',
      'nav.settings': 'Configuración',

      // Common
      'common.loading': 'Cargando...',
      'common.error': 'Error',
      'common.success': 'Éxito',
      'common.save': 'Guardar',
      'common.cancel': 'Cancelar',
      'common.delete': 'Eliminar',
      'common.edit': 'Editar',
      'common.create': 'Crear',
      'common.join': 'Unirse',
      'common.leave': 'Salir',
      'common.send': 'Enviar',
      'common.search': 'Buscar',
      'common.filter': 'Filtrar',

      // Auth
      'auth.signIn': 'Iniciar Sesión',
      'auth.signUp': 'Registrarse',
      'auth.signOut': 'Cerrar Sesión',
      'auth.email': 'Correo electrónico',
      'auth.password': 'Contraseña',
      'auth.confirmPassword': 'Confirmar Contraseña',
      'auth.forgotPassword': '¿Olvidaste tu contraseña?',

      // Bubbles
      'bubbles.title': 'Burbujas',
      'bubbles.create': 'Crear Burbuja',
      'bubbles.join': 'Unirse a Burbuja',
      'bubbles.members': 'Miembros',
      'bubbles.description': 'Descripción',
      'bubbles.location': 'Ubicación',
      'bubbles.interests': 'Intereses',

      // Messages
      'messages.title': 'Mensajes',
      'messages.placeholder': 'Escribe un mensaje...',
      'messages.send': 'Enviar Mensaje',
      'messages.noMessages': 'Aún no hay mensajes',

      // Live Features
      'live.title': 'Características en Vivo',
      'live.locationSharing': 'Compartir Ubicación',
      'live.activity': 'Actividad en Vivo',
      'live.status': 'Actualizaciones de Estado',

      // Settings
      'settings.title': 'Configuración',
      'settings.profile': 'Configuración de Perfil',
      'settings.privacy': 'Privacidad y Seguridad',
      'settings.notifications': 'Notificaciones',
      'settings.appearance': 'Apariencia',
      'settings.language': 'Idioma',
      'settings.timezone': 'Zona Horaria',

      // Errors
      'error.network': 'Error de red. Por favor verifica tu conexión.',
      'error.server': 'Error del servidor. Por favor intenta más tarde.',
      'error.validation': 'Por favor verifica tu entrada e intenta nuevamente.',
      'error.permission': 'No tienes permiso para realizar esta acción.',

      // Success
      'success.saved': 'Cambios guardados exitosamente',
      'success.created': 'Creado exitosamente',
      'success.deleted': 'Eliminado exitosamente',
      'success.sent': 'Mensaje enviado exitosamente',
    }
  },
  fr: {
    translation: {
      // Navigation
      'nav.home': 'Accueil',
      'nav.discover': 'Découvrir',
      'nav.messages': 'Messages',
      'nav.live': 'En Direct',
      'nav.profile': 'Profil',
      'nav.settings': 'Paramètres',

      // Common
      'common.loading': 'Chargement...',
      'common.error': 'Erreur',
      'common.success': 'Succès',
      'common.save': 'Sauvegarder',
      'common.cancel': 'Annuler',
      'common.delete': 'Supprimer',
      'common.edit': 'Modifier',
      'common.create': 'Créer',
      'common.join': 'Rejoindre',
      'common.leave': 'Quitter',
      'common.send': 'Envoyer',
      'common.search': 'Rechercher',
      'common.filter': 'Filtrer',

      // Auth
      'auth.signIn': 'Se Connecter',
      'auth.signUp': 'S\'inscrire',
      'auth.signOut': 'Se Déconnecter',
      'auth.email': 'Email',
      'auth.password': 'Mot de passe',
      'auth.confirmPassword': 'Confirmer le mot de passe',
      'auth.forgotPassword': 'Mot de passe oublié ?',

      // Bubbles
      'bubbles.title': 'Bulles',
      'bubbles.create': 'Créer une Bulle',
      'bubbles.join': 'Rejoindre une Bulle',
      'bubbles.members': 'Membres',
      'bubbles.description': 'Description',
      'bubbles.location': 'Emplacement',
      'bubbles.interests': 'Intérêts',

      // Messages
      'messages.title': 'Messages',
      'messages.placeholder': 'Tapez un message...',
      'messages.send': 'Envoyer le Message',
      'messages.noMessages': 'Pas encore de messages',

      // Live Features
      'live.title': 'Fonctionnalités en Direct',
      'live.locationSharing': 'Partage de Localisation',
      'live.activity': 'Activité en Direct',
      'live.status': 'Mises à Jour de Statut',

      // Settings
      'settings.title': 'Paramètres',
      'settings.profile': 'Paramètres de Profil',
      'settings.privacy': 'Confidentialité et Sécurité',
      'settings.notifications': 'Notifications',
      'settings.appearance': 'Apparence',
      'settings.language': 'Langue',
      'settings.timezone': 'Fuseau Horaire',

      // Errors
      'error.network': 'Erreur réseau. Veuillez vérifier votre connexion.',
      'error.server': 'Erreur serveur. Veuillez réessayer plus tard.',
      'error.validation': 'Veuillez vérifier votre saisie et réessayer.',
      'error.permission': 'Vous n\'avez pas la permission d\'effectuer cette action.',

      // Success
      'success.saved': 'Modifications sauvegardées avec succès',
      'success.created': 'Créé avec succès',
      'success.deleted': 'Supprimé avec succès',
      'success.sent': 'Message envoyé avec succès',
    }
  },
  de: {
    translation: {
      // Navigation
      'nav.home': 'Startseite',
      'nav.discover': 'Entdecken',
      'nav.messages': 'Nachrichten',
      'nav.live': 'Live',
      'nav.profile': 'Profil',
      'nav.settings': 'Einstellungen',

      // Common
      'common.loading': 'Laden...',
      'common.error': 'Fehler',
      'common.success': 'Erfolg',
      'common.save': 'Speichern',
      'common.cancel': 'Abbrechen',
      'common.delete': 'Löschen',
      'common.edit': 'Bearbeiten',
      'common.create': 'Erstellen',
      'common.join': 'Beitreten',
      'common.leave': 'Verlassen',
      'common.send': 'Senden',
      'common.search': 'Suchen',
      'common.filter': 'Filtern',

      // Auth
      'auth.signIn': 'Anmelden',
      'auth.signUp': 'Registrieren',
      'auth.signOut': 'Abmelden',
      'auth.email': 'E-Mail',
      'auth.password': 'Passwort',
      'auth.confirmPassword': 'Passwort bestätigen',
      'auth.forgotPassword': 'Passwort vergessen?',

      // Bubbles
      'bubbles.title': 'Blasen',
      'bubbles.create': 'Blase erstellen',
      'bubbles.join': 'Blase beitreten',
      'bubbles.members': 'Mitglieder',
      'bubbles.description': 'Beschreibung',
      'bubbles.location': 'Standort',
      'bubbles.interests': 'Interessen',

      // Messages
      'messages.title': 'Nachrichten',
      'messages.placeholder': 'Nachricht eingeben...',
      'messages.send': 'Nachricht senden',
      'messages.noMessages': 'Noch keine Nachrichten',

      // Live Features
      'live.title': 'Live-Funktionen',
      'live.locationSharing': 'Standort teilen',
      'live.activity': 'Live-Aktivität',
      'live.status': 'Status-Updates',

      // Settings
      'settings.title': 'Einstellungen',
      'settings.profile': 'Profileinstellungen',
      'settings.privacy': 'Datenschutz & Sicherheit',
      'settings.notifications': 'Benachrichtigungen',
      'settings.appearance': 'Erscheinungsbild',
      'settings.language': 'Sprache',
      'settings.timezone': 'Zeitzone',

      // Errors
      'error.network': 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.',
      'error.server': 'Serverfehler. Bitte versuchen Sie es später erneut.',
      'error.validation': 'Bitte überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.',
      'error.permission': 'Sie haben keine Berechtigung, diese Aktion auszuführen.',

      // Success
      'success.saved': 'Änderungen erfolgreich gespeichert',
      'success.created': 'Erfolgreich erstellt',
      'success.deleted': 'Erfolgreich gelöscht',
      'success.sent': 'Nachricht erfolgreich gesendet',
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    debug: process.env.NODE_ENV === 'development',

    interpolation: {
      escapeValue: false, // React already escapes values
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    react: {
      useSuspense: false, // Disable suspense for better UX
    },
  });

export default i18n;