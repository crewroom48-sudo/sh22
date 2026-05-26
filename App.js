import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Alert, Switch, Platform,
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

// ─── AsyncStorage keys (one per shift per data type) ─────────────────────────
const KEYS = {
  shared:                   'shift_shared',
  morning_before:           'morning_before_checklist',
  morning_during:           'morning_during_checklist',
  morning_after:            'morning_after_checklist',
  morning_table:            'morning_table_data',
  morning_walk:             'morning_walk_times',
  afternoon_before:         'afternoon_before_checklist',
  afternoon_during:         'afternoon_during_checklist',
  afternoon_after:          'afternoon_after_checklist',
  afternoon_table:          'afternoon_table_data',
  afternoon_walk:           'afternoon_walk_times',
  checks:                   'shift_checks',
  duringChecks:             'shift_during_checks',
  afterChecks:              'shift_after_checks',
  walkChecks:               'shift_walk_checks',
};

// ─── Default checklist content ────────────────────────────────────────────────
const DEFAULT_MORNING_BEFORE = [
  'Prebraté shift kľúče a mngr trezor?',
  'Ľudia na zmenu naplánovaní?',
  'Ciele zmeny nadefinované?',
  'BTO tabuľky vyplnené?',
  'Kontrola deaktivovaných produktov?',
  'FIFO a FSA',
  'Funkčné zariadenia',
  'Uniformy zamestnancov',
];
const DEFAULT_MORNING_DURING = [
  'Kontrola raňajok (Prechod)',
  'Kuchyňa aj servis navozené?',
  'HACCP kontroly vykonané?',
];
const DEFAULT_MORNING_AFTER = [
  'Ciele vyhodnotené a komunikované s vedúcimi zón?',
  'Vyvozené príručné mrazničky',
  'Tabuľka vyhodnotenie zmeny vyplnená?',
  'Vyčistený kávovar',
  'Tréning + verifikácie v tabuľke vyhodnotené?',
  'Kancelária je čistá, poriadená?',
];
const DEFAULT_AFTERNOON_BEFORE = [
  'Ľudia na zmenu naplánovaní?',
  'Skontrolované doby spotreby?',
  'Ciele zmeny nadefinované?',
  'BTO tabuľky vyplnené?',
  'Kontrola deaktivovaných produktov?',
  'Lobby je čisté?',
  'e-production nastavená?',
  'FIFO a FSA',
  'Funkčné zariadenia',
  'Uniformy zamestnancov',
];
const DEFAULT_AFTERNOON_DURING = [
  'Hodinové vyhodnocovanie ukazovateľov',
  'Kuchyňa aj servis navozené?',
  'HACCP kontroly vykonané?',
];
const DEFAULT_AFTERNOON_AFTER = [
  'Podstatné informácie prichádzajúcemu shiftovi odovzdané?',
  'Ciele vyhodnotené a komunikované s vedúcimi zón?',
  'Odpad nahodený?',
  'Tabuľka vyhodnotenie zmeny vyplnená?',
  'Depozity a odvod spravený?',
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
  const [shiftType,      setShiftType]      = useState('morning');
  const [name,           setName]           = useState('');
  const [hoursWorked,    setHoursWorked]    = useState('');
  const [notes,          setNotes]          = useState('');
  const [darkMode,       setDarkMode]       = useState(false);
  const [showSettings,   setShowSettings]   = useState(false);
  const [password,       setPassword]       = useState('');
  const [editingEnabled, setEditingEnabled] = useState(false);

  // ── Checkbox states (keyed by shift+index so shifts never cross) ────────────
  const [checks,       setChecks]       = useState({});
  const [duringChecks, setDuringChecks] = useState({});
  const [afterChecks,  setAfterChecks]  = useState({});
  const [walkChecks,   setWalkChecks]   = useState({});

  // ── Morning shift: completely independent state ──────────────────────────────
  const [morningBefore, setMorningBefore] = useState(DEFAULT_MORNING_BEFORE);
  const [morningDuring, setMorningDuring] = useState(DEFAULT_MORNING_DURING);
  const [morningAfter,  setMorningAfter]  = useState(DEFAULT_MORNING_AFTER);
  const [morningTable,  setMorningTable]  = useState(() => mkRows(MORNING_HOURS));
  const [morningWalk,   setMorningWalk]   = useState(() => MORNING_HOURS.map(h => `${h}:00`));

  // ── Afternoon shift: completely independent state ────────────────────────────
  const [afternoonBefore, setAfternoonBefore] = useState(DEFAULT_AFTERNOON_BEFORE);
  const [afternoonDuring, setAfternoonDuring] = useState(DEFAULT_AFTERNOON_DURING);
  const [afternoonAfter,  setAfternoonAfter]  = useState(DEFAULT_AFTERNOON_AFTER);
  const [afternoonTable,  setAfternoonTable]  = useState(() => mkRows(AFTERNOON_HOURS));
  const [afternoonWalk,   setAfternoonWalk]   = useState(() => AFTERNOON_HOURS.map(h => `${h}:00`));

  // ── Derived: active shift data (read-only shortcuts) ────────────────────────
  const isMorning   = shiftType === 'morning';
  const checklist   = isMorning ? morningBefore   : afternoonBefore;
  const duringList  = isMorning ? morningDuring   : afternoonDuring;
  const afterList   = isMorning ? morningAfter    : afternoonAfter;
  const tableData   = isMorning ? morningTable    : afternoonTable;
  const walkTimes   = isMorning ? morningWalk     : afternoonWalk;
  const currentHours= isMorning ? MORNING_HOURS   : AFTERNOON_HOURS;
  const prefix      = shiftType; // 'morning' | 'afternoon' — used as key prefix

  // ── Setters that write to the correct shift ──────────────────────────────────
  const setChecklist  = (v) => isMorning ? setMorningBefore(v)   : setAfternoonBefore(v);
  const setDuringList = (v) => isMorning ? setMorningDuring(v)   : setAfternoonDuring(v);
  const setAfterList  = (v) => isMorning ? setMorningAfter(v)    : setAfternoonAfter(v);
  const setTableData  = (v) => isMorning ? setMorningTable(v)    : setAfternoonTable(v);
  const setWalkTimes  = (v) => isMorning ? setMorningWalk(v)     : setAfternoonWalk(v);

  // ── Load all data on mount ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted')
          Alert.alert('Upozornenie','Notifikácie nie sú povolené. Zapni ich v nastaveniach telefónu.');
      }
      await loadAll();
    })();
  }, []);

  const loadAll = async () => {
    try {
      const load = async (key, fallback) => {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      };

      // Shared
      const shared = await load(KEYS.shared, {});
      setName(shared.name || '');
      setHoursWorked(shared.hoursWorked || '');
      setNotes(shared.notes || '');
      setDarkMode(shared.darkMode || false);
      setShiftType(shared.shiftType || 'morning');

      // Checkbox states
      setChecks(      await load(KEYS.checks,      {}));
      setDuringChecks(await load(KEYS.duringChecks, {}));
      setAfterChecks( await load(KEYS.afterChecks,  {}));
      setWalkChecks(  await load(KEYS.walkChecks,   {}));

      // Morning checklists
      setMorningBefore(await load(KEYS.morning_before, DEFAULT_MORNING_BEFORE));
      setMorningDuring(await load(KEYS.morning_during, DEFAULT_MORNING_DURING));
      setMorningAfter( await load(KEYS.morning_after,  DEFAULT_MORNING_AFTER));
      const mt = await load(KEYS.morning_table, null);
      if (mt && mt.length) setMorningTable(mt);
      const mw = await load(KEYS.morning_walk, null);
      if (mw && mw.length) setMorningWalk(mw);

      // Afternoon checklists
      setAfternoonBefore(await load(KEYS.afternoon_before, DEFAULT_AFTERNOON_BEFORE));
      setAfternoonDuring(await load(KEYS.afternoon_during, DEFAULT_AFTERNOON_DURING));
      setAfternoonAfter( await load(KEYS.afternoon_after,  DEFAULT_AFTERNOON_AFTER));
      const at = await load(KEYS.afternoon_table, null);
      if (at && at.length) setAfternoonTable(at);
      const aw = await load(KEYS.afternoon_walk, null);
      if (aw && aw.length) setAfternoonWalk(aw);

    } catch (e) { console.log('loadAll error:', e); }
    isInitialized.current = true;
  };

  // ── Autosave helpers — each piece of state has its own useEffect ────────────
  const save = (key, value) => {
    if (!isInitialized.current) return;
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(console.log);
  };

  useEffect(() => { save(KEYS.shared, { name, hoursWorked, notes, darkMode, shiftType }); },
    [name, hoursWorked, notes, darkMode, shiftType]);

  useEffect(() => { save(KEYS.checks,       checks);       }, [checks]);
  useEffect(() => { save(KEYS.duringChecks, duringChecks); }, [duringChecks]);
  useEffect(() => { save(KEYS.afterChecks,  afterChecks);  }, [afterChecks]);
  useEffect(() => { save(KEYS.walkChecks,   walkChecks);   }, [walkChecks]);

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

  // ── Notifications ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized.current) return;
    if (Platform.OS !== 'web') scheduleAllNotifications();
  }, [name, checks, duringChecks, afterChecks, walkChecks, hoursWorked,
      morningTable, afternoonTable, morningWalk, afternoonWalk, shiftType]);

  const scheduleAllNotifications = async () => {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      const now = new Date();
      const todayAt = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };

      for (const row of tableData) {
        const h = parseInt(row.hour);
        if (isNaN(h)) continue;
        const fireAt = todayAt(h + 1, 15);
        if (fireAt > now && (row.salesReality === '' || row.tcReality === '')) {
          await Notifications.scheduleNotificationAsync({
            content: { title: `Zabudol si si zapisať hodinu ${row.hour}:00`, body: 'Sales Real a/alebo TC Real nie je vyplnené!' },
            trigger: { date: fireAt },
          });
        }
      }

      const checklistComplete = Object.values(checks).every(Boolean);
      if (!checklistComplete) {
        const morningSlots   = [[6,0],[6,30],[7,0],[7,30],[8,0],[8,30]];
        const afternoonSlots = [[12,0],[12,30],[13,0],[13,30],[14,0],[14,30],[15,0]];
        const slots = isMorning ? morningSlots : afternoonSlots;
        const shiftEndMin = isMorning ? 8*60+30 : 15*60;
        for (const [h, m] of slots) {
          const fireAt = todayAt(h, m);
          if (fireAt > now) {
            const minsLeft = shiftEndMin - (h * 60 + m);
            const timeStr = minsLeft === 0 ? 'teraz' : `o ${minsLeft} min`;
            const shiftName = isMorning ? 'Ranná zmena' : 'Obedná zmena';
            await Notifications.scheduleNotificationAsync({
              content: { title: `${shiftName} začína ${timeStr}`, body: 'Checklist pred zmenou ešte nie je dokončený!' },
              trigger: { date: fireAt },
            });
          }
        }
      }
    } catch (e) { console.log('Notification error:', e); }
  };

  // ── Toggle helpers ──────────────────────────────────────────────────────────
  const toggleCheck       = (k) => setChecks(p       => ({...p, [k]: !p[k]}));
  const toggleDuringCheck = (k) => setDuringChecks(p => ({...p, [k]: !p[k]}));
  const toggleAfterCheck  = (k) => setAfterChecks(p  => ({...p, [k]: !p[k]}));
  const toggleWalkCheck   = (k) => setWalkChecks(p   => ({...p, [k]: !p[k]}));

  // ── Checklist edit helpers (always write to the active shift) ───────────────
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

  // ── Table helpers ───────────────────────────────────────────────────────────
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

  // ── Calculations ────────────────────────────────────────────────────────────
  const calcSum  = (f) => tableData.reduce((s,r) => s + (parseFloat(r[f]) || 0), 0);
  const calcAvg  = () => { const v=tableData.map(r=>parseFloat(r.r2p)).filter(x=>!isNaN(x)); return v.length ? (v.reduce((s,x)=>s+x,0)/v.length).toFixed(2) : '0'; };
  const calcProd = (f) => { const h=parseFloat(hoursWorked)||0; return h ? (calcSum(f)/h).toFixed(2) : '0'; };

  const perfColor = (plan, real) => {
    const p=parseFloat(plan)||0, r=parseFloat(real)||0;
    if (!p||!r) return darkMode ? '#1a2235' : '#f8fafc';
    if (r>=p)     return darkMode ? '#052e16' : '#dcfce7';
    if (r>=p*0.9) return darkMode ? '#431407' : '#fef3c7';
    return darkMode ? '#2d0a0a' : '#fee2e2';
  };

  // ── Auth ────────────────────────────────────────────────────────────────────
  const unlockEditing = () => {
    if (password === EDIT_PASSWORD) { setEditingEnabled(true); setPassword(''); Alert.alert('Odomknuté','Editovanie povolené'); }
    else Alert.alert('Chyba','Nesprávne heslo');
  };

  // ── Reset — only clears the active shift ────────────────────────────────────
  const resetShift = () => Alert.alert('Reset zmeny','Naozaj chceš resetovať zmenu?',[
    {text:'Nie', style:'cancel'},
    {text:'Áno', style:'destructive', onPress: () => {
      const nd = currentHours.map(h => ({hour:h,salesPlan:'',salesReality:'',tcPlan:'',tcReality:'',mfy:'',r2p:'',sendKuch:'',del:''}));
      // Clear only this shift's checkboxes
      setChecks(p => {
        const n = {...p};
        Object.keys(n).forEach(k => { if (k.startsWith(prefix)) delete n[k]; });
        return n;
      });
      setDuringChecks(p => {
        const n = {...p};
        Object.keys(n).forEach(k => { if (k.startsWith(prefix)) delete n[k]; });
        return n;
      });
      setAfterChecks(p => {
        const n = {...p};
        Object.keys(n).forEach(k => { if (k.startsWith(prefix)) delete n[k]; });
        return n;
      });
      setWalkChecks(p => {
        const n = {...p};
        Object.keys(n).forEach(k => { if (k.startsWith(prefix)) delete n[k]; });
        return n;
      });
      setNotes('');
      setHoursWorked('');
      setTableData(nd);
      setWalkTimes(nd.map(r => `${r.hour}:00`));
    }},
  ], {cancelable: true});

  // ── Theme ───────────────────────────────────────────────────────────────────
  const T = darkMode ? darkTheme : lightTheme;
  const W    = [36,60,60,60,60,44,44,44,44];
  const COLS = ['Hod','Sales\nPlan','Sales\nReal','TC\nPlan','TC\nReal','MFY','R2P','SEND','Del'];
  const FIELDS = ['salesPlan','salesReality','tcPlan','tcReality','mfy','r2p','sendKuch','del'];

  // ── Progress counts ─────────────────────────────────────────────────────────
  const countDone = (stateObj, pfx, total) =>
    Array.from({length:total}, (_,i) => stateObj[`${pfx}_${i}`] ? 1 : 0).reduce((a,b) => a+b, 0);
  const beforeDone = countDone(checks,       `${prefix}_before`, checklist.length);
  const duringDone = countDone(duringChecks, `${prefix}_during`, duringList.length);
  const afterDone  = countDone(afterChecks,  `${prefix}_after`,  afterList.length);
  const walkDone   = Array.from({length:tableData.length}, (_,i) => walkChecks[`${prefix}_walk_${i}`] ? 1 : 0).reduce((a,b) => a+b, 0);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, {backgroundColor: T.background}]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── HEADER ───────────────────────────────────────────────────────── */}
        <View style={s.headerRow}>
          <View style={{flex:1}}>
            <Text style={[s.title, {color: T.text}]}>Shift Checklist</Text>
            <Text style={[s.date,  {color: T.subText}]}>{formattedDate}</Text>
          </View>
          <TouchableOpacity
            style={[s.settingsBtn, {backgroundColor: showSettings ? ACCENT : T.card, borderColor: T.border}]}
            onPress={() => setShowSettings(!showSettings)}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={22} color={showSettings ? '#111' : T.icon} />
          </TouchableOpacity>
        </View>

        {/* ── NAME ─────────────────────────────────────────────────────────── */}
        <TextInput
          style={[s.input, {backgroundColor: T.inputBg, color: T.inputText, borderColor: T.border}]}
          placeholder="Meno manažera"
          placeholderTextColor={T.placeholder}
          value={name}
          onChangeText={setName}
        />

        {/* ── SETTINGS ─────────────────────────────────────────────────────── */}
        {showSettings && (
          <View style={[s.card, {backgroundColor: T.card, borderColor: T.border}]}>
            <Text style={[s.cardTitle, {color: T.text}]}>Nastavenia</Text>

            <View style={[s.settingRow, {borderBottomColor: T.border}]}>
              <View style={s.settingLeft}>
                <View style={[s.settingIcon, {backgroundColor: darkMode ? '#1e3a5f' : '#eff6ff'}]}>
                  <Ionicons name="moon" size={15} color={darkMode ? '#93c5fd' : '#3b82f6'} />
                </View>
                <Text style={[s.settingLabel, {color: T.text}]}>Tmavý režim</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{false:'#cbd5e1', true:'#3b82f6'}}
                thumbColor="#fff"
              />
            </View>

            {!editingEnabled ? (
              <View style={{marginTop: 14}}>
                <TextInput
                  style={[s.input, {backgroundColor: T.inputBg, color: T.inputText, borderColor: T.border, marginBottom: 10}]}
                  placeholder="Heslo pre editovanie"
                  placeholderTextColor={T.placeholder}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity style={s.unlockBtn} onPress={unlockEditing} activeOpacity={0.85}>
                  <Ionicons name="lock-open-outline" size={16} color="#111" style={{marginRight: 6}} />
                  <Text style={s.unlockTxt}>Zapnúť editovanie</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[s.unlockBtn, {backgroundColor: DANGER, marginTop: 14}]} onPress={() => setEditingEnabled(false)} activeOpacity={0.85}>
                <Ionicons name="lock-closed-outline" size={16} color="#fff" style={{marginRight: 6}} />
                <Text style={[s.unlockTxt, {color:'#fff'}]}>Vypnúť editovanie</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── SHIFT TOGGLE ─────────────────────────────────────────────────── */}
        <View style={[s.shiftToggleWrap, {backgroundColor: T.toggleBg, borderColor: T.border}]}>
          {['morning','afternoon'].map((t) => (
            <TouchableOpacity
              key={t}
              style={[s.shiftBtn, shiftType === t && [s.shiftActive, {shadowColor: ACCENT}]]}
              onPress={() => setShiftType(t)}
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

        {/* ── BEFORE + DURING CHECKLISTS ────────────────────────────────────── */}
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

        {/* ── WALKTHROUGHS ──────────────────────────────────────────────────── */}
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

        {/* ── TABLE ─────────────────────────────────────────────────────────── */}
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
                {FIELDS.map((f, fi) => (
                  <TextInput key={f}
                    style={[s.tdCell, {width:W[fi+1], backgroundColor: T.tdBg, color: T.tdText, borderColor: T.border},
                      (f==='mfy'||f==='r2p')    && {backgroundColor: T.spBg, color: T.spText},
                      f==='salesReality' && {backgroundColor: perfColor(row.salesPlan, row.salesReality)},
                      f==='tcReality'    && {backgroundColor: perfColor(row.tcPlan, row.tcReality)},
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
              {['SUM', String(calcSum('salesPlan')), String(calcSum('salesReality')), String(calcSum('tcPlan')), String(calcSum('tcReality')), String(calcSum('mfy')), calcAvg(), String(calcSum('sendKuch')), String(calcSum('del'))].map((v, i) => (
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
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable sub-components (module-level — never re-created on parent render)
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
  card:            {borderRadius:16, borderWidth:1, padding:18, marginBottom:18, ...SHADOW_MD},
  cardTitle:       {fontSize:16, fontWeight:'800', letterSpacing:-0.3, marginBottom:16},
  settingRow:      {flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingBottom:14, borderBottomWidth:1},
  settingLeft:     {flexDirection:'row', alignItems:'center', gap:10},
  settingIcon:     {width:28, height:28, borderRadius:8, alignItems:'center', justifyContent:'center'},
  settingLabel:    {fontSize:15, fontWeight:'600'},
  unlockBtn:       {flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:ACCENT, paddingVertical:13, borderRadius:12, ...SHADOW},
  unlockTxt:       {fontWeight:'700', fontSize:15, color:'#111'},
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
  row:       {flexDirection:'row', alignItems:'center', borderRadius:13, borderWidth:1.5, paddingHorizontal:12, paddingVertical:11, marginBottom:8,
    ...Platform.select({ios:{shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:4},android:{elevation:1}})},
  checkbox:  {width:26, height:26, borderRadius:8, borderWidth:1.5, alignItems:'center', justifyContent:'center', marginRight:12, flexShrink:0},
  label:     {flex:1, fontSize:14, fontWeight:'500', lineHeight:20},
  deleteBtn: {padding:4, marginLeft:6},
});
