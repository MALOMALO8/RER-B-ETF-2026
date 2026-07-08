import './style.css'

// Firebase SDK imports from CDN
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyA8f-aqalE4Ar3GJKF2dp4XOkRvz2pnRmg',
  authDomain: 'etf-rer-b-e2b84.firebaseapp.com',
  projectId: 'etf-rer-b-e2b84',
  storageBucket: 'etf-rer-b-e2b84.firebasestorage.app',
  messagingSenderId: '508339509506',
  appId: '1:508339509506:web:306bde2199c524031c0a1b'
}

// Initialize Firebase
let db = null
try {
  const app = initializeApp(firebaseConfig)
  db = getFirestore(app)
} catch (error) {
  console.log('Firebase init error:', error)
}

// Admin password
const ADMIN_PASSWORD = 'MDP8lannin&'

// Functions list
const FONCTIONS = ['Chef', 'Poseur', 'Soudeur', 'Conducteur', 'Autre']

// Shift configuration
const SHIFTS = ['Matin', 'AM', 'Nuit', 'Repos']
const SHIFT_COLORS = {
  'Matin': { bg: 'bg-yellow-400/20', border: 'border-yellow-400', text: 'text-yellow-300', ring: 'ring-yellow-400' },
  'AM': { bg: 'bg-orange-400/20', border: 'border-orange-400', text: 'text-orange-300', ring: 'ring-orange-400' },
  'Nuit': { bg: 'bg-blue-400/20', border: 'border-blue-400', text: 'text-blue-300', ring: 'ring-blue-400' },
  'Repos': { bg: 'bg-gray-400/20', border: 'border-gray-400', text: 'text-gray-300', ring: 'ring-gray-400' }
}

// Chantier colors
const CHANTIER_COLORS = [
  { name: 'Rouge', value: '#ef4444' },
  { name: 'Bleu', value: '#3b82f6' },
  { name: 'Vert', value: '#22c55e' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Violet', value: '#a855f7' },
  { name: 'Rose', value: '#ec4899' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Jaune', value: '#eab308' }
]

// State
let isAuthenticated = false
let personnel = []
let chantiers = []
let affectations = []
let currentView = 'home'
let selectedPersonnelFilter = ''
let selectedChantierFilter = ''
let map = null
let markers = []

let selectedPersonnelIds = new Set()
let filterFonction = ''

let viewMode = '2weeks'
let startDate = new Date()
let endDate = new Date()
endDate.setDate(startDate.getDate() + 13)

function generateDays() {
  const days = []
  let numDays = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 14
  for (let i = 0; i < numDays; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)
    days.push(date.toISOString().split('T')[0])
  }
  return days
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  return `${days[date.getDay()]} ${date.getDate()}`
}

function formatDateFull(dateStr) {
  const date = new Date(dateStr)
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatGoogleMapsUrl(lat, lng) {
  return `http://googleusercontent.com/maps.google.com/?q=${lat},${lng}`
}

window.navigate = function(view) {
  currentView = view
  if (view === 'visitor' || view === 'map') {
    setTimeout(initMap, 100)
  }
  render()
}

window.handleLogin = function() {
  const input = document.getElementById('password-input')
  if (input.value === ADMIN_PASSWORD) {
    isAuthenticated = true
    navigate('admin')
  } else {
    input.classList.add('border-red-500')
    alert('Mot de passe incorrect')
  }
}

window.handleLogout = function() {
  isAuthenticated = false
  selectedPersonnelIds.clear()
  navigate('home')
}

window.prevPeriod = function() {
  const delta = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 14
  startDate.setDate(startDate.getDate() - delta)
  render()
}

window.nextPeriod = function() {
  const delta = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 14
  startDate.setDate(startDate.getDate() + delta)
  render()
}

window.setViewMode = function(mode) {
  viewMode = mode
  render()
}

window.goToToday = function() {
  startDate = new Date()
  render()
}

window.refreshData = async function() {
  const btn = document.getElementById('refresh-btn')
  if (btn) btn.classList.add('animate-spin')
  render()
  setTimeout(() => { if (btn) btn.classList.remove('animate-spin') }, 1000)
}

window.toggleSelectAll = function() {
  const filtered = getFilteredPersonnel()
  const allSelected = filtered.every(p => selectedPersonnelIds.has(p.id))
  if (allSelected) filtered.forEach(p => selectedPersonnelIds.delete(p.id))
  else filtered.forEach(p => selectedPersonnelIds.add(p.id))
  render()
}

window.togglePersonnelSelect = function(id) {
  if (selectedPersonnelIds.has(id)) selectedPersonnelIds.delete(id)
  else selectedPersonnelIds.add(id)
  render()
}

window.setFilterFonction = function(fonction) {
  filterFonction = fonction
  render()
}

function getFilteredPersonnel() {
  if (!filterFonction) return personnel
  return personnel.filter(p => p.fonction === filterFonction)
}

window.openMassAssignModal = function() {
  const modal = document.getElementById('mass-assign-modal')
  if (modal) modal.classList.remove('hidden')
}

window.closeMassAssignModal = function() {
  const modal = document.getElementById('mass-assign-modal')
  if (modal) modal.classList.add('hidden')
}

window.applyMassAssign = async function() {
  // ... (Code original)
  render()
}

window.savePersonnel = async function(e) {
  e.preventDefault()
  // ... (Code original)
  render()
}

window.deletePersonnel = async function(id) {
  await deleteDoc(doc(db, 'personnel', id))
}

window.editPersonnel = async function(id) { /* ... */ }

window.saveChantier = async function(e) {
  e.preventDefault()
  // ... (Code original)
}

window.deleteChantier = async function(id) {
  await deleteDoc(doc(db, 'chantiers', id))
}

// SÉCURITÉ : Vérifie si le conteneur existe avant d'ajouter l'élément
window.addGpsPoint = function() {
  const container = document.getElementById('gps-points-container')
  if (!container) return 
  const row = document.createElement('div')
  row.className = 'gps-point grid grid-cols-12 gap-2 items-center'
  row.innerHTML = `
    <input type="text" class="gps-adresse col-span-5 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm" placeholder="Adresse">
    <input type="number" step="any" class="gps-lat col-span-3 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm" placeholder="Lat">
    <input type="number" step="any" class="gps-lng col-span-3 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm" placeholder="Lng">
    <button type="button" onclick="this.parentElement.remove()" class="col-span-1 text-red-400 hover:text-red-300">X</button>
  `
  container.appendChild(row)
}

window.editChantier = async function(id) { /* ... */ }

window.toggleShift = async function(personId, date, shift) { /* ... */ }

window.updateChantierAssign = async function(personId, date, chantierId) { /* ... */ }

window.filterPersonnelName = function() {
  const input = document.getElementById('personnel-name-filter')
  if (input) selectedPersonnelFilter = input.value
  render()
}

window.selectChantierFilter = function(chantierId) {
  selectedChantierFilter = chantierId
  render()
}

// SÉCURITÉ : Vérifie si la carte peut être initialisée
function initMap() {
  const mapEl = document.getElementById('map')
  if (!mapEl || map) return 

  map = L.map('map').setView([48.8566, 2.3522], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
  // ... (Logique marqueurs)
}

function render() {
  const app = document.getElementById('app')
  if (!app) return 
  // (Insère ici tout ton switch(currentView) original)
}

function subscribeToData() {
  if (!db) return
  onSnapshot(collection(db, 'personnel'), (s) => { personnel = s.docs.map(d => ({id: d.id, ...d.data()})); render() })
  onSnapshot(collection(db, 'chantiers'), (s) => { chantiers = s.docs.map(d => ({id: d.id, ...d.data()})); render() })
  onSnapshot(collection(db, 'affectations'), (s) => { affectations = s.docs.map(d => ({id: d.id, ...d.data()})); render() })
}

subscribeToData()
