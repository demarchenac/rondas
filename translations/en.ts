export const en = {
  // Common
  cancel: 'Cancel',
  delete: 'Delete',
  done: 'Done',
  remove: 'Remove',
  error: 'Error',
  loading: 'Loading...',
  save: 'Save',
  confirm: 'Confirm',
  back: 'Go Back',
  or: 'or',

  // Tabs
  tabs_home: 'Home',
  tabs_settings: 'Settings',

  // Auth / Login
  auth_appName: 'Rondas',
  auth_tagline: 'Split bills, not friendships',
  auth_signInEmail: 'Sign in with Email',
  auth_signInApple: 'Sign in with Apple',
  auth_signInGoogle: 'Sign in with Google',
  auth_terms: 'By continuing, you agree to our Terms of Service',

  // Setup
  setup_welcome: 'Welcome to Rondas',
  setup_subtitle: "Let's set up your preferences to get started",
  setup_getStarted: 'Get Started',

  // Home
  home_greeting: (name: string) => `Hey ${name} 👋`,
  home_billCount: (n: number) => `${n} ${n === 1 ? 'bill' : 'bills'}`,
  home_pending: (amount: string) => `${amount} pending`,
  home_noBills: 'No bills yet',
  home_noBillsHint: 'Scan a receipt to get started',
  home_addFirstBill: 'Add your first bill',
  home_addBill: 'Add Bill',
  home_addBillHow: 'How would you like to add a bill?',
  home_takePhoto: 'Take Photo',
  home_chooseLibrary: 'Choose from Library',
  home_deleteBill: 'Delete bill',
  home_deleteConfirm: 'Are you sure? This cannot be undone.',
  home_permissionCamera: 'Camera access is required to take photos of bills.',
  home_permissionLibrary: 'Photo library access is required to select bill photos.',
  home_permissionNeeded: 'Permission needed',

  // Filters
  filter_all: 'All',
  filter_draft: 'Draft',
  filter_unsplit: 'Unsplit',
  filter_unresolved: 'Unresolved',
  filter_split: 'Split',

  // Bill states
  state_draft: 'Draft',
  state_unsplit: 'Unsplit',
  state_split: 'Split',
  state_unresolved: 'Unresolved',

  // Bill card
  billCard_items: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  billCard_assigned: (assigned: number, total: number) => `${assigned}/${total} items assigned`,

  // Categories
  category_dining: 'Dining',
  category_retail: 'Retail',
  category_service: 'Service',

  // Tax labels
  tax_impoconsumo: 'Impoconsumo (included)',
  tax_iva: 'IVA (included)',
  tax_salesTax: 'Sales Tax',

  // Settings
  settings_title: 'Settings',
  settings_preferences: 'Preferences',
  settings_theme: 'Theme',
  settings_themeLight: 'Light',
  settings_themeDark: 'Dark',
  settings_themeAuto: 'Auto',
  settings_language: 'Language',
  settings_langEnglish: 'English',
  settings_langSpanish: 'Español',
  settings_billing: 'Billing',
  settings_country: 'Country',
  settings_countryColombia: 'Colombia',
  settings_countryUSA: 'USA',
  settings_state: 'State',
  settings_selectState: 'Select State',
  settings_defaultTip: 'Default tip',
  settings_tipPercentage: 'Tip percentage',
  settings_scanning: 'Scanning',
  settings_extractTime: 'Auto-extract time',
  settings_extractTimeInfo: "Reads the date and time from your receipt photo's metadata (EXIF)",
  settings_captureLocation: 'Capture location',
  settings_captureLocationInfo: "Tags bills with your location or the venue from the photo's GPS data",
  settings_account: 'Account',
  settings_signOut: 'Sign Out',
  settings_signOutConfirm: 'Are you sure you want to sign out?',
  settings_upgradePro: 'Upgrade to Pro',
  settings_proDescription: 'Unlimited bills, item splits & more',
  settings_version: 'Rondas v0.1.0',
  settings_madeIn: 'Made with love in Colombia',

  // Scan / New bill
  scan_noImage: 'No image selected',
  scan_scanBill: 'Scan Bill',
  scan_enterManually: 'Enter Manually',
  scan_tapRetry: 'Tap to retry',
  scan_analyzing: 'Analyzing bill...',
  scan_reading: 'Reading receipt...',
  scan_extracting: 'Extracting items...',
  scan_analyzeHint: 'This may take a few seconds',
  scan_readingHint: 'Understanding the receipt layout',
  scan_itemsFound: (n: number) => `${n} items found`,
  scan_reviewTitle: 'Review Items',
  scan_itemCount: (n: number) => `${n} items`,
  scan_restaurantPlaceholder: 'Restaurant name...',
  scan_tapToEdit: 'Tap to edit · Swipe left to delete',
  scan_itemName: 'Item name',
  scan_qty: 'Qty',
  scan_unitPrice: 'Unit Price',
  scan_subtotalLabel: 'Subtotal',
  scan_addItem: 'Add Item',
  scan_subtotal: 'Subtotal',
  scan_taxIva: 'Tax (IVA)',
  scan_tipPropina: 'Tip (Propina)',
  scan_total: 'Total',
  scan_confirmItems: 'Confirm Items',
  scan_saving: 'Saving...',
  scan_saveError: 'Failed to save bill. Please try again.',
  scan_discardTitle: 'Discard changes?',
  scan_discardMessage: "You have unsaved items. Leaving will discard your progress and you'll need to scan the bill again, which uses your available scans.",
  scan_keepEditing: 'Keep editing',
  scan_discard: 'Discard',
  scan_unnamed: 'Unnamed item',

  // Bill detail
  bill_subtotal: 'Subtotal',
  bill_tip: (pct: number) => `Tip (${pct}%)`,
  bill_total: 'Total',
  bill_country: 'Country',
  bill_deleteBill: 'Delete bill',
  bill_deleteConfirm: 'Are you sure? This cannot be undone.',
  bill_tapToEdit: 'Tap item to edit · Tap + to assign contact',
  bill_selected: (n: number) => `${n} selected`,
  bill_bulkEdit: 'Bulk edit',
  bill_deleteItems: 'Delete items',
  bill_deleteItemsConfirm: (n: number) => `Delete ${n} selected ${n === 1 ? 'item' : 'items'}?`,
  bill_permissionNeeded: 'Permission needed',
  bill_permissionContacts: 'Contact access is required to assign people to items.',
  bill_removeContact: 'Remove contact',
  bill_removeContactConfirm: 'Remove this person from the item?',
  bill_removeFromSelected: (name: string) => `Remove ${name} from selected items?`,
  bill_noContacts: 'No contacts',
  bill_noContactsOnItems: 'Selected items have no contacts assigned.',
  bill_confirmRemoval: 'Confirm removal',
  bill_removeMultipleConfirm: (n: number) => `Remove ${n} ${n === 1 ? 'contact' : 'contacts'} from selected items?`,
  bill_noPhone: 'No phone number',
  bill_noPhoneMessage: 'This contact has no phone number to send a message to.',
  bill_confirmItems: 'Confirm Items',

  // Sort
  sort_receipt: 'Receipt ↕',
  sort_priceDesc: 'Price ↓',
  sort_priceAsc: 'Price ↑',
  sort_alphaAsc: 'A→Z',
  sort_alphaDesc: 'Z→A',

  // Tip dialog
  tipDialog_title: 'Tip Percentage',

  // Country dialog
  countryDialog_title: 'Bill Country',

  // Share & Pay
  share_title: 'Share & Pay',
  share_button: (n: number) => `${n} ${n === 1 ? 'person' : 'people'} · Share & Pay`,
  share_paid: 'Paid',
  share_unpaid: 'Unpaid',
  share_whatsapp: 'WhatsApp',
  share_share: 'Share',

  // Contact picker
  contactPicker_title: 'Select Contacts',
  contactPicker_search: 'Search contacts...',
  contactPicker_assign: (n: number) => `Assign ${n} ${n === 1 ? 'contact' : 'contacts'}`,

  // Unassign picker
  unassignPicker_title: 'Remove Contacts',
  unassignPicker_itemsOnSelection: (n: number) => `${n} ${n === 1 ? 'item' : 'items'} on selection`,
  unassignPicker_remove: (n: number) => `Remove ${n} ${n === 1 ? 'contact' : 'contacts'}`,

  // Bulk toolbar
  bulk_assign: 'Assign',
  bulk_unassign: 'Unassign',
  bulk_delete: 'Delete',

  // Relative time
  time_justNow: 'just now',
  time_minutesAgo: (n: number) => `${n}m ago`,
  time_hoursAgo: (n: number) => `${n}h ago`,
  time_yesterday: 'yesterday',
  time_daysAgo: (n: number) => `${n}d ago`,
  time_photoAndBill: (time: string) => `Photo and bill from ${time}`,
  time_photoBill: (photo: string, bill: string) => `Photo ${photo} · Bill created ${bill}`,
  time_created: (time: string) => `Created ${time}`,

  // WhatsApp message
  wa_items: 'Your items:',
  wa_total: (amount: string) => `*Your total: ${amount}*`,
  wa_footer: 'Summary generated with the Rondas app',

  // Infographic
  infographic_billFor: 'Bill for',
  infographic_item: 'Item',
  infographic_amount: 'Amount',
  infographic_total: 'TOTAL',
  infographic_tagline: 'Split bills, not friendships',
  infographic_country: (country: string): string => country === 'CO' ? '🇨🇴 Colombia' : '🇺🇸 USA',
};
