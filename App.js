/**
 * Shift Checklist — Standalone App.js
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
 */

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Alert, Switch, Platform, Modal, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

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
  handover:          'shift_handover_message',
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
  const [customPassword,      setCustomPassword]      = useState('');
  const [showChangePw,        setShowChangePw]        = useState(false);
  const [cpCurrent,           setCpCurrent]           = useState('');
  const [cpNew,               setCpNew]               = useState('');
  const [cpConfirm,           setCpConfirm]           = useState('');
  const [showCpCurrent,       setShowCpCurrent]       = useState(false);
  const [showCpNew,           setShowCpNew]           = useState(false);
  const [showCpConfirm,       setShowCpConfirm]       = useState(false);

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
    morningPrepHour:    8,   // exact hour for morning prep notification
    morningPrepMinute:  1,   // exact minute for morning prep notification
    afternoonPrepHour:  15,  // exact hour for afternoon prep notification
    afternoonPrepMinute:1,   // exact minute for afternoon prep notification
    tableMinute:        16,  // minutes into next hour for table (X+1:16)
  });

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

  // ── Derived: active shift shortcuts ─────────────────────────────────────────
  const isMorning    = shiftType === 'morning';
  const checklist    = isMorning ? morningBefore       : afternoonBefore;
  const duringList   = isMorning ? morningDuring       : afternoonDuring;
  const afterList    = isMorning ? morningAfter        : afternoonAfter;
  const tableData    = isMorning ? morningTable        : afternoonTable;
  const walkTimes    = isMorning ? morningWalk         : afternoonWalk;
  const currentHours = isMorning ? MORNING_HOURS       : AFTERNOON_HOURS;
  const prefix       = shiftType;

  // Per-shift name and hours — completely independent between shifts
  const name         = isMorning ? morningName         : afternoonName;
  const setName      = isMorning ? setMorningName      : setAfternoonName;
  const hoursWorked  = isMorning ? morningHoursWorked  : afternoonHoursWorked;
  const setHoursWorked = isMorning ? setMorningHoursWorked : setAfternoonHoursWorked;

  const setChecklist  = (v) => isMorning ? setMorningBefore(v)  : setAfternoonBefore(v);
  const setDuringList = (v) => isMorning ? setMorningDuring(v)  : setAfternoonDuring(v);
  const setAfterList  = (v) => isMorning ? setMorningAfter(v)   : setAfternoonAfter(v);
  const setTableData  = (v) => isMorning ? setMorningTable(v)   : setAfternoonTable(v);
  const setWalkTimes  = (v) => isMorning ? setMorningWalk(v)    : setAfternoonWalk(v);
  const notes         = isMorning ? morningNotes    : afternoonNotes;
  const setNotes      = isMorning ? setMorningNotes : setAfternoonNotes;

  // ── Load on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted')
          Alert.alert('Upozornenie','Notifikácie nie sú povolené. Zapni ich v nastaveniach telefónu.');
      }
      if (Platform.OS === 'android') {
        // Delete the channel first — Android locks channel settings after first
        // creation, so a plain setNotificationChannelAsync call cannot update
        // sound or importance on an already-existing channel.
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

      // Show handover popup if previous manager left messages
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
  useEffect(() => { save(KEYS.notif_times, notifTimes); if (isInitialized.current && Platform.OS !== 'web') debouncedSchedule(); }, [notifTimes]);
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

  // Načíta správy z AsyncStorage → state (helper)
  const loadHandoverMsgs = async () => {
    const raw = await AsyncStorage.getItem(KEYS.handover);
    if (!raw) return [];
    try { const l = JSON.parse(raw); return Array.isArray(l) ? l : [{text: raw, time: ''}]; }
    catch { return [{text: raw, time: ''}]; }
  };

  // Prepnutie zmeny + zobraz odkaz
  const switchShift = async (t) => {
    if (t === shiftType) return;
    setShiftType(t);
    const list = await loadHandoverMsgs();
    if (list.length) { setHandoverPopupMsgs(list); setShowHandoverPopup(true); }
  };

  // Ručné zobrazenie odkazov
  const viewHandover = async () => {
    const list = await loadHandoverMsgs();
    if (list.length) { setHandoverPopupMsgs(list); setShowHandoverPopup(true); }
  };

  // Vymazať jednu správu podľa indexu
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
  // Both shifts are scheduled upfront so notifications fire even when the app is
  // closed or the phone is locked. The fireAt > now guard prevents rescheduling
  // notifications that have already fired. Unique identifiers ensure only one
  // notification per slot ever exists in the OS queue at a time. A 1-second
  // debounce collapses rapid state changes (checkbox taps, table edits) into a
  // single scheduling run to avoid the cancel/reschedule race condition.

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

  const scheduleAllNotifications = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      // Snapshot time AFTER cancel so the "is this in the future?" check is
      // as accurate as possible.
      const now = new Date();
      const todayAt = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

      // Helper: returns seconds until fireAt, or null if fireAt is in the past.
      const secsUntil = (fireAt) => {
        const s = Math.round((fireAt.getTime() - now.getTime()) / 1000);
        return s > 0 ? s : null;
      };

      // Build a one-shot trigger using DATE so Android registers it via
      // AlarmManager.setExactAndAllowWhileIdle(). This fires reliably even
      // when the app is killed, the screen is locked, or the device is in
      // Doze mode. TIME_INTERVAL uses a JavaScript-level timer which the OS
      // destroys when the app process is killed -- that is why notifications
      // were silently missed when the phone was locked or the app was closed.
      const makeTrigger = (fireAt) => ({
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: 'default',
      });

      // Derive the morning cutoff dynamically from the first hour of the
      // afternoon table. If the afternoon first hour is 15, cutoff = 15:00;
      // if the user changes it to 14, cutoff = 14:00 — fully automatic.
      // Falls back to 23:59 if the afternoon table is empty so morning rows
      // are never unexpectedly blocked.
      const afFirstHour = afternoonTable.length ? parseInt(afternoonTable[0].hour) : NaN;
      const morningCutoff = !isNaN(afFirstHour) ? todayAt(afFirstHour, 0) : todayAt(23, 59);

      // ── 1. Morning table notifications ───────────────────────────────────
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
                title: `Nevypísal si hodinu ${row.hour}:00`,
                body: 'Sales Real alebo TC Real nie je vyplnené!',
                sound: 'default',
              },
              trigger: makeTrigger(fireAt),
            });
          }
        }
      }

      // ── 2. Afternoon table notifications ─────────────────────────────────
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
                title: `Nevypísal si hodinu ${row.hour}:00`,
                body: 'Sales Real alebo TC Real nie je vyplnené!',
                sound: 'default',
              },
              trigger: makeTrigger(fireAt),
            });
          }
        }
      }

      // ── 3. Morning preparation notification ──────────────────────────────
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
                  title: 'Ranná zmena začína!',
                  body: 'Checklist pred zmenou ešte nie je dokončený!',
                  sound: 'default',
                },
                trigger: makeTrigger(fireAt),
              });
            }
          }
        }
      }

      // ── 4. Afternoon preparation notification ─────────────────────────────
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
                  title: 'Obedná zmena začína!',
                  body: 'Checklist pred zmenou ešte nie je dokončený!',
                  sound: 'default',
                },
                trigger: makeTrigger(fireAt),
              });
            }
          }
        }
      }
    } catch (e) { console.log('Notification error:', e); }
  };

  // ── Test notifications ────────────────────────────────────────────────────────
  // Fires a sample of every notification type in 10 seconds so the user can
  // verify sound, vibration, and lock-screen behaviour without waiting for a
  // real shift hour. Uses unique "test_" identifiers so they never cancel or
  // conflict with the real scheduled notifications.
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

      // 1. Preparation notification — fires in 10 s
      await Notifications.scheduleNotificationAsync({
        identifier: 'test_prep',
        content: {
          title: '🔔 TEST — Príprava zmeny',
          body: 'Toto je testovacia notifikácia pre Prípravu zmeny.',
          sound: 'default',
        },
        trigger: inSecs(10),
      });

      // 2. Table row notification — fires in 20 s
      await Notifications.scheduleNotificationAsync({
        identifier: 'test_table',
        content: {
          title: '🔔 TEST — Nevypísal si hodinu 08:00',
          body: 'Toto je testovacia notifikácia pre hodinový riadok tabuľky.',
          sound: 'default',
        },
        trigger: inSecs(20),
      });

      Alert.alert(
        'Test naplánovaný ✅',
        'Prvá notifikácia príde za 10 sekúnd.\nDruhá notifikácia príde za 20 sekúnd.\n\nZamkni telefón alebo minimalizuj appku — notifikácie musia prísť aj tak.',
      );
    } catch (e) {
      console.log('Test notification error:', e);
      Alert.alert('Chyba', 'Nepodarilo sa naplánovať testovací notifikáciu.');
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
    setTableData([...tableData, {hour:'',salesPlan:'',salesReality:'',tcPlan:'',tcReality:'',mfy:'',r2p:'',sendKuch:'',del:''}]);
    setWalkTimes([...walkTimes, '']);
  };
  const deleteTableRow = (idx) => {
    setTableData(tableData.filter((_,i) => i !== idx));
    setWalkTimes(walkTimes.filter((_,i) => i !== idx));
  };
  const updateRow = (idx, field, val) => {
    const u = [...tableData];
    u[idx] = {...u[idx], [field]: val};
    const tcp = parseFloat(u[idx].tcPlan) || 0;
    u[idx].sendKuch = (tcp * 1.9).toFixed(0);
    u[idx].del      = (tcp * 0.07).toFixed(0);
    setTableData(u);
  };

  // ── Calculations ──────────────────────────────────────────────────────────────
  const calcSum  = (f) => tableData.reduce((s,r) => s + (parseFloat(r[f]) || 0), 0);
  const calcAvg  = () => { const v=tableData.map(r=>parseFloat(r.r2p)).filter(x=>!isNaN(x)); return v.length ? (v.reduce((s,x)=>s+x,0)/v.length).toFixed(2) : '0'; };
  const calcProd = (f) => { const h=parseFloat(hoursWorked)||0; return h ? (calcSum(f)/h).toFixed(2) : '0'; };
  // AVG = Sales Real / TC Real pre jeden riadok
  const rowAvg   = (row) => { const s=parseFloat(row.salesReality),t=parseFloat(row.tcReality); return t>0 ? (s/t).toFixed(2) : '-'; };
  // Priemerný nákup za celú zmenu = priemer hodinových AVG hodnôt
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
      const nd = currentHours.map(h => ({hour:h,salesPlan:'',salesReality:'',tcPlan:'',tcReality:'',mfy:'',r2p:'',sendKuch:'',del:''}));
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
  const T = darkMode ? darkTheme : lightTheme;
  const W        = [36,60,60,60,60,40,44,44,44,44];
  const COLS     = ['Hod','Sales\nPlan','Sales\nReal','TC\nPlan','TC\nReal','AVG','MFY','R2P','SEND','Del'];
  const FIELDS_A = ['salesPlan','salesReality','tcPlan','tcReality'];
  const FIELDS_B = ['mfy','r2p','sendKuch','del'];

  // ── Progress counts ───────────────────────────────────────────────────────────
  const countDone = (stateObj, pfx, total) =>
    Array.from({length:total}, (_,i) => stateObj[`${pfx}_${i}`] ? 1 : 0).reduce((a,b) => a+b, 0);
  const beforeDone = countDone(checks,       `${prefix}_before`, checklist.length);
  const duringDone = countDone(duringChecks, `${prefix}_during`, duringList.length);
  const afterDone  = countDone(afterChecks,  `${prefix}_after`,  afterList.length);
  const walkDone   = Array.from({length:tableData.length}, (_,i) => walkChecks[`${prefix}_walk_${i}`] ? 1 : 0).reduce((a,b) => a+b, 0);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, {backgroundColor: T.background}]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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

        {/* ── BEFORE + DURING CHECKLISTS ─────────────────────────────────────── */}
        {[
          {label:'Pred zmenou', icon:'clipboard-outline', items:checklist,  toggle:toggleCheck,       stateObj:checks,      pfx:`${prefix}_before`, section:'before', done:beforeDone, total:checklist.length},
          {label:'Počas zmeny', icon:'time-outline',      items:duringList, toggle:toggleDuringCheck, stateObj:duringChecks, pfx:`${prefix}_during`, section:'during', done:duringDone, total:duringList.length},
        ].map(({label, icon, items, toggle, stateObj, pfx, section, done, total}) => (
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

        {/* ── WALKTHROUGHS ───────────────────────────────────────────────────── */}
        <SectionHeader label="Obhliadky prevádzky" icon="walk-outline" done={walkDone} total={tableData.length} T={T} />
        <View style={s.walkWrap}>
          {tableData.map((row, i) => {
            const checked = !!walkChecks[`${prefix}_walk_${i}`];
            return (
              <TouchableOpacity
                key={`${prefix}_walk_${i}`}
                style={[s.walkBox, {
                  backgroundColor: checked ? (darkMode ? '#052e16' : '#dcfce7') : T.card,
                  borderColor: checked ? (darkMode ? '#14532d' : '#86efac') : T.border,
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
          })}
        </View>

        {/* ── TABLE ──────────────────────────────────────────────────────────── */}
        <SectionHeader label="Plan / Realita" icon="bar-chart-outline" T={T} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 6}}>
          <View>
            <View style={{flexDirection:'row'}}>
              {editingEnabled && <View style={[s.thCell, {width:36, backgroundColor: T.thBg, borderColor: T.border}]} />}
              {COLS.map((c, i) => (
                <Text key={c} style={[s.thCell, {width:W[i], backgroundColor: T.thBg, color: T.thText, borderColor: T.border}]}>{c}</Text>
              ))}
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
                <TextInput style={[s.tdCell, {width:W[0], backgroundColor: T.tdBg, color: T.tdText, borderColor: T.border, fontWeight:'700'}]} value={row.hour} onChangeText={(v) => updateRow(i,'hour',v)} />
                {FIELDS_A.map((f, fi) => (
                  <TextInput key={f}
                    style={[s.tdCell, {width:W[fi+1], backgroundColor: T.tdBg, color: T.tdText, borderColor: T.border},
                      f==='salesReality' && {backgroundColor: perfColor(row.salesPlan, row.salesReality)},
                      f==='tcReality'    && {backgroundColor: perfColor(row.tcPlan, row.tcReality)},
                    ]}
                    value={row[f]}
                    onChangeText={(v) => updateRow(i, f, v)}
                    keyboardType="numeric"
                  />
                ))}
                <Text style={[s.tdCell, {width:W[5], backgroundColor: T.spBg, color: T.spText, borderColor: T.border, textAlign:'center', fontWeight:'700', paddingTop:8}]}>
                  {rowAvg(row)}
                </Text>
                {FIELDS_B.map((f, fi) => (
                  <TextInput key={f}
                    style={[s.tdCell, {width:W[fi+6], backgroundColor: T.tdBg, color: T.tdText, borderColor: T.border},
                      (f==='mfy'||f==='r2p') && {backgroundColor: T.spBg, color: T.spText},
                    ]}
                    value={row[f]}
                    onChangeText={(v) => updateRow(i, f, v)}
                    keyboardType="numeric"
                  />
                ))}
              </View>
            ))}
            <View style={{flexDirection:'row'}}>
              {editingEnabled && <View style={[s.sumCell, {width:36, backgroundColor: T.sumBg, borderColor: T.border}]} />}
              {['SUM', String(calcSum('salesPlan')), String(calcSum('salesReality')), String(calcSum('tcPlan')), String(calcSum('tcReality')), calcAvgPurchase(), String(calcSum('mfy')), calcAvg(), String(calcSum('sendKuch')), String(calcSum('del'))].map((v, i) => (
                <Text key={i} style={[s.sumCell, {width:W[i], backgroundColor: T.sumBg, color: T.sumText, borderColor: T.border}]}>{v}</Text>
              ))}
            </View>
          </View>
        </ScrollView>
        {editingEnabled && (
          <TouchableOpacity style={[s.addBtn, {backgroundColor: T.addBtnBg, borderColor: T.addBtnBorder, marginBottom: 20}]} onPress={addTableRow} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={16} color={T.addBtnText} style={{marginRight: 6}} />
            <Text style={[s.addTxt, {color: T.addBtnText}]}>Pridať riadok</Text>
          </TouchableOpacity>
        )}

        {/* ── HOURS ──────────────────────────────────────────────────────────── */}
        <SectionHeader label="Hodiny" icon="time-outline" T={T} />
        <TextInput
          style={[s.input, {backgroundColor: T.inputBg, color: T.inputText, borderColor: T.border}]}
          placeholder="Počet hodín"
          placeholderTextColor={T.placeholder}
          value={hoursWorked}
          onChangeText={setHoursWorked}
          keyboardType="numeric"
        />

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
        </View>

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

        {/* ── RESET ──────────────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.resetBtn} onPress={resetShift} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={17} color="#fff" style={{marginRight: 7}} />
          <Text style={s.resetTxt}>Reset zmeny</Text>
        </TouchableOpacity>

        {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={[s.footerBy,   {color: T.subText}]}>CREATED BY</Text>
          <Text style={[s.footerName, {color: T.text}]}>Róbert Rosenberger</Text>
          <Text style={[s.footerSub,  {color: T.subText}]}>Shift Checklist</Text>
        </View>

      </ScrollView>

      {/* ── SETTINGS MODAL ─────────────────────────────────────────────────── */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
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
              onPress={() => setShowSettings(false)}
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

            {/* ─── EDITOVANIE ─── */}
            <View style={sm.sectionLabelRow}>
              <Ionicons name="pencil-outline" size={12} color={T.subText} style={{marginRight: 5}} />
              <Text style={[sm.sectionLabel, {color: T.subText}]}>EDITOVANIE</Text>
            </View>
            <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
              {/* Lock status banner */}
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

                      {/* Dots */}
                      <View style={pin.dotsRow}>
                        {[0,1,2,3].map(i => (
                          <View key={i} style={[
                            pin.dot,
                            {backgroundColor: pinError ? DANGER : (pinInput.length > i ? ACCENT : (darkMode ? '#334155' : '#e2e8f0'))},
                          ]} />
                        ))}
                      </View>
                      {pinError && <Text style={pin.errorTxt}>Nesprávny PIN</Text>}

                      {/* Numpad */}
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

            {/* ─── NOTIFIKÁCIE (viditeľné len po odomknutí) ─── */}
            {editingEnabled && (
              <>
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

                {/* ─── ČASY NOTIFIKÁCIÍ ─── */}
                <View style={sm.sectionLabelRow}>
                  <Ionicons name="alarm-outline" size={12} color={T.subText} style={{marginRight: 5}} />
                  <Text style={[sm.sectionLabel, {color: T.subText}]}>ČASY NOTIFIKÁCIÍ</Text>
                </View>
                <View style={[sm.card, {backgroundColor: T.card, borderColor: T.border}]}>
                  {/* Morning Prep time */}
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
                    <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                      <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:52}}>HODINA</Text>
                      <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,morningPrepHour:Math.max(0,(p.morningPrepHour??8)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                        <TextInput style={{width:46,textAlign:'center',fontSize:16,fontWeight:'800',color:ACCENT,backgroundColor:T.inputBg,borderRadius:9,borderWidth:1.5,borderColor:ACCENT,paddingVertical:5}} value={String(notifTimes.morningPrepHour??8)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setNotifTimes(p=>({...p,morningPrepHour:n}));else if(v==='')setNotifTimes(p=>({...p,morningPrepHour:0}));}} />
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,morningPrepHour:Math.min(23,(p.morningPrepHour??8)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                      </View>
                      <Text style={{color:ACCENT,fontSize:20,fontWeight:'900',marginHorizontal:2}}>:</Text>
                      <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:52}}>MINÚTA</Text>
                      <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,morningPrepMinute:Math.max(0,(p.morningPrepMinute??1)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                        <TextInput style={{width:46,textAlign:'center',fontSize:16,fontWeight:'800',color:ACCENT,backgroundColor:T.inputBg,borderRadius:9,borderWidth:1.5,borderColor:ACCENT,paddingVertical:5}} value={String(notifTimes.morningPrepMinute??1)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=59)setNotifTimes(p=>({...p,morningPrepMinute:n}));else if(v==='')setNotifTimes(p=>({...p,morningPrepMinute:0}));}} />
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,morningPrepMinute:Math.min(59,(p.morningPrepMinute??1)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal:16, marginVertical:10}]} />

                  {/* Afternoon Prep time */}
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
                    <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                      <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:52}}>HODINA</Text>
                      <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,afternoonPrepHour:Math.max(0,(p.afternoonPrepHour??15)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                        <TextInput style={{width:46,textAlign:'center',fontSize:16,fontWeight:'800',color:'#f59e0b',backgroundColor:T.inputBg,borderRadius:9,borderWidth:1.5,borderColor:'#f59e0b',paddingVertical:5}} value={String(notifTimes.afternoonPrepHour??15)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=23)setNotifTimes(p=>({...p,afternoonPrepHour:n}));else if(v==='')setNotifTimes(p=>({...p,afternoonPrepHour:0}));}} />
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,afternoonPrepHour:Math.min(23,(p.afternoonPrepHour??15)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                      </View>
                      <Text style={{color:'#f59e0b',fontSize:20,fontWeight:'900',marginHorizontal:2}}>:</Text>
                      <Text style={{color: T.subText, fontSize:12, fontWeight:'700', width:52}}>MINÚTA</Text>
                      <View style={{flexDirection:'row', alignItems:'center', gap:5}}>
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,afternoonPrepMinute:Math.max(0,(p.afternoonPrepMinute??1)-1)}))} activeOpacity={0.7}><Ionicons name="remove" size={16} color={T.text} /></TouchableOpacity>
                        <TextInput style={{width:46,textAlign:'center',fontSize:16,fontWeight:'800',color:'#f59e0b',backgroundColor:T.inputBg,borderRadius:9,borderWidth:1.5,borderColor:'#f59e0b',paddingVertical:5}} value={String(notifTimes.afternoonPrepMinute??1)} keyboardType="numeric" maxLength={2} onChangeText={(v)=>{const n=parseInt(v);if(!isNaN(n)&&n>=0&&n<=59)setNotifTimes(p=>({...p,afternoonPrepMinute:n}));else if(v==='')setNotifTimes(p=>({...p,afternoonPrepMinute:0}));}} />
                        <TouchableOpacity style={{width:32,height:32,borderRadius:9,backgroundColor:T.card,borderWidth:1.5,borderColor:T.border,alignItems:'center',justifyContent:'center'}} onPress={() => setNotifTimes(p=>({...p,afternoonPrepMinute:Math.min(59,(p.afternoonPrepMinute??1)+1)}))} activeOpacity={0.7}><Ionicons name="add" size={16} color={T.text} /></TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={[sm.divider, {backgroundColor: T.border, marginHorizontal:16, marginVertical:10}]} />

                  {/* Table minute */}
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
                      <Text style={[{color: T.subText, fontSize:13, fontWeight:'600', width:130}]}>Minúty po hodine:</Text>
                      <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                        <TouchableOpacity
                          style={{width:34, height:34, borderRadius:10, backgroundColor: T.card, borderWidth:1.5, borderColor: T.border, alignItems:'center', justifyContent:'center'}}
                          onPress={() => setNotifTimes(p => ({...p, tableMinute: Math.max(0, (p.tableMinute||16) - 1)}))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="remove" size={18} color={T.text} />
                        </TouchableOpacity>
                        <TextInput
                          style={{width:50, textAlign:'center', fontSize:17, fontWeight:'800', color:'#3b82f6', backgroundColor: T.inputBg, borderRadius:10, borderWidth:1.5, borderColor:'#3b82f6', paddingVertical:6}}
                          value={String(notifTimes.tableMinute ?? 16)}
                          keyboardType="numeric"
                          maxLength={2}
                          onChangeText={(v) => {
                            const n = parseInt(v);
                            if (!isNaN(n) && n >= 0 && n <= 59) setNotifTimes(p => ({...p, tableMinute: n}));
                            else if (v === '') setNotifTimes(p => ({...p, tableMinute: 0}));
                          }}
                        />
                        <TouchableOpacity
                          style={{width:34, height:34, borderRadius:10, backgroundColor: T.card, borderWidth:1.5, borderColor: T.border, alignItems:'center', justifyContent:'center'}}
                          onPress={() => setNotifTimes(p => ({...p, tableMinute: Math.min(59, (p.tableMinute||16) + 1)}))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="add" size={18} color={T.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>

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
                      {'Testovací režim: notifikácie prídu za 10 s a 20 s.\nZamkni telefón alebo minimalizuj appku pred stlačením.'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[sm.primaryBtn, {backgroundColor: '#fbbf24', marginTop: 0}]}
                    onPress={sendTestNotifications}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="flask-outline" size={16} color="#111" style={{marginRight: 8}} />
                    <Text style={[sm.primaryBtnTxt, {color: '#111'}]}>Otestovať notifikácie (10 s / 20 s)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={{height: 40}} />
          </ScrollView>
        </View>
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
function SectionHeader({ label, icon, done, total, T }) {
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
          <Text style={[sh.badgeText, {color: allDone ? '#22c55e' : T.badgeText}]}>{done}/{total}</Text>
        </View>
      )}
    </View>
  );
}

function CheckRow({ item, checked, editable, darkMode, T, onToggle, onChangeText, onDelete }) {
  return (
    <View style={[cr.row, {
      backgroundColor: checked ? (darkMode ? '#052e16' : '#f0fdf4') : T.card,
      borderColor: checked ? (darkMode ? '#14532d' : '#86efac') : T.border,
    }]}>
      <TouchableOpacity
        style={[cr.checkbox, {
          backgroundColor: checked ? (darkMode ? '#16a34a' : '#22c55e') : T.cbBg,
          borderColor: checked ? 'transparent' : T.cbBorder,
        }]}
        onPress={onToggle}
        activeOpacity={0.8}
      >
        {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
      </TouchableOpacity>
      <TextInput
        style={[cr.label, {
          color: checked ? (darkMode ? '#86efac' : '#15803d') : T.rowText,
          textDecorationLine: checked ? 'line-through' : 'none',
        }]}
        value={item}
        editable={editable}
        multiline
        onChangeText={onChangeText}
      />
      {editable && (
        <TouchableOpacity onPress={onDelete} style={cr.deleteBtn} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={15} color="#ef4444" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Themes
// ─────────────────────────────────────────────────────────────────────────────
const lightTheme = {
  background:    '#f1f5f9',
  card:          '#ffffff',
  text:          '#0f172a',
  subText:       '#64748b',
  icon:          '#0f172a',
  inputBg:       '#ffffff',
  inputText:     '#0f172a',
  placeholder:   '#94a3b8',
  border:        '#e2e8f0',
  rowText:       '#0f172a',
  cbBg:          '#f1f5f9',
  cbBorder:      '#cbd5e1',
  toggleBg:      '#e2e8f0',
  walkText:      '#0f172a',
  thBg:          '#fef3c7',
  thText:        '#92400e',
  tdBg:          '#fffbeb',
  tdText:        '#0f172a',
  spBg:          '#eff6ff',
  spText:        '#1e40af',
  sumBg:         '#f1f5f9',
  sumText:       '#0f172a',
  addBtnBg:      '#f0fdf4',
  addBtnBorder:  '#86efac',
  addBtnText:    '#15803d',
  sectionIconBg: '#f1f5f9',
  sectionIcon:   '#64748b',
  badgeBg:       '#f1f5f9',
  badgeText:     '#64748b',
};
const darkTheme = {
  background:    '#070d1a',
  card:          '#0f1a2e',
  text:          '#f1f5f9',
  subText:       '#94a3b8',
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
  content:         {padding:18, paddingBottom:60},
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
  resetBtn:        {flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:DANGER, paddingVertical:15, borderRadius:14, marginTop:8, marginBottom:32,
    ...Platform.select({ios:{shadowColor:DANGER,shadowOffset:{width:0,height:4},shadowOpacity:0.35,shadowRadius:10},android:{elevation:5}})},
  resetTxt:        {color:'#fff', fontWeight:'800', fontSize:16},
  footer:          {alignItems:'center', paddingTop:8, paddingBottom:8, marginTop:8},
  footerBy:        {fontSize:9, fontWeight:'800', letterSpacing:3, marginBottom:4},
  footerName:      {fontSize:20, fontWeight:'800', letterSpacing:-0.4},
  footerSub:       {fontSize:12, fontWeight:'600', marginTop:3, letterSpacing:0.5},
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
  infoText:     {flex:1, fontSize:12, lineHeight:19, fontWeight:'500'},
  pwLabelRow:   {flexDirection:'row', alignItems:'center', gap:8, marginBottom:6},
  pwStep:       {width:20, height:20, borderRadius:10, backgroundColor:ACCENT, alignItems:'center', justifyContent:'center'},
  pwStepTxt:    {fontSize:11, fontWeight:'800', color:'#111'},
  pwFieldLabel: {fontSize:12, fontWeight:'600', letterSpacing:0.3},
  lockBanner:   {flexDirection:'row', alignItems:'center', gap:14, paddingHorizontal:16,
                  paddingVertical:14, borderBottomWidth:1},
  lockBannerIcon:{width:38, height:38, borderRadius:12, alignItems:'center', justifyContent:'center'},
  lockBannerTitle:{fontSize:15, fontWeight:'700', marginBottom:2},
  lockBannerSub: {fontSize:12, fontWeight:'400'},
  unlockBtn:    {flexDirection:'row', alignItems:'center', justifyContent:'center',
                  paddingVertical:14, borderRadius:13,
                  ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:3},shadowOpacity:0.15,shadowRadius:8},android:{elevation:4}})},
  unlockBtnTxt: {fontWeight:'800', fontSize:16},
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
