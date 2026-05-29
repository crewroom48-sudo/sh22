/**
 * Shift Checklist — Standalone App.js  (+ AI Asistent)
 *
 * Works with:
 *  - Expo Snack  (paste directly, SDK 52+)
 *  - GitHub + Codemagic  (place at project root, npx expo start)
 *  - EAS Build / expo-dev-client
 *
 * Required packages:
 *   "expo-notifications": "~0.29.0"
 *   "@react-native-async-storage/async-storage": "^2.0.0"
 *   "@expo/vector-icons": "^14.0.0"
 *
 * app.json plugins: ["expo-notifications", { "sounds": [] }]
 *
 * CHANGES v2:
 *  - Fix: záporné čísla v tabuľke sú blokované
 *  - Fix: sendKuch/del sa neprepíšu keď ich edituješ priamo
 *  - KeyboardAvoidingView: obsah sa posunie nad klávesnicu
 *  - Sticky footer: "CREATED BY" lišta je vždy viditeľná na spodku
 *  - AI Settings UI: vylepšený dizajn so summary kartou
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Alert, Switch, Platform, Modal, StatusBar,
  KeyboardAvoidingView, Keyboard, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const EDIT_PASSWORD = '2587';
const ACCENT = '#FBBF24';
const DANGER = '#ef4444';
const SUCCESS = '#22c55e';

// ─── AsyncStorage keys ────────────────────────────────────────────────────────
const KEYS = {
  shared:            'shift_shared',
  morning_name:      'morning_manager_name',
  afternoon_name:    'afternoon_manager_name',
  morning_hours:     'morning_hours_worked',
  afternoon_hours:   'afternoon_hours_worked',
  morning_before:    'morning_before_checklist',
  morning_during:    'morning_during_checklist',
  morning_after:     'morning_after_checklist',
  morning_table:     'morning_table_data',
  morning_walk:      'morning_walk_times',
  afternoon_before:  'afternoon_before_checklist',
  afternoon_during:  'afternoon_during_checklist',
  afternoon_after:   'afternoon_after_checklist',
  afternoon_table:   'afternoon_table_data',
  afternoon_walk:    'afternoon_walk_times',
  checks:            'shift_checks',
  duringChecks:      'shift_during_checks',
  afterChecks:       'shift_after_checks',
  walkChecks:        'shift_walk_checks',
  morning_notes:     'morning_notes',
  afternoon_notes:   'afternoon_notes',
  password:          'shift_custom_password',
  notif_prefs:       'shift_notif_prefs',
  notif_times:       'shift_notif_times',
  shift_hours:       'shift_hours_config',
  handover:          'shift_handover_message',
  morning_section_vis:   'shift_morning_section_visibility',
  afternoon_section_vis: 'shift_afternoon_section_visibility',
  ai_prefs:          'shift_ai_prefs',
  morning_custom_cols:   'morning_custom_cols',
  afternoon_custom_cols: 'afternoon_custom_cols',
  annual_goals:      'shift_annual_goals',
  ai_notif_texts:    'shift_ai_notif_texts',
  ai_vision_key:    'shift_ai_vision_key',
  ai_scan_enabled:  'shift_ai_scan_enabled',
  ocr_api_key:      'shift_ocr_api_key',
  gemini_api_key:    'shift_gemini_api_key',
  scan_mode:         'shift_scan_mode',
  classic_notif_texts: 'shift_classic_notif_texts',
};

// ─── Base column definitions (order matters for table rendering) ───────────────
const BASE_COL_DEFS = [
  {id:'hour',         label:'Hod',        width:36,  field:'hour',         kind:'text'},
  {id:'salesPlan',    label:'Sales\nPlan', width:60,  field:'salesPlan',    kind:'numeric'},
  {id:'salesReality', label:'Sales\nReal', width:60,  field:'salesReality', kind:'numeric', bgFn:'salesPerf'},
  {id:'tcPlan',       label:'TC\nPlan',   width:60,  field:'tcPlan',       kind:'numeric'},
  {id:'tcReality',    label:'TC\nReal',   width:60,  field:'tcReality',    kind:'numeric', bgFn:'tcPerf'},
  {id:'avg',          label:'AVG',        width:40,  field:'avg',          kind:'computed'},
  {id:'mfy',          label:'MFY',        width:44,  field:'mfy',          kind:'numeric', special:true},
  {id:'r2p',          label:'R2P',        width:44,  field:'r2p',          kind:'numeric', bgFn:'r2pColor'},
  {id:'sendKuch',     label:'SEND',       width:44,  field:'sendKuch',     kind:'numeric'},
  {id:'del',          label:'Del',        width:44,  field:'del',          kind:'numeric'},
];

const DEFAULT_ANNUAL_GOALS = {
  avgTarget:    58,
  tcHourTarget: 6,
  r2pAnnual:    135,
  forecastEnabled: false,
};

const DEFAULT_NOTIF_TEXTS = {
  preRush:     'Sales Plan: {plan}€ — Skontroluj Kuchyňu, Servis, Loby a či ľudia sú tam kde majú byť.',
  strongest:   'Sales Plan: {plan}€ — Maximálna pozornosť, ideš mať vrchol zmeny!',
  weakest:     'Sales Plan: {plan}€ — Zváž špeciálky alebo promo akciu.',
  behind:      'Real: {real}€ / Plan: {plan}€ — Zváž: pustiť niekoho domov / špeciálky / promo.',
  ahead:       'Real: {real}€ / Plan: {plan}€ — Skvelé tempo, pokračuj!',
  deficit2:    'Každá hodina −{perHour}€+ oproti plánu. Zváž:\n• Pustiť ľudí domov\n• Spustiť špeciálky / promo\n• Tréning pre tím počas kľudu',
  deficit3:    'Celkový deficit: −{total}€. Okamžite eskaluj manažérovi alebo spusti promo!',
  r2pBad:      'R2P: {r2p}s (cieľ {target}s) | Sales {real}€ / Plan {plan}€ — Treba na tom pracovať: rýchlosť obsluhy aj tržby.',
  forecast:    'Predp. produktivita: {prod}€/TC (cieľ {target}€/TC) | TC/hod: {tcHour} (cieľ {tcTarget}). Zváž: pustiť domov / trénovať stanoviská / špeciálky.',
};


const DEFAULT_CLASSIC_NOTIF_TEXTS = {
  morningPrepTitle:    'Ranná zmena začína!',
  morningPrepBody:     'Checklist pred zmenou ešte nie je dokončený!',
  afternoonPrepTitle:  'Obedná zmena začína!',
  afternoonPrepBody:   'Checklist pred zmenou ešte nie je dokončený!',
  morningTableTitle:   'Nevypísal si hodinu {hour}:00',
  morningTableBody:    'Sales Real alebo TC Real nie je vyplnené!',
  afternoonTableTitle: 'Nevypísal si hodinu {hour}:00',
  afternoonTableBody:  'Sales Real alebo TC Real nie je vyplnené!',
};

// ─── Default checklist content ────────────────────────────────────────────────
const DEFAULT_MORNING_BEFORE = [
  'Ľudia na zmenu naplánované a príslušní vedúci informovaný?',
  'Skontrolované doby spotreby? (Kuchyňa, servis,cafe)',
  'Ciele zmeny nadefinované a komunikované ?',
  'BTO tabuľky navážania vyplnené?',
  'Kontrola deaktivovaných produktov?',
  'Loby je čiste ? (parapety, paravany a stanice)',
  'E-production nastavená ?',
  'FIFO a FSA. (sklady zodpovedajú štandardu)',
  'Zariadenia sú funkčné?',
  'Uniformy zamestnancov (Zamestnanci sú upravený)',
];
const DEFAULT_MORNING_DURING = [
  'Kontrola raňajok (Prechod)',
  'Kuchyňa aj servis navozené? (Pred špičkou)',
  'HACCP kontroly vykonané?',
];
const DEFAULT_MORNING_AFTER = [
  'Podstatné informácie predané ďalšiemu shiftovy',
  'Ciele vyhodnotené a komunikované s vedúcimi zón?',
  'Tabuľka vyhodnotenie zmeny vyplnená?',
  'Depozit a odvod spravený ?',
  'Tréning + verifikácie v tabuľke vyhodnotené?',
  'Kancelária je čistá, poriadená?',
];
const DEFAULT_AFTERNOON_BEFORE = [
  'Ľudia na zmenu naplánované a príslušní vedúci informovaný?',
  'Skontrolované doby spotreby? (Kuchyňa, servis,cafe)',
  'Ciele zmeny nadefinované a komunikované ?',
  'BTO tabuľky navážania vyplnené?',
  'Kontrola deaktivovaných produktov?',
  'Prebraté shift kľúče aj trezor? (Podpísať v knižke)',
  'E-production nastavená ?',
  'FIFO a FSA. (sklady zodpovedajú štandardu)',
  'Funkčné zariadenia ?',
  'Uniformy zamestnancov (Zamestnanci sú upravený)',
];
const DEFAULT_AFTERNOON_DURING = [
  'Hodinové vyhodnocovanie ukazovateľov',
  'Kuchyňa aj servis navozené? (Pred špičkou)',
  'HACCP kontroly vykonané?',
];
const DEFAULT_AFTERNOON_AFTER = [
  'Ciele vyhodnotené a komunikované s vedúcimi zón?',
  'Vyvozené priručné mrazničky?',
  'Tabuľka vyhodnotenie zmeny vyplnená?',
  'Kávovar vyčistení ? (Aj tesnenia)',
  'Tréning + verifikácie v tabuľke vyhodnotené?',
  'Kancelária je čistá, poriadená?',
];

const MORNING_HOURS   = ['08','09','10','11','12','13','14'];
const AFTERNOON_HOURS = ['15','16','17','18','19','20'];

const mkRows = (hours) =>
  hours.map((h) => ({ hour:h, salesPlan:'', salesReality:'', tcPlan:'', tcReality:'', mfy:'', r2p:'', sendKuch:'', del:'' }));

// ─── AI preferences defaults ──────────────────────────────────────────────────
const DEFAULT_AI_PREFS = {
  enabled:           true,
  strongestHour:     true,
  weakestHour:       true,
  preRush:           true,
  preRushMinutes:    10,
  behindPlan:        true,
  aheadPlan:         true,
  trendAlert:        true,
  tcMonitor:         true,
  cumulativeTracker: true,
  showBestWorstRow:  true,
  dailyComparison:   true,
  r2pMonitor:        true,
  r2pTarget:         135,
  kitchenCheck:      true,
  behindThreshold:   90,
  aheadThreshold:    110,
  staffingAdvisor:   false,
  endOfShiftProjection: false,
  aiAlertMinutes:    2,
};

// ─── Daily history key ────────────────────────────────────────────────────────
const DAILY_HISTORY_KEY = 'shift_daily_history';

// ─────────────────────────────────────────────────────────────────────────────
export default function ShiftChecklistScreen() {
  const isInitialized = React.useRef(false);

  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2,'0')}.${(today.getMonth()+1).toString().padStart(2,'0')}.${today.getFullYear()}`;

  // ── Shared state ────────────────────────────────────────────────────────────
  const [shiftType,           setShiftType]           = useState('morning');
  const [morningName,         setMorningName]         = useState('');
  const [afternoonName,       setAfternoonName]       = useState('');
  const [morningHoursWorked,  setMorningHoursWorked]  = useState('');
  const [afternoonHoursWorked,setAfternoonHoursWorked]= useState('');
  const [morningNotes,        setMorningNotes]        = useState('');
  const [afternoonNotes,      setAfternoonNotes]      = useState('');
  const [darkMode,            setDarkMode]            = useState(false);
  const [showSettings,        setShowSettings]        = useState(false);
  const [showPinModal,        setShowPinModal]        = useState(false);
  const [pinInput,            setPinInput]            = useState('');
  const [pinError,            setPinError]            = useState(false);
  const [editingEnabled,      setEditingEnabled]      = useState(false);
  const [sekTab,               setSekTab]               = useState('morning');
  const [sekciEditEnabled,      setSekciEditEnabled]      = useState(false);
  const [showSekciPin,          setShowSekciPin]          = useState(false);
  const [sekciPinInput,         setSekciPinInput]         = useState('');
  const [sekciPinError,         setSekciPinError]         = useState(false);
  const [customPassword,      setCustomPassword]      = useState('');
  const [showChangePw,        setShowChangePw]        = useState(false);
  const [cpCurrent,           setCpCurrent]           = useState('');
  const [cpNew,               setCpNew]               = useState('');
  const [cpConfirm,           setCpConfirm]           = useState('');
  const [showCpCurrent,       setShowCpCurrent]       = useState(false);
  const [showCpNew,           setShowCpNew]           = useState(false);
  const [showCpConfirm,       setShowCpConfirm]       = useState(false);
  const [aiSettingsUnlocked, setAiSettingsUnlocked] = useState(false);
  const [showAiPinModal,    setShowAiPinModal]    = useState(false);
  const [aiPinInput,         setAiPinInput]         = useState('');
  const [aiPinError,         setAiPinError]         = useState(false);

  // ── Handover message ─────────────────────────────────────────────────────────
  const [handoverDraft,       setHandoverDraft]       = useState('');
  const [handoverSaved,       setHandoverSaved]       = useState(false);
  const [showHandoverPopup,   setShowHandoverPopup]   = useState(false);
  const [handoverPopupMsgs,   setHandoverPopupMsgs]   = useState([]);

  // ── Notification preferences ─────────────────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState({
    morningPrep:    true,
    morningTable:   true,
    afternoonPrep:  true,
    afternoonTable: true,
  });

  // ── Notification times ────────────────────────────────────────────────────────
  const [notifTimes, setNotifTimes] = useState({
    morningPrepHour:    8,
    morningPrepMinute:  1,
    afternoonPrepHour:  15,
    afternoonPrepMinute:1,
    tableMinute:        16,
  });

  // ── Shift hours config ───────────────────────────────────────────────────────
  const [shiftHours, setShiftHours] = useState({
    morningStart:   8,
    morningEnd:     14,
    afternoonStart: 15,
    afternoonEnd:   20,
  });

  // ── AI preferences ────────────────────────────────────────────────────────────
  const [aiPrefs, setAiPrefs] = useState(DEFAULT_AI_PREFS);
  const [aiSec, setAiSec] = useState({spicka:false, vykon:false, r2p:false, dalse:false});
  const [aiCollapse, setAiCollapse] = useState({casovanie:false, prahy:false, rocne:false, skenu:false, texty:false, heslo:false});
  const [keyboardVisible,  setKeyboardVisible]  = useState(false);
  const [settingsCatSec,   setSettingsCatSec]   = useState({ai: false, notif: false, zmena: false});

  // ── Keyboard visibility ────────────────────────────────────────────────────
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ── Custom table columns ──────────────────────────────────────────────────────
  const [morningCustomCols,   setMorningCustomCols]   = useState([]);
  const [afternoonCustomCols, setAfternoonCustomCols] = useState([]);
  const [showAddColModal,     setShowAddColModal]     = useState(false);
  const [newColLabel,         setNewColLabel]         = useState('');
  const [addColShift,         setAddColShift]         = useState('morning');
  const [addColPosition,      setAddColPosition]      = useState('del');

  // ── Annual goals ─────────────────────────────────────────────────────────────
  const [annualGoals, setAnnualGoals] = useState(DEFAULT_ANNUAL_GOALS);

  // ── Notification body text templates ─────────────────────────────────────────
  const [aiNotifTexts,   setAiNotifTexts]   = useState(DEFAULT_NOTIF_TEXTS);
  const [classicNotifTexts, setClassicNotifTexts] = useState(DEFAULT_CLASSIC_NOTIF_TEXTS);
  const [editingNotifKey, setEditingNotifKey] = useState(null);
  const [editingClassicKey, setEditingClassicKey] = useState(null);
  const [notifResetTick, setNotifResetTick] = useState(0);
  // ── AI Vision (photo scan) ───────────────────────────────────────────────
  const [aiVisionKey,       setAiVisionKey]       = useState('');
  const [showPhotoScanModal, setShowPhotoScanModal] = useState(false);
  const [aiPhotoLoading,    setAiPhotoLoading]    = useState(false);
  const [photoScanStatus,   setPhotoScanStatus]   = useState('');
  const [aiScanEnabled,     setAiScanEnabled]     = useState(true);
  const [scanRealEnabled,  setScanRealEnabled]  = useState(true); // skry/zobraz 'Naskenuj Reál'
  const [ocrApiKey,         setOcrApiKey]         = useState('');

  const [geminiApiKey,     setGeminiApiKey]     = useState('');
  const [scanMode,          setScanMode]         = useState('ocr');
  // ── Section visibility ───────────────────────────────────────────────────────
  const DEFAULT_SECTION_VIS = {
    beforeShift:  true,
    duringShift:  true,
    walkthrough:  true,
    table:        true,
    hours:        true,
    productivity: true,
    evaluation:   true,
    notes:        true,
    handover:     true,
    afterShift:   true,
  };
  const [morningSectionVis, setMorningSectionVis] = useState(DEFAULT_SECTION_VIS);
  const [afternoonSectionVis, setAfternoonSectionVis] = useState(DEFAULT_SECTION_VIS);

  // ── Countdown timer ──────────────────────────────────────────────────────────
  // const [timeLeft, setTimeLeft] = useState('');  // odstránené
  // const [shiftEnded, setShiftEnded] = useState(false);  // odstránené

  // ── Checkbox states ──────────────────────────────────────────────────────────
  const [checks,       setChecks]       = useState({});
  const [duringChecks, setDuringChecks] = useState({});
  const [afterChecks,  setAfterChecks]  = useState({});
  const [walkChecks,   setWalkChecks]   = useState({});

  // ── Morning shift state ──────────────────────────────────────────────────────
  const [morningBefore, setMorningBefore] = useState(DEFAULT_MORNING_BEFORE);
  const [morningDuring, setMorningDuring] = useState(DEFAULT_MORNING_DURING);
  const [morningAfter,  setMorningAfter]  = useState(DEFAULT_MORNING_AFTER);
  const [morningTable,  setMorningTable]  = useState(() => mkRows(MORNING_HOURS));
  const [morningWalk,   setMorningWalk]   = useState(() => MORNING_HOURS.map(h => `${h}:00`));

  // ── Afternoon shift state ────────────────────────────────────────────────────
  const [afternoonBefore, setAfternoonBefore] = useState(DEFAULT_AFTERNOON_BEFORE);
  const [afternoonDuring, setAfternoonDuring] = useState(DEFAULT_AFTERNOON_DURING);
  const [afternoonAfter,  setAfternoonAfter]  = useState(DEFAULT_AFTERNOON_AFTER);
  const [afternoonTable,  setAfternoonTable]  = useState(() => mkRows(AFTERNOON_HOURS));
  const [afternoonWalk,   setAfternoonWalk]   = useState(() => AFTERNOON_HOURS.map(h => `${h}:00`));

  // ── Dynamic hour lists from settings ────────────────────────────────────────
  const morningHoursList = React.useMemo(() => {
    const s = shiftHours.morningStart, e = shiftHours.morningEnd;
    if (e < s) return [];
    return Array.from({length: e - s + 1}, (_, i) => String(s + i).padStart(2,'0'));
  }, [shiftHours.morningStart, shiftHours.morningEnd]);

  const afternoonHoursList = React.useMemo(() => {
    const s = shiftHours.afternoonStart, e = shiftHours.afternoonEnd;
    if (e < s) return [];
    return Array.from({length: e - s + 1}, (_, i) => String(s + i).padStart(2,'0'));
  }, [shiftHours.afternoonStart, shiftHours.afternoonEnd]);

  // ── Derived: active shift shortcuts ─────────────────────────────────────────
  const isMorning    = shiftType === 'morning';
  const checklist    = isMorning ? morningBefore       : afternoonBefore;
  const duringList   = isMorning ? morningDuring       : afternoonDuring;
  const afterList    = isMorning ? morningAfter        : afternoonAfter;
  const tableData    = isMorning ? morningTable        : afternoonTable;
  const walkTimes    = isMorning ? morningWalk         : afternoonWalk;
  const currentHours = isMorning ? morningHoursList    : afternoonHoursList;
  const prefix       = shiftType;

  const name         = isMorning ? morningName         : afternoonName;
  const setName      = isMorning ? setMorningName      : setAfternoonName;
  const hoursWorked  = isMorning ? morningHoursWorked  : afternoonHoursWorked;
  const setHoursWorked = isMorning ? setMorningHoursWorked : setAfternoonHoursWorked;

  const setChecklist  = (v) => isMorning ? setMorningBefore(v)  : setAfternoonBefore(v);
  const sectionVisibility    = isMorning ? morningSectionVis    : afternoonSectionVis;
  const setSectionVisibility = isMorning ? setMorningSectionVis : setAfternoonSectionVis;
  const setDuringList = (v) => isMorning ? setMorningDuring(v)  : setAfternoonDuring(v);
  const setAfterList  = (v) => isMorning ? setMorningAfter(v)   : setAfternoonAfter(v);
  const setTableData  = (v) => isMorning ? setMorningTable(v)   : setAfternoonTable(v);
  const setWalkTimes  = (v) => isMorning ? setMorningWalk(v)    : setAfternoonWalk(v);
  const notes         = isMorning ? morningNotes    : afternoonNotes;
  const setNotes      = isMorning ? setMorningNotes : setAfternoonNotes;
  const customCols    = isMorning ? morningCustomCols    : afternoonCustomCols;
  const setCustomCols = (v) => isMorning ? setMorningCustomCols(v) : setAfternoonCustomCols(v);

  // ── Load on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted')
          Alert.alert('Upozornenie','Notifikácie nie sú povolené. Zapni ich v nastaveniach telefónu.');
      }
      if (Platform.OS === 'android') {
        await Notifications.deleteNotificationChannelAsync('default');
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Shift Checklist',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FBBF24',
          sound: 'default',
          enableVibrate: true,
          showBadge: false,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
      await loadAll();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAll = async () => {
    try {
      const load = async (key, fallback) => {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      };

      const shared = await load(KEYS.shared, {});
      setDarkMode(shared.darkMode || false);
      setShiftType(shared.shiftType || 'morning');

      const mname = await AsyncStorage.getItem(KEYS.morning_name);
      if (mname !== null) setMorningName(mname);
      const aname = await AsyncStorage.getItem(KEYS.afternoon_name);
      if (aname !== null) setAfternoonName(aname);
      const mhrs = await AsyncStorage.getItem(KEYS.morning_hours);
      if (mhrs !== null) setMorningHoursWorked(mhrs);
      const ahrs = await AsyncStorage.getItem(KEYS.afternoon_hours);
      if (ahrs !== null) setAfternoonHoursWorked(ahrs);

      setChecks(      await load(KEYS.checks,       {}));
      setDuringChecks(await load(KEYS.duringChecks, {}));
      setAfterChecks( await load(KEYS.afterChecks,  {}));
      setWalkChecks(  await load(KEYS.walkChecks,   {}));

      setMorningBefore(await load(KEYS.morning_before, DEFAULT_MORNING_BEFORE));
      setMorningDuring(await load(KEYS.morning_during, DEFAULT_MORNING_DURING));
      setMorningAfter( await load(KEYS.morning_after,  DEFAULT_MORNING_AFTER));
      const mt = await load(KEYS.morning_table, null);
      if (mt && mt.length) setMorningTable(mt);
      const mw = await load(KEYS.morning_walk, null);
      if (mw && mw.length) setMorningWalk(mw);

      setAfternoonBefore(await load(KEYS.afternoon_before, DEFAULT_AFTERNOON_BEFORE));
      setAfternoonDuring(await load(KEYS.afternoon_during, DEFAULT_AFTERNOON_DURING));
      setAfternoonAfter( await load(KEYS.afternoon_after,  DEFAULT_AFTERNOON_AFTER));
      const at = await load(KEYS.afternoon_table, null);
      if (at && at.length) setAfternoonTable(at);
      const aw = await load(KEYS.afternoon_walk, null);
      if (aw && aw.length) setAfternoonWalk(aw);

      const mn = await AsyncStorage.getItem(KEYS.morning_notes);
      if (mn !== null) setMorningNotes(mn);
      const an = await AsyncStorage.getItem(KEYS.afternoon_notes);
      if (an !== null) setAfternoonNotes(an);

      const pw = await AsyncStorage.getItem(KEYS.password);
      if (pw) setCustomPassword(pw);

      const np = await load(KEYS.notif_prefs, {morningPrep:true,morningTable:true,afternoonPrep:true,afternoonTable:true});
      setNotifPrefs(np);

      const nt = await load(KEYS.notif_times, {morningPrepHour:8,morningPrepMinute:1,afternoonPrepHour:15,afternoonPrepMinute:1,tableMinute:16});
      setNotifTimes(nt);

      const sh = await load(KEYS.shift_hours, {morningStart:8,morningEnd:14,afternoonStart:15,afternoonEnd:20});
      setShiftHours(sh);

      const ap = await load(KEYS.ai_prefs, DEFAULT_AI_PREFS);
      setAiPrefs({...DEFAULT_AI_PREFS, ...ap});

      const mcc = await load(KEYS.morning_custom_cols, []);
      if (Array.isArray(mcc)) setMorningCustomCols(mcc);
      const acc = await load(KEYS.afternoon_custom_cols, []);
      if (Array.isArray(acc)) setAfternoonCustomCols(acc);

      const ag = await load(KEYS.annual_goals, DEFAULT_ANNUAL_GOALS);
      setAnnualGoals({...DEFAULT_ANNUAL_GOALS, ...ag});
      const ant = await load(KEYS.ai_notif_texts, DEFAULT_NOTIF_TEXTS);
      setAiNotifTexts({...DEFAULT_NOTIF_TEXTS, ...ant});
      const cnt = await load(KEYS.classic_notif_texts, DEFAULT_CLASSIC_NOTIF_TEXTS);
      setClassicNotifTexts({...DEFAULT_CLASSIC_NOTIF_TEXTS, ...cnt});
      const avk = await AsyncStorage.getItem(KEYS.ai_vision_key);
      if (avk) setAiVisionKey(avk);
      const ase = await AsyncStorage.getItem(KEYS.ai_scan_enabled);
      if (ase !== null) setAiScanEnabled(JSON.parse(ase));
      const sre = await AsyncStorage.getItem(KEYS.scan_real_enabled);
      if (sre !== null) setScanRealEnabled(JSON.parse(sre));
      const oak = await AsyncStorage.getItem(KEYS.ocr_api_key);
      if (oak !== null) setOcrApiKey(oak);
      const gmk = await AsyncStorage.getItem(KEYS.gemini_api_key);
      if (gmk !== null) setGeminiApiKey(gmk);
      const sm = await AsyncStorage.getItem(KEYS.scan_mode);
      if (sm !== null) setScanMode(sm);

      const DEFAULT_SV = {beforeShift:true,duringShift:true,walkthrough:true,table:true,hours:true,productivity:true,evaluation:true,notes:true,handover:true,afterShift:true};
      const msv = await load(KEYS.morning_section_vis, DEFAULT_SV);
      setMorningSectionVis(msv);
      const asv = await load(KEYS.afternoon_section_vis, DEFAULT_SV);
      setAfternoonSectionVis(asv);

      const hmRaw = await AsyncStorage.getItem(KEYS.handover);
      if (hmRaw) {
        try {
          const list = JSON.parse(hmRaw);
          setHandoverPopupMsgs(Array.isArray(list) ? list : [{text: hmRaw, time: ''}]);
        } catch { setHandoverPopupMsgs([{text: hmRaw, time: ''}]); }
        setShowHandoverPopup(true);
      }

    } catch (e) { console.log('loadAll error:', e); }
    isInitialized.current = true;
    if (Platform.OS !== 'web') {
      setTimeout(() => scheduleAllNotifications(), 500);
    }
  };

  // ── Autosave ─────────────────────────────────────────────────────────────────
  const save = (key, value) => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(console.log);
  };

  useEffect(() => { save(KEYS.shared, { darkMode, shiftType }); }, [darkMode, shiftType]);
  useEffect(() => { save(KEYS.notif_prefs, notifPrefs); }, [notifPrefs]);
  useEffect(() => { save(KEYS.notif_times, notifTimes); if (isInitialized.current && Platform.OS !== 'web') debouncedSchedule(); }, [notifTimes]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { save(KEYS.shift_hours, shiftHours); }, [shiftHours]);
  useEffect(() => { save(KEYS.ai_prefs, aiPrefs); if (isInitialized.current && Platform.OS !== 'web') debouncedSchedule(); }, [aiPrefs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(KEYS.morning_name,    morningName).catch(console.log);
  }, [morningName]);
  useEffect(() => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(KEYS.afternoon_name,  afternoonName).catch(console.log);
  }, [afternoonName]);
  useEffect(() => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(KEYS.morning_hours,   morningHoursWorked).catch(console.log);
  }, [morningHoursWorked]);
  useEffect(() => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(KEYS.afternoon_hours, afternoonHoursWorked).catch(console.log);
  }, [afternoonHoursWorked]);

  useEffect(() => { save(KEYS.checks,       checks);       }, [checks]);
  useEffect(() => { save(KEYS.duringChecks, duringChecks); }, [duringChecks]);
  useEffect(() => { save(KEYS.afterChecks,  afterChecks);  }, [afterChecks]);
  useEffect(() => { save(KEYS.walkChecks,   walkChecks);   }, [walkChecks]);
  useEffect(() => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(KEYS.morning_notes,   morningNotes).catch(console.log);
  }, [morningNotes]);
  useEffect(() => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(KEYS.afternoon_notes, afternoonNotes).catch(console.log);
  }, [afternoonNotes]);
  useEffect(() => { if (isInitialized.current) AsyncStorage.setItem(KEYS.ai_vision_key, aiVisionKey).catch(()=>{}); }, [aiVisionKey]);
  useEffect(() => { if (isInitialized.current) AsyncStorage.setItem(KEYS.ai_scan_enabled, JSON.stringify(aiScanEnabled)).catch(()=>{}); }, [aiScanEnabled]);
  useEffect(() => { if (isInitialized.current) AsyncStorage.setItem(KEYS.scan_real_enabled, JSON.stringify(scanRealEnabled)).catch(()=>{}); }, [scanRealEnabled]);
  useEffect(() => { if (isInitialized.current) AsyncStorage.setItem(KEYS.ocr_api_key, ocrApiKey).catch(()=>{}); }, [ocrApiKey]);
  useEffect(() => { if (isInitialized.current) AsyncStorage.setItem(KEYS.gemini_api_key, geminiApiKey).catch(()=>{}); }, [geminiApiKey]);
  useEffect(() => { if (isInitialized.current) AsyncStorage.setItem(KEYS.scan_mode, scanMode).catch(()=>{}); }, [scanMode]);

  useEffect(() => { save(KEYS.morning_before, morningBefore); }, [morningBefore]);
  useEffect(() => { save(KEYS.morning_during, morningDuring); }, [morningDuring]);
  useEffect(() => { save(KEYS.morning_after,  morningAfter);  }, [morningAfter]);
  useEffect(() => { save(KEYS.morning_table,  morningTable);  }, [morningTable]);
  useEffect(() => { save(KEYS.morning_walk,   morningWalk);   }, [morningWalk]);

  useEffect(() => { save(KEYS.afternoon_before, afternoonBefore); }, [afternoonBefore]);
  useEffect(() => { save(KEYS.afternoon_during, afternoonDuring); }, [afternoonDuring]);
  useEffect(() => { save(KEYS.afternoon_after,  afternoonAfter);  }, [afternoonAfter]);
  useEffect(() => { save(KEYS.afternoon_table,  afternoonTable);  }, [afternoonTable]);
  useEffect(() => { save(KEYS.afternoon_walk,   afternoonWalk);   }, [afternoonWalk]);
  useEffect(() => { save(KEYS.morning_section_vis,   morningSectionVis);   }, [morningSectionVis]);
  useEffect(() => { save(KEYS.afternoon_section_vis, afternoonSectionVis); }, [afternoonSectionVis]);
  useEffect(() => { save(KEYS.morning_custom_cols,   morningCustomCols);   }, [morningCustomCols]);
  useEffect(() => { save(KEYS.afternoon_custom_cols, afternoonCustomCols); }, [afternoonCustomCols]);
  useEffect(() => { save(KEYS.annual_goals,   annualGoals);   }, [annualGoals]);
  useEffect(() => { save(KEYS.ai_notif_texts, aiNotifTexts);  }, [aiNotifTexts]);
  useEffect(() => { save(KEYS.classic_notif_texts, classicNotifTexts); if (isInitialized.current && Platform.OS !== 'web') debouncedSchedule(); }, [classicNotifTexts]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync table & walk when morning hours change ──────────────────────────────
  useEffect(() => {
    if (!isInitialized.current) return;
    setMorningTable(prev =>
      morningHoursList.map(h => prev.find(r => r.hour === h) || mkRows([h])[0])
    );
    setMorningWalk(prev => {
      const oldMap = {};
      prev.forEach(t => { const h = t.substring(0, 2); oldMap[h] = t; });
      return morningHoursList.map(h => oldMap[h] !== undefined ? oldMap[h] : `${h}:00`);
    });
  }, [JSON.stringify(morningHoursList)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync table & walk when afternoon hours change ─────────────────────────
  useEffect(() => {
    if (!isInitialized.current) return;
    setAfternoonTable(prev =>
      afternoonHoursList.map(h => prev.find(r => r.hour === h) || mkRows([h])[0])
    );
    setAfternoonWalk(prev => {
      const oldMap = {};
      prev.forEach(t => { const h = t.substring(0, 2); oldMap[h] = t; });
      return afternoonHoursList.map(h => oldMap[h] !== undefined ? oldMap[h] : `${h}:00`);
    });
  }, [JSON.stringify(afternoonHoursList)]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown timer effect ────────────────────────────────────────────────────
  // ── Countdown timer effect ODSTRÁNENÝ ─────────────────────────────────
  // Pôvodne tu bol setInterval(tick, 1000) ktorý zapríčiňoval re-render celej
  // obrazovky každú sekundu. Timer + JSX boli odstránené pre úsporu CPU/batérie.

  // ── Handover save ────────────────────────────────────────────────────────────
  const saveHandover = async () => {
    if (!handoverDraft.trim()) return;
    const raw = await AsyncStorage.getItem(KEYS.handover);
    let list = [];
    if (raw) { try { list = JSON.parse(raw); if (!Array.isArray(list)) list = [{text: raw, time: ''}]; } catch { list = [{text: raw, time: ''}]; } }
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    list.push({ text: handoverDraft.trim(), time });
    await AsyncStorage.setItem(KEYS.handover, JSON.stringify(list));
    setHandoverDraft('');
    setHandoverSaved(true);
    setTimeout(() => setHandoverSaved(false), 2500);
  };

  const loadHandoverMsgs = async () => {
    const raw = await AsyncStorage.getItem(KEYS.handover);
    if (!raw) return [];
    try { const l = JSON.parse(raw); return Array.isArray(l) ? l : [{text: raw, time: ''}]; }
    catch { return [{text: raw, time: ''}]; }
  };

  const switchShift = async (t) => {
    if (t === shiftType) return;
    setShiftType(t);
    const list = await loadHandoverMsgs();
    if (list.length) { setHandoverPopupMsgs(list); setShowHandoverPopup(true); }
  };

  const viewHandover = async () => {
    const list = await loadHandoverMsgs();
    if (list.length) { setHandoverPopupMsgs(list); setShowHandoverPopup(true); }
  };

  const deleteHandoverMsg = async (idx) => {
    const updated = handoverPopupMsgs.filter((_, i) => i !== idx);
    setHandoverPopupMsgs(updated);
    if (updated.length === 0) {
      await AsyncStorage.removeItem(KEYS.handover);
      setShowHandoverPopup(false);
    } else {
      await AsyncStorage.setItem(KEYS.handover, JSON.stringify(updated));
    }
  };

  // ── Notifications ─────────────────────────────────────────────────────────────
  const scheduleDebounceTimer = React.useRef(null);

  const debouncedSchedule = () => {
    if (!isInitialized.current) return;
    if (Platform.OS === 'web') return;
    if (scheduleDebounceTimer.current) clearTimeout(scheduleDebounceTimer.current);
    scheduleDebounceTimer.current = setTimeout(() => scheduleAllNotifications(), 1000);
  };

  useEffect(() => {
    if (!isInitialized.current) return;
    if (Platform.OS !== 'web') debouncedSchedule();
  }, [checks, morningTable, afternoonTable, morningBefore, afternoonBefore]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Daily history helpers ─────────────────────────────────────────────────────
  const saveDailyHistory = async (table, shiftName) => {
    try {
      const rowsWithBoth = table.filter(r => parseFloat(r.salesPlan) > 0 && parseFloat(r.salesReality) > 0);
      if (!rowsWithBoth.length) return;
      const totalPlan = rowsWithBoth.reduce((s, r) => s + (parseFloat(r.salesPlan) || 0), 0);
      const totalReal = rowsWithBoth.reduce((s, r) => s + (parseFloat(r.salesReality) || 0), 0);
      const totalTcPlan = rowsWithBoth.reduce((s, r) => s + (parseFloat(r.tcPlan) || 0), 0);
      const totalTcReal = rowsWithBoth.reduce((s, r) => s + (parseFloat(r.tcReality) || 0), 0);
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const raw = await AsyncStorage.getItem(DAILY_HISTORY_KEY);
      const history = raw ? JSON.parse(raw) : {};
      history[`${dateKey}_${shiftName}`] = { dateKey, shiftName, totalPlan, totalReal, totalTcPlan, totalTcReal, pct: Math.round((totalReal/totalPlan)*100), ts: Date.now() };
      // Keep only last 14 days (28 entries = 14 days × 2 shifts)
      const keys = Object.keys(history).sort((a,b) => (history[b].ts||0) - (history[a].ts||0));
      if (keys.length > 28) keys.slice(28).forEach(k => delete history[k]);
      await AsyncStorage.setItem(DAILY_HISTORY_KEY, JSON.stringify(history));
    } catch(e) { console.log('saveDailyHistory error:', e); }
  };

  const loadYesterdayEntry = async (shiftName) => {
    try {
      const raw = await AsyncStorage.getItem(DAILY_HISTORY_KEY);
      if (!raw) return null;
      const history = JSON.parse(raw);
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const dateKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
      return history[`${dateKey}_${shiftName}`] || null;
    } catch { return null; }
  };

  // ── AI notifications ──────────────────────────────────────────────────────────
  const scheduleAiNotifications = async (table, shiftName) => {
    if (!aiPrefs.enabled || Platform.OS === 'web') return;
    try {
      const now = new Date();
      const todayAt = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
      const secsUntil = (fireAt) => {
        const s = Math.round((fireAt.getTime() - now.getTime()) / 1000);
        return s > 0 ? s : null;
      };
      const makeTrigger = (fireAt) => ({
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: 'default',
      });
      const sched = async (id, title, body, fireAt) => {
        if (secsUntil(fireAt) === null) return;
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: { title, body, sound: 'default' },
          trigger: makeTrigger(fireAt),
        });
      };
      const tpl = (k, vars = {}) => {
        let t = (aiNotifTexts[k] || DEFAULT_NOTIF_TEXTS[k] || '');
        Object.entries(vars).forEach(([key, val]) => { t = t.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val)); });
        return t;
      };

      const rowsWithPlan = table.filter(r => parseFloat(r.salesPlan) > 0);
      if (!rowsWithPlan.length) return;

      let strongestRow = rowsWithPlan[0];
      let weakestRow   = rowsWithPlan[0];
      for (const r of rowsWithPlan) {
        if (parseFloat(r.salesPlan) > parseFloat(strongestRow.salesPlan)) strongestRow = r;
        if (parseFloat(r.salesPlan) < parseFloat(weakestRow.salesPlan))   weakestRow   = r;
      }

      const behindThr = (aiPrefs.behindThreshold ?? 90) / 100;
      const aheadThr  = (aiPrefs.aheadThreshold  ?? 110) / 100;
      const tblMin    = notifTimes.tableMinute ?? 16;
      const alertMin  = Math.min((aiPrefs.aiAlertMinutes ?? 2), 59);

      if (aiPrefs.preRush && strongestRow) {
        const h = parseInt(strongestRow.hour);
        if (!isNaN(h)) {
          const rushMin = aiPrefs.preRushMinutes ?? 10;
          const totalMin = h * 60 - rushMin;
          const fireAt = todayAt(Math.floor(totalMin / 60), ((totalMin % 60) + 60) % 60);
          await sched(
            `ai_prerush_${shiftName}`,
            `⏰ Za ${rushMin} min najsilnejšia hodina! (${strongestRow.hour}:00)`,
            tpl('preRush', {plan: strongestRow.salesPlan, hours: rushMin}),
            fireAt,
          );
        }
      }

      if (aiPrefs.strongestHour && strongestRow) {
        const h = parseInt(strongestRow.hour);
        if (!isNaN(h)) {
          const kitchenMsg = aiPrefs.kitchenCheck ? ' Skontroluj si kuchyňu, servis a loby.' : '';
          await sched(
            `ai_strongest_${shiftName}`,
            '💪 Ideš mať najsilnejšiu hodinu!',
            tpl('strongest', {plan: strongestRow.salesPlan}) + kitchenMsg,
            todayAt(h, 0),
          );
        }
      }

      if (aiPrefs.weakestHour && weakestRow && weakestRow.hour !== strongestRow.hour) {
        const h = parseInt(weakestRow.hour);
        if (!isNaN(h)) {
          await sched(
            `ai_weakest_${shiftName}`,
            '📉 Ideš do slabšej hodiny',
            tpl('weakest', {plan: weakestRow.salesPlan}),
            todayAt(h, 0),
          );
        }
      }

      let consecutiveDeficitHours = 0;
      let consecutiveDeficitTotal = 0;
      let consecutiveAhead        = 0;
      let runningPlan = 0;
      let runningReal = 0;
      const DEFICIT_PER_HOUR_EUR = 100;

      for (let i = 0; i < table.length; i++) {
        const row = table[i];
        const h  = parseInt(row.hour);
        if (isNaN(h)) continue;
        const sp  = parseFloat(row.salesPlan);
        const sr  = parseFloat(row.salesReality);
        const tcp = parseFloat(row.tcPlan);
        const tcr = parseFloat(row.tcReality);
        const fireAt = todayAt(h + 1, alertMin);
        if (secsUntil(fireAt) === null) continue;

        const bestWorstContext = aiPrefs.showBestWorstRow
          ? ` | Najlepší: ${strongestRow.hour}:00 (${strongestRow.salesPlan}€) Najhorší: ${weakestRow.hour}:00 (${weakestRow.salesPlan}€)`
          : '';

        if (sp && sr) {
          const ratio  = sr / sp;
          const deficit = sp - sr;

          let cumAheadThisHour  = false;
          let cumBehindThisHour = false;
          if (aiPrefs.cumulativeTracker) {
            runningPlan += sp;
            runningReal += sr;
            const cumPct  = Math.round((runningReal / runningPlan) * 100);
            const cumDiff = Math.round(runningReal - runningPlan);
            const diffStr = cumDiff >= 0 ? `+${cumDiff}` : `${cumDiff}`;
            if (cumPct < behindThr * 100) {
              cumBehindThisHour = true;
              const hourPct = Math.round((sr / sp) * 100);
              await sched(
                `ai_cum_behind_${shiftName}_${row.hour}`,
                `📊 Celkové tempo pod plán (${cumPct}%) | ${row.hour}:00 ${hourPct}%`,
                `Hodina ${row.hour}:00: Real ${sr}€ / Plan ${sp}€ (${Math.round(sr-sp)}€) | Celkom: ${Math.round(runningReal)}€ / ${Math.round(runningPlan)}€ (${diffStr}€)${bestWorstContext}`,
                fireAt,
              );
            } else if (cumPct > aheadThr * 100) {
              cumAheadThisHour = true;
              const hourPct = Math.round((sr / sp) * 100);
              await sched(
                `ai_cum_ahead_${shiftName}_${row.hour}`,
                `📊 Celkové tempo nad plán (${cumPct}%) | ${row.hour}:00 ${hourPct}%`,
                `Hodina ${row.hour}:00: Real ${sr}€ / Plan ${sp}€ (+${Math.round(sr-sp)}€) | Celkom: ${Math.round(runningReal)}€ / ${Math.round(runningPlan)}€ (${diffStr}€)`,
                fireAt,
              );
            }
          }

          if (aiPrefs.trendAlert) {
            if (deficit >= DEFICIT_PER_HOUR_EUR) {
              consecutiveDeficitHours++;
              consecutiveDeficitTotal += Math.round(deficit);
              consecutiveAhead = 0;

              if (consecutiveDeficitHours === 2) {
                await sched(
                  `ai_deficit_streak2_${shiftName}_${row.hour}`,
                  `🚨 2 hodiny za sebou pod plán! (−${consecutiveDeficitTotal}€)`,
                  tpl('deficit2', {perHour: DEFICIT_PER_HOUR_EUR, total: consecutiveDeficitTotal}),
                  fireAt,
                );
              } else if (consecutiveDeficitHours === 3) {
                await sched(
                  `ai_deficit_streak3_${shiftName}_${row.hour}`,
                  `🔴 URGENT: 3 hodiny za sebou pod plán! (−${consecutiveDeficitTotal}€)`,
                  tpl('deficit3', {total: consecutiveDeficitTotal}),
                  fireAt,
                );
              }
            } else if (ratio > aheadThr) {
              consecutiveDeficitHours = 0;
              consecutiveDeficitTotal = 0;
              consecutiveAhead++;
              if (consecutiveAhead === 2) {
                await sched(
                  `ai_trend_ahead_${shiftName}_${row.hour}`,
                  `🔄 2 hodiny za sebou nad plán! 🎉`,
                  `Výborná forma — Real: ${sr}€ / Plan: ${sp}€. Môžeš optimalizovať personál.`,
                  fireAt,
                );
              }
            } else {
              consecutiveDeficitHours = 0;
              consecutiveDeficitTotal = 0;
              consecutiveAhead        = 0;
            }
          }

          if (aiPrefs.behindPlan && ratio < behindThr && !cumBehindThisHour) {
            await sched(
              `ai_behind_${shiftName}_${row.hour}`,
              `⚠️ Pod plán (${row.hour}:00 — ${Math.round(ratio * 100)}%, −${Math.round(deficit)}€)`,
              tpl('behind', {real: sr, plan: sp, diff: Math.round(deficit)}) + bestWorstContext,
              fireAt,
            );
          } else if (aiPrefs.aheadPlan && ratio > aheadThr && !cumAheadThisHour) {
            await sched(
              `ai_ahead_${shiftName}_${row.hour}`,
              `✅ Výborný výkon! (${row.hour}:00 — ${Math.round(ratio * 100)}%)`,
              tpl('ahead', {real: sr, plan: sp}),
              fireAt,
            );
          }
        }

        if (aiPrefs.tcMonitor && tcp && tcr) {
          const tcRatio = tcr / tcp;
          if (tcRatio < behindThr) {
            await sched(
              `ai_tc_behind_${shiftName}_${row.hour}`,
              `🧾 TC pod plán (${row.hour}:00 — ${Math.round(tcRatio * 100)}%)`,
              `TC Real: ${Math.round(tcr)} / Plan: ${Math.round(tcp)} — Skontroluj servisné tempo a priepustnosť.`,
              fireAt,
            );
          } else if (tcRatio > aheadThr) {
            await sched(
              `ai_tc_ahead_${shiftName}_${row.hour}`,
              `🧾 TC nad plán! (${row.hour}:00 — ${Math.round(tcRatio * 100)}%)`,
              `TC Real: ${Math.round(tcr)} / Plan: ${Math.round(tcp)} — Výborná priepustnosť!`,
              fireAt,
            );
          }
        }

        if (aiPrefs.r2pMonitor) {
          const r2pVal = parseFloat(row.r2p);
          const r2pTgt = aiPrefs.r2pTarget ?? 135;
          if (!isNaN(r2pVal) && row.r2p !== '' && sp && sr) {
            const salesDiff = Math.round(sr - sp);
            const r2pHigh   = r2pVal > r2pTgt;

            if (salesDiff >= 300 && r2pHigh) {
              await sched(
                `ai_r2p_ok_${shiftName}_${row.hour}`,
                `⏱️ R2P vyšší, Sales OK (${row.hour}:00)`,
                `R2P: ${Math.round(r2pVal)}s (cieľ ${r2pTgt}s) | Sales +${salesDiff}€ nad plán — Tempo predaja je dobré, ale skontroluj rýchlosť obsluhy.`,
                fireAt,
              );
            } else if (sr < sp && r2pHigh) {
              await sched(
                `ai_r2p_bad_${shiftName}_${row.hour}`,
                `🔴 Pod plán + R2P vysoký! (${row.hour}:00)`,
                tpl('r2pBad', {r2p: Math.round(r2pVal), target: r2pTgt, real: Math.round(sr), plan: Math.round(sp)}),
                fireAt,
              );
            }
          }
        }

        if (annualGoals.forecastEnabled) {
          const completedRows = rowsWithPlan.filter(r => parseFloat(r.salesReality) > 0 && parseFloat(r.tcReality) > 0);
          if (completedRows.length >= 2) {
            const hoursLeft   = Math.max(0, rowsWithPlan.length - completedRows.length);
            const totalSReal  = completedRows.reduce((s,r) => s+(parseFloat(r.salesReality)||0), 0);
            const totalTcReal = completedRows.reduce((s,r) => s+(parseFloat(r.tcReality)||0), 0);
            const tcPerHour   = totalTcReal / completedRows.length;
            const projTcTotal    = totalTcReal + tcPerHour * hoursLeft;
            const projSalesTotal = totalSReal  + (totalSReal/completedRows.length) * hoursLeft;
            const projAvg        = projTcTotal > 0 ? projSalesTotal/projTcTotal : 0;
            const last2         = completedRows.slice(-2);
            const trendDrift    = last2.reduce((s,r) => s+(parseFloat(r.salesReality)||0), 0)
                                - last2.reduce((s,r) => s+(parseFloat(r.salesPlan)||0), 0);
            const targetAvgG    = annualGoals.avgTarget    || 58;
            const targetTcH     = annualGoals.tcHourTarget || 6;
            const avgGap        = projAvg - targetAvgG;
            const tcHourGap     = tcPerHour - targetTcH;
            if ((avgGap < -2 || tcHourGap < -0.5) && trendDrift < -50) {
              await sched(
                `ai_forecast_${shiftName}_${row.hour}`,
                `📊 AI Predikcia: produktivita klesá (${row.hour}:00)`,
                tpl('forecast', {prod: projAvg.toFixed(1), target: targetAvgG, tcHour: tcPerHour.toFixed(1), tcTarget: targetTcH}),
                fireAt,
              );
            }
          }
        }
      }

      if (aiPrefs.staffingAdvisor) {
        const completedRows2 = table.filter(r => parseFloat(r.salesReality) > 0);
        if (completedRows2.length >= 1) {
          const lastC   = completedRows2[completedRows2.length - 1];
          const hC      = parseInt(lastC.hour);
          const spC     = parseFloat(lastC.salesPlan);
          const srC     = parseFloat(lastC.salesReality);
          const ratioC  = spC > 0 ? srC / spC : 1;
          const hoursRemC = Math.max(0, rowsWithPlan.length - completedRows2.length);
          const planRemC  = rowsWithPlan.slice(completedRows2.length).reduce((s, r) => s + (parseFloat(r.salesPlan) || 0), 0);
          if (!isNaN(hC)) {
            const fireAtC = todayAt(hC + 1, alertMin);
            if (secsUntil(fireAtC) !== null) {
              if (hoursRemC >= 2 && ratioC < 0.82) {
                const deficitEur = Math.round(planRemC - ratioC * planRemC);
                await sched(
                  `ai_staffing_${shiftName}`,
                  `👥 Personálne odporúčanie (${lastC.hour}:00)`,
                  `Tempo ${Math.round(ratioC*100)}% plánu, zostatok ~${Math.round(planRemC)}€ plán. Predikovaný deficit: −${deficitEur}€. Zváž: pustiť 1–2 ľudí domov + spustiť promo.`,
                  fireAtC,
                );
              } else if (hoursRemC >= 1 && ratioC > 1.15) {
                await sched(
                  `ai_staffing_plus_${shiftName}`,
                  `👥 Výborné tempo — skontroluj kapacitu (${lastC.hour}:00)`,
                  `Tempo ${Math.round(ratioC*100)}% plánu. Uisti sa, že máš dostatok ľudí na obsluhu zvýšeného počtu zákazníkov.`,
                  fireAtC,
                );
              }
            }
          }
        }
      }

      if (aiPrefs.endOfShiftProjection) {
        const completedRows3 = table.filter(r => parseFloat(r.salesReality) > 0);
        if (completedRows3.length >= 3) {
          const lastH3     = parseInt(completedRows3[completedRows3.length - 1].hour);
          if (!isNaN(lastH3)) {
            const fireAt3  = todayAt(lastH3 + 1, Math.min(alertMin + 3, 59));
            if (secsUntil(fireAt3) !== null) {
              const totalPlan3  = rowsWithPlan.reduce((s, r) => s + (parseFloat(r.salesPlan) || 0), 0);
              const totalReal3  = completedRows3.reduce((s, r) => s + (parseFloat(r.salesReality) || 0), 0);
              const avgPerH3    = totalReal3 / completedRows3.length;
              const remaining3  = Math.max(0, rowsWithPlan.length - completedRows3.length);
              const projTotal3  = totalReal3 + avgPerH3 * remaining3;
              const projPct3    = totalPlan3 > 0 ? Math.round((projTotal3 / totalPlan3) * 100) : 0;
              const diff3       = Math.round(projTotal3 - totalPlan3);
              const diffStr3    = diff3 >= 0 ? `+${diff3}` : `${diff3}`;
              const eosMsg      = projPct3 >= 100
                ? 'Na dobrej ceste splniť plán! 🟢'
                : projPct3 >= 90
                  ? 'Tesne pod plán — ešte to môžeš stiahnuť! 🟡'
                  : 'Ťažká zmena — eskaluj alebo spusti promo. 🔴';
              await sched(
                `ai_eos_${shiftName}`,
                `🏁 Predikcia konca zmeny (~${projPct3}% plánu)`,
                `Predikovaný Real: ~${Math.round(projTotal3)}€ / Plan: ${Math.round(totalPlan3)}€ (${diffStr3}€) — ${eosMsg}`,
                fireAt3,
              );
            }
          }
        }
      }

      if (aiPrefs.dailyComparison && rowsWithPlan.length) {
        const lastH = parseInt(rowsWithPlan[rowsWithPlan.length - 1].hour);
        if (!isNaN(lastH)) {
          const fireAt = todayAt(lastH + 1, Math.min(alertMin + 5, 59));
          if (secsUntil(fireAt) !== null) {
            const yesterday = await loadYesterdayEntry(shiftName);
            const totalPlan = rowsWithPlan.reduce((s, r) => s + (parseFloat(r.salesPlan)||0), 0);
            const totalReal = table.reduce((s, r) => s + (parseFloat(r.salesReality)||0), 0);
            if (totalReal > 0) {
              let compMsg = '';
              if (yesterday) {
                const diff = Math.round(totalReal - yesterday.totalReal);
                const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
                const ydPct = yesterday.pct;
                const todayPct = Math.round((totalReal / totalPlan) * 100);
                compMsg = `Dnes: ${Math.round(totalReal)}€ (${todayPct}%) | Včera: ${Math.round(yesterday.totalReal)}€ (${ydPct}%) | Rozdiel: ${diffStr}€`;
              } else {
                compMsg = `Celkový Sales Real: ${Math.round(totalReal)}€ / Plan: ${Math.round(totalPlan)}€ (${Math.round((totalReal/totalPlan)*100)}%) — Prvý záznam uložený.`;
              }
              await sched(
                `ai_daily_cmp_${shiftName}`,
                '🗓️ Denné porovnanie',
                compMsg,
                fireAt,
              );
              await saveDailyHistory(table, shiftName);
            }
          }
        }
      }

    } catch (e) { console.log('AI notification error:', e); }
  };

  const scheduleAllNotifications = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const now = new Date();
      const todayAt = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

      const secsUntil = (fireAt) => {
        const s = Math.round((fireAt.getTime() - now.getTime()) / 1000);
        return s > 0 ? s : null;
      };

      const makeTrigger = (fireAt) => ({
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: 'default',
      });

      const afFirstHour = afternoonTable.length ? parseInt(afternoonTable[0].hour) : NaN;
      const morningCutoff = !isNaN(afFirstHour) ? todayAt(afFirstHour, 0) : todayAt(23, 59);

      if (notifPrefs.morningTable) {
        for (const row of morningTable) {
          const h = parseInt(row.hour);
          if (isNaN(h)) continue;
          const fireAt = todayAt(h + 1, notifTimes.tableMinute);
          if (fireAt >= morningCutoff) continue;
          if (secsUntil(fireAt) === null) continue;
          if (row.salesReality === '' || row.tcReality === '') {
            await Notifications.scheduleNotificationAsync({
              identifier: `table_morning_${row.hour}`,
              content: {
                title: (classicNotifTexts.morningTableTitle || DEFAULT_CLASSIC_NOTIF_TEXTS.morningTableTitle).replace('{hour}', row.hour),
                body: classicNotifTexts.morningTableBody || DEFAULT_CLASSIC_NOTIF_TEXTS.morningTableBody,
                sound: 'default',
              },
              trigger: makeTrigger(fireAt),
            });
          }
        }
      }

      if (notifPrefs.afternoonTable) {
        for (const row of afternoonTable) {
          const h = parseInt(row.hour);
          if (isNaN(h)) continue;
          const fireAt = todayAt(h + 1, notifTimes.tableMinute);
          if (secsUntil(fireAt) === null) continue;
          if (row.salesReality === '' || row.tcReality === '') {
            await Notifications.scheduleNotificationAsync({
              identifier: `table_afternoon_${row.hour}`,
              content: {
                title: (classicNotifTexts.afternoonTableTitle || DEFAULT_CLASSIC_NOTIF_TEXTS.afternoonTableTitle).replace('{hour}', row.hour),
                body: classicNotifTexts.afternoonTableBody || DEFAULT_CLASSIC_NOTIF_TEXTS.afternoonTableBody,
                sound: 'default',
              },
              trigger: makeTrigger(fireAt),
            });
          }
        }
      }

      if (notifPrefs.morningPrep) {
        {
          const fireAt = todayAt(notifTimes.morningPrepHour, notifTimes.morningPrepMinute);
          if (secsUntil(fireAt) !== null) {
            const complete =
              morningBefore.length > 0 &&
              morningBefore.every((_, i) => !!checks[`morning_before_${i}`]);
            if (!complete) {
              await Notifications.scheduleNotificationAsync({
                identifier: 'prep_morning',
                content: {
                  title: classicNotifTexts.morningPrepTitle || DEFAULT_CLASSIC_NOTIF_TEXTS.morningPrepTitle,
                  body:  classicNotifTexts.morningPrepBody  || DEFAULT_CLASSIC_NOTIF_TEXTS.morningPrepBody,
                  sound: 'default',
                },
                trigger: makeTrigger(fireAt),
              });
            }
          }
        }
      }

      if (notifPrefs.afternoonPrep) {
        {
          const fireAt = todayAt(notifTimes.afternoonPrepHour, notifTimes.afternoonPrepMinute);
          if (secsUntil(fireAt) !== null) {
            const complete =
              afternoonBefore.length > 0 &&
              afternoonBefore.every((_, i) => !!checks[`afternoon_before_${i}`]);
            if (!complete) {
              await Notifications.scheduleNotificationAsync({
                identifier: 'prep_afternoon',
                content: {
                  title: classicNotifTexts.afternoonPrepTitle || DEFAULT_CLASSIC_NOTIF_TEXTS.afternoonPrepTitle,
                  body:  classicNotifTexts.afternoonPrepBody  || DEFAULT_CLASSIC_NOTIF_TEXTS.afternoonPrepBody,
                  sound: 'default',
                },
                trigger: makeTrigger(fireAt),
              });
            }
          }
        }
      }

      await scheduleAiNotifications(morningTable, 'morning');
      await scheduleAiNotifications(afternoonTable, 'afternoon');

    } catch (e) { console.log('Notification error:', e); }
  };

  // ── Test notifications ────────────────────────────────────────────────────────
  const sendTestNotifications = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', 'Notifikácie sú dostupné len na mobilných zariadeniach.');
      return;
    }
    try {
      const inSecs = (s) => ({
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: s,
        repeats: false,
        channelId: 'default',
      });

      await Notifications.scheduleNotificationAsync({
        identifier: 'test_prep',
        content: {
          title: '🔔 TEST — Príprava zmeny',
          body: 'Toto je testovacia notifikácia pre Prípravu zmeny.',
          sound: 'default',
        },
        trigger: inSecs(10),
      });

      await Notifications.scheduleNotificationAsync({
        identifier: 'test_table',
        content: {
          title: '🔔 TEST — Nevypísal si hodinu 08:00',
          body: 'Toto je testovacia notifikácia pre hodinový riadok tabuľky.',
          sound: 'default',
        },
        trigger: inSecs(20),
      });

      await Notifications.scheduleNotificationAsync({
        identifier: 'test_ai_strongest',
        content: {
          title: '🔔 TEST — AI: Ideš mať najsilnejšiu hodinu!',
          body: 'Sales Plan: 1200€ — Skontroluj si kuchyňu, servis a loby.',
          sound: 'default',
        },
        trigger: inSecs(30),
      });

      await Notifications.scheduleNotificationAsync({
        identifier: 'test_ai_behind',
        content: {
          title: '🔔 TEST — AI: Pod plán (10:00 — 82%)',
          body: 'Real: 980€ / Plan: 1200€ — Zváž špeciálky alebo promo akciu.',
          sound: 'default',
        },
        trigger: inSecs(40),
      });

      Alert.alert(
        'Test naplánovaný ✅',
        'Notifikácie prídu za 10, 20, 30 a 40 sekúnd.\n\n• 10s — Príprava zmeny\n• 20s — Nevypísaná hodina\n• 30s — AI: Najsilnejšia hodina\n• 40s — AI: Pod plán\n\nZamkni telefón alebo minimalizuj appku.',
      );
    } catch (e) {
      console.log('Test notification error:', e);
      Alert.alert('Chyba', 'Nepodarilo sa naplánovať testovaciu notifikáciu.');
    }
  };

  // ── Toggle helpers ────────────────────────────────────────────────────────────
  const toggleCheck       = (k) => setChecks(p       => ({...p, [k]: !p[k]}));
  const toggleDuringCheck = (k) => setDuringChecks(p => ({...p, [k]: !p[k]}));
  const toggleAfterCheck  = (k) => setAfterChecks(p  => ({...p, [k]: !p[k]}));
  const toggleWalkCheck   = (k) => setWalkChecks(p   => ({...p, [k]: !p[k]}));

  // ── Checklist edit helpers ────────────────────────────────────────────────────
  const updateChecklist = (section, idx, val) => {
    if (section === 'before') { const u=[...checklist]; u[idx]=val; setChecklist(u); }
    if (section === 'during') { const u=[...duringList]; u[idx]=val; setDuringList(u); }
    if (section === 'after')  { const u=[...afterList];  u[idx]=val; setAfterList(u);  }
  };
  const addChecklistItem = (section) => {
    if (section === 'before') setChecklist([...checklist, '']);
    if (section === 'during') setDuringList([...duringList, '']);
    if (section === 'after')  setAfterList([...afterList,  '']);
  };
  const deleteChecklistItem = (section, idx) => {
    if (section === 'before') setChecklist(checklist.filter((_,i) => i !== idx));
    if (section === 'during') setDuringList(duringList.filter((_,i) => i !== idx));
    if (section === 'after')  setAfterList(afterList.filter((_,i) => i !== idx));
  };

  // ── Table helpers ─────────────────────────────────────────────────────────────
  const updateWalkTime = (idx, val) => { const u=[...walkTimes]; u[idx]=val; setWalkTimes(u); };
  const addTableRow    = () => {
    const emptyCustom = customCols.reduce((o, c) => ({...o, [c.id]: ''}), {});
    setTableData([...tableData, {hour:'',salesPlan:'',salesReality:'',tcPlan:'',tcReality:'',mfy:'',r2p:'',sendKuch:'',del:'',...emptyCustom}]);
    setWalkTimes([...walkTimes, '']);
  };

  // ── Custom column helpers ─────────────────────────────────────────────────────
  const addCustomCol = () => {
    const label = newColLabel.trim();
    if (!label) return;
    const id = `cc_${Date.now()}`;
    const cols = isMorning ? morningCustomCols : afternoonCustomCols;
    const setCols = isMorning ? setMorningCustomCols : setAfternoonCustomCols;
    setCols([...cols, {id, label, insertAfter: addColPosition || 'del'}]);
    setTableData(tableData.map(r => ({...r, [id]: ''})));
    setNewColLabel('');
    setAddColPosition('del');
    setShowAddColModal(false);
  };
  const deleteCustomCol = (colId) => {
    setCustomCols(customCols.filter(c => c.id !== colId));
    setTableData(tableData.map(r => { const u={...r}; delete u[colId]; return u; }));
  };
  const renameCustomCol = (colId, newLabel) => {
    setCustomCols(customCols.map(c => c.id === colId ? {...c, label: newLabel} : c));
  };
  const deleteTableRow = (idx) => {
    setTableData(tableData.filter((_,i) => i !== idx));
    setWalkTimes(walkTimes.filter((_,i) => i !== idx));
  };

  // ── FIX: updateRow — záporné čísla blokované, sendKuch/del sa neprepíšu
  //    keď ich edituje užívateľ priamo ──────────────────────────────────────────
  const updateRow = (idx, field, val) => {
    // Blokuj záporné čísla pre numerické polia (nie pre "hour")
    if (field !== 'hour' && val !== '' && val !== '.') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed) && parsed < 0) return;
    }
    const u = [...tableData];
    u[idx] = {...u[idx], [field]: val};
    const tcp = parseFloat(u[idx].tcPlan) || 0;
    // Prepočítaj sendKuch/del LEN keď sa mení tcPlan, nie keď ich edituješ priamo
    if (field !== 'sendKuch' && field !== 'del') {
      u[idx].sendKuch = (tcp * 1.9).toFixed(0);
      u[idx].del      = (tcp * 0.07).toFixed(0);
    }
    setTableData(u);
  };

  // ── Calculations ──────────────────────────────────────────────────────────────
  const calcSum  = (f) => tableData.reduce((s,r) => s + (parseFloat(r[f]) || 0), 0);
  const calcAvg  = () => { const v=tableData.map(r=>parseFloat(r.r2p)).filter(x=>!isNaN(x)); return v.length ? (v.reduce((s,x)=>s+x,0)/v.length).toFixed(2) : '0'; };
  const calcProd = (f) => { const h=parseFloat(hoursWorked)||0; return h ? (calcSum(f)/h).toFixed(2) : '0'; };
  const rowAvg   = (row) => { const s=parseFloat(row.salesReality),t=parseFloat(row.tcReality); return t>0 ? (s/t).toFixed(2) : '-'; };
  const calcAvgPurchase = () => {
    const vals = tableData.map(r => { const s=parseFloat(r.salesReality),t=parseFloat(r.tcReality); return t>0 ? s/t : null; }).filter(v=>v!==null);
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2) : '-';
  };

  const perfColor = (plan, real) => {
    const p=parseFloat(plan)||0, r=parseFloat(real)||0;
    if (!p||!r) return darkMode ? '#1a2235' : '#f8fafc';
    if (r>=p)     return darkMode ? '#052e16' : '#dcfce7';
    if (r>=p*0.9) return darkMode ? '#431407' : '#fef3c7';
    return darkMode ? '#2d0a0a' : '#fee2e2';
  };

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const activePassword = customPassword || EDIT_PASSWORD;

  const unlockEditing = (pin) => {
    if (pin === activePassword) {
      setEditingEnabled(true);
      setPinInput('');
      setShowPinModal(false);
      setPinError(false);
    } else {
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 800);
    }
  };

  const handlePinPress = (digit) => {
    if (pinInput.length >= 4) return;
    const next = pinInput + digit;
    setPinInput(next);
    if (next.length === 4) {
      setTimeout(() => unlockEditing(next), 120);
    }
  };

  const handlePinBack = () => {
    setPinInput(p => p.slice(0, -1));
    setPinError(false);
  };

  const unlockSekciEditing = (pin) => {
    const pw = customPassword || EDIT_PASSWORD;
    if (pin === pw) {
      setSekciEditEnabled(true);
      setShowSekciPin(false);
      setSekciPinInput('');
      setSekciPinError(false);
    } else {
      setSekciPinError(true);
      setSekciPinInput('');
    }
  };

  const handleSekciPinPress = (digit) => {
    if (sekciPinInput.length >= 4) return;
    const next = sekciPinInput + digit;
    setSekciPinInput(next);
    if (next.length === 4) {
      setTimeout(() => unlockSekciEditing(next), 120);
    }
  };

  const handleSekciPinBack = () => {
    setSekciPinInput(p => p.slice(0, -1));
    setSekciPinError(false);
  };

  const changePassword = async () => {
    if (cpCurrent !== activePassword) {
      Alert.alert('Chyba','Aktuálne heslo je nesprávne.');
      return;
    }
    if (cpNew.length < 1) {
      Alert.alert('Chyba','Nové heslo nesmie byť prázdne.');
      return;
    }
    if (cpNew !== cpConfirm) {
      Alert.alert('Chyba','Nové heslá sa nezhodujú.');
      return;
    }
    await AsyncStorage.setItem(KEYS.password, cpNew);
    setCustomPassword(cpNew);
    setCpCurrent('');
    setCpNew('');
    setCpConfirm('');
    setShowChangePw(false);
    Alert.alert('Hotovo','Heslo bolo zmenené.');
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const resetShift = () => Alert.alert('Reset zmeny','Naozaj chceš resetovať zmenu?',[
    {text:'Nie', style:'cancel'},
    {text:'Áno', style:'destructive', onPress: () => {
      const emptyCC = customCols.reduce((o, c) => ({...o, [c.id]: ''}), {});
      const nd = currentHours.map(h => ({hour:h,salesPlan:'',salesReality:'',tcPlan:'',tcReality:'',mfy:'',r2p:'',sendKuch:'',del:'',...emptyCC}));
      const clearPrefix = (setter) => setter(p => {
        const n = {...p};
        Object.keys(n).forEach(k => { if (k.startsWith(prefix)) delete n[k]; });
        return n;
      });
      clearPrefix(setChecks);
      clearPrefix(setDuringChecks);
      clearPrefix(setAfterChecks);
      clearPrefix(setWalkChecks);
      if (isMorning) setMorningNotes(''); else setAfternoonNotes('');
      setHoursWorked('');
      setTableData(nd);
      setWalkTimes(nd.map(r => `${r.hour}:00`));
    }},
  ], {cancelable: true});

  // ── Theme ─────────────────────────────────────────────────────────────────────
  // ── OCR Photo Scan (OCR.space free API — no AI, no paid key needed) ─────────
  // scanType: 'plan' → fills salesPlan + tcPlan
  //           'real' → fills salesReality + tcReality
  //
  // Table column layout (from photo, left to right after time):
  //   nums[0]=Celkové predaje(salesReal), nums[1]=Projekcia(salesPlan),
  //   nums[2]=Rozdiel, nums[3]=Produkt, nums[4]=Neprodukt,
  //   nums[5]=Počet hostí(tcReal), nums[6]=Projekcia hostí(tcPlan)
  const normalizeHourValue = (value) => {
    const text = String(value ?? '').trim();
    const match = text.match(/(\d{1,2})(?:\s*[:.]\s*\d{2})?/);
    if (!match) return '';
    const hourNum = parseInt(match[1], 10);
    if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) return '';
    return String(hourNum).padStart(2, '0');
  };

  const parseOcrNumber = (value) => {
    let text = String(value ?? '').replace(/[€%]/g, '').replace(/[−–—]/g, '-').trim();
    text = text.replace(/\s+/g, '');
    const hasComma = text.includes(',');
    const hasDot = text.includes('.');
    if (hasComma && hasDot) text = text.replace(/\./g, '').replace(',', '.');
    else if (hasComma) text = text.replace(',', '.');
    const num = parseFloat(text);
    return isNaN(num) ? null : Math.round(num);
  };

  const applyOcrRow = (row, nums, scanType) => {
    if (scanType === 'plan') {
      const salesPlan = nums[1] !== undefined ? String(nums[1]) : '';
      const tcPlan    = nums[6] !== undefined ? String(nums[6]) : (nums[5] !== undefined ? String(nums[5]) : '');
      if (!salesPlan && !tcPlan) return row;
      const nr = { ...row };
      if (salesPlan) nr.salesPlan = salesPlan;
      if (tcPlan) {
        nr.tcPlan = tcPlan;
        const tc = parseInt(tcPlan, 10) || 0;
        if (tc > 0 && !row.sendKuch) { nr.sendKuch = String(Math.round(tc * 1.9)); nr.del = String(Math.round(tc * 0.07)); }
      }
      return nr;
    } else {
      const salesReal = nums[0] !== undefined ? String(nums[0]) : '';
      const tcReal    = nums[5] !== undefined ? String(nums[5]) : '';
      if (!salesReal && !tcReal) return row;
      const nr = { ...row };
      if (salesReal) nr.salesReality = salesReal;
      if (tcReal)    nr.tcReality    = tcReal;
      return nr;
    }
  };

  const scanTablePhoto = async (scanType = 'plan', useCamera = true) => {
    if (!aiScanEnabled) {
      Alert.alert('Sken vypnutý', 'Zapni foto-sken v Nastaveniach → AI Asistent → Sken tabuľky.');
      return;
    }
    try {
      const permResult = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permResult.status !== 'granted') {
        Alert.alert('Povolenie zamietnuté', 'Potrebujem prístup ku ' + (useCamera ? 'kamere' : 'galérii') + '.');
        return;
      }
      const pickerResult = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.4 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.4 });
      if (pickerResult.canceled || !pickerResult.assets?.[0]?.base64) return;

      setAiPhotoLoading(true);
      const label = scanType === 'plan' ? 'Plán' : 'Reál';
      setPhotoScanStatus((scanMode === 'gemini' ? '🤖 Gemini: ' : '📷 OCR: ') + 'Čítam tabuľku — ' + label + '…');
      setShowPhotoScanModal(true);

      const base64img = pickerResult.assets[0].base64;
      let filled = 0;

      if (scanMode === 'gemini') {
        // ── Gemini Vision ────────────────────────────────────────────────────
        if (!geminiApiKey.trim()) {
          throw new Error('Gemini API kľúč nie je zadaný — zadaj ho v Nastaveniach → Sken tabuľky.');
        }
        const prompt = scanType === 'plan'
          ? 'This is a photo of a shift sales table in Slovak. Extract ONLY a clean JSON object (no markdown, no extra text, no code fences). Format: {"rows":[{"hour":"15","salesPlan":"1396","tcPlan":"144"}, ...]}. Rules: "hour" MUST be a two-digit STRING of the START hour only. The column "Casovy usek" contains ranges like "15:00 - 15:59" - return ONLY "15". Valid hours: "08" through "23". "salesPlan" = column "Projekcia" (planned sales, integer string, no spaces). "tcPlan" = column "Projekcia hosti" (planned guests, integer string). Skip the summary/total row at the bottom (the row without an hour). If a cell is empty or unclear use "". Return raw JSON only.'
          : 'This is a photo of a shift sales table in Slovak. Extract ONLY a clean JSON object (no markdown, no extra text, no code fences). Format: {"rows":[{"hour":"15","salesReality":"1119","tcReality":"133"}, ...]}. Rules: "hour" MUST be a two-digit STRING of the START hour only. The column "Casovy usek" contains ranges like "15:00 - 15:59" - return ONLY "15". Valid hours: "08" through "23". "salesReality" = column "Celkove predaje" (actual sales, integer string, no spaces). "tcReality" = column "Pocet hosti" (actual guests, integer string). Skip the summary/total row at the bottom. If a cell is empty or unclear use "". Return raw JSON only.';

        const gemBody = JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: base64img } },
            ],
          }],
          generationConfig: { temperature: 0, maxOutputTokens: 2000, responseMimeType: 'application/json' },
        });
        const callGemini = async (model) => fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + geminiApiKey.trim(),
          { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: gemBody }
        );
        const modelChain = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
        let gemResp, lastErrText = '';
        for (const m of modelChain) {
          setPhotoScanStatus('🤖 ' + m + ': Čítam tabuľku — ' + label + '…');
          gemResp = await callGemini(m);
          if (gemResp.ok) break;
          const errData = await gemResp.json().catch(() => ({}));
          lastErrText = errData?.error?.message || ('HTTP ' + gemResp.status);
          if (gemResp.status !== 429 && gemResp.status !== 404 && gemResp.status !== 503 && gemResp.status !== 500) break;
          await new Promise(r => setTimeout(r, 1200));
        }
        if (!gemResp.ok) {
          if (gemResp.status === 429) throw new Error('Gemini: prekročená free kvóta. Počkaj minútu, alebo vygeneruj nový kľúč na https://aistudio.google.com/apikey.');
          if (gemResp.status === 503 || gemResp.status === 500) throw new Error('Gemini servery sú preťažené. Skús to znova o 30-60 s.');
          throw new Error('Gemini chyba: ' + lastErrText);
        }
        const gemData = await gemResp.json();
        let rawContent = (gemData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        rawContent = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
        const firstBrace = rawContent.indexOf('{');
        const lastBrace = rawContent.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) rawContent = rawContent.slice(firstBrace, lastBrace + 1);
        let parsed;
        try { parsed = JSON.parse(rawContent); }
        catch (parseErr) { throw new Error('Gemini vrátil neplatný JSON. Skús znova alebo ostrejšiu fotku.'); }
        if (!parsed.rows || !Array.isArray(parsed.rows)) throw new Error('Gemini vrátil nesprávny formát (chýba pole "rows").');

        // SYNC update: compute newTable now so `filled` is accurate before status text
        const currentTable = isMorning ? morningTable : afternoonTable;
        const newTable = currentTable.map(row => {
          const rowHour = normalizeHourValue(row.hour);
          const match = parsed.rows.find(r => normalizeHourValue(r.hour) === rowHour);
          if (!match) return row;
          const nr = { ...row };
          if (scanType === 'plan') {
            if (match.salesPlan !== '' && match.salesPlan != null) { nr.salesPlan = String(match.salesPlan).replace(/\s/g,''); filled++; }
            if (match.tcPlan !== '' && match.tcPlan != null) {
              nr.tcPlan = String(match.tcPlan).replace(/\s/g,'');
              const tc = parseInt(nr.tcPlan, 10) || 0;
              if (tc > 0 && !row.sendKuch) { nr.sendKuch = String(Math.round(tc * 1.9)); nr.del = String(Math.round(tc * 0.07)); }
            }
          } else {
            if (match.salesReality !== '' && match.salesReality != null) { nr.salesReality = String(match.salesReality).replace(/\s/g,''); filled++; }
            if (match.tcReality !== '' && match.tcReality != null) nr.tcReality = String(match.tcReality).replace(/\s/g,'');
          }
          return nr;
        });
        if (filled === 0) {
          const tableHours = currentTable.map(r => normalizeHourValue(r.hour)).filter(Boolean).join(',');
          const geminiHours = parsed.rows.map(r => normalizeHourValue(r.hour)).filter(Boolean).join(',');
          console.log('[ScanDebug] table hours:', tableHours, '| gemini hours:', geminiHours, '| raw:', rawContent.slice(0,300));
          throw new Error('Žiadna hodina sa nezhodovala.\nV tabuľke: ' + (tableHours || '—') + '\nGemini videl: ' + (geminiHours || '—') + '\n\nPrepni zmenu (ranná/obedná) alebo skontroluj že fotíš správny shift.');
        }
        setTableData(newTable);

      } else {
        // ── OCR.space ────────────────────────────────────────────────────────
        const apiKey = ocrApiKey.trim() || 'helloworld';
        const formData = new FormData();
        formData.append('base64Image', 'data:image/jpeg;base64,' + base64img);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('OCREngine', '2');
        formData.append('isTable', 'true');
        formData.append('scale', 'true');
        formData.append('filetype', 'JPG');

        const resp = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          headers: { apikey: apiKey },
          body: formData,
        });
        if (!resp.ok) throw new Error('OCR.space nedostupný (HTTP ' + resp.status + '). Demo kľúč býva preťažený — zadaj vlastný OCR.space kľúč v Nastaveniach, alebo prepni na Gemini AI.');
        const ocrData = await resp.json();
        if (ocrData.IsErroredOnProcessing) throw new Error(ocrData.ErrorMessage?.[0] || 'OCR chyba');

        const rawText = (ocrData.ParsedResults?.[0]?.ParsedText || '').trim();
        if (!rawText) throw new Error('OCR nevrátilo text — skús ostrejšiu fotografiu.');

        const parsedRows = [];
        const textLines = rawText
          .replace(/[\u00A0\u202F]/g, ' ')
          .replace(/[−–—]/g, '-')
          .split(/\r?\n/)
          .map(line => line.trim().replace(/\s+/g, ' '))
          .filter(Boolean);

        const rowRegex = /(?:^|\n|\s)[^\d\n]{0,6}(\d{1,2})\s*[:.]\s*\d{2}\s*-\s*\d{1,2}\s*[:.]\s*\d{2}([\s\S]*?)(?=(?:\n|\s)[^\d\n]{0,6}\d{1,2}\s*[:.]\s*\d{2}\s*-\s*\d{1,2}\s*[:.]\s*\d{2}|$)/g;
        const normalizedText = '\n' + textLines.join('\n') + '\n';
        let rowMatch;
        while ((rowMatch = rowRegex.exec(normalizedText)) !== null) {
          const hour = normalizeHourValue(rowMatch[1]);
          if (!hour) continue;
          const nums = [];
          const body = rowMatch[2].replace(/\n/g, ' ');
          const numRegex = /-?\d{1,3}(?:\s\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g;
          let numMatch;
          while ((numMatch = numRegex.exec(body)) !== null) {
            const num = parseOcrNumber(numMatch[0]);
            if (num !== null) nums.push(num);
          }
          if (nums.length >= 2) parsedRows.push({ hour, nums });
        }

        if (!parsedRows.length) {
          for (const line of textLines) {
            const cleanLine = line.replace(/^[^\d]{0,10}/, '');
            const hourMatch = cleanLine.match(/^(?:hod\.?\s*)?(\d{1,2})(?:\s*[:.]\s*\d{2})?(?:\s*-\s*\d{1,2}(?:\s*[:.]\s*\d{2})?)?/i);
            if (!hourMatch) continue;
            const hour = normalizeHourValue(hourMatch[1]);
            if (!hour) continue;
            let rest = cleanLine.slice(hourMatch[0].length).trim();
            const numMatches = rest.match(/-?\d{1,3}(?:\s\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g);
            if (!numMatches || numMatches.length < 2) continue;
            const nums = numMatches.map(parseOcrNumber).filter(n => n !== null);
            if (nums.length >= 2) parsedRows.push({ hour, nums });
          }
        }

        if (!parsedRows.length) throw new Error('Nenašli sa riadky s hodinami. Odfoť celý ľavý stĺpec Časový úsek (napr. 15:00 - 15:59) spolu s číslami.');

        const currentTableOcr = isMorning ? morningTable : afternoonTable;
        const newTableOcr = currentTableOcr.map(row => {
          const rowHour = normalizeHourValue(row.hour);
          const match = parsedRows.find(r => r.hour === rowHour);
          if (!match) return row;
          const nr = applyOcrRow(row, match.nums, scanType);
          if (nr !== row) filled++;
          return nr;
        });
        setTableData(newTableOcr);
      }

      setPhotoScanStatus(filled > 0
        ? '✓ Hotovo! Vyplnených ' + filled + ' riadkov (' + label + ').'
        : '⚠ Žiadne hodiny sa nezhodovali — skontroluj zmenu a foto.');
      setTimeout(() => { setShowPhotoScanModal(false); setPhotoScanStatus(''); }, 3000);
    } catch (e) {
      setPhotoScanStatus('Chyba: ' + (e.message || 'Neznáma chyba'));
      setTimeout(() => { setShowPhotoScanModal(false); setPhotoScanStatus(''); }, 5000);
    } finally {
      setAiPhotoLoading(false);
    }
  };

  const T = darkMode ? darkTheme : lightTheme;

  // ── orderedCols: BASE_COL_DEFS interleaved with custom cols ──────────────────
  const orderedCols = (() => {
    const result = [];
    for (const base of BASE_COL_DEFS) {
      result.push(base);
      for (const cc of customCols) {
        if ((cc.insertAfter || 'del') === base.id) {
          result.push({id:cc.id, label:cc.label, width:58, field:cc.id, kind:'custom'});
        }
      }
    }
    for (const cc of customCols) {
      if (!BASE_COL_DEFS.find(b => b.id === cc.insertAfter)) {
        if (!result.find(r => r.id === cc.id)) {
          result.push({id:cc.id, label:cc.label, width:58, field:cc.id, kind:'custom'});
        }
      }
    }
    return result;
  })();

  const fillT = (tplKey, vars = {}) => {
    let t = (aiNotifTexts && aiNotifTexts[tplKey]) || (DEFAULT_NOTIF_TEXTS[tplKey] || '');
    Object.entries(vars).forEach(([k, v]) => { t = t.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)); });
    return t;
  };

  // ── Progress counts ───────────────────────────────────────────────────────────
  const countDone = (stateObj, pfx, total) =>
    Array.from({length:total}, (_,i) => stateObj[`${pfx}_${i}`] ? 1 : 0).reduce((a,b) => a+b, 0);
  const beforeDone = countDone(checks,       `${prefix}_before`, checklist.length);
  const duringDone = countDone(duringChecks, `${prefix}_during`, duringList.length);
  const afterDone  = countDone(afterChecks,  `${prefix}_after`,  afterList.length);
  const walkDone   = Array.from({length:tableData.length}, (_,i) => walkChecks[`${prefix}_walk_${i}`] ? 1 : 0).reduce((a,b) => a+b, 0);

  // ── AI active count (for summary banner) ─────────────────────────────────────
  const aiActiveCount = aiPrefs.enabled ? [
    aiPrefs.preRush, aiPrefs.strongestHour, aiPrefs.weakestHour, aiPrefs.kitchenCheck,
    aiPrefs.behindPlan, aiPrefs.aheadPlan, aiPrefs.trendAlert, aiPrefs.cumulativeTracker,
    aiPrefs.r2pMonitor, aiPrefs.tcMonitor, aiPrefs.showBestWorstRow, aiPrefs.dailyComparison,
    aiPrefs.staffingAdvisor, aiPrefs.endOfShiftProjection,
  ].filter(Boolean).length : 0;
  const aiTotalCount = 14;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, {backgroundColor: T.background}]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* ── KeyboardAvoidingView: obsah sa posunie nad klávesnicu ────────────── */}
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[s.content, {paddingBottom: 80}]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── HEADER ─────────────────────────────────────────────────────────── */}
          <View style={s.headerRow}>
            <View style={{flex:1}}>
              <Text style={[s.title, {color: T.text}]}>Shift Checklist</Text>
              <Text style={[s.date,  {color: T.subText}]}>{formattedDate}</Text>
            </View>
            <TouchableOpacity
              style={[s.settingsBtn, {backgroundColor: T.card, borderColor: T.border, marginRight: 8}]}
              onPress={resetShift}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={22} color={T.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.settingsBtn, {backgroundColor: T.card, borderColor: T.border}]}
              onPress={() => setShowSettings(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="settings-outline" size={22} color={T.icon} />
            </TouchableOpacity>
          </View>

          {/* ── NAME ───────────────────────────────────────────────────────────── */}
          <TextInput
            style={[s.input, {backgroundColor: T.inputBg, color: T.inputText, borderColor: T.border}]}
            placeholder="Meno manažera"
            placeholderTextColor={T.placeholder}
            value={name}
            onChangeText={setName}
          />

          {/* ── SHIFT TOGGLE ───────────────────────────────────────────────────── */}
          <View style={[s.shiftToggleWrap, {backgroundColor: T.toggleBg, borderColor: T.border}]}>
            {['morning','afternoon'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[s.shiftBtn, shiftType === t && [s.shiftActive, {shadowColor: ACCENT}]]}
                onPress={() => switchShift(t)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={t === 'morning' ? 'sunny-outline' : 'partly-sunny-outline'}
                  size={15}
                  color={shiftType === t ? '#111' : T.subText}
                  style={{marginRight: 5}}
                />
                <Text style={[s.shiftBtnText, {color: shiftType === t ? '#111' : T.subText}]}>
                  {t === 'morning' ? 'Ranná' : 'Obedná'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── COUNTDOWN TIMER ───────────────────────────────────────────────── */}
          {/* COUNTDOWN ODSTRÁNENÝ — šetrí CPU (žiadny setInterval každú sekundu) */}
          {false && null}

          {/* ── PROGRESS STRIP ────────────────────────────────────────────────── */}
          {(() => {
            const totalItems = checklist.length + duringList.length + afterList.length + tableData.length;
            const totalDone  = beforeDone + duringDone + afterDone + walkDone;
            if (totalItems === 0) return null;
            const pct = Math.round((totalDone / totalItems) * 100);
            const allComplete = totalDone === totalItems;
            return (
              <View style={{marginBottom: 12}}>
                {allComplete ? (
                  <View style={[s.countdownBox, {
                    backgroundColor: darkMode ? '#052e16' : '#f0fdf4',
                    borderColor:     darkMode ? '#14532d' : '#86efac',
                    paddingVertical: 10, marginBottom: 0,
                  }]}>
                    <View style={[s.countdownIconWrap, {
                      backgroundColor: darkMode ? '#14532d' : '#bbf7d0',
                    }]}>
                      <Ionicons name='trophy' size={18} color='#22c55e' />
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[s.countdownLabel, {color: darkMode ? '#86efac' : '#15803d', fontWeight:'700'}]}>
                        Výborná zmena! Všetko dokončené 🎉
                      </Text>
                      <Text style={[s.countdownTime, {color: '#22c55e', fontSize: 13}]}>
                        {totalDone}/{totalItems} položiek ✓
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 5}}>
                      <Text style={{fontSize:11, fontWeight:'700', color: T.subText, letterSpacing: 0.5}}>CELKOVÝ POSTUP ZMENY</Text>
                      <Text style={{fontSize:12, fontWeight:'800', color: pct >= 80 ? '#22c55e' : pct >= 40 ? ACCENT : T.subText}}>
                        {pct}%
                      </Text>
                    </View>
                    <View style={{height: 6, borderRadius: 99, backgroundColor: darkMode ? '#1e293b' : '#e2e8f0', overflow:'hidden'}}>
                      <View style={{
                        height: 6,
                        borderRadius: 99,
                        width: pct + '%',
                        backgroundColor: pct >= 80 ? '#22c55e' : pct >= 40 ? ACCENT : '#64748b',
                      }} />
                    </View>
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 5}}>
                      {[{label:'Pred', done:beforeDone, total:checklist.length, vis:sectionVisibility.beforeShift},
                        {label:'Počas', done:duringDone, total:duringList.length, vis:sectionVisibility.duringShift},
                        {label:'Obhliada', done:walkDone, total:tableData.length, vis:sectionVisibility.walkthrough},
                        {label:'Po', done:afterDone, total:afterList.length, vis:sectionVisibility.afterShift},
                      ].filter(x => x.vis && x.total > 0).map(({label, done, total}) => (
                        <Text key={label} style={{fontSize:10, color: done===total ? '#22c55e' : T.subText, fontWeight: done===total ? '700' : '400'}}>
                          {done===total
                            ? '✓ ' + label
                            : label + ' ' + done + '/' + total}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            );
          })()}

          {/* ── BEFORE + DURING CHECKLISTS ─────────────────────────────────────── */}
          {[
            {label:'Pred zmenou', icon:'clipboard-outline', items:checklist,  toggle:toggleCheck,       stateObj:checks,      pfx:`${prefix}_before`, section:'before', done:beforeDone, total:checklist.length},
            {label:'Počas zmeny', icon:'time-outline',      items:duringList, toggle:toggleDuringCheck, stateObj:duringChecks, pfx:`${prefix}_during`, section:'during', done:duringDone, total:duringList.length},
          ].filter(({section}) => section === 'before' ? sectionVisibility.beforeShift : sectionVisibility.duringShift).map(({label, icon, items, toggle, stateObj, pfx, section, done, total}) => (
            <View key={`${prefix}_${section}`} style={{marginBottom: 8}}>
              <SectionHeader label={label} icon={icon} done={done} total={total} T={T} />
              {items.map((item, i) => (
                <CheckRow
                  key={`${pfx}_${i}`}
                  item={item}
                  checked={!!stateObj[`${pfx}_${i}`]}
                  editable={editingEnabled}
                  darkMode={darkMode}
                  T={T}
                  onToggle={() => toggle(`${pfx}_${i}`)}
                  onChangeText={(v) => updateChecklist(section, i, v)}
                  onDelete={() => deleteChecklistItem(section, i)}
                />
              ))}
              {editingEnabled && (
                <TouchableOpacity style={[s.addBtn, {backgroundColor: T.addBtnBg, borderColor: T.addBtnBorder}]} onPress={() => addChecklistItem(section)} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={16} color={T.addBtnText} style={{marginRight: 6}} />
                  <Text style={[s.addTxt, {color: T.addBtnText}]}>Pridať položku</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {sectionVisibility.walkthrough && (
            <View>
              {/* ── WALKTHROUGHS ───────────────────────────────────────────────────── */}
              <SectionHeader label="Obhliadky prevádzky" icon="walk-outline" done={walkDone} total={tableData.length} T={T} />
              <View style={s.walkWrap}>
                {(() => {
                  const nowHour = new Date().getHours();
                  return tableData.map((row, i) => {
                    const checked = !!walkChecks[`${prefix}_walk_${i}`];
                    const slotHour = parseInt(row.hour, 10);
                    const isCurrent = slotHour === nowHour && !checked;
                    return (
                      <TouchableOpacity
                        key={`${prefix}_walk_${i}`}
                        style={[s.walkBox, {
                          backgroundColor: checked ? (darkMode ? '#052e16' : '#dcfce7')
                            : isCurrent ? (darkMode ? '#2d1800' : '#fffbeb')
                            : T.card,
                          borderColor: checked ? (darkMode ? '#14532d' : '#86efac')
                            : isCurrent ? '#f59e0b'
                            : T.border,
                        }]}
                        onPress={() => toggleWalkCheck(`${prefix}_walk_${i}`)}
                        activeOpacity={0.8}
                      >
                        {checked && <Ionicons name="checkmark-circle" size={14} color={darkMode ? '#4ade80' : '#16a34a'} style={{marginBottom: 2}} />}
                        <TextInput
                          style={[s.walkTxt, {color: checked ? (darkMode ? '#4ade80' : '#15803d') : T.walkText}]}
                          value={walkTimes[i] || `${row.hour}:00`}
                          editable={editingEnabled}
                          onChangeText={(v) => updateWalkTime(i, v)}
                        />
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>
            </View>
          )}

          {sectionVisibility.table && (
            <View>
              {/* ── TABLE ──────────────────────────────────────────────────────────── */}
              <SectionHeader label="Plan / Realita" icon="bar-chart-outline" T={T} />
              {/* ── FOTO SKEN TLAČIDLÁ ─── */}
              {aiScanEnabled && (
                <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center', marginBottom:6, gap:8, flexWrap:'wrap'}}>
                  {/* Naskenuj Plán */}
                  <TouchableOpacity
                    onPress={() => Alert.alert('Naskenuj Plán', 'Vyber zdroj fotografie:', [
                      { text: '📷 Fotoaparát', onPress: () => scanTablePhoto('plan', true) },
                      { text: '🖼️ Galéria',    onPress: () => scanTablePhoto('plan', false) },
                      { text: 'Zrušiť', style: 'cancel' },
                    ])}
                    style={{flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:9, borderRadius:12, backgroundColor:darkMode?'#0c1a2e':'#eff6ff', borderWidth:1.5, borderColor:'#3b82f6', gap:6}}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={17} color="#3b82f6" />
                    <Text style={{fontSize:13, fontWeight:'700', color:'#3b82f6'}}>Naskenuj Plán</Text>
                    <Text style={{fontSize:10, color:T.subText}}>Plan+TC</Text>
                  </TouchableOpacity>
                  {scanRealEnabled && (
                  <>
                  {/* Naskenuj Reál */}
                  <TouchableOpacity
                    onPress={() => Alert.alert('Naskenuj Reál', 'Vyber zdroj fotografie:', [
                      { text: '📷 Fotoaparát', onPress: () => scanTablePhoto('real', true) },
                      { text: '🖼️ Galéria',    onPress: () => scanTablePhoto('real', false) },
                      { text: 'Zrušiť', style: 'cancel' },
                    ])}
                    style={{flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:9, borderRadius:12, backgroundColor:darkMode?'#052e16':'#f0fdf4', borderWidth:1.5, borderColor:'#22c55e', gap:6}}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="camera-outline" size={17} color="#22c55e" />
                    <Text style={{fontSize:13, fontWeight:'700', color:'#22c55e'}}>Naskenuj Reál</Text>
                    <Text style={{fontSize:10, color:T.subText}}>Real+TC</Text>
                  </TouchableOpacity>
                  </>
                  )}
                </View>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 6}}>
                <View>
                  <View style={{flexDirection:'row'}}>
                    {editingEnabled && <View style={[s.thCell, {width:36, backgroundColor: T.thBg, borderColor: T.border}]} />}
                    {orderedCols.map((col) => {
                      if (col.kind === 'custom') {
                        return (
                          <View key={col.id} style={[s.thCell, {width:58, backgroundColor: darkMode ? '#0c1a2e' : '#eff6ff', borderColor: T.border, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingHorizontal:2}]}>
                            <Text style={{color:'#3b82f6', fontSize:10, fontWeight:'700', flex:1, textAlign:'center'}} numberOfLines={2}>{col.label}</Text>
                            {editingEnabled && (
                              <TouchableOpacity onPress={() => deleteCustomCol(col.id)} hitSlop={{top:6,bottom:6,left:4,right:4}}>
                                <Ionicons name="close-circle" size={13} color={DANGER} />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      }
                      return <Text key={col.id} style={[s.thCell, {width:col.width, backgroundColor: T.thBg, color: T.thText, borderColor: T.border}]}>{col.label}</Text>;
                    })}
                    {editingEnabled && (
                      <TouchableOpacity
                        style={[s.thCell, {width:40, backgroundColor: darkMode ? '#1a0a2e' : '#fdf4ff', borderColor: '#a855f7', justifyContent:'center', alignItems:'center'}]}
                        onPress={() => { setAddColShift(shiftType); setNewColLabel(''); setAddColPosition('del'); setShowAddColModal(true); }}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={18} color="#a855f7" />
                      </TouchableOpacity>
                    )}
                  </View>
                  {tableData.map((row, i) => (
                    <View key={`${prefix}_row_${i}`} style={{flexDirection:'row'}}>
                      {editingEnabled && (
                        <TouchableOpacity
                          style={[s.tdCell, {width:36, backgroundColor: T.tdBg, borderColor: T.border, justifyContent:'center', alignItems:'center'}]}
                          onPress={() => deleteTableRow(i)}
                        >
                          <Ionicons name="remove-circle-outline" size={16} color={DANGER} />
                        </TouchableOpacity>
                      )}
                      {orderedCols.map((col) => {
                        if (col.kind === 'custom') {
                          return (
                            <TextInput key={col.id}
                              style={[s.tdCell, {width:58, backgroundColor: T.tdBg, color: T.tdText, borderColor: T.border}]}
                              value={row[col.id] ?? ''}
                              keyboardType="decimal-pad"
                              onChangeText={(v) => {
                                // Blokuj záporné čísla v custom stĺpcoch
                                if (v !== '' && v !== '.') {
                                  const parsed = parseFloat(v);
                                  if (!isNaN(parsed) && parsed < 0) return;
                                }
                                const u=[...tableData]; u[i]={...u[i],[col.id]:v}; setTableData(u);
                              }}
                            />
                          );
                        }
                        if (col.id === 'hour') {
                          return <TextInput key={col.id} style={[s.tdCell, {width:col.width, backgroundColor: T.tdBg, color: T.tdText, borderColor: T.border, fontWeight:'700'}]} value={row.hour} onChangeText={(v) => updateRow(i,'hour',v)} />;
                        }
                        if (col.kind === 'computed') {
                          return <Text key={col.id} style={[s.tdCell, {width:col.width, backgroundColor: T.spBg, color: T.spText, borderColor: T.border, textAlign:'center', fontWeight:'700', paddingTop:8}]}>{rowAvg(row)}</Text>;
                        }
                        let extraStyle = {};
                        if (col.bgFn === 'salesPerf') {
                          extraStyle = {backgroundColor: perfColor(row.salesPlan, row.salesReality)};
                        } else if (col.bgFn === 'tcPerf') {
                          extraStyle = {backgroundColor: perfColor(row.tcPlan, row.tcReality)};
                        } else if (col.bgFn === 'r2pColor') {
                          const v = parseFloat(row.r2p);
                          const tgt = aiPrefs.r2pTarget ?? 135;
                          if (!isNaN(v) && row.r2p !== '') {
                            if (v <= tgt)         extraStyle = {backgroundColor: darkMode ? '#052e16' : '#dcfce7', color: darkMode ? '#4ade80' : '#15803d'};
                            else if (v <= tgt+20) extraStyle = {backgroundColor: darkMode ? '#2d1800' : '#fef9c3', color: darkMode ? '#fbbf24' : '#854d0e'};
                            else                  extraStyle = {backgroundColor: darkMode ? '#2d0a0a' : '#fee2e2', color: darkMode ? '#f87171' : '#991b1b'};
                          } else {
                            extraStyle = {backgroundColor: T.spBg, color: T.spText};
                          }
                        } else if (col.special) {
                          extraStyle = {backgroundColor: T.spBg, color: T.spText};
                        }
                        return (
                          <TextInput key={col.id}
                            style={[s.tdCell, {width:col.width, backgroundColor: T.tdBg, color: T.tdText, borderColor: T.border}, extraStyle]}
                            value={row[col.field] ?? ''}
                            onChangeText={(v) => updateRow(i, col.field, v)}
                            keyboardType="decimal-pad"
                          />
                        );
                      })}
                    </View>
                  ))}
                  <View style={{flexDirection:'row'}}>
                    {editingEnabled && <View style={[s.sumCell, {width:36, backgroundColor: T.sumBg, borderColor: T.border}]} />}
                    {orderedCols.map((col, ci) => {
                      const sumMap = {salesPlan: calcSum('salesPlan'), salesReality: calcSum('salesReality'), tcPlan: calcSum('tcPlan'), tcReality: calcSum('tcReality'), avg: calcAvgPurchase(), mfy: calcSum('mfy'), r2p: calcAvg(), sendKuch: calcSum('sendKuch'), del: calcSum('del')};
                      const val = ci === 0 ? 'SUM' : (col.id in sumMap ? String(sumMap[col.id]) : '');
                      return <Text key={col.id} style={[s.sumCell, {width: col.kind==='custom' ? 58 : col.width, backgroundColor: T.sumBg, color: T.sumText, borderColor: T.border}]}>{val}</Text>;
                    })}
                  </View>
                </View>
              </ScrollView>
              {editingEnabled && (
                <TouchableOpacity style={[s.addBtn, {backgroundColor: T.addBtnBg, borderColor: T.addBtnBorder, marginBottom: 20}]} onPress={addTableRow} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={16} color={T.addBtnText} style={{marginRight: 6}} />
                  <Text style={[s.addTxt, {color: T.addBtnText}]}>Pridať riadok</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {sectionVisibility.hours && (
            <View>
              {/* ── HOURS ──────────────────────────────────────────────────────────── */}
              <SectionHeader label="Hodiny" icon="time-outline" T={T} />
              <TextInput
                style={[s.input, {backgroundColor: T.inputBg, color: T.inputText, borderColor: T.border}]}
                placeholder="Počet hodín"
                placeholderTextColor={T.placeholder}
                value={hoursWorked}
                onChangeText={setHoursWorked}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {sectionVisibility.productivity && (
            <View>
              {/* ── PRODUCTIVITY ───────────────────────────────────────────────────── */}
              <SectionHeader label="Produktivita" icon="trending-up-outline" T={T} />
              <View style={[s.prodBox, {backgroundColor: T.card, borderColor: T.border}]}>
                <View style={s.prodRow}>
                  <Text style={[s.prodLabel, {color: T.subText}]}>Sales Plan / TC Plan</Text>
                  <Text style={[s.prodValue, {color: T.text}]}>{calcProd('salesPlan')} / {calcProd('tcPlan')}</Text>
                </View>
                <View style={[s.prodDivider, {backgroundColor: T.border}]} />
                <View style={s.prodRow}>
                  <Text style={[s.prodLabel, {color: T.subText}]}>Sales Real / TC Real</Text>
                  <Text style={[s.prodValue, {color: T.text}]}>{calcProd('salesReality')} / {calcProd('tcReality')}</Text>
                </View>
              </View>
            </View>
          )}

          {sectionVisibility.evaluation && (
            <View>
              {/* ── HODNOTENIE ZMENY ───────────────────────────────────────────────── */}
              {(() => {
                const sp = calcSum('salesPlan');
                const sr = calcSum('salesReality');
                const tp = calcSum('tcPlan');
                const tr = calcSum('tcReality');
                if (!sp && !tp) return null;
                const salesPct = sp > 0 ? Math.round((sr / sp) * 100) : null;
                const tcPct    = tp > 0 ? Math.round((tr / tp) * 100) : null;
                const minPct   = Math.min(salesPct ?? 999, tcPct ?? 999);
                const grade = minPct >= 100 ? 'green' : minPct >= 90 ? 'yellow' : 'red';
                const gradeColor = grade === 'green' ? '#22c55e' : grade === 'yellow' ? '#f59e0b' : '#ef4444';
                const gradeBg    = grade === 'green'
                  ? (darkMode ? '#052e16' : '#dcfce7')
                  : grade === 'yellow'
                    ? (darkMode ? '#2d1800' : '#fef3c7')
                    : (darkMode ? '#2d0a0a' : '#fee2e2');
                const gradeBorder = grade === 'green'
                  ? (darkMode ? '#14532d' : '#86efac')
                  : grade === 'yellow'
                    ? (darkMode ? '#78350f' : '#fcd34d')
                    : (darkMode ? '#7f1d1d' : '#fca5a5');
                const gradeLabel = grade === 'green' ? 'Výborná zmena! 🟢' : grade === 'yellow' ? 'Dobrá zmena 🟡' : 'Pod plán 🔴';
                const gradeIcon  = grade === 'green' ? 'trophy' : grade === 'yellow' ? 'trending-up' : 'trending-down';
                return (
                  <View>
                    <SectionHeader label="Hodnotenie zmeny" icon="stats-chart-outline" T={T} />
                    <View style={[s.evalBox, {backgroundColor: gradeBg, borderColor: gradeBorder}]}>
                      <View style={[s.evalGradeRow, {borderBottomColor: gradeBorder}]}>
                        <View style={[s.evalGradeIcon, {backgroundColor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}]}>
                          <Ionicons name={gradeIcon} size={22} color={gradeColor} />
                        </View>
                        <Text style={[s.evalGradeText, {color: gradeColor}]}>{gradeLabel}</Text>
                      </View>
                      <View style={s.evalRows}>
                        {salesPct !== null && (
                          <View style={s.evalRow}>
                            <Text style={[s.evalRowLabel, {color: T.subText}]}>Sales Real / Plan</Text>
                            <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                              <Text style={[s.evalRowVal, {color: T.text}]}>{sr} / {sp}</Text>
                              <View style={[s.evalPctBadge, {backgroundColor: salesPct>=100 ? (darkMode?'#052e16':'#dcfce7') : salesPct>=90 ? (darkMode?'#2d1800':'#fef3c7') : (darkMode?'#2d0a0a':'#fee2e2')}]}>
                                <Text style={[s.evalPctText, {color: salesPct>=100?'#22c55e':salesPct>=90?'#f59e0b':'#ef4444'}]}>{salesPct}%</Text>
                              </View>
                            </View>
                          </View>
                        )}
                        {tcPct !== null && (
                          <View style={[s.evalRow, {borderTopWidth:1, borderTopColor: gradeBorder}]}>
                            <Text style={[s.evalRowLabel, {color: T.subText}]}>TC Real / Plan</Text>
                            <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                              <Text style={[s.evalRowVal, {color: T.text}]}>{tr} / {tp}</Text>
                              <View style={[s.evalPctBadge, {backgroundColor: tcPct>=100 ? (darkMode?'#052e16':'#dcfce7') : tcPct>=90 ? (darkMode?'#2d1800':'#fef3c7') : (darkMode?'#2d0a0a':'#fee2e2')}]}>
                                <Text style={[s.evalPctText, {color: tcPct>=100?'#22c55e':tcPct>=90?'#f59e0b':'#ef4444'}]}>{tcPct}%</Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>
          )}

          {sectionVisibility.notes && (
            <View>
              {/* ── NOTES ──────────────────────────────────────────────────────────── */}
              <SectionHeader label="Poznámky" icon="create-outline" T={T} />
              <View style={[s.notesBox, {backgroundColor: T.card, borderColor: T.border}]}>
                <TextInput
                  style={[s.notesInput, {color: T.text}]}
                  placeholder="Sem môžeš zapisovať poznámky..."
                  placeholderTextColor={T.placeholder}
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                />
                {notes.length > 0 && (
                  <Text style={{fontSize:10, color: T.subText, textAlign:'right', paddingHorizontal:12, paddingBottom:6}}>
                    {notes.length} zn.
                  </Text>
                )}
              </View>
            </View>
          )}

          {sectionVisibility.handover && (
            <View>
              {/* ── HANDOVER ───────────────────────────────────────────────────────── */}
              <SectionHeader label="Odkaz pre ďalšiu zmenu" icon="mail-outline" T={T} />
              <View style={[s.handoverBox, {backgroundColor: T.card, borderColor: T.border}]}>
                <TextInput
                  style={[s.notesInput, {color: T.text, minHeight: 90}]}
                  placeholder="Napíš správu pre ďalšieho manažéra..."
                  placeholderTextColor={T.placeholder}
                  multiline
                  value={handoverDraft}
                  onChangeText={(v) => { setHandoverDraft(v); setHandoverSaved(false); }}
                />
                {handoverDraft.length > 0 && (
                  <Text style={{fontSize:10, color: T.subText, textAlign:'right', paddingHorizontal:12, paddingVertical:4}}>
                    {handoverDraft.length} zn.
                  </Text>
                )}
                <View style={[s.handoverDivider, {backgroundColor: T.border}]} />
                <TouchableOpacity
                  style={[s.handoverBtn, {
                    backgroundColor: handoverSaved
                      ? (darkMode ? '#052e16' : '#f0fdf4')
                      : (handoverDraft.trim() ? ACCENT : (darkMode ? '#1e293b' : '#f1f5f9')),
                  }]}
                  onPress={saveHandover}
                  activeOpacity={0.8}
                  disabled={!handoverDraft.trim() && !handoverSaved}
                >
                  <Ionicons
                    name={handoverSaved ? 'checkmark-circle' : 'paper-plane-outline'}
                    size={16}
                    color={handoverSaved ? (darkMode ? '#4ade80' : '#16a34a') : (handoverDraft.trim() ? '#111' : T.subText)}
                    style={{marginRight: 8}}
                  />
                  <Text style={[s.handoverBtnTxt, {
                    color: handoverSaved
                      ? (darkMode ? '#4ade80' : '#16a34a')
                      : (handoverDraft.trim() ? '#111' : T.subText),
                  }]}>
                    {handoverSaved ? 'Uložené — vyskočí pri prepnutí zmeny' : 'Uložiť odkaz'}
                  </Text>
                </TouchableOpacity>
                <View style={[s.handoverDivider, {backgroundColor: T.border}]} />
                <TouchableOpacity
                  style={[s.handoverBtn, {backgroundColor: darkMode ? '#1e293b' : '#f1f5f9'}]}
                  onPress={viewHandover}
                  activeOpacity={0.8}
                >
                  <Ionicons name="eye-outline" size={16} color={T.subText} style={{marginRight: 8}} />
                  <Text style={[s.handoverBtnTxt, {color: T.subText}]}>Zobraziť uložené odkazy</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {sectionVisibility.afterShift && (
            <View>
              {/* ── AFTER SHIFT ────────────────────────────────────────────────────── */}
              <SectionHeader label="Po zmene" icon="moon-outline" done={afterDone} total={afterList.length} T={T} />
              {afterList.map((item, i) => (
                <CheckRow
                  key={`${prefix}_after_${i}`}
                  item={item}
                  checked={!!afterChecks[`${prefix}_after_${i}`]}
                  editable={editingEnabled}
                  darkMode={darkMode}
                  T={T}
                  onToggle={() => toggleAfterCheck(`${prefix}_after_${i}`)}
                  onChangeText={(v) => updateChecklist('after', i, v)}
                  onDelete={() => deleteChecklistItem('after', i)}
                />
              ))}
              {editingEnabled && (
                <TouchableOpacity style={[s.addBtn, {backgroundColor: T.addBtnBg, borderColor: T.addBtnBorder}]} onPress={() => addChecklistItem('after')} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={16} color={T.addBtnText} style={{marginRight: 6}} />
                  <Text style={[s.addTxt, {color: T.addBtnText}]}>Pridať položku</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── RESET ──────────────────────────────────────────────────────────── */}
          <TouchableOpacity style={s.resetBtn} onPress={resetShift} activeOpacity={0.85}>
            <Ionicons name="refresh-outline" size={17} color="#fff" style={{marginRight: 7}} />
            <Text style={s.resetTxt}>Reset zmeny</Text>
          </TouchableOpacity>

        </ScrollView>

        {/* ── STICKY FOOTER — hidden when keyboard open ─────────────────────── */}
        {!keyboardVisible && (
          <View style={[s.stickyFooter, {
            backgroundColor: darkMode ? '#0d1117' : '#f8fafc',
            borderTopColor: T.border,
          }]}>
            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'center'}}>
              <Text style={{fontSize:9, fontWeight:'800', letterSpacing:2, color: T.subText}}>CREATED BY</Text>
              <View style={{width:4, height:4, borderRadius:2, backgroundColor: T.subText, marginHorizontal:9}} />
              <Text style={{fontSize:13, fontWeight:'700', color: T.text, letterSpacing:0.1}}>Róbert Rosenberger</Text>
              <View style={{width:4, height:4, borderRadius:2, backgroundColor: T.subText, marginHorizontal:9}} />
              <Text style={{fontSize:12, fontWeight:'700', color: ACCENT, letterSpacing:0.3}}>Shift Checklist</Text>
            </View>
          </View>
        )}

      </KeyboardAvoidingView>

      {/* ── AI PHOTO SCAN MODAL ─── */}
      <Modal visible={showPhotoScanModal} transparent animationType="fade">
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.65)', alignItems:'center', justifyContent:'center', padding:32}}>
          <View style={{backgroundColor:T.card, borderRadius:22, padding:32, alignItems:'center', minWidth:260, borderWidth:1.5, borderColor:'#a855f7'}}>
            {aiPhotoLoading ? (
              <ActivityIndicator size="large" color="#a855f7" />
            ) : (
              <Ionicons name={photoScanStatus.startsWith('✓') ? 'checkmark-circle' : 'alert-circle'} size={36} color={photoScanStatus.startsWith('✓') ? '#22c55e' : '#ef4444'} />
            )}
            <Text style={{fontSize:14, fontWeight:'700', color:T.text, marginTop:16, textAlign:'center'}}>{photoScanStatus || 'Analyzujem...'}</Text>
          </View>
        </View>
      </Modal>

      {/* ── SETTINGS MODAL ─────────────────────────────────────────────────── */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowSettings(false); setAiSettingsUnlocked(false); setSettingsCatSec(p => ({...p, ai: false})); }}
      >
        <View style={[sm.container, {backgroundColor: T.background}]}>

          {/* Header */}
          <View style={[sm.header, {borderBottomColor: T.border, backgroundColor: T.background}]}>
            <View style={sm.headerLeft}>
              <View style={sm.headerIconWrap}>
                <Ionicons name="settings" size={18} color="#fff" />
              </View>
              <Text style={[sm.title, {color: T.text}]}>Nastavenia</Text>
            </View>
            <TouchableOpacity
              style={[sm.closeBtn, {backgroundColor: T.card, borderColor: T.border}]}
              onPress={() => { setShowSettings(false); setAiSettingsUnlocked(false); setSettingsCatSec(p => ({...p, ai: false})); }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={18} color={T.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={sm.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ─── VZHĽAD ─── */}
            <View style={sm.sectionLabelRow}>
              <Ionicons name="color-palette-outline" size={12} color={T.subText} style={{marginRight: 5}} />
              <Text style={[sm.sectionLabel, {color: T.subText}]}>VZHĽAD</Text>
            </View>
            <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
              <View style={sm.row}>
                <View style={sm.rowLeft}>
                  <View style={[sm.iconBox, {backgroundColor: darkMode ? '#2d1b69' : '#ede9fe'}]}>
                    <Ionicons name={darkMode ? 'moon' : 'sunny'} size={17} color={darkMode ? '#a78bfa' : '#7c3aed'} />
                  </View>
                  <View style={sm.rowTextBlock}>
                    <Text style={[sm.rowLabel, {color: T.text}]}>Tmavý režim</Text>
                    <Text style={[sm.rowSub, {color: T.subText}]}>{darkMode ? 'Aktívny' : 'Neaktívny'}</Text>
                  </View>
                </View>
                <Switch
                  value={darkMode}
                  onValueChange={setDarkMode}
                  trackColor={{false:'#cbd5e1', true:'#7c3aed'}}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* ─── SEKCIE ─── */}
            <View style={sm.sectionLabelRow}>
              <Ionicons name="eye-outline" size={12} color={T.subText} style={{marginRight: 5}} />
              <Text style={[sm.sectionLabel, {color: T.subText}]}>SEKCIE</Text>
            </View>
            <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
              <View style={[sm.lockBanner, {
                backgroundColor: sekciEditEnabled
                  ? (darkMode ? '#052e16' : '#f0fdf4')
                  : (darkMode ? '#1a0a0a' : '#fff5f5'),
                borderBottomColor: sekciEditEnabled
                  ? (darkMode ? '#14532d' : '#bbf7d0')
                  : (darkMode ? '#7f1d1d' : '#fecaca'),
              }]}>
                <View style={[sm.lockBannerIcon, {
                  backgroundColor: sekciEditEnabled
                    ? (darkMode ? '#14532d' : '#dcfce7')
                    : (darkMode ? '#7f1d1d' : '#fee2e2'),
                }]}>
                  <Ionicons
                    name={sekciEditEnabled ? 'lock-open' : 'lock-closed'}
                    size={16}
                    color={sekciEditEnabled ? (darkMode ? '#4ade80' : '#16a34a') : (darkMode ? '#f87171' : '#dc2626')}
                  />
                </View>
                <View style={{flex:1}}>
                  <Text style={[sm.lockBannerTitle, {color: sekciEditEnabled ? (darkMode ? '#86efac' : '#15803d') : (darkMode ? '#fca5a5' : '#dc2626')}]}>
                    {sekciEditEnabled ? 'Editovanie sekcií je aktívne' : 'Editovanie sekcií je zamknuté'}
                  </Text>
                  <Text style={[sm.lockBannerSub, {color: sekciEditEnabled ? (darkMode ? '#4ade80' : '#16a34a') : (darkMode ? '#f87171' : '#ef4444')}]}>
                    {sekciEditEnabled ? 'Môžeš skrývať/zobrazovať sekcie' : 'Zadaj heslo na odomknutie'}
                  </Text>
                </View>
              </View>

              {!sekciEditEnabled ? (
                <View style={{paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16}}>
                  {!showSekciPin ? (
                    <TouchableOpacity
                      style={[sm.unlockBtn, {backgroundColor: ACCENT}]}
                      onPress={() => { setSekciPinInput(''); setSekciPinError(false); setShowSekciPin(true); }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="keypad-outline" size={17} color="#111" style={{marginRight: 9}} />
                      <Text style={[sm.unlockBtnTxt, {color: '#111'}]}>Zadať PIN</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{alignItems:'center'}}>
                      <Text style={[pin.title, {color: T.text, fontSize: 17, marginBottom: 4}]}>Zadaj PIN</Text>
                      <Text style={[pin.sub, {color: T.subText, fontSize: 12, marginBottom: 20}]}>4-ciferný PIN pre editovanie sekcií</Text>
                      <View style={pin.dotsRow}>
                        {[0,1,2,3].map(i => (
                          <View key={i} style={[
                            pin.dot,
                            {backgroundColor: sekciPinError ? DANGER : (sekciPinInput.length > i ? ACCENT : (darkMode ? '#334155' : '#e2e8f0'))},
                          ]} />
                        ))}
                      </View>
                      {sekciPinError && <Text style={pin.errorTxt}>Nesprávny PIN</Text>}
                      <View style={pin.numpad}>
                        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => {
                          if (key === '') return <View key={idx} style={pin.numKeyEmpty} />;
                          const isBack = key === '⌫';
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[pin.numKey, {backgroundColor: isBack ? 'transparent' : (darkMode ? '#1e293b' : '#f1f5f9')}]}
                              onPress={() => isBack ? handleSekciPinBack() : handleSekciPinPress(key)}
                              activeOpacity={0.6}
                            >
                              {isBack
                                ? <Ionicons name="backspace-outline" size={22} color={T.text} />
                                : <Text style={[pin.numKeyTxt, {color: T.text}]}>{key}</Text>
                              }
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TouchableOpacity
                        onPress={() => { setShowSekciPin(false); setSekciPinInput(''); setSekciPinError(false); }}
                        style={{marginTop: 14}}
                        activeOpacity={0.7}
                      >
                        <Text style={{color: T.subText, fontSize: 13, fontWeight: '600'}}>Zrušiť</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View>
                  <View style={{flexDirection:'row', padding:12, gap:8}}>
                    <TouchableOpacity
                      style={{flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:8, paddingHorizontal:6, borderRadius:10,
                        backgroundColor: sekTab === 'morning' ? (darkMode ? '#2d1800' : '#fffbeb') : (darkMode ? '#1e293b' : '#f1f5f9'),
                        borderWidth:1,
                        borderColor: sekTab === 'morning' ? '#f59e0b' : T.border,
                      }}
                      onPress={() => setSekTab('morning')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name='sunny' size={14} color={sekTab === 'morning' ? '#f59e0b' : T.subText} style={{marginRight:5}} />
                      <Text style={{fontSize:12, fontWeight:'700', color: sekTab === 'morning' ? '#f59e0b' : T.subText}}>Ranná zmena</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:8, paddingHorizontal:6, borderRadius:10,
                        backgroundColor: sekTab === 'afternoon' ? (darkMode ? '#0c1a2e' : '#eff6ff') : (darkMode ? '#1e293b' : '#f1f5f9'),
                        borderWidth:1,
                        borderColor: sekTab === 'afternoon' ? '#3b82f6' : T.border,
                      }}
                      onPress={() => setSekTab('afternoon')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name='partly-sunny' size={14} color={sekTab === 'afternoon' ? '#3b82f6' : T.subText} style={{marginRight:5}} />
                      <Text style={{fontSize:12, fontWeight:'700', color: sekTab === 'afternoon' ? '#3b82f6' : T.subText}}>Obedná zmena</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal: 0}]} />

                  {[
                    { key: 'beforeShift',  label: 'Pred zmenou',             icon: 'clipboard-outline',   iconBg: darkMode ? '#052e16' : '#f0fdf4', iconColor: '#22c55e' },
                    { key: 'duringShift',  label: 'Počas zmeny',             icon: 'time-outline',        iconBg: darkMode ? '#0c1a2e' : '#eff6ff', iconColor: '#3b82f6' },
                    { key: 'walkthrough',  label: 'Obhliadky prevádzky',     icon: 'walk-outline',        iconBg: darkMode ? '#2d1800' : '#fffbeb', iconColor: '#f59e0b' },
                    { key: 'table',        label: 'Plan / Realita',          icon: 'grid-outline',        iconBg: darkMode ? '#1a0a2e' : '#fdf4ff', iconColor: '#a855f7' },
                    { key: 'hours',        label: 'Hodiny',                  icon: 'time-outline',        iconBg: darkMode ? '#0c1a2e' : '#eff6ff', iconColor: '#3b82f6' },
                    { key: 'productivity', label: 'Produktivita',            icon: 'trending-up-outline', iconBg: darkMode ? '#052e16' : '#f0fdf4', iconColor: '#22c55e' },
                    { key: 'evaluation',   label: 'Hodnotenie zmeny',        icon: 'stats-chart-outline', iconBg: darkMode ? '#2d1800' : '#fffbeb', iconColor: '#f59e0b' },
                    { key: 'notes',        label: 'Poznámky',                icon: 'create-outline',      iconBg: darkMode ? '#0c1a2e' : '#eff6ff', iconColor: '#3b82f6' },
                    { key: 'handover',     label: 'Odkaz pre ďalšiu zmenu', icon: 'mail-outline',        iconBg: darkMode ? '#1a0a2e' : '#fdf4ff', iconColor: '#a855f7' },
                    { key: 'afterShift',   label: 'Po zmene',               icon: 'moon-outline',        iconBg: darkMode ? '#1a0420' : '#fdf2f8', iconColor: '#ec4899' },
                  ].map(({ key, label, icon, iconBg, iconColor }, idx) => {
                    const tabVis    = sekTab === 'morning' ? morningSectionVis    : afternoonSectionVis;
                    const setTabVis = sekTab === 'morning' ? setMorningSectionVis : setAfternoonSectionVis;
                    return (
                      <View key={key}>
                        <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal: 0}]} />
                        <View style={sm.row}>
                          <View style={sm.rowLeft}>
                            <View style={[sm.iconBox, {backgroundColor: iconBg}]}>
                              <Ionicons name={icon} size={17} color={iconColor} />
                            </View>
                            <View style={sm.rowTextBlock}>
                              <Text style={[sm.rowLabel, {color: T.text}]}>{label}</Text>
                              <Text style={[sm.rowSub, {color: T.subText}]}>{tabVis[key] ? 'Viditeľná' : 'Skrytá'}</Text>
                            </View>
                          </View>
                          <Switch
                            value={tabVis[key]}
                            onValueChange={(v) => setTabVis(prev => ({...prev, [key]: v}))}
                            trackColor={{false:'#cbd5e1', true:'#7c3aed'}}
                            thumbColor="#fff"
                          />
                        </View>
                      </View>
                    );
                  })}

                  <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal: 0}]} />
                  <View style={{padding: 16, paddingTop: 14}}>
                    <TouchableOpacity
                      style={[sm.unlockBtn, {backgroundColor: DANGER}]}
                      onPress={() => { setSekciEditEnabled(false); setShowSekciPin(false); setSekciPinInput(''); setSekciPinError(false); }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="lock-closed-outline" size={17} color="#fff" style={{marginRight: 9}} />
                      <Text style={[sm.unlockBtnTxt, {color: '#fff'}]}>Zamknúť editovanie sekcií</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* ─── EDITOVANIE ─── */}
            <View style={sm.sectionLabelRow}>
              <Ionicons name="pencil-outline" size={12} color={T.subText} style={{marginRight: 5}} />
              <Text style={[sm.sectionLabel, {color: T.subText}]}>EDITOVANIE</Text>
            </View>
            <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
              <View style={[sm.lockBanner, {
                backgroundColor: editingEnabled
                  ? (darkMode ? '#052e16' : '#f0fdf4')
                  : (darkMode ? '#1a0a0a' : '#fff5f5'),
                borderBottomColor: editingEnabled
                  ? (darkMode ? '#14532d' : '#bbf7d0')
                  : (darkMode ? '#7f1d1d' : '#fecaca'),
              }]}>
                <View style={[sm.lockBannerIcon, {
                  backgroundColor: editingEnabled
                    ? (darkMode ? '#14532d' : '#dcfce7')
                    : (darkMode ? '#7f1d1d' : '#fee2e2'),
                }]}>
                  <Ionicons
                    name={editingEnabled ? 'lock-open' : 'lock-closed'}
                    size={16}
                    color={editingEnabled ? (darkMode ? '#4ade80' : '#16a34a') : (darkMode ? '#f87171' : '#dc2626')}
                  />
                </View>
                <View style={{flex:1}}>
                  <Text style={[sm.lockBannerTitle, {color: editingEnabled ? (darkMode ? '#86efac' : '#15803d') : (darkMode ? '#fca5a5' : '#dc2626')}]}>
                    {editingEnabled ? 'Editovanie je aktívne' : 'Editovanie je zamknuté'}
                  </Text>
                  <Text style={[sm.lockBannerSub, {color: editingEnabled ? (darkMode ? '#4ade80' : '#16a34a') : (darkMode ? '#f87171' : '#ef4444')}]}>
                    {editingEnabled ? 'Môžeš upravovať checklisty a tabuľky' : 'Zadaj heslo na odomknutie úprav'}
                  </Text>
                </View>
              </View>

              {!editingEnabled ? (
                <View style={{paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16}}>
                  {!showPinModal ? (
                    <TouchableOpacity
                      style={[sm.unlockBtn, {backgroundColor: ACCENT}]}
                      onPress={() => { setPinInput(''); setPinError(false); setShowPinModal(true); }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="keypad-outline" size={17} color="#111" style={{marginRight: 9}} />
                      <Text style={[sm.unlockBtnTxt, {color: '#111'}]}>Zadať PIN</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{alignItems:'center'}}>
                      <Text style={[pin.title, {color: T.text, fontSize: 17, marginBottom: 4}]}>Zadaj PIN</Text>
                      <Text style={[pin.sub, {color: T.subText, fontSize: 12, marginBottom: 20}]}>4-ciferný PIN pre editovanie</Text>
                      <View style={pin.dotsRow}>
                        {[0,1,2,3].map(i => (
                          <View key={i} style={[
                            pin.dot,
                            {backgroundColor: pinError ? DANGER : (pinInput.length > i ? ACCENT : (darkMode ? '#334155' : '#e2e8f0'))},
                          ]} />
                        ))}
                      </View>
                      {pinError && <Text style={pin.errorTxt}>Nesprávny PIN</Text>}
                      <View style={pin.numpad}>
                        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => {
                          if (key === '') return <View key={idx} style={pin.numKeyEmpty} />;
                          const isBack = key === '⌫';
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[pin.numKey, {backgroundColor: isBack ? 'transparent' : (darkMode ? '#1e293b' : '#f1f5f9')}]}
                              onPress={() => isBack ? handlePinBack() : handlePinPress(key)}
                              activeOpacity={0.6}
                            >
                              {isBack
                                ? <Ionicons name="backspace-outline" size={22} color={T.text} />
                                : <Text style={[pin.numKeyTxt, {color: T.text}]}>{key}</Text>
                              }
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TouchableOpacity
                        onPress={() => { setShowPinModal(false); setPinInput(''); setPinError(false); }}
                        style={{marginTop: 14}}
                        activeOpacity={0.7}
                      >
                        <Text style={{color: T.subText, fontSize: 13, fontWeight: '600'}}>Zrušiť</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{padding: 16, paddingTop: 14}}>
                  <TouchableOpacity style={[sm.unlockBtn, {backgroundColor: DANGER}]} onPress={() => setEditingEnabled(false)} activeOpacity={0.85}>
                    <Ionicons name="lock-closed-outline" size={17} color="#fff" style={{marginRight: 9}} />
                    <Text style={[sm.unlockBtnTxt, {color: '#fff'}]}>Zamknúť editovanie</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* ─── HESLO ─── */}
            <View style={sm.sectionLabelRow}>
              <Ionicons name="key-outline" size={12} color={T.subText} style={{marginRight: 5}} />
              <Text style={[sm.sectionLabel, {color: T.subText}]}>HESLO</Text>
            </View>
            <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
              {!showChangePw ? (
                <TouchableOpacity
                  style={[sm.ghostBtn, {borderColor: T.border}]}
                  onPress={() => setShowChangePw(true)}
                  activeOpacity={0.8}
                >
                  <View style={[sm.iconBox, {backgroundColor: darkMode ? '#1a0a00' : '#fff7ed', marginRight: 12}]}>
                    <Ionicons name="key-outline" size={17} color="#f97316" />
                  </View>
                  <Text style={[sm.ghostBtnTxt, {color: T.text}]}>Zmeniť heslo</Text>
                  <Ionicons name="chevron-forward" size={16} color={T.subText} style={{marginLeft: 'auto'}} />
                </TouchableOpacity>
              ) : (
                <View style={{padding: 16}}>
                  {[
                    { label: 'Aktuálne heslo', value: cpCurrent, setter: setCpCurrent, show: showCpCurrent, toggleShow: () => setShowCpCurrent(p => !p), step: '1' },
                    { label: 'Nové heslo',      value: cpNew,     setter: setCpNew,     show: showCpNew,     toggleShow: () => setShowCpNew(p => !p),     step: '2' },
                    { label: 'Potvrď heslo',    value: cpConfirm, setter: setCpConfirm, show: showCpConfirm, toggleShow: () => setShowCpConfirm(p => !p), step: '3' },
                  ].map(({ label, value, setter, show, toggleShow, step }) => (
                    <View key={label} style={{marginBottom: 10}}>
                      <View style={sm.pwLabelRow}>
                        <View style={sm.pwStep}><Text style={sm.pwStepTxt}>{step}</Text></View>
                        <Text style={[sm.pwFieldLabel, {color: T.subText}]}>{label}</Text>
                      </View>
                      <View style={[sm.passwordRow, {backgroundColor: T.inputBg, borderColor: T.border, marginBottom: 0}]}>
                        <View style={[sm.inputIconWrap, {backgroundColor: darkMode ? '#1e293b' : '#f1f5f9'}]}>
                          <Ionicons name="key-outline" size={15} color={T.placeholder} />
                        </View>
                        <TextInput
                          style={[sm.passwordInput, {color: T.inputText}]}
                          placeholder={label}
                          placeholderTextColor={T.placeholder}
                          secureTextEntry={!show}
                          value={value}
                          onChangeText={setter}
                          returnKeyType="done"
                        />
                        <TouchableOpacity onPress={toggleShow} activeOpacity={0.7} style={sm.eyeBtn}>
                          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={17} color={T.placeholder} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  <View style={{flexDirection:'row', gap: 8, marginTop: 6}}>
                    <TouchableOpacity
                      style={[sm.ghostBtn, {flex:1, borderColor: T.border, paddingVertical: 13}]}
                      onPress={() => { setShowChangePw(false); setCpCurrent(''); setCpNew(''); setCpConfirm(''); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[sm.ghostBtnTxt, {color: T.text}]}>Zrušiť</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[sm.primaryBtn, {flex:1, margin: 0, backgroundColor: ACCENT}]}
                      onPress={changePassword}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="checkmark-outline" size={16} color="#111" style={{marginRight: 6}} />
                      <Text style={[sm.primaryBtnTxt, {color: '#111'}]}>Uložiť</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* ─── SEKCIE VIDITEĽNÉ LEN PO ODOMKNUTÍ ─── */}
            {editingEnabled && (
              <>

                {/* ════ POKROČILÉ NASTAVENIA ════════════════════════════════════════════ */}
                <View style={sm.sectionLabelRow}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                  <Text style={[sm.sectionLabel, {color: T.subText}]}>POKROČILÉ NASTAVENIA</Text>
                </View>

                {/* ── 1. AI ASISTENT ─────────────────────────────────────────────────── */}
                <View style={{marginBottom: 10}}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!aiSettingsUnlocked) { setShowAiPinModal(true); }
                      else { setSettingsCatSec(p => ({...p, ai: !p.ai})); }
                    }}
                    style={[sm.catHdr, {
                      backgroundColor: settingsCatSec.ai ? (darkMode ? '#1a0a2e' : '#fdf4ff') : T.card,
                      borderColor: settingsCatSec.ai ? '#a855f7' : T.border,
                      borderBottomLeftRadius: settingsCatSec.ai ? 0 : 16,
                      borderBottomRightRadius: settingsCatSec.ai ? 0 : 16,
                    }]}
                    activeOpacity={0.8}
                  >
                    <View style={[sm.catIco, {backgroundColor: settingsCatSec.ai ? (darkMode ? '#2d0a4e' : '#ede9fe') : T.sectionIconBg}]}>
                      <Text style={{fontSize: 22}}>🤖</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[sm.catLbl, {color: T.text}]}>AI Asistent</Text>
                      <Text style={[sm.catSub, {color: T.subText}]}>
                        {aiPrefs.enabled ? `${aiActiveCount}/${aiTotalCount} alertov aktívnych` : 'Vypnutý'}
                      </Text>
                    </View>
                    <Ionicons
                      name={!aiSettingsUnlocked ? 'lock-closed-outline' : settingsCatSec.ai ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={!aiSettingsUnlocked ? '#a855f7' : settingsCatSec.ai ? '#a855f7' : T.subText}
                    />
                  </TouchableOpacity>
                  {settingsCatSec.ai && aiSettingsUnlocked && (
                    <View style={[sm.catBody, {borderColor: '#a855f7', backgroundColor: T.card}]}>
                      {/* AI Asistent card */}
                      <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border, borderRadius:0, marginBottom:0, borderTopWidth:0, borderLeftWidth:0, borderRightWidth:0}]}>
                        {/* ─── AI ASISTENT ─── */}
                                        <View style={sm.sectionLabelRow}>
                                          <Ionicons name="sparkles-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                                          <Text style={[sm.sectionLabel, {color: T.subText}]}>AI ASISTENT</Text>
                                        </View>
                        
                                        <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                        
                                          {/* Master toggle */}
                                          <View style={[sm.row, {paddingVertical:16}]}>
                                            <View style={[sm.rowLeft, {flex:1, marginRight:8}]}>
                                              <View style={[sm.iconBox, {backgroundColor: aiPrefs.enabled ? (darkMode ? '#1a0a2e' : '#fdf4ff') : T.sectionIconBg}]}>
                                                <Ionicons name="sparkles" size={17} color={aiPrefs.enabled ? '#a855f7' : T.sectionIcon} />
                                              </View>
                                              <View style={{flex:1}}>
                                                <Text style={[sm.rowLabel, {color:T.text}]}>AI Asistent</Text>
                                                <Text style={[sm.rowSub, {color:T.subText}]}>{aiPrefs.enabled ? 'Aktívny — analyzuje dáta zmeny' : 'Vypnutý'}</Text>
                                              </View>
                                            </View>
                                            <Switch value={aiPrefs.enabled} onValueChange={(v)=>{const next={...aiPrefs,enabled:v};setAiPrefs(next);setTimeout(()=>scheduleAllNotifications(),400);}} trackColor={{false:'#cbd5e1',true:'#a855f7'}} thumbColor="#fff" />
                                          </View>
                        
                                          {aiPrefs.enabled && (<>
                        
                                            {/* ── SUMMARY KARTA — celkový prehľad aktívnych alertov ───────────── */}
                                            <View style={{
                                              marginHorizontal:16, marginBottom:14,
                                              borderRadius:14, overflow:'hidden',
                                              borderWidth:1.5,
                                              borderColor: aiActiveCount > 8 ? (darkMode ? '#5b21b6' : '#ddd6fe') : (darkMode ? '#1e293b' : '#e2e8f0'),
                                            }}>
                                              {/* Top bar */}
                                              <View style={{
                                                flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                                                paddingHorizontal:14, paddingVertical:10,
                                                backgroundColor: aiActiveCount > 8 ? (darkMode ? '#1a0a2e' : '#fdf4ff') : (darkMode ? '#111e34' : '#f8fafc'),
                                              }}>
                                                <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                                                  <Ionicons name="pulse-outline" size={16} color={aiActiveCount > 8 ? '#a855f7' : T.subText} />
                                                  <Text style={{fontSize:13, fontWeight:'800', color: aiActiveCount > 8 ? '#a855f7' : T.text, letterSpacing:0.3}}>
                                                    Aktívne AI alerty
                                                  </Text>
                                                </View>
                                                <View style={{
                                                  paddingHorizontal:10, paddingVertical:4, borderRadius:20,
                                                  backgroundColor: aiActiveCount > 8 ? '#a855f7' : (darkMode ? '#1e293b' : '#e2e8f0'),
                                                }}>
                                                  <Text style={{
                                                    fontSize:12, fontWeight:'800',
                                                    color: aiActiveCount > 8 ? '#fff' : T.subText,
                                                  }}>
                                                    {aiActiveCount}/{aiTotalCount}
                                                  </Text>
                                                </View>
                                              </View>
                                              {/* Progress bar */}
                                              <View style={{height:4, backgroundColor: darkMode ? '#1e293b' : '#e2e8f0'}}>
                                                <View style={{
                                                  height:4,
                                                  width: `${Math.round((aiActiveCount/aiTotalCount)*100)}%`,
                                                  backgroundColor: aiActiveCount > 8 ? '#a855f7' : aiActiveCount > 4 ? '#f59e0b' : '#64748b',
                                                }} />
                                              </View>
                                              {/* Bottom row with quick stats */}
                                              <View style={{
                                                flexDirection:'row',
                                                paddingHorizontal:14, paddingVertical:8,
                                                backgroundColor: darkMode ? '#0a1120' : '#f1f5f9',
                                                gap:14,
                                              }}>
                                                {[
                                                  {label:'Špička', count:[aiPrefs.preRush,aiPrefs.strongestHour,aiPrefs.weakestHour,aiPrefs.kitchenCheck].filter(Boolean).length, total:4, color:'#f59e0b'},
                                                  {label:'Výkon',  count:[aiPrefs.behindPlan,aiPrefs.aheadPlan,aiPrefs.trendAlert,aiPrefs.cumulativeTracker].filter(Boolean).length, total:4, color:'#ef4444'},
                                                  {label:'R2P',    count:[aiPrefs.r2pMonitor].filter(Boolean).length, total:1, color:'#3b82f6'},
                                                  {label:'Ďalšie', count:[aiPrefs.tcMonitor,aiPrefs.showBestWorstRow,aiPrefs.dailyComparison,aiPrefs.staffingAdvisor,aiPrefs.endOfShiftProjection].filter(Boolean).length, total:5, color:'#8b5cf6'},
                                                ].map(({label, count, total, color}) => (
                                                  <View key={label} style={{flex:1, alignItems:'center'}}>
                                                    <Text style={{fontSize:11, fontWeight:'700', color: count > 0 ? color : T.subText}}>{count}/{total}</Text>
                                                    <Text style={{fontSize:9, color: T.subText, marginTop:1}}>{label}</Text>
                                                  </View>
                                                ))}
                                              </View>
                                            </View>
                        
                                            {/* Info banner */}
                                            <View style={[sm.infoBox, {backgroundColor:darkMode?'#1a0a2e':'#fdf4ff',borderColor:darkMode?'#6b21a8':'#d8b4fe',marginTop:0}]}>
                                              <Ionicons name="information-circle-outline" size={14} color={darkMode?'#c084fc':'#7c3aed'} style={{marginRight:8,marginTop:1}} />
                                              <Text style={[sm.infoText, {color:darkMode?'#c084fc':'#6d28d9'}]}>{'AI sleduje tvoje Sales Plan dáta a upozorní ťa na kľúčové momenty zmeny — všetko beží priamo v appke, bez internetu.'}</Text>
                                            </View>
                        
                                            <View style={[sm.divider, {backgroundColor:T.border,marginHorizontal:0}]} />
                        
                                            {/* ═══ ČASOVANIE ═══════════════════════════════════════════════════════ */}
                                            <View style={{marginHorizontal:16, marginTop:14, marginBottom:14}}>
                                              <TouchableOpacity onPress={()=>setAiCollapse(p=>({...p,casovanie:!p.casovanie}))} style={{flexDirection:'row', alignItems:'center', gap:6, marginBottom:aiCollapse.casovanie?10:0, paddingVertical:4}} activeOpacity={0.7}>
                                                <View style={{width:22, height:22, borderRadius:6, backgroundColor:darkMode?'#2d1800':'#fffbeb', alignItems:'center', justifyContent:'center'}}>
                                                  <Text style={{fontSize:12}}>🕐</Text>
                                                </View>
                                                <Text style={{fontSize:12, fontWeight:'800', letterSpacing:0.8, color:'#f59e0b', flex:1}}>ČASOVANIE NOTIFIKÁCIÍ</Text>
                                                <Ionicons name={aiCollapse.casovanie?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                                              </TouchableOpacity>
                                              {aiCollapse.casovanie && (<>
                                              {[
                                                {label:'AI hodinové alerty', sub:'Koľko minút PO hodine prídu AI notifikácie', key:'aiAlertMinutes', color:'#f59e0b', min:1, max:58, step:1, def:2},
                                                {label:'Pre-rush varovanie', sub:'Koľko minút PRED najsilnejšou hodinou', key:'preRushMinutes', color:'#f59e0b', min:1, max:59, step:5, def:10},
                                              ].map(({label,sub,key,color,min,max,step,def}) => (
                                                <View key={key} style={{
                                                  flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                                                  paddingVertical:10, paddingHorizontal:12,
                                                  backgroundColor:darkMode?'#1e1e3a':'#f8faff',
                                                  borderRadius:12, marginBottom:8, borderWidth:1, borderColor:T.border,
                                                }}>
                                                  <View style={{flex:1, marginRight:8}}>
                                                    <Text style={{fontSize:13, fontWeight:'700', color:T.text}}>{label}</Text>
                                                    <Text style={{fontSize:11, color:T.subText, marginTop:2}}>{sub}</Text>
                                                  </View>
                                                  <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                                                    <TouchableOpacity onPress={()=>setAiPrefs(p=>({...p,[key]:Math.max(min,(p[key]??def)-step)}))} style={{width:32,height:32,borderRadius:10,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                    <View style={{width:44,height:32,borderRadius:8,backgroundColor:darkMode?'#0f0f2e':'#fff',borderWidth:1,borderColor:color,alignItems:'center',justifyContent:'center'}}>
                                                      <TextInput style={{color:color,fontWeight:'800',fontSize:15,textAlign:'center',width:'100%'}} value={String(aiPrefs[key]??def)} keyboardType="numeric" maxLength={3} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=min&&n<=max)setAiPrefs(p=>({...p,[key]:n}));}} />
                                                    </View>
                                                    <TouchableOpacity onPress={()=>setAiPrefs(p=>({...p,[key]:Math.min(max,(p[key]??def)+step)}))} style={{width:32,height:32,borderRadius:10,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                                    <Text style={{color:T.subText,fontSize:11,marginLeft:2}}>min</Text>
                                                  </View>
                                                </View>
                                              ))}
                                            </>)}
                                            </View>
                        
                                            <View style={[sm.divider, {backgroundColor:T.border,marginHorizontal:0}]} />
                        
                                            {/* ═══ PRAHY UPOZORNENÍ ════════════════════════════════════════════════ */}
                                            <View style={{marginHorizontal:16, marginTop:14, marginBottom:14}}>
                                              <TouchableOpacity onPress={()=>setAiCollapse(p=>({...p,prahy:!p.prahy}))} style={{flexDirection:'row', alignItems:'center', gap:6, marginBottom:aiCollapse.prahy?10:0, paddingVertical:4}} activeOpacity={0.7}>
                                                <View style={{width:22, height:22, borderRadius:6, backgroundColor:darkMode?'#2d0a0a':'#fee2e2', alignItems:'center', justifyContent:'center'}}>
                                                  <Text style={{fontSize:12}}>🎚️</Text>
                                                </View>
                                                <Text style={{fontSize:12, fontWeight:'800', letterSpacing:0.8, color:'#ef4444', flex:1}}>PRAHY UPOZORNENÍ</Text>
                                                <Ionicons name={aiCollapse.prahy?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                                              </TouchableOpacity>
                                              {aiCollapse.prahy && (<>
                                              {[
                                                {label:'Pod plán — prah', sub:'Upozorniť keď Real < X% plánu', key:'behindThreshold', color:'#ef4444', min:50, max:99, step:5, def:90, unit:'%'},
                                                {label:'Nad plán — prah', sub:'Upozorniť keď Real > X% plánu', key:'aheadThreshold', color:'#22c55e', min:101, max:200, step:5, def:110, unit:'%'},
                                                {label:'R2P cieľový čas', sub:('Zóny: ≤'+(aiPrefs.r2pTarget??135)+'s 🟢  '+((aiPrefs.r2pTarget??135)+1)+'–'+((aiPrefs.r2pTarget??135)+20)+'s 🟡  >'+(((aiPrefs.r2pTarget??135)+20))+'s 🔴'), key:'r2pTarget', color:'#3b82f6', min:60, max:300, step:5, def:135, unit:'s'},
                                              ].map(({label,sub,key,color,min,max,step,def,unit}) => (
                                                <View key={key} style={{
                                                  flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                                                  paddingVertical:10, paddingHorizontal:12,
                                                  backgroundColor:darkMode?'#1e1e3a':'#f8faff',
                                                  borderRadius:12, marginBottom:8, borderWidth:1, borderColor:T.border,
                                                }}>
                                                  <View style={{flex:1, marginRight:8}}>
                                                    <Text style={{fontSize:13, fontWeight:'700', color:T.text}}>{label}</Text>
                                                    <Text style={{fontSize:11, color:T.subText, marginTop:2}}>{sub}</Text>
                                                  </View>
                                                  <View style={{flexDirection:'row', alignItems:'center', gap:4}}>
                                                    <TouchableOpacity onPress={()=>{const n={...aiPrefs,[key]:Math.max(min,(aiPrefs[key]??def)-step)};setAiPrefs(n);setTimeout(()=>scheduleAllNotifications(),400);}} style={{width:32,height:32,borderRadius:10,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                    <View style={{width:48,height:32,borderRadius:8,backgroundColor:darkMode?'#0f0f2e':'#fff',borderWidth:1,borderColor:color,alignItems:'center',justifyContent:'center'}}>
                                                      <TextInput style={{color:color,fontWeight:'800',fontSize:15,textAlign:'center',width:'100%'}} value={String(aiPrefs[key]??def)} keyboardType="numeric" maxLength={3} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=min&&n<=max){const u={...aiPrefs,[key]:n};setAiPrefs(u);setTimeout(()=>scheduleAllNotifications(),400);}}} />
                                                    </View>
                                                    <TouchableOpacity onPress={()=>{const n={...aiPrefs,[key]:Math.min(max,(aiPrefs[key]??def)+step)};setAiPrefs(n);setTimeout(()=>scheduleAllNotifications(),400);}} style={{width:32,height:32,borderRadius:10,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                                    <Text style={{color:color,fontSize:12,fontWeight:'700',marginLeft:2}}>{unit}</Text>
                                                  </View>
                                                </View>
                                              ))}
                                            </>)}
                                            </View>
                        
                                            <View style={[sm.divider, {backgroundColor:T.border,marginHorizontal:0}]} />
                        
                                            {/* ═══ NOTIFIKÁCIE — skladacie sekcie ═════════════════════════════════ */}
                        
                                            {/* ── ŠPIČKA ──────────────────────────────────────────────────────── */}
                                            {(()=>{
                                              const cnt=[aiPrefs.preRush,aiPrefs.strongestHour,aiPrefs.weakestHour,aiPrefs.kitchenCheck].filter(Boolean).length;
                                              return(<View>
                                                <TouchableOpacity onPress={()=>setAiSec(p=>({...p,spicka:!p.spicka}))} style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:13}} activeOpacity={0.7}>
                                                  <View style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#2d1800':'#fffbeb',alignItems:'center',justifyContent:'center',marginRight:10}}>
                                                    <Text style={{fontSize:14}}>🏃</Text>
                                                  </View>
                                                  <Text style={{fontSize:13,fontWeight:'800',color:'#f59e0b',flex:1,letterSpacing:0.5}}>ŠPIČKA</Text>
                                                  <View style={{
                                                    paddingHorizontal:10,paddingVertical:4,borderRadius:20,
                                                    backgroundColor:cnt>0?(darkMode?'#2d1800':'#fffbeb'):T.sectionIconBg,
                                                    marginRight:8,
                                                    borderWidth:1,
                                                    borderColor:cnt>0?'#f59e0b':T.border,
                                                  }}>
                                                    <Text style={{fontSize:11,fontWeight:'700',color:cnt>0?'#f59e0b':T.subText}}>{cnt}/4</Text>
                                                  </View>
                                                  <Ionicons name={aiSec.spicka?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                                                </TouchableOpacity>
                                                {aiSec.spicka && (<View style={{marginHorizontal:16,marginBottom:12}}>
                                                  {[
                                                    {key:'preRush',label:'Pred-rush upozornenie',sub:'Navoz zásoby pred najsilnejšou hodinou',icon:'timer-outline',c:'#f59e0b',bg:darkMode?'#2d1800':'#fffbeb'},
                                                    {key:'strongestHour',label:'Najsilnejšia hodina',sub:'Upozornenie keď začína hodina s najvyšším plánom',icon:'flash',c:'#f59e0b',bg:darkMode?'#2d1800':'#fffbeb'},
                                                    {key:'weakestHour',label:'Slabšia hodina',sub:'Upozornenie keď začína hodina s najnižším plánom',icon:'trending-down-outline',c:'#ef4444',bg:darkMode?'#2d0a0a':'#fee2e2'},
                                                    {key:'kitchenCheck',label:'Kuchyňa / servis / loby',sub:'Pridá pripomienku do rush notifikácií',icon:'restaurant-outline',c:'#22c55e',bg:darkMode?'#052e16':'#f0fdf4'},
                                                  ].map(({key,label,sub,icon,c,bg},idx,arr)=>(
                                                    <React.Fragment key={key}>
                                                      <View style={{
                                                        flexDirection:'row',alignItems:'center',justifyContent:'space-between',
                                                        paddingVertical:10, paddingHorizontal:12,
                                                        borderRadius:10, marginBottom:4,
                                                        backgroundColor: aiPrefs[key] ? (darkMode?'rgba(245,158,11,0.06)':'rgba(245,158,11,0.04)') : 'transparent',
                                                      }}>
                                                        <View style={[sm.rowLeft,{flex:1,marginRight:8}]}>
                                                          <View style={[sm.iconBox,{backgroundColor:aiPrefs[key]?bg:T.sectionIconBg}]}><Ionicons name={icon} size={17} color={aiPrefs[key]?c:T.sectionIcon} /></View>
                                                          <View style={{flex:1}}><Text style={[sm.rowLabel,{color:T.text,fontSize:14}]}>{label}</Text><Text style={[sm.rowSub,{color:T.subText}]}>{sub}</Text></View>
                                                        </View>
                                                        <Switch value={!!aiPrefs[key]} onValueChange={(v)=>{const n={...aiPrefs,[key]:v};setAiPrefs(n);setTimeout(()=>scheduleAllNotifications(),400);}} trackColor={{false:'#cbd5e1',true:c}} thumbColor="#fff" />
                                                      </View>
                                                      {idx<arr.length-1&&<View style={[sm.divider,{backgroundColor:T.border,marginHorizontal:0,marginVertical:2}]} />}
                                                    </React.Fragment>
                                                  ))}
                                                </View>)}
                                                <View style={[sm.divider,{backgroundColor:T.border,marginHorizontal:0}]} />
                                              </View>);
                                            })()}
                        
                                            {/* ── VÝKON ───────────────────────────────────────────────────────── */}
                                            {(()=>{
                                              const cnt=[aiPrefs.behindPlan,aiPrefs.aheadPlan,aiPrefs.trendAlert,aiPrefs.cumulativeTracker].filter(Boolean).length;
                                              return(<View>
                                                <TouchableOpacity onPress={()=>setAiSec(p=>({...p,vykon:!p.vykon}))} style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:13}} activeOpacity={0.7}>
                                                  <View style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#2d0a0a':'#fee2e2',alignItems:'center',justifyContent:'center',marginRight:10}}>
                                                    <Text style={{fontSize:14}}>📊</Text>
                                                  </View>
                                                  <Text style={{fontSize:13,fontWeight:'800',color:'#ef4444',flex:1,letterSpacing:0.5}}>VÝKON</Text>
                                                  <View style={{
                                                    paddingHorizontal:10,paddingVertical:4,borderRadius:20,
                                                    backgroundColor:cnt>0?(darkMode?'#2d0a0a':'#fee2e2'):T.sectionIconBg,
                                                    marginRight:8,
                                                    borderWidth:1,
                                                    borderColor:cnt>0?'#ef4444':T.border,
                                                  }}>
                                                    <Text style={{fontSize:11,fontWeight:'700',color:cnt>0?'#ef4444':T.subText}}>{cnt}/4</Text>
                                                  </View>
                                                  <Ionicons name={aiSec.vykon?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                                                </TouchableOpacity>
                                                {aiSec.vykon && (<View style={{marginHorizontal:16,marginBottom:12}}>
                                                  {[
                                                    {key:'behindPlan',label:'Pod plán — zváž špeciálky',sub:`Keď Real < ${aiPrefs.behindThreshold??90}% plánu → promo`,icon:'alert-circle-outline',c:'#ef4444',bg:darkMode?'#2d0a0a':'#fee2e2'},
                                                    {key:'aheadPlan',label:'Nad plán — výborný výkon',sub:`Keď Real > ${aiPrefs.aheadThreshold??110}% plánu → pochvala`,icon:'checkmark-circle-outline',c:'#22c55e',bg:darkMode?'#052e16':'#f0fdf4'},
                                                    {key:'trendAlert',label:'Trendová detekcia',sub:'2+ hodiny za sebou pod/nad plán → eskalovaný alert',icon:'pulse-outline',c:'#a855f7',bg:darkMode?'#1a0a2e':'#fdf4ff'},
                                                    {key:'cumulativeTracker',label:'Kumulatívny tracker',sub:'Sleduje celkové Sales Real vs Plan počas celej zmeny',icon:'stats-chart-outline',c:'#22c55e',bg:darkMode?'#052e16':'#f0fdf4'},
                                                  ].map(({key,label,sub,icon,c,bg},idx,arr)=>(
                                                    <React.Fragment key={key}>
                                                      <View style={{
                                                        flexDirection:'row',alignItems:'center',justifyContent:'space-between',
                                                        paddingVertical:10, paddingHorizontal:12,
                                                        borderRadius:10, marginBottom:4,
                                                        backgroundColor: aiPrefs[key] ? (darkMode?'rgba(239,68,68,0.06)':'rgba(239,68,68,0.03)') : 'transparent',
                                                      }}>
                                                        <View style={[sm.rowLeft,{flex:1,marginRight:8}]}>
                                                          <View style={[sm.iconBox,{backgroundColor:aiPrefs[key]?bg:T.sectionIconBg}]}><Ionicons name={icon} size={17} color={aiPrefs[key]?c:T.sectionIcon} /></View>
                                                          <View style={{flex:1}}><Text style={[sm.rowLabel,{color:T.text,fontSize:14}]}>{label}</Text><Text style={[sm.rowSub,{color:T.subText}]}>{sub}</Text></View>
                                                        </View>
                                                        <Switch value={!!aiPrefs[key]} onValueChange={(v)=>{const n={...aiPrefs,[key]:v};setAiPrefs(n);setTimeout(()=>scheduleAllNotifications(),400);}} trackColor={{false:'#cbd5e1',true:c}} thumbColor="#fff" />
                                                      </View>
                                                      {idx<arr.length-1&&<View style={[sm.divider,{backgroundColor:T.border,marginHorizontal:0,marginVertical:2}]} />}
                                                    </React.Fragment>
                                                  ))}
                                                </View>)}
                                                <View style={[sm.divider,{backgroundColor:T.border,marginHorizontal:0}]} />
                                              </View>);
                                            })()}
                        
                                            {/* ── R2P ─────────────────────────────────────────────────────────── */}
                                            {(()=>{
                                              const cnt=[aiPrefs.r2pMonitor].filter(Boolean).length;
                                              return(<View>
                                                <TouchableOpacity onPress={()=>setAiSec(p=>({...p,r2p:!p.r2p}))} style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:13}} activeOpacity={0.7}>
                                                  <View style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#0c1a2e':'#eff6ff',alignItems:'center',justifyContent:'center',marginRight:10}}>
                                                    <Text style={{fontSize:14}}>⏱️</Text>
                                                  </View>
                                                  <Text style={{fontSize:13,fontWeight:'800',color:'#3b82f6',flex:1,letterSpacing:0.5}}>R2P</Text>
                                                  <View style={{
                                                    paddingHorizontal:10,paddingVertical:4,borderRadius:20,
                                                    backgroundColor:cnt>0?(darkMode?'#0c1a2e':'#eff6ff'):T.sectionIconBg,
                                                    marginRight:8,
                                                    borderWidth:1,
                                                    borderColor:cnt>0?'#3b82f6':T.border,
                                                  }}>
                                                    <Text style={{fontSize:11,fontWeight:'700',color:cnt>0?'#3b82f6':T.subText}}>{cnt}/1</Text>
                                                  </View>
                                                  <Ionicons name={aiSec.r2p?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                                                </TouchableOpacity>
                                                {aiSec.r2p && (<View style={{marginHorizontal:16,marginBottom:12}}>
                                                  <View style={{
                                                    flexDirection:'row',alignItems:'center',justifyContent:'space-between',
                                                    paddingVertical:10, paddingHorizontal:12,
                                                    borderRadius:10,
                                                    backgroundColor: aiPrefs.r2pMonitor ? (darkMode?'rgba(59,130,246,0.06)':'rgba(59,130,246,0.04)') : 'transparent',
                                                  }}>
                                                    <View style={[sm.rowLeft,{flex:1,marginRight:8}]}>
                                                      <View style={[sm.iconBox,{backgroundColor:aiPrefs.r2pMonitor?(darkMode?'#0c1a2e':'#eff6ff'):T.sectionIconBg}]}><Ionicons name="timer-outline" size={17} color={aiPrefs.r2pMonitor?'#3b82f6':T.sectionIcon} /></View>
                                                      <View style={{flex:1}}><Text style={[sm.rowLabel,{color:T.text,fontSize:14}]}>R2P monitoring</Text><Text style={[sm.rowSub,{color:T.subText}]}>{'Cieľ '+(aiPrefs.r2pTarget??135)+'s — kombinuje R2P so Sales výsledkami'}</Text></View>
                                                    </View>
                                                    <Switch value={!!aiPrefs.r2pMonitor} onValueChange={(v)=>{const n={...aiPrefs,r2pMonitor:v};setAiPrefs(n);setTimeout(()=>scheduleAllNotifications(),400);}} trackColor={{false:'#cbd5e1',true:'#3b82f6'}} thumbColor="#fff" />
                                                  </View>
                                                </View>)}
                                                <View style={[sm.divider,{backgroundColor:T.border,marginHorizontal:0}]} />
                                              </View>);
                                            })()}
                        
                                            {/* ── ĎALŠIE ──────────────────────────────────────────────────────── */}
                                            {(()=>{
                                              const cnt=[aiPrefs.tcMonitor,aiPrefs.showBestWorstRow,aiPrefs.dailyComparison,aiPrefs.staffingAdvisor,aiPrefs.endOfShiftProjection].filter(Boolean).length;
                                              return(<View>
                                                <TouchableOpacity onPress={()=>setAiSec(p=>({...p,dalse:!p.dalse}))} style={{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:13}} activeOpacity={0.7}>
                                                  <View style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#1e1e3a':'#f1f5f9',alignItems:'center',justifyContent:'center',marginRight:10}}>
                                                    <Text style={{fontSize:14}}>📈</Text>
                                                  </View>
                                                  <Text style={{fontSize:13,fontWeight:'800',color:T.text,flex:1,letterSpacing:0.5}}>ĎALŠIE</Text>
                                                  <View style={{
                                                    paddingHorizontal:10,paddingVertical:4,borderRadius:20,
                                                    backgroundColor:cnt>0?(darkMode?'#1e1e3a':'#f1f5f9'):T.sectionIconBg,
                                                    marginRight:8,
                                                    borderWidth:1,
                                                    borderColor:cnt>0?T.subText:T.border,
                                                  }}>
                                                    <Text style={{fontSize:11,fontWeight:'700',color:cnt>0?T.text:T.subText}}>{cnt}/5</Text>
                                                  </View>
                                                  <Ionicons name={aiSec.dalse?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                                                </TouchableOpacity>
                                                {aiSec.dalse && (<View style={{marginHorizontal:16,marginBottom:12}}>
                                                  {[
                                                    {key:'tcMonitor',label:'TC monitoring',sub:'Upozornenie keď TC Real padá pod/nad plán',icon:'receipt-outline',c:'#3b82f6',bg:darkMode?'#0c1a2e':'#eff6ff'},
                                                    {key:'showBestWorstRow',label:'Najlepší / najhorší kontext',sub:'Pridá best/worst info do každej notifikácie',icon:'podium-outline',c:'#f59e0b',bg:darkMode?'#2d1800':'#fffbeb'},
                                                    {key:'dailyComparison',label:'Denné porovnanie',sub:'Na konci zmeny porovná výsledky so včerajším dňom',icon:'calendar-outline',c:'#a855f7',bg:darkMode?'#1a0a2e':'#fdf4ff'},
                                                    {key:'staffingAdvisor',label:'Personálny poradca',sub:'Tempo < 82% → pustiť ľudí. Tempo > 115% → kapacita',icon:'people-outline',c:'#3b82f6',bg:darkMode?'#0c1a2e':'#eff6ff'},
                                                    {key:'endOfShiftProjection',label:'Projekcia konca zmeny',sub:'Po 3+ hodinách predikuje celkový výsledok zmeny',icon:'flag-outline',c:'#22c55e',bg:darkMode?'#052e16':'#f0fdf4'},
                                                  ].map(({key,label,sub,icon,c,bg},idx,arr)=>(
                                                    <React.Fragment key={key}>
                                                      <View style={{
                                                        flexDirection:'row',alignItems:'center',justifyContent:'space-between',
                                                        paddingVertical:10, paddingHorizontal:12,
                                                        borderRadius:10, marginBottom:4,
                                                        backgroundColor: aiPrefs[key] ? (darkMode?'rgba(139,92,246,0.06)':'rgba(139,92,246,0.03)') : 'transparent',
                                                      }}>
                                                        <View style={[sm.rowLeft,{flex:1,marginRight:8}]}>
                                                          <View style={[sm.iconBox,{backgroundColor:aiPrefs[key]?bg:T.sectionIconBg}]}><Ionicons name={icon} size={17} color={aiPrefs[key]?c:T.sectionIcon} /></View>
                                                          <View style={{flex:1}}><Text style={[sm.rowLabel,{color:T.text,fontSize:14}]}>{label}</Text><Text style={[sm.rowSub,{color:T.subText}]}>{sub}</Text></View>
                                                        </View>
                                                        <Switch value={!!aiPrefs[key]} onValueChange={(v)=>{const n={...aiPrefs,[key]:v};setAiPrefs(n);setTimeout(()=>scheduleAllNotifications(),400);}} trackColor={{false:'#cbd5e1',true:c}} thumbColor="#fff" />
                                                      </View>
                                                      {idx<arr.length-1&&<View style={[sm.divider,{backgroundColor:T.border,marginHorizontal:0,marginVertical:2}]} />}
                                                    </React.Fragment>
                                                  ))}
                                                </View>)}
                                              </View>);
                                            })()}
                                          </>)}
                                        </View>
                      </View>
                      {/* Ročné ciele */}
                      <TouchableOpacity onPress={()=>setAiCollapse(p=>({...p,rocne:!p.rocne}))} style={[sm.sectionLabelRow, {marginTop: 16, flexDirection:'row', alignItems:'center'}]} activeOpacity={0.7}>
                        <Ionicons name="calendar-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                        <Text style={[sm.sectionLabel, {color: T.subText, flex:1}]}>ROČNÉ CIELE</Text>
                        <Ionicons name={aiCollapse.rocne?'chevron-up':'chevron-down'} size={14} color={T.subText} />
                      </TouchableOpacity>
                      {aiCollapse.rocne && (
                      <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border, marginBottom:4}]}>
                                          <View style={{paddingHorizontal:16, paddingVertical:12}}>
                                            {/* AVG target */}
                                            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:6}}>
                                              <View style={[sm.rowLeft, {flex:1, marginRight:8}]}>
                                                <View style={[sm.iconBox, {backgroundColor: darkMode ? '#1a0a2e' : '#fdf4ff'}]}>
                                                  <Ionicons name="trending-up-outline" size={17} color="#a855f7" />
                                                </View>
                                                <View style={{flex:1}}>
                                                  <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>AVG cieľ (€/TC)</Text>
                                                  <Text style={[sm.rowSub, {color: T.subText}]}>Priemerná hodnota nákupu — ročný cieľ</Text>
                                                </View>
                                              </View>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                                                <TouchableOpacity onPress={()=>setAnnualGoals(g=>({...g,avgTarget:Math.round(Math.max(0,(parseFloat(g.avgTarget)||58)-0.5)*100)/100}))} style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}}><Text style={{color:T.text,fontWeight:'700',fontSize:16}}>−</Text></TouchableOpacity>
                                                <TextInput style={{color:T.text,fontWeight:'800',fontSize:15,minWidth:60,textAlign:'center',borderBottomWidth:1,borderColor:T.border,paddingHorizontal:4}} value={String(annualGoals.avgTarget ?? '')} keyboardType="decimal-pad" maxLength={8} onChangeText={(v)=>{const vv=v.replace(',','.');if(vv===''||/^\d*\.?\d*$/.test(vv))setAnnualGoals(g=>({...g,avgTarget:vv==='' ? '' : (vv.endsWith('.') || /^\d+\.\d*0$/.test(vv) ? vv : (isNaN(parseFloat(vv))?'':parseFloat(vv)))}));}} onEndEditing={()=>setAnnualGoals(g=>{const n=parseFloat(g.avgTarget);return {...g,avgTarget:isNaN(n)?58:n};})} />
                                                <TouchableOpacity onPress={()=>setAnnualGoals(g=>({...g,avgTarget:Math.round(((parseFloat(g.avgTarget)||58)+0.5)*100)/100}))} style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}}><Text style={{color:T.text,fontWeight:'700',fontSize:16}}>+</Text></TouchableOpacity>
                                              </View>
                                            </View>
                                            <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal: 0, marginVertical: 6}]} />
                                            {/* TC/hour target */}
                                            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:6}}>
                                              <View style={[sm.rowLeft, {flex:1, marginRight:8}]}>
                                                <View style={[sm.iconBox, {backgroundColor: darkMode ? '#0c1a2e' : '#eff6ff'}]}>
                                                  <Ionicons name="receipt-outline" size={17} color="#3b82f6" />
                                                </View>
                                                <View style={{flex:1}}>
                                                  <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>TC/hod cieľ</Text>
                                                  <Text style={[sm.rowSub, {color: T.subText}]}>Cieľový počet transakcií za hodinu</Text>
                                                </View>
                                              </View>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                                                <TouchableOpacity onPress={()=>setAnnualGoals(g=>({...g,tcHourTarget:Math.round(Math.max(0,(parseFloat(g.tcHourTarget)||6)-0.1)*10)/10}))} style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}}><Text style={{color:T.text,fontWeight:'700',fontSize:16}}>−</Text></TouchableOpacity>
                                                <TextInput style={{color:T.text,fontWeight:'800',fontSize:15,minWidth:60,textAlign:'center',borderBottomWidth:1,borderColor:T.border,paddingHorizontal:4}} value={String(annualGoals.tcHourTarget ?? '')} keyboardType="decimal-pad" maxLength={6} onChangeText={(v)=>{const vv=v.replace(',','.');if(vv===''||/^\d*\.?\d*$/.test(vv))setAnnualGoals(g=>({...g,tcHourTarget:vv==='' ? '' : (vv.endsWith('.') || /^\d+\.\d*0$/.test(vv) ? vv : (isNaN(parseFloat(vv))?'':parseFloat(vv)))}));}} onEndEditing={()=>setAnnualGoals(g=>{const n=parseFloat(g.tcHourTarget);return {...g,tcHourTarget:isNaN(n)?6:n};})} />
                                                <TouchableOpacity onPress={()=>setAnnualGoals(g=>({...g,tcHourTarget:Math.round(((parseFloat(g.tcHourTarget)||6)+0.1)*10)/10}))} style={{width:28,height:28,borderRadius:8,backgroundColor:darkMode?'#2d2d4e':'#e2e8f0',alignItems:'center',justifyContent:'center'}}><Text style={{color:T.text,fontWeight:'700',fontSize:16}}>+</Text></TouchableOpacity>
                                              </View>
                                            </View>
                                            <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal: 0, marginVertical: 6}]} />
                                            {/* Forecast toggle */}
                                            <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:6}}>
                                              <View style={[sm.rowLeft, {flex:1, marginRight:8}]}>
                                                <View style={[sm.iconBox, {backgroundColor: annualGoals.forecastEnabled ? (darkMode ? '#0a2e1a' : '#f0fdf4') : T.sectionIconBg}]}>
                                                  <Ionicons name="analytics-outline" size={17} color={annualGoals.forecastEnabled ? '#22c55e' : T.sectionIcon} />
                                                </View>
                                                <View style={{flex:1}}>
                                                  <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>Predikcia produktivity</Text>
                                                  <Text style={[sm.rowSub, {color: T.subText}]}>AI porovná tempo s ročnými cieľmi a upozorní keď klesáš</Text>
                                                </View>
                                              </View>
                                              <Switch value={!!annualGoals.forecastEnabled} onValueChange={(v)=>{setAnnualGoals(g=>({...g,forecastEnabled:v}));setTimeout(()=>scheduleAllNotifications(),400);}} trackColor={{false:'#cbd5e1',true:'#22c55e'}} thumbColor="#fff" />
                                            </View>
                                          </View>
                      </View>
                      )}
                      {/* ── FOTO SKEN NASTAVENIA ─── */}
                      <View style={[sm.divider, {backgroundColor:T.border, marginHorizontal:0}]} />
                      <View style={{marginHorizontal:16, marginTop:14, marginBottom:14}}>
                        <TouchableOpacity onPress={()=>setAiCollapse(p=>({...p,skenu:!p.skenu}))} style={{flexDirection:'row', alignItems:'center', gap:6, marginBottom:aiCollapse.skenu?12:0, paddingVertical:4}} activeOpacity={0.7}>
                          <View style={{width:22, height:22, borderRadius:6, backgroundColor:darkMode?'#0c1a2e':'#eff6ff', alignItems:'center', justifyContent:'center'}}>
                            <Ionicons name="camera-outline" size={13} color="#3b82f6" />
                          </View>
                          <Text style={{fontSize:12, fontWeight:'800', letterSpacing:0.8, color:'#3b82f6', flex:1}}>SKEN TABUĽKY (FOTO — ZDARMA)</Text>
                          <Ionicons name={aiCollapse.skenu?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                        </TouchableOpacity>
                        {aiCollapse.skenu && (<>

                        {/* Master toggle */}
                        <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:8, paddingHorizontal:12, borderRadius:12, backgroundColor:aiScanEnabled?(darkMode?'rgba(34,197,94,0.07)':'rgba(34,197,94,0.05)'):'transparent', marginBottom:12}}>
                          <View style={{flex:1, marginRight:8}}>
                            <Text style={{fontSize:13, fontWeight:'700', color:T.text}}>Foto-sken zapnutý</Text>
                            <Text style={{fontSize:11, color:T.subText}}>Tlačidlá "Naskenuj Plán / Reál" pri tabuľke</Text>
                          </View>
                          <Switch value={aiScanEnabled} onValueChange={setAiScanEnabled} trackColor={{false:'#cbd5e1', true:'#22c55e'}} thumbColor="#fff" />
                        </View>

                        {/* Toggle: skryť/zobraziť tlačidlo "Naskenuj Reál" */}
                        {aiScanEnabled && (
                          <View style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:8, paddingHorizontal:12, borderRadius:12, backgroundColor:scanRealEnabled?(darkMode?'rgba(34,197,94,0.07)':'rgba(34,197,94,0.05)'):'transparent', marginBottom:12}}>
                          <View style={{flex:1, marginRight:8}}>
                            <Text style={{fontSize:13, fontWeight:'700', color:T.text}}>Tlačidlo "Naskenuj Reál"</Text>
                            <Text style={{fontSize:11, color:T.subText}}>Vypni ak chceš zobraziť iba "Naskenuj Plán"</Text>
                          </View>
                          <Switch value={scanRealEnabled} onValueChange={setScanRealEnabled} trackColor={{false:'#cbd5e1', true:'#22c55e'}} thumbColor="#fff" />
                        </View>
                        )}

                        {/* Mode picker: OCR vs Gemini */}
                        {aiScanEnabled && (<>
                          <Text style={{fontSize:11, fontWeight:'700', color:T.subText, letterSpacing:0.5, marginBottom:8}}>REŽIM SKENU</Text>
                          <View style={{flexDirection:'row', gap:8, marginBottom:14}}>
                            <TouchableOpacity
                              onPress={() => setScanMode('ocr')}
                              style={{flex:1, paddingVertical:10, borderRadius:12, borderWidth:2,
                                borderColor: scanMode==='ocr' ? '#3b82f6' : T.border,
                                backgroundColor: scanMode==='ocr' ? (darkMode?'#0c1a2e':'#eff6ff') : T.card,
                                alignItems:'center', gap:4}}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="scan-outline" size={20} color={scanMode==='ocr'?'#3b82f6':T.subText} />
                              <Text style={{fontSize:12, fontWeight:'700', color:scanMode==='ocr'?'#3b82f6':T.subText}}>OCR.space</Text>
                              <Text style={{fontSize:10, color:T.subText, textAlign:'center'}}>{'Zadarmo\n25 000/mes'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setScanMode('gemini')}
                              style={{flex:1, paddingVertical:10, borderRadius:12, borderWidth:2,
                                borderColor: scanMode==='gemini' ? '#a855f7' : T.border,
                                backgroundColor: scanMode==='gemini' ? (darkMode?'#1a0a2e':'#fdf4ff') : T.card,
                                alignItems:'center', gap:4}}
                              activeOpacity={0.8}
                            >
                              <Ionicons name="sparkles-outline" size={20} color={scanMode==='gemini'?'#a855f7':T.subText} />
                              <Text style={{fontSize:12, fontWeight:'700', color:scanMode==='gemini'?'#a855f7':T.subText}}>Gemini AI</Text>
                              <Text style={{fontSize:10, color:T.subText, textAlign:'center'}}>{'Presnejší\nvyžaduje kľúč'}</Text>
                            </TouchableOpacity>
                          </View>

                          {/* OCR.space section */}
                          {scanMode === 'ocr' && (
                            <View style={{backgroundColor:darkMode?'#0c1a2e':'#eff6ff', borderRadius:10, padding:12, borderWidth:1, borderColor:'#3b82f6', marginBottom:10}}>
                              <Text style={{fontSize:11, color:darkMode?'#93c5fd':'#1d4ed8', lineHeight:17}}>
                                {'OCR.space — zadarmo, bez AI.\nDemo kľúč: 25 000 skenov/mesiac.\n"Naskenuj Plán" → vyplní Sales Plan + TC Plan\n"Naskenuj Reál" → vyplní Sales Real + TC Real'}
                              </Text>
                              <View style={{marginTop:10}}>
                                <Text style={{fontSize:11, fontWeight:'700', color:T.subText, marginBottom:5}}>VLASTNÝ KĽÚČ (voliteľné)</Text>
                                <View style={{backgroundColor:darkMode?'#0a1120':'#f8fafc', borderRadius:8, borderWidth:1, borderColor:T.border}}>
                                  <TextInput
                                    style={{padding:9, fontSize:12, color:T.text, fontFamily:Platform.OS==='ios'?'Courier':'monospace'}}
                                    value={ocrApiKey}
                                    onChangeText={setOcrApiKey}
                                    placeholder="Nechaj prázdne — použije sa demo kľúč"
                                    placeholderTextColor={T.subText}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                  />
                                </View>
                              </View>
                            </View>
                          )}

                          {/* Gemini section */}
                          {scanMode === 'gemini' && (
                            <View style={{backgroundColor:darkMode?'#1a0a2e':'#fdf4ff', borderRadius:10, padding:12, borderWidth:1, borderColor:'#a855f7', marginBottom:10}}>
                              <Text style={{fontSize:11, color:darkMode?'#d8b4fe':'#7e22ce', lineHeight:17, marginBottom:10}}>
                                {'Gemini 1.5 Flash — číta tabuľku ako AI.\nPresnejší ako OCR, vyžaduje vlastný Google AI kľúč.\nKľúč zadarmo na: aistudio.google.com'}
                              </Text>
                              <Text style={{fontSize:11, fontWeight:'700', color:T.subText, marginBottom:5}}>GEMINI API KĽÚČ</Text>
                              <View style={{backgroundColor:darkMode?'#0f0f2e':'#fff', borderRadius:8, borderWidth:1, borderColor:geminiApiKey.trim()?'#a855f7':T.border}}>
                                <TextInput
                                  style={{padding:9, fontSize:12, color:T.text, fontFamily:Platform.OS==='ios'?'Courier':'monospace'}}
                                  value={geminiApiKey}
                                  onChangeText={setGeminiApiKey}
                                  placeholder="AIza..."
                                  placeholderTextColor={T.subText}
                                  autoCapitalize="none"
                                  autoCorrect={false}
                                  secureTextEntry={false}
                                />
                              </View>
                              {!geminiApiKey.trim() && (
                                <Text style={{fontSize:10, color:'#ef4444', marginTop:5}}>⚠ Bez kľúča Gemini sken nefunguje</Text>
                              )}
                            </View>
                          )}
                        </>)}
                        </>)}
                      </View>
                      <View style={{height: 8}} />

                      {/* ── EDITOR TEXTOV AI NOTIFIKÁCIÍ ──────────────────────── */}
                      <View style={{marginHorizontal:16, marginBottom:12}}>
                        <TouchableOpacity onPress={()=>setAiCollapse(p=>({...p,texty:!p.texty}))} style={{flexDirection:'row', alignItems:'center', gap:6, marginBottom:aiCollapse.texty?10:0, paddingVertical:4}} activeOpacity={0.7}>
                          <View style={{width:22, height:22, borderRadius:6, backgroundColor:darkMode?'#1a0a2e':'#fdf4ff', alignItems:'center', justifyContent:'center'}}>
                            <Text style={{fontSize:12}}>✍️</Text>
                          </View>
                          <Text style={{fontSize:12, fontWeight:'800', letterSpacing:0.8, color:'#a855f7', flex:1}}>TEXTY AI NOTIFIKÁCIÍ</Text>
                          <Ionicons name={aiCollapse.texty?'chevron-up':'chevron-down'} size={16} color={T.subText} />
                        </TouchableOpacity>
                        {aiCollapse.texty && (<>
                        <Text style={{fontSize:11, color:T.subText, marginBottom:10}}>
                          {'Premenné: {plan}, {real}, {diff}, {hours}, {perHour}, {total}, {r2p}, {target}, {prod}, {tcHour}, {tcTarget}.'}
                        </Text>
                        {Object.keys(DEFAULT_NOTIF_TEXTS).map((k) => {
                          const labels = {
                            preRush:'Pre-rush varovanie', strongest:'Najsilnejšia hodina', weakest:'Najslabšia hodina',
                            behind:'Pod plán', ahead:'Nad plán', deficit2:'Deficit — 2 hod',
                            deficit3:'Deficit — 3 hod', r2pBad:'R2P zlý', forecast:'Predpoveď'
                          };
                          const open = editingNotifKey === k;
                          const val = (aiNotifTexts && aiNotifTexts[k] != null) ? aiNotifTexts[k] : DEFAULT_NOTIF_TEXTS[k];
                          return (
                            <View key={k} style={{marginBottom:8, borderWidth:1, borderColor:T.border, borderRadius:12, overflow:'hidden'}}>
                              <TouchableOpacity
                                onPress={() => setEditingNotifKey(open ? null : k)}
                                style={{flexDirection:'row', alignItems:'center', padding:11, backgroundColor: open ? (darkMode?'#1a0a2e':'#fdf4ff') : T.card}}
                                activeOpacity={0.7}
                              >
                                <Text style={{flex:1, fontSize:13, fontWeight:'700', color:T.text}}>{labels[k] || k}</Text>
                                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={T.subText} />
                              </TouchableOpacity>
                              {open && (
                                <View style={{padding:11, backgroundColor: darkMode?'#0f0f2e':'#fafafa', borderTopWidth:1, borderColor:T.border}}>
                                  <TextInput
                                    key={`ai-${k}-${notifResetTick}`}
                                    style={{backgroundColor:T.inputBg, borderWidth:1, borderColor:T.border, borderRadius:8, padding:9, color:T.text, fontSize:13, minHeight:80, textAlignVertical:'top'}}
                                    defaultValue={val}
                                    onChangeText={(v) => setAiNotifTexts(p => ({...p, [k]: v}))}
                                    placeholder={DEFAULT_NOTIF_TEXTS[k]}
                                    placeholderTextColor={T.placeholder}
                                    multiline
                                  />
                                  <TouchableOpacity
                                    onPress={() => { Keyboard.dismiss(); setAiNotifTexts(p => ({...p, [k]: DEFAULT_NOTIF_TEXTS[k]})); setNotifResetTick(t => t + 1); }}
                                    style={{marginTop:8, alignSelf:'flex-end', flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:T.border}}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="refresh-outline" size={12} color={T.subText} style={{marginRight:4}} />
                                    <Text style={{fontSize:11, color:T.subText, fontWeight:'700'}}>Pôvodný text</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })}
                        </>)}
                      </View>

                      {/* ── ZMENA HESLA (v AI sekcii) ─────────────────────────── */}
                      <View style={{marginHorizontal:16, marginBottom:14, padding:12, borderRadius:12, borderWidth:1, borderColor:'#a855f7', backgroundColor: darkMode?'#1a0a2e':'#fdf4ff'}}>
                        <TouchableOpacity onPress={()=>setAiCollapse(p=>({...p,heslo:!p.heslo}))} style={{flexDirection:'row', alignItems:'center', gap:6, marginBottom:aiCollapse.heslo?10:0}} activeOpacity={0.7}>
                          <Ionicons name="key-outline" size={15} color="#a855f7" />
                          <Text style={{fontSize:12, fontWeight:'800', letterSpacing:0.8, color:'#a855f7', flex:1}}>ZMENIŤ HESLO</Text>
                          <Ionicons name={aiCollapse.heslo?'chevron-up':'chevron-down'} size={16} color="#a855f7" />
                        </TouchableOpacity>
                        {aiCollapse.heslo && (<>
                        <Text style={{fontSize:11, color:T.subText, marginBottom:10}}>
                          {'Heslo chráni úpravy aj prístup k AI nastaveniam.'}
                        </Text>
                        {[
                          { label:'Aktuálne heslo', value:cpCurrent, setter:setCpCurrent, show:showCpCurrent, toggleShow:() => setShowCpCurrent(p => !p) },
                          { label:'Nové heslo',     value:cpNew,     setter:setCpNew,     show:showCpNew,     toggleShow:() => setShowCpNew(p => !p) },
                          { label:'Potvrď heslo',   value:cpConfirm, setter:setCpConfirm, show:showCpConfirm, toggleShow:() => setShowCpConfirm(p => !p) },
                        ].map(({ label, value, setter, show, toggleShow }) => (
                          <View key={label} style={{flexDirection:'row', alignItems:'center', backgroundColor:T.inputBg, borderWidth:1, borderColor:T.border, borderRadius:10, marginBottom:8, paddingHorizontal:10, paddingVertical:6}}>
                            <Ionicons name="lock-closed-outline" size={14} color={T.placeholder} style={{marginRight:8}} />
                            <TextInput
                              style={{flex:1, color:T.inputText, fontSize:13, paddingVertical:6}}
                              placeholder={label}
                              placeholderTextColor={T.placeholder}
                              secureTextEntry={!show}
                              value={value}
                              onChangeText={setter}
                              returnKeyType="done"
                            />
                            <TouchableOpacity onPress={toggleShow} activeOpacity={0.7} style={{padding:4}}>
                              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={15} color={T.placeholder} />
                            </TouchableOpacity>
                          </View>
                        ))}
                        <TouchableOpacity
                          onPress={changePassword}
                          style={{marginTop:4, backgroundColor:'#a855f7', borderRadius:10, paddingVertical:11, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6}}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="checkmark-outline" size={16} color="#fff" />
                          <Text style={{color:'#fff', fontWeight:'800', fontSize:13, letterSpacing:0.3}}>Uložiť nové heslo</Text>
                        </TouchableOpacity>
                        </>)}
                      </View>

                      {/* ── ZAMKNÚŤ AI NASTAVENIA ─── */}
                      <TouchableOpacity
                        onPress={() => { setAiSettingsUnlocked(false); setSettingsCatSec(p => ({...p, ai: false})); }}
                        style={{marginHorizontal:16, marginBottom:14, marginTop:4, backgroundColor:DANGER, borderRadius:12, paddingVertical:12, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8}}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="lock-closed-outline" size={16} color="#fff" />
                        <Text style={{color:'#fff', fontWeight:'800', fontSize:13, letterSpacing:0.3}}>Zamknúť AI nastavenia</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* ── 2. NOTIFIKÁCIE ──────────────────────────────────────────────────── */}
                <View style={{marginBottom: 10}}>
                  <TouchableOpacity
                    onPress={() => setSettingsCatSec(p => ({...p, notif: !p.notif}))}
                    style={[sm.catHdr, {
                      backgroundColor: settingsCatSec.notif ? (darkMode ? '#0a2e1a' : '#f0fdf4') : T.card,
                      borderColor: settingsCatSec.notif ? '#22c55e' : T.border,
                      borderBottomLeftRadius: settingsCatSec.notif ? 0 : 16,
                      borderBottomRightRadius: settingsCatSec.notif ? 0 : 16,
                    }]}
                    activeOpacity={0.8}
                  >
                    <View style={[sm.catIco, {backgroundColor: settingsCatSec.notif ? (darkMode ? '#052e16' : '#dcfce7') : T.sectionIconBg}]}>
                      <Text style={{fontSize: 22}}>🔔</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[sm.catLbl, {color: T.text}]}>Notifikácie</Text>
                      <Text style={[sm.catSub, {color: T.subText}]}>Príprava zmeny, hodinová tabuľka</Text>
                    </View>
                    <Ionicons
                      name={settingsCatSec.notif ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={settingsCatSec.notif ? '#22c55e' : T.subText}
                    />
                  </TouchableOpacity>
                  {settingsCatSec.notif && (
                    <View style={[sm.catBody, {borderColor: '#22c55e', backgroundColor: T.card}]}>
                      <View style={[sm.sectionLabelRow, {marginTop: 16}]}>
                        <Ionicons name="notifications-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                        <Text style={[sm.sectionLabel, {color: T.subText}]}>PREPÍNAČE NOTIFIKÁCIÍ</Text>
                      </View>
                      <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                        {/* ─── NOTIFIKÁCIE ─── */}
                                        <View style={sm.sectionLabelRow}>
                                          <Ionicons name="notifications-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                                          <Text style={[sm.sectionLabel, {color: T.subText}]}>NOTIFIKÁCIE</Text>
                                        </View>
                        
                                        <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                                          {[
                                            { key: 'morningPrep',    icon: 'sunny',        iconBg: darkMode ? '#2d1800' : '#fffbeb', iconColor: '#f59e0b', label: 'Ranná zmena — príprava',  sub: 'Upozornenie na začiatku rannej zmeny' },
                                            { key: 'morningTable',   icon: 'bar-chart',    iconBg: darkMode ? '#0c1a2e' : '#eff6ff', iconColor: '#3b82f6', label: 'Ranná zmena — tabuľka',   sub: 'Upozornenie 16 min po každej hodine' },
                                            { key: 'afternoonPrep',  icon: 'partly-sunny', iconBg: darkMode ? '#2d1800' : '#fffbeb', iconColor: '#f59e0b', label: 'Obedná zmena — príprava', sub: 'Upozornenie na začiatku obednej zmeny' },
                                            { key: 'afternoonTable', icon: 'stats-chart',  iconBg: darkMode ? '#0c1a2e' : '#eff6ff', iconColor: '#3b82f6', label: 'Obedná zmena — tabuľka',  sub: 'Upozornenie 16 min po každej hodine' },
                                          ].map(({ key, icon, iconBg, iconColor, label, sub }, idx, arr) => (
                                            <React.Fragment key={key}>
                                              <View style={[sm.row, {paddingVertical: 14}]}>
                                                <View style={[sm.rowLeft, {flex: 1, marginRight: 8}]}>
                                                  <View style={[sm.iconBox, {backgroundColor: notifPrefs[key] ? iconBg : T.sectionIconBg}]}>
                                                    <Ionicons name={icon} size={17} color={notifPrefs[key] ? iconColor : T.sectionIcon} />
                                                  </View>
                                                  <View style={{flex: 1}}>
                                                    <Text style={[sm.rowLabel, {color: T.text, fontSize: 14}]}>{label}</Text>
                                                    <Text style={[sm.rowSub, {color: T.subText}]}>{sub}</Text>
                                                  </View>
                                                </View>
                                                <Switch
                                                  value={notifPrefs[key]}
                                                  onValueChange={(v) => {
                                                    const next = {...notifPrefs, [key]: v};
                                                    setNotifPrefs(next);
                                                    setTimeout(() => scheduleAllNotifications(), 400);
                                                  }}
                                                  trackColor={{false: '#cbd5e1', true: '#22c55e'}}
                                                  thumbColor="#fff"
                                                />
                                              </View>
                                              {idx < arr.length - 1 && <View style={[sm.divider, {backgroundColor: T.border}]} />}
                                            </React.Fragment>
                                          ))}
                      </View>
                      {/* Test + replán */}
                      <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border, marginBottom: 4}]}>
                        <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                                          <TouchableOpacity
                                            style={[sm.ghostBtn, {borderColor: T.border}]}
                                            onPress={async () => {
                                              if (Platform.OS === 'web') {
                                                Alert.alert('Info','Notifikácie sú dostupné len na mobilných zariadeniach.');
                                                return;
                                              }
                                              await scheduleAllNotifications();
                                              Alert.alert('Hotovo','Notifikácie boli znovu naplánované.');
                                            }}
                                            activeOpacity={0.8}
                                          >
                                            <Ionicons name="refresh-outline" size={16} color={T.text} style={{marginRight: 8}} />
                                            <Text style={[sm.ghostBtnTxt, {color: T.text}]}>Znovu naplánovať notifikácie</Text>
                                          </TouchableOpacity>
                        
                                          <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal: 0}]} />
                        
                                          <View style={[sm.infoBox, {backgroundColor: darkMode ? '#1a1200' : '#fffbeb', borderColor: darkMode ? '#78350f' : '#fcd34d'}]}>
                                            <Ionicons name="flask-outline" size={14} color={darkMode ? '#fbbf24' : '#92400e'} style={{marginRight: 8, marginTop: 1}} />
                                            <Text style={[sm.infoText, {color: darkMode ? '#fbbf24' : '#92400e'}]}>
                                              {'Testovací režim: 4 notifikácie (10s, 20s, 30s, 40s).\nVrátane AI testov — najsilnejšia hodina a pod plán.\nZamkni telefón pred stlačením.'}
                                            </Text>
                                          </View>
                                          <TouchableOpacity
                                            style={[sm.primaryBtn, {backgroundColor: '#fbbf24', marginTop: 0}]}
                                            onPress={sendTestNotifications}
                                            activeOpacity={0.85}
                                          >
                                            <Ionicons name="flask-outline" size={16} color="#111" style={{marginRight: 8}} />
                                            <Text style={[sm.primaryBtnTxt, {color: '#111'}]}>Otestovať notifikácie (10–40 s)</Text>
                                          </TouchableOpacity>
                      </View>

                      {/* ── EDITOR TEXTOV KLASICKÝCH NOTIFIKÁCIÍ ────────────── */}
                      <View style={[sm.sectionLabelRow, {marginTop: 14}]}>
                        <Ionicons name="create-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                        <Text style={[sm.sectionLabel, {color: T.subText}]}>TEXTY NOTIFIKÁCIÍ</Text>
                      </View>
                      <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border, padding: 12}]}>
                        <Text style={{fontSize: 11, color: T.subText, marginBottom: 10}}>
                          {'Uprav nadpis a text klasických upozornení. V názve tabuľkových notifikácií môžeš použiť {hour}.'}
                        </Text>
                        {[
                          {key:'morningPrep',    label:'Ranná — príprava',  icon:'sunny',        color:'#f59e0b'},
                          {key:'afternoonPrep',  label:'Obedná — príprava', icon:'partly-sunny', color:'#f59e0b'},
                          {key:'morningTable',   label:'Ranná — tabuľka',   icon:'bar-chart',    color:'#3b82f6'},
                          {key:'afternoonTable', label:'Obedná — tabuľka',  icon:'stats-chart',  color:'#3b82f6'},
                        ].map(({key,label,icon,color}) => {
                          const tKey = key + 'Title';
                          const bKey = key + 'Body';
                          const open = editingClassicKey === key;
                          return (
                            <View key={key} style={{marginBottom: 8, borderWidth: 1, borderColor: T.border, borderRadius: 12, overflow: 'hidden'}}>
                              <TouchableOpacity
                                onPress={() => setEditingClassicKey(open ? null : key)}
                                style={{flexDirection:'row', alignItems:'center', padding: 11, backgroundColor: open ? (darkMode ? '#0c1a2e' : '#eff6ff') : T.card}}
                                activeOpacity={0.7}
                              >
                                <Ionicons name={icon} size={15} color={color} style={{marginRight: 8}} />
                                <Text style={{flex: 1, fontSize: 13, fontWeight: '700', color: T.text}}>{label}</Text>
                                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={T.subText} />
                              </TouchableOpacity>
                              {open && (
                                <View style={{padding: 11, backgroundColor: darkMode ? '#0f0f2e' : '#fafafa', borderTopWidth: 1, borderColor: T.border}}>
                                  <Text style={{fontSize: 10, color: T.subText, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5}}>NADPIS</Text>
                                  <TextInput
                                    key={`cls-t-${key}-${notifResetTick}`}
                                    style={{backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 8, padding: 9, color: T.text, fontSize: 13, marginBottom: 8}}
                                    defaultValue={classicNotifTexts[tKey] ?? ''}
                                    onChangeText={(v) => setClassicNotifTexts(p => ({...p, [tKey]: v}))}
                                    placeholder={DEFAULT_CLASSIC_NOTIF_TEXTS[tKey]}
                                    placeholderTextColor={T.placeholder}
                                  />
                                  <Text style={{fontSize: 10, color: T.subText, marginBottom: 4, fontWeight: '700', letterSpacing: 0.5}}>TEXT</Text>
                                  <TextInput
                                    key={`cls-b-${key}-${notifResetTick}`}
                                    style={{backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border, borderRadius: 8, padding: 9, color: T.text, fontSize: 13, minHeight: 60, textAlignVertical: 'top'}}
                                    defaultValue={classicNotifTexts[bKey] ?? ''}
                                    onChangeText={(v) => setClassicNotifTexts(p => ({...p, [bKey]: v}))}
                                    placeholder={DEFAULT_CLASSIC_NOTIF_TEXTS[bKey]}
                                    placeholderTextColor={T.placeholder}
                                    multiline
                                  />
                                  <TouchableOpacity
                                    onPress={() => { Keyboard.dismiss(); setClassicNotifTexts(p => ({...p, [tKey]: DEFAULT_CLASSIC_NOTIF_TEXTS[tKey], [bKey]: DEFAULT_CLASSIC_NOTIF_TEXTS[bKey]})); setNotifResetTick(t => t + 1); }}
                                    style={{marginTop: 8, alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: T.border}}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="refresh-outline" size={12} color={T.subText} style={{marginRight: 4}} />
                                    <Text style={{fontSize: 11, color: T.subText, fontWeight: '700'}}>Pôvodný text</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                      <View style={{height: 8}} />
                    </View>
                  </View>
                    </View>
                  )}
                </View>

                {/* ── 3. NASTAVENIE ZMENY ─────────────────────────────────────────────── */}
                <View style={{marginBottom: 10}}>
                  <TouchableOpacity
                    onPress={() => setSettingsCatSec(p => ({...p, zmena: !p.zmena}))}
                    style={[sm.catHdr, {
                      backgroundColor: settingsCatSec.zmena ? (darkMode ? '#0c1a2e' : '#eff6ff') : T.card,
                      borderColor: settingsCatSec.zmena ? '#3b82f6' : T.border,
                      borderBottomLeftRadius: settingsCatSec.zmena ? 0 : 16,
                      borderBottomRightRadius: settingsCatSec.zmena ? 0 : 16,
                    }]}
                    activeOpacity={0.8}
                  >
                    <View style={[sm.catIco, {backgroundColor: settingsCatSec.zmena ? (darkMode ? '#0c1a2e' : '#dbeafe') : T.sectionIconBg}]}>
                      <Text style={{fontSize: 22}}>⚙️</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={[sm.catLbl, {color: T.text}]}>Nastavenie zmeny</Text>
                      <Text style={[sm.catSub, {color: T.subText}]}>Časy zmeny a notifikácií</Text>
                    </View>
                    <Ionicons
                      name={settingsCatSec.zmena ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={settingsCatSec.zmena ? '#3b82f6' : T.subText}
                    />
                  </TouchableOpacity>
                  {settingsCatSec.zmena && (
                    <View style={[sm.catBody, {borderColor: '#3b82f6', backgroundColor: T.card}]}>
                      <View style={[sm.sectionLabelRow, {marginTop: 16}]}>
                        <Ionicons name="calendar-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                        <Text style={[sm.sectionLabel, {color: T.subText}]}>ČASY ZMIEN</Text>
                      </View>
                      <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                        {/* ─── ČASY ZMIEN ─── */}
                                        <View style={sm.sectionLabelRow}>
                                          <Ionicons name="calendar-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                                          <Text style={[sm.sectionLabel, {color: T.subText}]}>ČASY ZMIEN</Text>
                                        </View>
                                        <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                                          <View style={{paddingHorizontal:16, paddingTop:14, paddingBottom:10}}>
                                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}>
                                              <View style={[sm.iconBox, {backgroundColor: darkMode ? '#2d1800' : '#fffbeb', marginRight:12}]}>
                                                <Ionicons name="sunny" size={17} color="#f59e0b" />
                                              </View>
                                              <View style={{flex:1}}>
                                                <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>Ranná zmena</Text>
                                                <Text style={[sm.rowSub, {color: T.subText}]}>
                                                  {String(shiftHours.morningStart).padStart(2,'0') + ':00 — ' + String(shiftHours.morningEnd).padStart(2,'0') + ':59  (' + (shiftHours.morningEnd - shiftHours.morningStart + 1) + ' hodín)'}
                                                </Text>
                                              </View>
                                            </View>
                                            <View style={{gap:10}}>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:36}}>OD</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, morningStart: Math.max(0, p.morningStart-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color: '#f59e0b', borderColor: '#f59e0b'}]} value={String(shiftHours.morningStart)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setShiftHours(p=>({...p,morningStart:n}));else if(v==='')setShiftHours(p=>({...p,morningStart:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, morningStart: Math.min(p.morningEnd, p.morningStart+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                                <Text style={{color: T.subText, fontSize:12}}>hodín</Text>
                                              </View>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:36}}>DO</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, morningEnd: Math.max(p.morningStart, p.morningEnd-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color: '#f59e0b', borderColor: '#f59e0b'}]} value={String(shiftHours.morningEnd)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setShiftHours(p=>({...p,morningEnd:n}));else if(v==='')setShiftHours(p=>({...p,morningEnd:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, morningEnd: Math.min(23, p.morningEnd+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                                <Text style={{color: T.subText, fontSize:12}}>hodín</Text>
                                              </View>
                                            </View>
                                          </View>
                        
                                          <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal:16}]} />
                        
                                          <View style={{paddingHorizontal:16, paddingTop:10, paddingBottom:14}}>
                                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:12}}>
                                              <View style={[sm.iconBox, {backgroundColor: darkMode ? '#0c1a2e' : '#eff6ff', marginRight:12}]}>
                                                <Ionicons name="partly-sunny" size={17} color="#3b82f6" />
                                              </View>
                                              <View style={{flex:1}}>
                                                <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>Obedná zmena</Text>
                                                <Text style={[sm.rowSub, {color: T.subText}]}>
                                                  {String(shiftHours.afternoonStart).padStart(2,'0') + ':00 — ' + String(shiftHours.afternoonEnd).padStart(2,'0') + ':59  (' + (shiftHours.afternoonEnd - shiftHours.afternoonStart + 1) + ' hodín)'}
                                                </Text>
                                              </View>
                                            </View>
                                            <View style={{gap:10}}>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:36}}>OD</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, afternoonStart: Math.max(0, p.afternoonStart-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color: '#3b82f6', borderColor: '#3b82f6'}]} value={String(shiftHours.afternoonStart)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setShiftHours(p=>({...p,afternoonStart:n}));else if(v==='')setShiftHours(p=>({...p,afternoonStart:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, afternoonStart: Math.min(p.afternoonEnd, p.afternoonStart+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                                <Text style={{color: T.subText, fontSize:12}}>hodín</Text>
                                              </View>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:36}}>DO</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, afternoonEnd: Math.max(p.afternoonStart, p.afternoonEnd-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color: '#3b82f6', borderColor: '#3b82f6'}]} value={String(shiftHours.afternoonEnd)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setShiftHours(p=>({...p,afternoonEnd:n}));else if(v==='')setShiftHours(p=>({...p,afternoonEnd:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setShiftHours(p=>({...p, afternoonEnd: Math.min(23, p.afternoonEnd+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                                <Text style={{color: T.subText, fontSize:12}}>hodín</Text>
                                              </View>
                                            </View>
                                          </View>
                      </View>
                      <View style={sm.sectionLabelRow}>
                        <Ionicons name="alarm-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                        <Text style={[sm.sectionLabel, {color: T.subText}]}>ČASY NOTIFIKÁCIÍ</Text>
                      </View>
                      <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border, marginBottom: 4}]}>
                        {/* ─── ČASY NOTIFIKÁCIÍ ─── */}
                                        <View style={sm.sectionLabelRow}>
                                          <Ionicons name="alarm-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                                          <Text style={[sm.sectionLabel, {color: T.subText}]}>ČASY NOTIFIKÁCIÍ</Text>
                                        </View>
                                        <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                                          <View style={{paddingHorizontal:16, paddingTop:14, paddingBottom:6}}>
                                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                                              <View style={[sm.iconBox, {backgroundColor: darkMode ? '#2d1800' : '#fffbeb', marginRight:12}]}>
                                                <Ionicons name="sunny" size={17} color="#f59e0b" />
                                              </View>
                                              <View style={{flex:1}}>
                                                <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>Ranná zmena — príprava</Text>
                                                <Text style={[sm.rowSub, {color: T.subText}]}>
                                                  {'Notifikácia príde o ' + String(notifTimes.morningPrepHour).padStart(2,'0') + ':' + String(notifTimes.morningPrepMinute).padStart(2,'0')}
                                                </Text>
                                              </View>
                                            </View>
                                            <View style={{gap:10}}>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:60}}>HODINA</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,morningPrepHour:Math.max(0,(p.morningPrepHour??8)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color:ACCENT, borderColor:ACCENT}]} value={String(notifTimes.morningPrepHour??8)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setNotifTimes(p=>({...p,morningPrepHour:n}));else if(v==='')setNotifTimes(p=>({...p,morningPrepHour:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,morningPrepHour:Math.min(23,(p.morningPrepHour??8)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                              </View>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:60}}>MINÚTA</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,morningPrepMinute:Math.max(0,(p.morningPrepMinute??1)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color:ACCENT, borderColor:ACCENT}]} value={String(notifTimes.morningPrepMinute??1)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=59)setNotifTimes(p=>({...p,morningPrepMinute:n}));else if(v==='')setNotifTimes(p=>({...p,morningPrepMinute:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,morningPrepMinute:Math.min(59,(p.morningPrepMinute??1)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                              </View>
                                            </View>
                                          </View>
                        
                                          <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal:16, marginVertical:10}]} />
                        
                                          <View style={{paddingHorizontal:16, paddingBottom:14}}>
                                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:10}}>
                                              <View style={[sm.iconBox, {backgroundColor: darkMode ? '#2d1800' : '#fffbeb', marginRight:12}]}>
                                                <Ionicons name="partly-sunny" size={17} color="#f59e0b" />
                                              </View>
                                              <View style={{flex:1}}>
                                                <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>Obedná zmena — príprava</Text>
                                                <Text style={[sm.rowSub, {color: T.subText}]}>
                                                  {'Notifikácia príde o ' + String(notifTimes.afternoonPrepHour).padStart(2,'0') + ':' + String(notifTimes.afternoonPrepMinute).padStart(2,'0')}
                                                </Text>
                                              </View>
                                            </View>
                                            <View style={{gap:10}}>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:60}}>HODINA</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,afternoonPrepHour:Math.max(0,(p.afternoonPrepHour??15)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color:'#f59e0b', borderColor:'#f59e0b'}]} value={String(notifTimes.afternoonPrepHour??15)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setNotifTimes(p=>({...p,afternoonPrepHour:n}));else if(v==='')setNotifTimes(p=>({...p,afternoonPrepHour:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,afternoonPrepHour:Math.min(23,(p.afternoonPrepHour??15)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                              </View>
                                              <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                                <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:60}}>MINÚTA</Text>
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,afternoonPrepMinute:Math.max(0,(p.afternoonPrepMinute??1)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                                <TextInput style={[sm_hInput, {color:'#f59e0b', borderColor:'#f59e0b'}]} value={String(notifTimes.afternoonPrepMinute??1)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=59)setNotifTimes(p=>({...p,afternoonPrepMinute:n}));else if(v==='')setNotifTimes(p=>({...p,afternoonPrepMinute:0}));}} />
                                                <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p,afternoonPrepMinute:Math.min(59,(p.afternoonPrepMinute??1)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                              </View>
                                            </View>
                                          </View>
                        
                                          <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal:16, marginVertical:10}]} />
                        
                                          <View style={{paddingHorizontal:16, paddingBottom:14}}>
                                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
                                              <View style={[sm.iconBox, {backgroundColor: darkMode ? '#0c1a2e' : '#eff6ff', marginRight:12}]}>
                                                <Ionicons name="bar-chart" size={17} color="#3b82f6" />
                                              </View>
                                              <View style={{flex:1}}>
                                                <Text style={[sm.rowLabel, {color: T.text, fontSize:14}]}>Hodinová tabuľka</Text>
                                                <Text style={[sm.rowSub, {color: T.subText}]}>
                                                  {'Notifikácia vyskočí X+1:' + String(notifTimes.tableMinute).padStart(2,'0') + ' (nasledujúca hodina)'}
                                                </Text>
                                              </View>
                                            </View>
                                            <View style={{flexDirection:'row', alignItems:'center', gap:10}}>
                                              <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:60}}>MINÚTA</Text>
                                              <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p, tableMinute: Math.max(0,(p.tableMinute||16)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                                              <TextInput style={[sm_hInput, {color:'#3b82f6', borderColor:'#3b82f6'}]} value={String(notifTimes.tableMinute??16)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=59)setNotifTimes(p=>({...p,tableMinute:n}));else if(v==='')setNotifTimes(p=>({...p,tableMinute:0}));}} />
                                              <TouchableOpacity style={sm_hBtn} onPress={() => setNotifTimes(p=>({...p, tableMinute: Math.min(59,(p.tableMinute||16)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                                            </View>
                                          </View>
                      </View>
                      <View style={{height: 8}} />
                    </View>
                      </View>
                    </View>
                  )}
                </View>

              </>
            )}

            <View style={{height: 40}} />
          </ScrollView>
          {showAiPinModal && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{position:'absolute', top:0, left:0, right:0, bottom:0, zIndex:1000, elevation:1000}}
            >
        <TouchableOpacity
          style={{flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:32}}
          activeOpacity={1}
          onPress={() => { setShowAiPinModal(false); setAiPinInput(''); setAiPinError(false); }}
        >
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{
              backgroundColor: T.card, borderRadius:24, padding:28, width:300,
              borderWidth:2, borderColor:'#a855f7',
              ...Platform.select({ios:{shadowColor:'#a855f7',shadowOffset:{width:0,height:8},shadowOpacity:0.3,shadowRadius:20},android:{elevation:16}}),
            }}>
              <View style={{alignItems:'center', marginBottom:20}}>
                <View style={{width:56, height:56, borderRadius:18, backgroundColor:darkMode?'#2d0a4e':'#fdf4ff', alignItems:'center', justifyContent:'center', marginBottom:12}}>
                  <Ionicons name="lock-closed-outline" size={28} color="#a855f7" />
                </View>
                <Text style={{fontSize:18, fontWeight:'800', color:T.text, letterSpacing:-0.3}}>AI Asistent</Text>
                <Text style={{fontSize:13, color:T.subText, marginTop:4}}>Zadaj heslo pre prístup</Text>
              </View>

              <View style={{
                flexDirection:'row', borderRadius:14, borderWidth:2,
                borderColor: aiPinError ? '#ef4444' : (aiPinInput.length > 0 ? '#a855f7' : T.border),
                backgroundColor: darkMode ? '#0a1120' : '#f8fafc',
                marginBottom:10, overflow:'hidden',
              }}>
                <TextInput
                  style={{flex:1, padding:14, fontSize:24, fontWeight:'800', color:T.text, textAlign:'center', letterSpacing:8}}
                  value={aiPinInput}
                  onChangeText={(v) => { setAiPinInput(v); setAiPinError(false); }}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  autoFocus
                  placeholder="••••"
                  placeholderTextColor={T.subText}
                  onSubmitEditing={() => {
                    if (aiPinInput.trim() === '1412') {
                      setAiSettingsUnlocked(true);
                      setShowAiPinModal(false);
                      setSettingsCatSec(p => ({...p, ai: true}));
                      setAiPinInput('');
                      setAiPinError(false);
                    } else {
                      setAiPinError(true);
                      setAiPinInput('');
                    }
                  }}
                />
              </View>

              {aiPinError && (
                <Text style={{fontSize:12, color:'#ef4444', textAlign:'center', marginBottom:8, fontWeight:'600'}}>
                  Nesprávne heslo. Skúste znova.
                </Text>
              )}

              <TouchableOpacity
                style={{
                  paddingVertical:14, borderRadius:14, marginTop:4,
                  backgroundColor: aiPinInput.length > 0 ? '#a855f7' : (darkMode?'#2d2d4e':'#e2e8f0'),
                  alignItems:'center',
                  ...Platform.select({ios:{shadowColor:'#a855f7',shadowOffset:{width:0,height:4},shadowOpacity:aiPinInput.length>0?0.4:0,shadowRadius:10},android:{elevation:aiPinInput.length>0?6:0}}),
                }}
                activeOpacity={0.85}
                onPress={() => {
                  if (aiPinInput.trim() === '1412') {
                    setAiSettingsUnlocked(true);
                    setShowAiPinModal(false);
                    setSettingsCatSec(p => ({...p, ai: true}));
                    setAiPinInput('');
                    setAiPinError(false);
                  } else {
                    setAiPinError(true);
                    setAiPinInput('');
                  }
                }}
                disabled={aiPinInput.length === 0}
              >
                <Text style={{fontSize:15, fontWeight:'800', color: aiPinInput.length > 0 ? '#fff' : T.subText}}>
                  Odomknúť
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{paddingVertical:10, alignItems:'center', marginTop:8}}
                onPress={() => { setShowAiPinModal(false); setAiPinInput(''); setAiPinError(false); }}
                activeOpacity={0.7}
              >
                <Text style={{fontSize:13, color:T.subText}}>Zrušiť</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>



      {/* ── ADD CUSTOM COLUMN MODAL ────────────────────────────────────────── */}
      <Modal
        visible={showAddColModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddColModal(false)}
      >
        <TouchableOpacity style={{flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'center', alignItems:'center', padding:28}} activeOpacity={1} onPress={() => setShowAddColModal(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{backgroundColor: T.card, borderRadius:22, padding:24, width:300,
              ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:12},shadowOpacity:0.22,shadowRadius:22},android:{elevation:14}})}}>
              {/* Header */}
              <View style={{flexDirection:'row', alignItems:'center', marginBottom:20}}>
                <View style={{width:40, height:40, borderRadius:14, backgroundColor: darkMode ? '#1a0a2e' : '#fdf4ff', alignItems:'center', justifyContent:'center', marginRight:12}}>
                  <Ionicons name="add-circle-outline" size={22} color="#a855f7" />
                </View>
                <View>
                  <Text style={{fontSize:16, fontWeight:'800', color: T.text, letterSpacing:-0.2}}>Nový stĺpec</Text>
                  <Text style={{fontSize:12, color: T.subText, marginTop:1}}>
                    {addColShift === 'morning' ? 'Ranná zmena' : 'Obedná zmena'}
                  </Text>
                </View>
              </View>

              {/* Label input */}
              <View style={{backgroundColor: darkMode ? '#0a1120' : '#f8fafc', borderRadius:12, borderWidth:1.5, borderColor: darkMode ? '#2d2d4e' : '#e2e8f0', marginBottom:18}}>
                <TextInput
                  style={{padding:13, fontSize:15, fontWeight:'600', color: T.text}}
                  placeholder="Názov stĺpca (napr. Košíky, Upsell…)"
                  placeholderTextColor={T.subText}
                  value={newColLabel}
                  onChangeText={setNewColLabel}
                  autoFocus
                  maxLength={12}
                  onSubmitEditing={addCustomCol}
                  returnKeyType="done"
                />
              </View>
              <Text style={{fontSize:11, color: T.subText, marginBottom:16, marginTop:-10, textAlign:'right'}}>{newColLabel.length}/12</Text>

              {/* Position picker */}
              <Text style={{fontSize:11, fontWeight:'700', color: T.subText, letterSpacing:0.6, marginBottom:8}}>VLOŽIŤ ZA STĹPEC</Text>
              <View style={{backgroundColor: darkMode ? '#0a1120' : '#f8fafc', borderRadius:12, borderWidth:1.5, borderColor: darkMode ? '#2d2d4e' : '#e2e8f0', marginBottom:18, maxHeight:160}}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{padding:8}}>
                  {BASE_COL_DEFS.map(col => (
                    <TouchableOpacity
                      key={col.id}
                      onPress={() => setAddColPosition(col.id)}
                      activeOpacity={0.7}
                      style={{flexDirection:'row', alignItems:'center', paddingVertical:7, paddingHorizontal:8, borderRadius:8, backgroundColor: addColPosition === col.id ? (darkMode ? '#2a1040' : '#fdf4ff') : 'transparent', marginBottom:2}}
                    >
                      <View style={{width:15, height:15, borderRadius:8, borderWidth:2, borderColor: addColPosition === col.id ? '#a855f7' : T.subText, backgroundColor: addColPosition === col.id ? '#a855f7' : 'transparent', marginRight:10}} />
                      <Text style={{fontSize:13, color: addColPosition === col.id ? (darkMode ? '#d8b4fe' : '#7e22ce') : T.text, fontWeight: addColPosition === col.id ? '700' : '500'}}>{col.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Existing custom cols list */}
              {customCols.length > 0 && (
                <View style={{marginBottom:16}}>
                  <Text style={{fontSize:11, fontWeight:'700', color: T.subText, letterSpacing:0.6, marginBottom:8}}>EXISTUJÚCE STĹPCE</Text>
                  {customCols.map(col => (
                    <View key={col.id} style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:6, paddingHorizontal:10, backgroundColor: darkMode ? '#0a1120' : '#f8fafc', borderRadius:8, marginBottom:4}}>
                      <Text style={{color: T.text, fontSize:13, fontWeight:'600'}}>{col.label}</Text>
                      <TouchableOpacity onPress={() => deleteCustomCol(col.id)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                        <Ionicons name="trash-outline" size={15} color={DANGER} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Buttons */}
              <View style={{flexDirection:'row', gap:10}}>
                <TouchableOpacity
                  style={{flex:1, paddingVertical:13, borderRadius:12, borderWidth:1.5, borderColor: T.border, alignItems:'center'}}
                  onPress={() => { setShowAddColModal(false); setNewColLabel(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={{fontWeight:'700', fontSize:14, color: T.text}}>Zrušiť</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{flex:1.4, paddingVertical:13, borderRadius:12, backgroundColor: newColLabel.trim() ? '#a855f7' : (darkMode ? '#2d2d4e' : '#e2e8f0'), alignItems:'center',
                    ...Platform.select({ios:{shadowColor:'#a855f7',shadowOffset:{width:0,height:3},shadowOpacity:newColLabel.trim()?0.35:0,shadowRadius:8},android:{elevation:newColLabel.trim()?4:0}})}}
                  onPress={addCustomCol}
                  activeOpacity={0.85}
                  disabled={!newColLabel.trim()}
                >
                  <Text style={{fontWeight:'800', fontSize:14, color: newColLabel.trim() ? '#fff' : T.subText}}>Pridať stĺpec</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── HANDOVER POPUP ─────────────────────────────────────────────────── */}
      <Modal
        visible={showHandoverPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHandoverPopup(false)}
      >
        <View style={hdl.overlay}>
          <View style={[hdl.sheet, {backgroundColor: T.card}]}>
            <View style={[hdl.iconWrap, {backgroundColor: darkMode ? '#0c1a2e' : '#eff6ff'}]}>
              <Ionicons name="mail-unread" size={28} color="#3b82f6" />
            </View>
            <Text style={[hdl.title, {color: T.text}]}>
              {handoverPopupMsgs.length > 1 ? `Odkazy od predchádzajúcej zmeny (${handoverPopupMsgs.length})` : 'Odkaz od predchádzajúcej zmeny'}
            </Text>
            <View style={[hdl.msgBox, {backgroundColor: darkMode ? '#0a1120' : '#f8fafc', borderColor: T.border}]}>
              {handoverPopupMsgs.map((m, idx) => (
                <View key={idx} style={idx > 0 ? {marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.border} : {}}>
                  <View style={{flexDirection:'row', alignItems:'center', marginBottom: 3}}>
                    <Text style={{fontSize:12, fontWeight:'700', color: ACCENT}}>#{idx + 1}</Text>
                    {m.time ? <Text style={{fontSize:11, color: T.subText, marginLeft: 6}}>{m.time}</Text> : null}
                    <TouchableOpacity
                      onPress={() => deleteHandoverMsg(idx)}
                      activeOpacity={0.7}
                      style={{marginLeft:'auto', padding: 4}}
                    >
                      <Ionicons name="trash-outline" size={16} color={darkMode ? '#f87171' : '#ef4444'} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[hdl.msgTxt, {color: T.text}]}>{m.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[hdl.btn, {backgroundColor: ACCENT}]}
              onPress={() => setShowHandoverPopup(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-outline" size={18} color="#111" style={{marginRight: 8}} />
              <Text style={[hdl.btnTxt, {color: '#111'}]}>Rozumiem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader = React.memo(function SectionHeader({ label, icon, done, total, T }) {
  const hasProgress = done !== undefined && total !== undefined;
  const allDone = hasProgress && done === total && total > 0;
  return (
    <View style={sh.wrap}>
      <View style={[sh.iconWrap, {backgroundColor: allDone ? (T === darkTheme ? '#052e16' : '#dcfce7') : T.sectionIconBg}]}>
        <Ionicons name={icon || 'list-outline'} size={14} color={allDone ? '#22c55e' : T.sectionIcon} />
      </View>
      <Text style={[sh.label, {color: T.text}]}>{label}</Text>
      {hasProgress && (
        <View style={[sh.badge, {backgroundColor: allDone ? (T === darkTheme ? '#052e16' : '#dcfce7') : T.badgeBg}]}>
          <Text style={[sh.badgeText, {color: allDone ? '#22c55e' : T.badgeText}]}>
            {done}/{total}
          </Text>
        </View>
      )}
    </View>
  );
});

const CheckRow = React.memo(function CheckRow({ item, checked, editable, darkMode, T, onToggle, onChangeText, onDelete }) {
  return (
    <TouchableOpacity
      style={[cr.row, {
        backgroundColor: checked
          ? (darkMode ? '#052e16' : '#f0fdf4')
          : T.card,
        borderColor: checked
          ? (darkMode ? '#14532d' : '#86efac')
          : T.border,
      }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View style={[cr.checkbox, {
        backgroundColor: checked ? SUCCESS : T.cbBg,
        borderColor: checked ? SUCCESS : T.cbBorder,
      }]}>
        {checked && <Ionicons name="checkmark" size={16} color="#fff" />}
      </View>
      {editable ? (
        <TextInput
          style={[cr.label, {color: checked ? (darkMode ? '#4ade80' : '#15803d') : T.rowText}]}
          value={item}
          onChangeText={onChangeText}
          multiline
        />
      ) : (
        <Text style={[cr.label, {
          color: checked
            ? (darkMode ? '#4ade80' : '#15803d')
            : T.rowText,
          textDecorationLine: checked ? 'line-through' : 'none',
        }]}>
          {item}
        </Text>
      )}
      {editable && (
        <TouchableOpacity style={cr.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="remove-circle" size={20} color={DANGER} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Themes
// ─────────────────────────────────────────────────────────────────────────────
const lightTheme = {
  background:    '#f8fafc',
  card:          '#ffffff',
  text:          '#0f172a',
  subText:       '#64748b',
  icon:          '#334155',
  inputBg:       '#ffffff',
  inputText:     '#0f172a',
  placeholder:   '#94a3b8',
  border:        '#e2e8f0',
  rowText:       '#334155',
  cbBg:          '#ffffff',
  cbBorder:      '#cbd5e1',
  toggleBg:      '#f1f5f9',
  walkText:      '#334155',
  thBg:          '#fef3c7',
  thText:        '#92400e',
  tdBg:          '#ffffff',
  tdText:        '#0f172a',
  spBg:          '#eff6ff',
  spText:        '#1e40af',
  sumBg:         '#f8fafc',
  sumText:       '#0f172a',
  addBtnBg:      '#f0fdf4',
  addBtnBorder:  '#86efac',
  addBtnText:    '#16a34a',
  sectionIconBg: '#f1f5f9',
  sectionIcon:   '#64748b',
  badgeBg:       '#f1f5f9',
  badgeText:     '#64748b',
};

const darkTheme = {
  background:    '#0a1120',
  card:          '#111e34',
  text:          '#f1f5f9',
  subText:       '#64748b',
  icon:          '#f1f5f9',
  inputBg:       '#111e34',
  inputText:     '#f1f5f9',
  placeholder:   '#475569',
  border:        '#1e293b',
  rowText:       '#e2e8f0',
  cbBg:          '#111e34',
  cbBorder:      '#334155',
  toggleBg:      '#0a1120',
  walkText:      '#e2e8f0',
  thBg:          '#2d1f00',
  thText:        '#fbbf24',
  tdBg:          '#1a1200',
  tdText:        '#f1f5f9',
  spBg:          '#0c1a2e',
  spText:        '#93c5fd',
  sumBg:         '#0a1120',
  sumText:       '#e2e8f0',
  addBtnBg:      '#052e16',
  addBtnBorder:  '#14532d',
  addBtnText:    '#4ade80',
  sectionIconBg: '#111e34',
  sectionIcon:   '#64748b',
  badgeBg:       '#111e34',
  badgeText:     '#64748b',
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const SHADOW = Platform.select({
  ios:     {shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.07, shadowRadius:6},
  android: {elevation:2},
});
const SHADOW_MD = Platform.select({
  ios:     {shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.10, shadowRadius:12},
  android: {elevation:4},
});

const s = StyleSheet.create({
  container:       {flex:1},
  content:         {padding:18, paddingBottom:80},
  headerRow:       {flexDirection:'row', alignItems:'flex-start', marginBottom:18, marginTop:4},
  title:           {fontSize:30, fontWeight:'800', letterSpacing:-0.8, marginBottom:2},
  date:            {fontSize:13, fontWeight:'600', letterSpacing:0.2},
  settingsBtn:     {width:42, height:42, borderRadius:13, borderWidth:1, alignItems:'center', justifyContent:'center', marginLeft:12, marginTop:2, ...SHADOW},
  input:           {borderRadius:12, borderWidth:1.5, paddingHorizontal:14, paddingVertical:13, marginBottom:14, fontSize:15, fontWeight:'500', ...SHADOW},
  shiftToggleWrap: {flexDirection:'row', borderRadius:14, borderWidth:1, padding:4, marginBottom:22, ...SHADOW},
  shiftBtn:        {flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:11, borderRadius:11},
  shiftActive:     {backgroundColor:ACCENT, ...Platform.select({ios:{shadowColor:ACCENT,shadowOffset:{width:0,height:2},shadowOpacity:0.4,shadowRadius:6},android:{elevation:3}})},
  shiftBtnText:    {fontSize:15, fontWeight:'700'},
  walkWrap:        {flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:22},
  walkBox:         {width:'30%', paddingVertical:14, paddingHorizontal:8, borderRadius:14, borderWidth:1.5, alignItems:'center', justifyContent:'center', ...SHADOW},
  walkTxt:         {fontWeight:'700', fontSize:15},
  thCell:          {padding:6, borderWidth:1, textAlign:'center', fontSize:10, fontWeight:'800', letterSpacing:0.3},
  tdCell:          {padding:6, borderWidth:1, textAlign:'center', fontSize:12, fontWeight:'500'},
  sumCell:         {padding:6, borderWidth:1, textAlign:'center', fontWeight:'800', fontSize:12},
  addBtn:          {flexDirection:'row', alignItems:'center', justifyContent:'center', borderWidth:1.5, borderRadius:12, paddingVertical:11, marginBottom:14},
  addTxt:          {fontWeight:'700', fontSize:14},
  prodBox:         {borderRadius:16, borderWidth:1, paddingVertical:6, paddingHorizontal:16, marginBottom:22, ...SHADOW},
  prodRow:         {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:12},
  prodLabel:       {fontSize:13, fontWeight:'600'},
  prodValue:       {fontSize:15, fontWeight:'800'},
  prodDivider:     {height:1},
  notesBox:        {borderRadius:16, borderWidth:1.5, padding:14, marginBottom:22, ...SHADOW},
  handoverBox:     {borderRadius:16, borderWidth:1.5, paddingTop:14, paddingHorizontal:14, marginBottom:22, ...SHADOW},
  handoverDivider: {height:1, marginHorizontal:-14, marginTop:12},
  handoverBtn:     {flexDirection:'row', alignItems:'center', justifyContent:'center',
                    paddingVertical:13, marginHorizontal:-14, borderBottomLeftRadius:14, borderBottomRightRadius:14, marginTop:0},
  handoverBtnTxt:  {fontSize:14, fontWeight:'700'},
  notesInput:      {minHeight:130, textAlignVertical:'top', fontSize:15, fontWeight:'500', lineHeight:22},
  countdownBox:    {flexDirection:'row', alignItems:'center', borderRadius:14, borderWidth:1.5, paddingHorizontal:14, paddingVertical:12, marginBottom:18, ...SHADOW},
  countdownIconWrap:{width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', marginRight:12},
  countdownLabel:  {fontSize:11, fontWeight:'700', letterSpacing:0.5, marginBottom:2},
  countdownTime:   {fontSize:22, fontWeight:'900', letterSpacing:1},
  evalBox:         {borderRadius:16, borderWidth:1.5, marginBottom:22, overflow:'hidden', ...SHADOW},
  evalGradeRow:    {flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, gap:12},
  evalGradeIcon:   {width:40, height:40, borderRadius:12, alignItems:'center', justifyContent:'center'},
  evalGradeText:   {fontSize:18, fontWeight:'900', letterSpacing:-0.3},
  evalRows:        {paddingHorizontal:16, paddingVertical:4},
  evalRow:         {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:12},
  evalRowLabel:    {fontSize:13, fontWeight:'600'},
  evalRowVal:      {fontSize:14, fontWeight:'700'},
  evalPctBadge:    {paddingHorizontal:10, paddingVertical:4, borderRadius:20},
  evalPctText:     {fontSize:13, fontWeight:'800'},
  resetBtn:        {flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:DANGER, paddingVertical:15, borderRadius:14, marginTop:8, marginBottom:32,
    ...Platform.select({ios:{shadowColor:DANGER,shadowOffset:{width:0,height:4},shadowOpacity:0.35,shadowRadius:10},android:{elevation:5}})},
  resetTxt:        {color:'#fff', fontWeight:'800', fontSize:16},
  // ── Sticky footer ────────────────────────────────────────────────────────────
  stickyFooter:    {
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    ...SHADOW,
  },
});

const sh = StyleSheet.create({
  wrap:      {flexDirection:'row', alignItems:'center', marginBottom:12, marginTop:20},
  iconWrap:  {width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center', marginRight:10},
  label:     {fontSize:16, fontWeight:'800', flex:1, letterSpacing:-0.3},
  badge:     {paddingHorizontal:10, paddingVertical:3, borderRadius:20},
  badgeText: {fontSize:12, fontWeight:'700'},
});

const cr = StyleSheet.create({
  row:       {flexDirection:'row', alignItems:'flex-start', borderRadius:13, borderWidth:1.5, paddingHorizontal:12, paddingVertical:11, marginBottom:8,
    ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:4},android:{elevation:1}})},
  checkbox:  {width:26, height:26, borderRadius:8, borderWidth:1.5, alignItems:'center', justifyContent:'center', marginRight:12, flexShrink:0, marginTop:1},
  label:     {flex:1, fontSize:14, fontWeight:'500', lineHeight:20},
  deleteBtn: {padding:4, marginLeft:6, marginTop:1},
});

const sm_hBtn = {width:32, height:32, borderRadius:9, alignItems:'center', justifyContent:'center'};
const sm_hInput = {width:44, textAlign:'center', fontSize:16, fontWeight:'800', borderRadius:9, borderWidth:1.5, paddingVertical:5};

const sm = StyleSheet.create({
  container:    {flex:1},
  header:       {flexDirection:'row', justifyContent:'space-between', alignItems:'center',
                  paddingHorizontal:20, paddingTop: Platform.OS === 'ios' ? 20 : 36,
                  paddingBottom:16, borderBottomWidth:1},
  headerLeft:   {flexDirection:'row', alignItems:'center', gap:10},
  headerIconWrap:{width:32, height:32, borderRadius:10, backgroundColor: ACCENT, alignItems:'center', justifyContent:'center'},
  title:        {fontSize:20, fontWeight:'800', letterSpacing:-0.4},
  closeBtn:     {width:34, height:34, borderRadius:17, borderWidth:1, alignItems:'center', justifyContent:'center'},
  scroll:       {flex:1, paddingHorizontal:20, paddingTop:20},
  sectionLabelRow:{flexDirection:'row', alignItems:'center', marginBottom:8, marginTop:20, marginLeft:2},
  sectionLabel: {fontSize:11, fontWeight:'800', letterSpacing:1.6},
  card:         {borderRadius:16, borderWidth:1, marginBottom:6, overflow:'hidden', ...SHADOW_MD},
  row:          {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16, paddingVertical:14},
  rowLeft:      {flexDirection:'row', alignItems:'center', gap:12},
  rowTextBlock: {flexDirection:'column', gap:2},
  rowLabel:     {fontSize:15, fontWeight:'600'},
  rowSub:       {fontSize:12, fontWeight:'400', marginTop:1},
  iconBox:      {width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center'},
  divider:      {height:1, marginHorizontal:16},
  inputIconWrap:{width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center', marginRight:10},
  passwordRow:  {flexDirection:'row', alignItems:'center', marginHorizontal:16, marginBottom:12,
                  padding:12, borderRadius:12, borderWidth:1.5},
  passwordInput:{flex:1, fontSize:15, fontWeight:'500'},
  eyeBtn:       {padding:4},
  primaryBtn:   {flexDirection:'row', alignItems:'center', justifyContent:'center',
                  margin:16, marginTop:12, padding:14, borderRadius:12,
                  ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:0.15,shadowRadius:8},android:{elevation:4}})},
  primaryBtnTxt:{fontWeight:'700', fontSize:15},
  ghostBtn:     {flexDirection:'row', alignItems:'center', padding:16, borderRadius:0},
  ghostBtnTxt:  {fontWeight:'600', fontSize:15},
  infoBox:      {flexDirection:'row', margin:16, marginBottom:12, padding:13, borderRadius:12, borderWidth:1},
  catHdr:       {flexDirection:'row', alignItems:'center', borderRadius:16, borderWidth:1.5, paddingHorizontal:14, paddingVertical:14},
  catIco:       {width:44, height:44, borderRadius:14, alignItems:'center', justifyContent:'center', marginRight:14},
  catLbl:       {fontSize:16, fontWeight:'800', letterSpacing:-0.3},
  catSub:       {fontSize:12, fontWeight:'400', marginTop:2},
  catBody:      {borderWidth:1.5, borderTopWidth:0, borderBottomLeftRadius:16, borderBottomRightRadius:16, overflow:'hidden', marginBottom:10},
  infoText:     {flex:1, fontSize:12, lineHeight:19, fontWeight:'500'},
  pwLabelRow:   {flexDirection:'row', alignItems:'center', gap:8, marginBottom:6},
  pwStep:       {width:20, height:20, borderRadius:10, backgroundColor:ACCENT, alignItems:'center', justifyContent:'center'},
  pwStepTxt:    {fontSize:11, fontWeight:'800', color:'#111'},
  lockBanner:   {flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:16,
                  paddingVertical:14, borderBottomWidth:1},
  lockBannerIcon:{width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center'},
  lockBannerTitle:{fontSize:15, fontWeight:'700', marginBottom:2},
  lockBannerSub: {fontSize:12, fontWeight:'400'},
  unlockBtn:    {flexDirection:'row', alignItems:'center', justifyContent:'center',
                  paddingVertical:14, borderRadius:13,
                  ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:0.15,shadowRadius:8},android:{elevation:4}})},
  unlockBtnTxt: {fontWeight:'800', fontSize:16},
  pwFieldLabel: {fontSize:12, fontWeight:'600'},
});

const hdl = StyleSheet.create({
  overlay:  {flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:24},
  sheet:    {width:'100%', maxWidth:340, borderRadius:28, padding:24, alignItems:'center',
              ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:12},shadowOpacity:0.25,shadowRadius:24},android:{elevation:16}})},
  iconWrap: {width:64, height:64, borderRadius:20, alignItems:'center', justifyContent:'center', marginBottom:14, marginTop:4},
  title:    {fontSize:17, fontWeight:'800', letterSpacing:-0.3, marginBottom:16, textAlign:'center'},
  msgBox:   {width:'100%', borderRadius:14, borderWidth:1, padding:16, marginBottom:20},
  msgTxt:   {fontSize:15, fontWeight:'500', lineHeight:22},
  btn:      {flexDirection:'row', alignItems:'center', justifyContent:'center', width:'100%',
              paddingVertical:14, borderRadius:14,
              ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:0.15,shadowRadius:8},android:{elevation:4}})},
  btnTxt:   {fontSize:16, fontWeight:'800'},
});

const pin = StyleSheet.create({
  title:      {fontSize:22, fontWeight:'800', letterSpacing:-0.4, marginBottom:4},
  sub:        {fontSize:13, fontWeight:'500', marginBottom:28},
  dotsRow:    {flexDirection:'row', gap:14, marginBottom:8},
  dot:        {width:16, height:16, borderRadius:8},
  errorTxt:   {color:DANGER, fontSize:13, fontWeight:'700', marginBottom:4, marginTop:4},
  numpad:     {flexDirection:'row', flexWrap:'wrap', width:240, marginTop:20, gap:12},
  numKey:     {width:68, height:68, borderRadius:18, alignItems:'center', justifyContent:'center'},
  numKeyEmpty:{width:68, height:68},
  numKeyTxt:  {fontSize:26, fontWeight:'600'},
});
