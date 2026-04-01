import type { en } from './en';

export const es: typeof en = {
  // Common
  cancel: 'Cancelar',
  delete: 'Eliminar',
  done: 'Listo',
  remove: 'Quitar',
  error: 'Error',
  loading: 'Cargando...',
  save: 'Guardar',
  confirm: 'Confirmar',
  back: 'Volver',
  or: 'o',

  // Tabs
  tabs_home: 'Inicio',
  tabs_settings: 'Configuración',

  // Auth / Login
  auth_appName: 'Rondas',
  auth_tagline: 'Divide cuentas, no amistades',
  auth_signInEmail: 'Iniciar sesión con Email',
  auth_signInApple: 'Iniciar sesión con Apple',
  auth_signInGoogle: 'Iniciar sesión con Google',
  auth_terms: 'Al continuar, aceptas nuestros Términos de Servicio',

  // Setup
  setup_welcome: 'Bienvenido a Rondas',
  setup_subtitle: 'Configuremos tus preferencias para comenzar',
  setup_getStarted: 'Comenzar',

  // Home
  home_greeting: (name: string) => `Hola ${name} 👋`,
  home_billCount: (n: number) => `${n} ${n === 1 ? 'factura' : 'facturas'}`,
  home_pending: (amount: string) => `${amount} pendiente`,
  home_noBills: 'Sin facturas aún',
  home_noBillsHint: 'Escanea un recibo para comenzar',
  home_addFirstBill: 'Agrega tu primera factura',
  home_loadMore: 'Cargar más',
  offline_banner: 'Sin conexión a internet',
  home_addBill: 'Agregar factura',
  home_addBillHow: '¿Cómo quieres agregar la factura?',
  home_takePhoto: 'Tomar foto',
  home_chooseLibrary: 'Elegir de la galería',
  home_deleteBill: 'Eliminar factura',
  home_deleteConfirm: '¿Estás seguro? Esto no se puede deshacer.',
  home_permissionCamera: 'Se necesita acceso a la cámara para tomar fotos de facturas.',
  home_permissionLibrary: 'Se necesita acceso a la galería para seleccionar fotos de facturas.',
  home_permissionNeeded: 'Permiso necesario',

  // Filters
  filter_all: 'Todas',
  filter_draft: 'Borrador',
  filter_unsplit: 'Sin dividir',
  filter_unresolved: 'Sin resolver',
  filter_split: 'Dividida',
  filter_filters: 'Filtros',

  // Filter sheet
  filterSheet_title: 'Filtros',
  filterSheet_country: 'País',
  filterSheet_status: 'Estado',
  filterSheet_contacts: 'Contactos',
  filterSheet_contactSearch: 'Buscar contactos...',
  filterSheet_amount: 'Rango de monto',
  filterSheet_amountMin: 'Mín',
  filterSheet_amountMax: 'Máx',
  filterSheet_dateRange: 'Rango de fechas',
  filterSheet_dateFrom: 'Desde',
  filterSheet_dateTo: 'Hasta',
  filterSheet_apply: 'Aplicar',
  filterSheet_resetDefaults: 'Restablecer',
  filterSheet_preset1h: '1h',
  filterSheet_preset1d: '1d',
  filterSheet_preset7d: '7d',
  filterSheet_preset30d: '30d',
  filterSheet_presetCustom: 'Personalizado',

  // Bill states
  state_draft: 'Borrador',
  state_unsplit: 'Sin dividir',
  state_split: 'Dividida',
  state_unresolved: 'Sin resolver',

  // Bill card
  billCard_items: (n: number) => `${n} ${n === 1 ? 'ítem' : 'ítems'}`,
  billCard_assigned: (assigned: number, total: number) => `${assigned}/${total} ítems asignados`,

  // Categories
  category_dining: 'Restaurante',
  category_retail: 'Comercio',
  category_service: 'Servicio',

  // Tax labels
  tax_impoconsumo: 'Impoconsumo (incluido)',
  tax_iva: 'IVA (incluido)',
  tax_salesTax: 'Impuesto de venta',

  // Settings
  settings_title: 'Configuración',
  settings_preferences: 'Preferencias',
  settings_theme: 'Tema',
  settings_themeLight: 'Claro',
  settings_themeDark: 'Oscuro',
  settings_themeAuto: 'Auto',
  settings_language: 'Idioma',
  settings_langEnglish: 'English',
  settings_langSpanish: 'Español',
  settings_billing: 'Facturación',
  settings_country: 'País',
  settings_countryColombia: 'Colombia',
  settings_countryUSA: 'EE.UU.',
  settings_state: 'Estado',
  settings_selectState: 'Seleccionar estado',
  settings_defaultTip: 'Propina por defecto',
  settings_tipPercentage: 'Porcentaje de propina',
  settings_scanning: 'Escaneo',
  settings_extractTime: 'Extraer hora automáticamente',
  settings_extractTimeInfo: 'Lee la fecha y hora de los metadatos de la foto del recibo (EXIF)',
  settings_captureLocation: 'Capturar ubicación',
  settings_captureLocationInfo: 'Etiqueta las facturas con tu ubicación o la del lugar desde los datos GPS de la foto',
  settings_account: 'Cuenta',
  settings_signOut: 'Cerrar sesión',
  settings_signOutConfirm: '¿Estás seguro de que quieres cerrar sesión?',
  settings_upgradePro: 'Actualizar a Pro',
  settings_proDescription: 'Facturas ilimitadas, divisiones por ítem y más',
  settings_proPrice: (country: string) => country === 'CO' ? '$15.000/mes' : '$1.99/mes',
  settings_version: 'Rondas v0.1.0',
  settings_madeIn: 'Hecho con amor en Colombia',

  // Scan / New bill
  scan_noImage: 'No se seleccionó imagen',
  scan_scanBill: 'Escanear factura',
  scan_enterManually: 'Ingresar manualmente',
  scan_tapRetry: 'Toca para reintentar',
  scan_analyzing: 'Analizando factura...',
  scan_reading: 'Leyendo recibo...',
  scan_extracting: 'Extrayendo ítems...',
  scan_analyzeHint: 'Esto puede tomar unos segundos',
  scan_readingHint: 'Entendiendo la estructura del recibo',
  scan_itemsFound: (n: number) => `${n} ítems encontrados`,
  scan_reviewTitle: 'Revisar ítems',
  scan_itemCount: (n: number) => `${n} ítems`,
  scan_restaurantPlaceholder: 'Nombre del restaurante...',
  scan_tapToEdit: 'Toca para editar · Desliza para eliminar',
  scan_itemName: 'Nombre del ítem',
  scan_qty: 'Cant',
  scan_unitPrice: 'Precio unitario',
  scan_subtotalLabel: 'Subtotal',
  scan_addItem: 'Agregar ítem',
  scan_subtotal: 'Subtotal',
  scan_taxIva: 'Impuesto (IVA)',
  scan_tipPropina: 'Propina',
  scan_total: 'Total',
  scan_confirmItems: 'Confirmar ítems',
  scan_saving: 'Guardando...',
  scan_saveError: 'Error al guardar la factura. Intenta de nuevo.',
  scan_discardTitle: '¿Descartar cambios?',
  scan_discardMessage: 'Tienes ítems sin guardar. Salir descartará tu progreso y necesitarás escanear la factura de nuevo.',
  scan_keepEditing: 'Seguir editando',
  scan_discard: 'Descartar',
  scan_unnamed: 'Ítem sin nombre',

  // Bill detail
  bill_subtotal: 'Subtotal',
  bill_beforeTip: 'Antes de propina',
  bill_tip: (pct: number) => `Propina (${pct}%)`,
  bill_total: 'Total',
  bill_country: 'País',
  bill_deleteBill: 'Eliminar factura',
  bill_deleteConfirm: '¿Estás seguro? Esto no se puede deshacer.',
  bill_tapToEdit: 'Toca un ítem para editar · Toca + para asignar',
  bill_tapToAssign: 'Toca + para asignar',
  bill_customTip: 'Propina personalizada',
  bill_tipCustom: 'Propina (personalizada)',

  // People summary
  people_title: 'Personas',
  people_paidCount: (paid: number, total: number) => `${paid}/${total} pagado${paid !== 1 ? 's' : ''}`,
  people_items: (n: number) => n === 1 ? '1 ítem' : `${n} ítems`,
  bill_selected: (n: number) => `${n} seleccionados`,
  bill_bulkEdit: 'Edición masiva',
  bill_deleteItems: 'Eliminar ítems',
  bill_deleteItemsConfirm: (n: number) => `¿Eliminar ${n} ${n === 1 ? 'ítem seleccionado' : 'ítems seleccionados'}?`,
  bill_permissionNeeded: 'Permiso necesario',
  bill_permissionContacts: 'Se necesita acceso a los contactos para asignar personas a los ítems.',
  bill_removeContact: 'Quitar contacto',
  bill_removeContactConfirm: '¿Quitar a esta persona del ítem?',
  bill_removeFromSelected: (name: string) => `¿Quitar a ${name} de los ítems seleccionados?`,
  bill_noContacts: 'Sin contactos',
  bill_noContactsOnItems: 'Los ítems seleccionados no tienen contactos asignados.',
  bill_confirmRemoval: 'Confirmar eliminación',
  bill_removeMultipleConfirm: (n: number) => `¿Quitar ${n} ${n === 1 ? 'contacto' : 'contactos'} de los ítems seleccionados?`,
  bill_noPhone: 'Sin número de teléfono',
  bill_noPhoneMessage: 'Este contacto no tiene número de teléfono para enviar un mensaje.',
  bill_confirmItems: 'Confirmar ítems',

  // Sort
  sort_receipt: 'Recibo',
  sort_priceDesc: 'Precio ↓',
  sort_priceAsc: 'Precio ↑',
  sort_alphaAsc: 'A→Z',
  sort_alphaDesc: 'Z→A',

  // Tip dialog
  tipDialog_title: 'Porcentaje de propina',

  // Country dialog
  countryDialog_title: 'País de la factura',

  // Share & Pay
  share_title: 'Compartir y pagar',
  share_button: (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'} · Compartir y pagar`,
  share_paid: 'Pagado',
  share_unpaid: 'Pendiente',
  share_whatsapp: 'WhatsApp',
  share_share: 'Compartir',
  share_itemCount: (n: number) => n === 1 ? '1 ítem' : `${n} ítems`,

  // Contact picker
  contactPicker_title: 'Seleccionar contactos',
  contactPicker_search: 'Buscar contactos...',
  contactPicker_assign: (n: number) => `Asignar ${n} ${n === 1 ? 'contacto' : 'contactos'}`,
  contactPicker_frequent: 'Frecuentes',
  contactPicker_recent: 'Recientes',
  contactPicker_allContacts: 'Todos los contactos',

  // Unassign picker
  unassignPicker_title: 'Quitar contactos',
  unassignPicker_itemsOnSelection: (n: number) => `${n} ${n === 1 ? 'ítem' : 'ítems'} en la selección`,
  unassignPicker_remove: (n: number) => `Quitar ${n} ${n === 1 ? 'contacto' : 'contactos'}`,

  // Bulk toolbar
  bulk_assign: 'Asignar',
  bulk_unassign: 'Desasignar',
  bulk_delete: 'Eliminar',

  // Relative time
  time_justNow: 'ahora',
  time_minutesAgo: (n: number) => `hace ${n}m`,
  time_hoursAgo: (n: number) => `hace ${n}h`,
  time_yesterday: 'ayer',
  time_daysAgo: (n: number) => `hace ${n}d`,
  time_photoAndBill: (time: string) => `Foto y factura de ${time}`,
  time_photoBill: (photo: string, bill: string) => `Foto ${photo} · Factura creada ${bill}`,
  time_created: (time: string) => `Creada ${time}`,

  // WhatsApp message
  wa_breakdown: (name: string) => `*Desglose de ${name}:*`,
  wa_subtotal: 'Subtotal',
  wa_beforeTip: 'Antes de propina',
  wa_tip: (pct: number) => `Propina (${pct}%)`,
  wa_total: (amount: string) => `*Total: ${amount}*`,
  wa_footer: '_Resumen generado con la app Rondas_\n_rondas.app_',

  // Error states
  error_billNotFound: 'Factura no encontrada',
  error_billNotFoundHint: 'Esta factura pudo haber sido eliminada o ya no está disponible.',
  error_goHome: 'Ir al inicio',
  error_mutationFailed: 'Algo salió mal. Por favor, inténtalo de nuevo.',
  error_shareFailed: 'No se pudo compartir. Por favor, inténtalo de nuevo.',
  error_timeout: 'La solicitud ha expirado',
  error_api: 'Servicio temporalmente no disponible',
  error_scanGeneric: 'No se pudo escanear la factura',
  error_hintTimeout: 'Verifica tu conexión e inténtalo de nuevo',
  error_hintApi: 'Espera un momento e inténtalo de nuevo',
  error_hintScan: 'Intenta con una foto más clara y bien iluminada',
  error_whatsappNotAvailable: 'WhatsApp no está disponible en este dispositivo',

  // Infographic
  infographic_billFor: 'Factura para',
  infographic_item: 'Ítem',
  infographic_amount: 'Monto',
  infographic_total: 'TOTAL',
  infographic_tagline: 'Divide cuentas, no amistades',
  infographic_country: (country: string) => country === 'CO' ? '🇨🇴 Colombia' : '🇺🇸 EE.UU.',
};
