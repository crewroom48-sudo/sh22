import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput,
  TouchableOpacity, StyleSheet, Alert, Switch, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const EDIT_PASSWORD = '2587';

export default function ShiftChecklistScreen() {
  const isInitialized = React.useRef(false);

  const today = new Date();
  const formattedDate = `${today.getDate().toString().padStart(2,'0')}.${(today.getMonth()+1).toString().padStart(2,'0')}.${today.getFullYear()}`;

  const morningHours = ['08','09','10','11','12','13','14'];
  const lunchHours   = ['15','16','17','18','19','20'];

  const [shiftType,      setShiftType]      = useState('morning');
  const [name,           setName]           = useState('');
  const [checks,         setChecks]         = useState({});
  const [duringChecks,   setDuringChecks]   = useState({});
  const [afterChecks,    setAfterChecks]    = useState({});
  const [walkChecks,     setWalkChecks]     = useState({});
  const [hoursWorked,    setHoursWorked]    = useState('');
  const [showSettings,   setShowSettings]   = useState(false);
  const [password,       setPassword]       = useState('');
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [notes,          setNotes]          = useState('');
  const [darkMode,       setDarkMode]       = useState(false);

  const [morningChecklist, setMorningChecklist] = useState([
    'Prebraté shift kľúče a mngr trezor?',
    'Ľudia na zmenu naplánovaní?',
    'Ciele zmeny nadefinované?',
    'BTO tabuľky vyplnené?',
    'Kontrola deaktivovaných produktov?',
    'FIFO a FSA',
    'Funkčné zariadenia',
    'Uniformy zamestnancov',
  ]);

  const [lunchChecklist, setLunchChecklist] = useState([
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
  ]);

  const [duringChecklist, setDuringChecklist] = useState([
    'Kontrola raňajok (Prechod)',
    'Kuchyňa aj servis navozené?',
    'HACCP kontroly vykonané?',
  ]);

  const [afterChecklist, setAfterChecklist] = useState([
    'Ciele vyhodnotené a komunikované s vedúcimi zón?',
    'Vyvozené príručné mrazničky',
    'Tabuľka vyhodnotenie zmeny vyplnená?',
    'Vyčistený kávovar',
    'Tréning + verifikácie v tabuľke vyhodnotené?',
    'Kancelária je čistá, poriadená?',
  ]);

  const mkRows = (hours) =>
    hours.map((h) => ({ hour:h, salesPlan:'', salesReality:'', tcPlan:'', tcReality:'', mfy:'', r2p:'', sendKuch:'', del:'' }));

  const [morningTableData, setMorningTableData] = useState(() => mkRows(morningHours));
  const [lunchTableData,   setLunchTableData]   = useState(() => mkRows(lunchHours));
  const [morningWalkTimes, setMorningWalkTimes] = useState(() => morningHours.map((h) => `${h}:00`));
  const [lunchWalkTimes,   setLunchWalkTimes]   = useState(() => lunchHours.map((h) => `${h}:00`));

  const tableData  = shiftType === 'morning' ? morningTableData : lunchTableData;
  const walkTimes  = shiftType === 'morning' ? morningWalkTimes : lunchWalkTimes;
  const checklist  = shiftType === 'morning' ? morningChecklist : lunchChecklist;
  const currentHoursForShift = shiftType === 'morning' ? morningHours : lunchHours;

  const setTableData = (d) => shiftType === 'morning' ? setMorningTableData(d) : setLunchTableData(d);
  const setWalkTimes = (t) => shiftType === 'morning' ? setMorningWalkTimes(t) : setLunchWalkTimes(t);

  // ── on mount: request permissions and load data ────────────────────────────
  useEffect(() => {
    (async () => {

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') Alert.alert('Upozornenie','Notifikácie nie sú povolené. Zapni ich v nastaveniach telefónu.');
      }
      await loadData();
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── reschedule notifications whenever data changes ─────────────────────────
  useEffect(() => {
    if (!isInitialized.current) return;
    saveData();
    if (Platform.OS !== 'web') scheduleAllNotifications();
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    name, checks, duringChecks, afterChecks, walkChecks,
    hoursWorked, morningChecklist, lunchChecklist,
    morningTableData, lunchTableData, morningWalkTimes, lunchWalkTimes,
    darkMode, notes, shiftType,
  ]);

  // ── schedule all future notifications for today ────────────────────────────
  const scheduleAllNotifications = async () => {
    if (Platform.OS === 'web') return;
    try {
      // Cancel everything first — we rebuild from scratch every time
      await Notifications.cancelAllScheduledNotificationsAsync();

      const now = new Date();

      // Helper: build a Date for today at HH:MM
      const todayAt = (h, m) => {
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
      };

      // ── Hourly row reminders ─────────────────────────────────────────────
      // For each hour row, fire at (hour+1):15 if salesReality or tcReality is empty
      for (const row of tableData) {
        const h = parseInt(row.hour);
        if (isNaN(h)) continue;
        const fireAt = todayAt(h + 1, 15); // e.g. row "08" → fires at 9:15
        if (fireAt > now && (row.salesReality === '' || row.tcReality === '')) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `Zabudol si si zapisať hodinu ${row.hour}:00`,
              body: 'Sales Real a/alebo TC Real nie je vyplnené!',
            },
            trigger: { date: fireAt },
          });
        }
      }

      // ── Before-shift reminders every 30 min until shift start ────────────
      const checklistComplete = Object.values(checks).every(Boolean);

      if (!checklistComplete) {
        const morningSlots = [[6,0],[6,30],[7,0],[7,30],[8,0],[8,30]];
        const lunchSlots   = [[12,0],[12,30],[13,0],[13,30],[14,0],[14,30],[15,0]];
        const slots = shiftType === 'morning' ? morningSlots : lunchSlots;
        const shiftEndMin = shiftType === 'morning' ? 8*60+30 : 15*60;

        for (const [h, m] of slots) {
          const fireAt = todayAt(h, m);
          if (fireAt > now) {
            const minsLeft = shiftEndMin - (h * 60 + m);
            const timeStr = minsLeft === 0 ? 'teraz' : `o ${minsLeft} min`;
            const shiftName = shiftType === 'morning' ? 'Ranná zmena' : 'Obedná zmena';
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `${shiftName} začína ${timeStr}`,
                body: 'Checklist pred zmenou ešte nie je dokončený!',
              },
              trigger: { date: fireAt },
            });
          }
        }
      }
    } catch (e) {
      console.log('Notification schedule error:', e);
    }
  };

  const loadData = async () => {
    try {
      const raw = await AsyncStorage.getItem('shiftAppData');
      if (raw) {
        const p = JSON.parse(raw);
        setName(p.name || '');
        setChecks(p.checks || {});
        setDuringChecks(p.duringChecks || {});
        setAfterChecks(p.afterChecks || {});
        setWalkChecks(p.walkChecks || {});
        setHoursWorked(p.hoursWorked || '');
        setNotes(p.notes || '');
        setDarkMode(p.darkMode || false);
        if (p.morningTableData?.length) setMorningTableData(p.morningTableData);
        if (p.morningWalkTimes?.length) setMorningWalkTimes(p.morningWalkTimes);
        if (p.lunchTableData?.length)   setLunchTableData(p.lunchTableData);
        if (p.lunchWalkTimes?.length)   setLunchWalkTimes(p.lunchWalkTimes);
      }
      const sm = await AsyncStorage.getItem('morningChecklist');
      const sl = await AsyncStorage.getItem('lunchChecklist');
      if (sm) setMorningChecklist(JSON.parse(sm));
      if (sl) setLunchChecklist(JSON.parse(sl));
    } catch (e) { console.log(e); }
    isInitialized.current = true;
  };

  const saveData = async () => {
    try {
      await AsyncStorage.setItem('shiftAppData', JSON.stringify({
        name, checks, duringChecks, afterChecks, walkChecks,
        hoursWorked, notes, darkMode,
        morningTableData, morningWalkTimes, lunchTableData, lunchWalkTimes,
      }));
      await AsyncStorage.setItem('morningChecklist', JSON.stringify(morningChecklist));
      await AsyncStorage.setItem('lunchChecklist',   JSON.stringify(lunchChecklist));
    } catch (e) { console.log(e); }
  };

  const switchShift = (s) => {
  setShiftType(s);
};
const darkTheme = {
  background:'#0d0d0d', card:'#1c1c1c', text:'#f0f0f0', subText:'#a0a0a0', icon:'#f0f0f0',
  inputBg:'#252525', inputText:'#f0f0f0', placeholder:'#666666',
  rowBg:'#1c1c1c', rowText:'#eeeeee', cbBg:'#2e2e2e', cbBorder:'#555555', cbMark:'#ffffff',
  btnBg:'#2e2e2e', btnText:'#cccccc',
  walkBg:'#1c1c1c', walkBorder:'#404040', walkText:'#eeeeee',
  border:'#3a3a3a', thBg:'#2e2600', thText:'#ffd84d',
  tdBg:'#1e1b00', tdText:'#e8e8e8', spBg:'#001e2e', spText:'#7dd4f5',
  sumBg:'#1a2428', sumText:'#d0e8f0',
};

const s = StyleSheet.create({
  container:   {flex:1},
  content:     {padding:16, paddingBottom:80},
  headerRow:   {flexDirection:'row', justifyContent:'space-between', alignItems:'center', width:'100%'},
  settingsBtn: {position:'absolute', right:0, top:0, padding:6, borderRadius:10},
  title:       {fontSize:28, fontWeight:'bold', marginBottom:20},
  date:        {marginBottom:10, fontWeight:'600'},
  input:       {borderRadius:10, padding:12, marginBottom:16},
  card:        {padding:15, borderRadius:12, marginBottom:20},
  row:         {flexDirection:'row', gap:10, marginBottom:20},
  shiftBtn:    {flex:1, padding:14, borderRadius:10, alignItems:'center'},
  shiftActive: {backgroundColor:'#f7d44c'},
  section:     {fontSize:22, fontWeight:'bold', marginVertical:12},
  checkRow:    {padding:12, borderRadius:10, flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10},
  rowLabel:    {flex:1, fontSize:15},
  del:         {color:'red', marginRight:10},
  checkbox:    {width:30, height:30, borderWidth:1, justifyContent:'center', alignItems:'center'},
  cbGreen:     {backgroundColor:'#7DFFB3'},
  walkWrap:    {flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginBottom:20},
  walkBox:     {width:'30%', padding:14, borderRadius:12, alignItems:'center', marginBottom:10, borderWidth:1},
  walkTxt:     {fontWeight:'bold', fontSize:15},
  cell:        {padding:6, borderWidth:1, textAlign:'center', fontSize:12},
  inputCell:   {padding:6, borderWidth:1, textAlign:'center', fontSize:12},
  sumCell:     {padding:6, borderWidth:1, textAlign:'center', fontWeight:'bold', fontSize:12},
  prodBox:     {padding:14, borderRadius:12, marginBottom:20},
  prodTxt:     {fontSize:16, fontWeight:'600', marginBottom:6},
  unlockBtn:   {backgroundColor:'#f7d44c', padding:12, borderRadius:10, alignItems:'center'},
  unlockTxt:   {fontWeight:'bold'},
  addBtn:      {backgroundColor:'#4CAF50', padding:14, borderRadius:10, alignItems:'center', marginBottom:15},
  addTxt:      {color:'white', fontWeight:'bold', fontSize:16},
  resetBtn:    {backgroundColor:'#ff5252', padding:14, borderRadius:10, alignItems:'center', marginBottom:15},
  resetTxt:    {color:'white', fontWeight:'bold', fontSize:16},
  notesBox:    {borderRadius:16, padding:14, marginBottom:24, borderWidth:1},
  notesInput:  {minHeight:140, textAlignVertical:'top', fontSize:16},
  footer:      {backgroundColor:'#1565c0', borderRadius:22, paddingVertical:28, paddingHorizontal:20, alignItems:'center', marginTop:35, marginBottom:40},
  footerTop:   {color:'#bbdefb', fontSize:13, letterSpacing:2},
  footerName:  {color:'#ffffff', fontSize:30, fontWeight:'bold', marginTop:8},
  footerSub:   {color:'#e3f2fd', marginTop:8, fontSize:14},
});