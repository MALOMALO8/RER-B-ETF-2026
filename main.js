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

// Mass selection state
let selectedPersonnelIds = new Set()
let filterFonction = ''

// Date navigation state
let viewMode = '2weeks' // 'day', 'week', '2weeks'
let startDate = new Date()
let endDate = new Date()
endDate.setDate(startDate.getDate() + 13)

// Dark mode state
let darkMode = true

// Helper functions
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

// Navigation functions
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

// Date navigation
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
  if (mode === 'day') {
    endDate = new Date(startDate)
  } else if (mode === 'week') {
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
  } else {
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 13)
  }
  render()
}

window.goToToday = function() {
  startDate = new Date()
  if (viewMode === 'day') {
    endDate = new Date(startDate)
  } else if (viewMode === 'week') {
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
  } else {
    endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 13)
  }
  render()
}

// Refresh data
window.refreshData = async function() {
  if (!db) return
  const btn = document.getElementById('refresh-btn')
  if (btn) btn.classList.add('animate-spin')

  render()
  setTimeout(() => {
    if (btn) btn.classList.remove('animate-spin')
  }, 1000)
}

// Mass selection
window.toggleSelectAll = function() {
  const filtered = getFilteredPersonnel()
  const allSelected = filtered.every(p => selectedPersonnelIds.has(p.id))

  if (allSelected) {
    filtered.forEach(p => selectedPersonnelIds.delete(p.id))
  } else {
    filtered.forEach(p => selectedPersonnelIds.add(p.id))
  }
  render()
}

window.togglePersonnelSelect = function(id) {
  if (selectedPersonnelIds.has(id)) {
    selectedPersonnelIds.delete(id)
  } else {
    selectedPersonnelIds.add(id)
  }
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

// Mass assignment modal
window.openMassAssignModal = function() {
  if (selectedPersonnelIds.size === 0) {
    alert('Sélectionnez au moins un collaborateur')
    return
  }
  document.getElementById('mass-assign-modal').classList.remove('hidden')
}

window.closeMassAssignModal = function() {
  document.getElementById('mass-assign-modal').classList.add('hidden')
}

window.applyMassAssign = async function() {
  const shift = document.getElementById('mass-shift').value
  const chantierId = document.getElementById('mass-chantier').value
  const dateStart = document.getElementById('mass-date-start').value
  const dateEnd = document.getElementById('mass-date-end').value

  if (!shift || !dateStart) {
    alert('Shift et date de début sont obligatoires')
    return
  }

  const startDateObj = new Date(dateStart)
  const endDateObj = dateEnd ? new Date(dateEnd) : startDateObj
  const dates = []

  for (let d = new Date(startDateObj); d <= endDateObj; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  try {
    for (const personId of selectedPersonnelIds) {
      for (const date of dates) {
        const existing = affectations.find(a => a.id_personne === personId && a.date === date)
        if (existing) {
          await updateDoc(doc(db, 'affectations', existing.id), {
            shift,
            id_chantier: chantierId || null
          })
        } else {
          await addDoc(collection(db, 'affectations'), {
            id_personne: personId,
            shift,
            id_chantier: chantierId || null,
            date,
            createdAt: new Date().toISOString()
          })
        }
      }
    }
    closeMassAssignModal()
    selectedPersonnelIds.clear()
  } catch (error) {
    console.error('Error:', error)
    alert('Erreur lors de l\'affectation')
  }
}

// Personnel CRUD
window.savePersonnel = async function(e) {
  e.preventDefault()
  const prenom = document.getElementById('prenom-input').value.trim()
  const nom = document.getElementById('nom-input').value.trim()
  const fonction = document.getElementById('fonction-input').value
  const telephone = document.getElementById('telephone-input').value.trim()

  if (!prenom || !nom) return alert('Prénom et nom sont obligatoires')

  try {
    await addDoc(collection(db, 'personnel'), {
      prenom, nom, fonction, telephone,
      createdAt: new Date().toISOString()
    })
    document.getElementById('prenom-input').value = ''
    document.getElementById('nom-input').value = ''
    document.getElementById('fonction-input').value = ''
    document.getElementById('telephone-input').value = ''
  } catch (error) {
    alert('Erreur lors de l\'ajout')
  }
}

window.deletePersonnel = async function(id) {
  if (!confirm('Supprimer ce collaborateur ?')) return
  try {
    await deleteDoc(doc(db, 'personnel', id))
  } catch (error) {
    alert('Erreur lors de la suppression')
  }
}

window.editPersonnel = async function(id) {
  const person = personnel.find(p => p.id === id)
  if (!person) return

  const prenom = prompt('Prénom:', person.prenom)
  const nom = prompt('Nom:', person.nom)
  const fonction = prompt('Fonction:', person.fonction || '')
  const telephone = prompt('Téléphone:', person.telephone || '')

  if (prenom && nom) {
    await updateDoc(doc(db, 'personnel', id), {
      prenom, nom,
      fonction: fonction || '',
      telephone: telephone || ''
    })
  }
}

// Chantier CRUD
window.saveChantier = async function(e) {
  e.preventDefault()
  const nom = document.getElementById('chantier-nom').value.trim()
  const couleur = document.getElementById('chantier-couleur').value
  const resp_jour = document.getElementById('chantier-resp-jour').value
  const resp_nuit = document.getElementById('chantier-resp-nuit').value
  const infos = document.getElementById('chantier-infos').value.trim()

  // Get all GPS points
  const gpsPoints = []
  document.querySelectorAll('.gps-point').forEach(row => {
    const adresse = row.querySelector('.gps-adresse').value.trim()
    const lat = parseFloat(row.querySelector('.gps-lat').value) || null
    const lng = parseFloat(row.querySelector('.gps-lng').value) || null
    if (adresse && lat && lng) {
      gpsPoints.push({ adresse, lat, lng })
    }
  })

  if (!nom) return alert('Le nom est obligatoire')

  try {
    await addDoc(collection(db, 'chantiers'), {
      nom, couleur, resp_jour: resp_jour || null, resp_nuit: resp_nuit || null,
      infos, gpsPoints,
      createdAt: new Date().toISOString()
    })
    document.getElementById('chantier-nom').value = ''
    document.getElementById('chantier-infos').value = ''
  } catch (error) {
    alert('Erreur lors de l\'ajout')
  }
}

window.deleteChantier = async function(id) {
  if (!confirm('Supprimer ce chantier ?')) return
  await deleteDoc(doc(db, 'chantiers', id))
}

// --- SÉCURITÉ AJOUTÉE ---
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
window.addGpsPoint()

window.editChantier = async function(id) {
  const chantier = chantiers.find(c => c.id === id)
  if (!chantier) return

  const nom = prompt('Nom:', chantier.nom)
  const infos = prompt('Informations:', chantier.infos || '')

  if (nom) {
    await updateDoc(doc(db, 'chantiers', id), {
      nom,
      infos: infos || ''
    })
  }
}

// Toggle shift
window.toggleShift = async function(personId, date, shift) {
  const existingAff = affectations.find(a => a.id_personne === personId && a.date === date)

  try {
    if (existingAff) {
      if (existingAff.shift === shift) {
        await deleteDoc(doc(db, 'affectations', existingAff.id))
      } else {
        await updateDoc(doc(db, 'affectations', existingAff.id), { shift })
      }
    } else {
      await addDoc(collection(db, 'affectations'), {
        id_personne: personId, date, shift,
        id_chantier: null,
        createdAt: new Date().toISOString()
      })
    }
  } catch (error) {
    alert('Erreur')
  }
}

window.updateChantierAssign = async function(personId, date, chantierId) {
  const existingAff = affectations.find(a => a.id_personne === personId && a.date === date)
  if (existingAff) {
    await updateDoc(doc(db, 'affectations', existingAff.id), {
      id_chantier: chantierId || null
    })
  }
}

// Terrain filtering
window.filterPersonnelName = function() {
  selectedPersonnelFilter = document.getElementById('personnel-name-filter').value
  render()
}

window.selectChantierFilter = function(chantierId) {
  selectedChantierFilter = chantierId
  render()
}

// --- SÉCURITÉ AJOUTÉE ---
function initMap() {
  const mapEl = document.getElementById('map')
  if (!mapEl || map) return

  map = L.map('map').setView([48.8566, 2.3522], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMap'
  }).addTo(map)

  markers = []
  chantiers.forEach(c => {
    if (c.gpsPoints?.length > 0) {
      c.gpsPoints.forEach(point => {
        const color = c.couleur || '#3b82f6'
        const icon = L.divIcon({
          html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
          className: 'custom-marker'
        })
        const marker = L.marker([point.lat, point.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <b style="color:${color}">${c.nom}</b><br>
            ${point.adresse}<br>
            <a href="${formatGoogleMapsUrl(point.lat, point.lng)}" target="_blank">Ouvrir GPS</a>
          `)
        markers.push(marker)
      })
    }
  })

  if (markers.length > 0) {
    map.fitBounds(L.featureGroup(markers).getBounds(), { padding: [30, 30] })
  }
}

// ============== RENDER FUNCTIONS ==============

function renderLoginScreen() {
  return `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      <div class="bg-gray-800/80 backdrop-blur rounded-2xl shadow-2xl p-8 w-full max-w-md border border-gray-700">
        <div class="text-center mb-8">
          <div class="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-white">RER B ETF 2026</h1>
          <p class="text-gray-400 mt-2">Planification du personnel</p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Mot de passe Admin</label>
            <input type="password" id="password-input"
              class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Entrez le mot de passe...">
          </div>
          <button onclick="handleLogin()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition">
            Connexion Admin
          </button>
          <div class="relative my-4">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-600"></div></div>
            <div class="relative flex justify-center text-sm"><span class="px-2 bg-gray-800 text-gray-400">ou</span></div>
          </div>
          <button onclick="navigate('visitor')" class="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition">
            Accès Terrain
          </button>
        </div>
      </div>
    </div>
  `
}

function renderAdminDashboard() {
  const days = generateDays()
  const filtered = getFilteredPersonnel()

  return `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-20">
        <div class="max-w-full mx-auto px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <h1 class="text-lg font-bold">Admin - Planning RER B ETF</h1>
              <span class="text-xs px-2 py-1 bg-green-600/20 text-green-400 rounded">Connecté</span>
            </div>
            <div class="flex items-center gap-2">
              <button id="refresh-btn" onclick="refreshData()" class="p-2 hover:bg-gray-700 rounded-lg" title="Rafraîchir">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
              </button>
              <button onclick="navigate('personnel')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium">Personnel</button>
              <button onclick="navigate('chantiers')" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium">Chantiers</button>
              <button onclick="handleLogout()" class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Déconnexion</button>
            </div>
          </div>
        </div>
      </header>

      <div class="bg-gray-800/50 border-b border-gray-700 px-4 py-3">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <label class="text-sm text-gray-400">Filtre:</label>
            <select onchange="setFilterFonction(this.value)" class="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm">
              <option value="">Tous</option>
              ${FONCTIONS.map(f => `<option value="${f}" ${filterFonction === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="toggleSelectAll()" class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">
              ${filtered.length > 0 && filtered.every(p => selectedPersonnelIds.has(p.id)) ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            <span class="text-sm text-gray-400">${selectedPersonnelIds.size} sélectionnés</span>
          </div>

          <button onclick="openMassAssignModal()" class="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium">
            Appliquer à la sélection
          </button>

          <div class="flex items-center gap-1 ml-auto">
            <button onclick="prevPeriod()" class="p-2 hover:bg-gray-700 rounded-lg">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <button onclick="goToToday()" class="px-3 py-1 hover:bg-gray-700 rounded text-sm">Aujourd'hui</button>
            <button onclick="nextPeriod()" class="p-2 hover:bg-gray-700 rounded-lg">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>

          <div class="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button onclick="setViewMode('day')" class="px-3 py-1 rounded ${viewMode === 'day' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">Jour</button>
            <button onclick="setViewMode('week')" class="px-3 py-1 rounded ${viewMode === 'week' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">Semaine</button>
            <button onclick="setViewMode('2weeks')" class="px-3 py-1 rounded ${viewMode === '2weeks' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">2 sem.</button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full min-w-[800px]">
          <thead class="bg-gray-800 sticky top-[108px] z-10">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-400 sticky left-0 bg-gray-800 min-w-[200px]">
                <input type="checkbox" onchange="toggleSelectAll()" ${filtered.length > 0 && filtered.every(p => selectedPersonnelIds.has(p.id)) ? 'checked' : ''} class="mr-2">
                Personnel
              </th>
              ${days.map(date => `
                <th class="px-2 py-2 text-center text-xs font-medium text-gray-400 min-w-[130px]">
                  <div class="font-bold">${formatDate(date)}</div>
                  <div class="text-gray-500">${date.split('-')[2]}/${date.split('-')[1]}</div>
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800">
            ${filtered.length === 0 ? `
              <tr><td colspan="${days.length + 1}" class="px-4 py-8 text-center text-gray-500">Aucun personnel</td></tr>
            ` : filtered.map(person => `
              <tr class="hover:bg-gray-800/50 ${selectedPersonnelIds.has(person.id) ? 'bg-blue-900/20' : ''}">
                <td class="px-3 py-2 sticky left-0 bg-gray-900">
                  <div class="flex items-center gap-2">
                    <input type="checkbox" ${selectedPersonnelIds.has(person.id) ? 'checked' : ''} onchange="togglePersonnelSelect('${person.id}')">
                    <div>
                      <div class="font-medium text-sm">${person.prenom} ${person.nom}</div>
                      <div class="text-xs text-gray-500">${person.fonction || '-'}</div>
                    </div>
                  </div>
                </td>
                ${days.map(date => {
                  const aff = affectations.find(a => a.id_personne === person.id && a.date === date)
                  const shiftColors = aff ? SHIFT_COLORS[aff.shift] : SHIFT_COLORS['Repos']
                  return `
                    <td class="px-2 py-1">
                      <div class="flex flex-col gap-1">
                        <div class="flex gap-0.5">
                          ${SHIFTS.map(shift => {
                            const isSelected = aff?.shift === shift
                            const colors = SHIFT_COLORS[shift]
                            return `<button onclick="toggleShift('${person.id}', '${date}', '${shift}')"
                              class="w-6 h-6 text-xs rounded ${colors.bg} ${colors.border} border ${isSelected ? 'ring-2 ' + colors.ring : 'opacity-40 hover:opacity-100'}">${shift.charAt(0)}</button>`
                          }).join('')}
                        </div>
                        ${aff ? `
                          <select onchange="updateChantierAssign('${person.id}', '${date}', this.value)" class="text-xs px-1 py-0.5 bg-gray-700 border border-gray-600 rounded">
                            <option value="">-</option>
                            ${chantiers.map(c => `<option value="${c.id}" ${aff.id_chantier === c.id ? 'selected' : ''} style="color:${c.couleur}">${c.nom.substring(0,12)}</option>`).join('')}
                          </select>
                        ` : ''}
                      </div>
                    </td>
                  `
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div id="mass-assign-modal" class="hidden fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div class="bg-gray-800 rounded-xl p-6 w-full max-w-md border border-gray-700">
          <h3 class="text-lg font-bold mb-4">Affectation massive</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Shift</label>
              <select id="mass-shift" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
                ${SHIFTS.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Chantier</label>
              <select id="mass-chantier" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
                <option value="">Aucun</option>
                ${chantiers.map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Date début</label>
                <input type="date" id="mass-date-start" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Date fin</label>
                <input type="date" id="mass-date-end" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded">
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button onclick="closeMassAssignModal()" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">Annuler</button>
              <button onclick="applyMassAssign()" class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium">Appliquer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderPersonnelManagement() {
  return `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onclick="navigate('admin')" class="p-2 hover:bg-gray-700 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 class="text-lg font-bold">Gestion Personnel</h1>
        </div>
      </header>

      <main class="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 class="text-lg font-semibold mb-4">Ajouter un collaborateur</h2>
          <form onsubmit="savePersonnel(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1">Prénom *</label>
              <input type="text" id="prenom-input" required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Nom *</label>
              <input type="text" id="nom-input" required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Fonction</label>
              <select id="fonction-input" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                <option value="">-</option>
                ${FONCTIONS.map(f => `<option value="${f}">${f}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1">Téléphone</label>
              <input type="tel" id="telephone-input" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
            </div>
            <div class="sm:col-span-2">
              <button type="submit" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium">Ajouter</button>
            </div>
          </form>
        </div>

        <div class="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
          <div class="px-4 py-3 text-sm text-gray-400">Liste (${personnel.length})</div>
          ${personnel.length === 0 ? `<div class="p-6 text-center text-gray-500">Aucun personnel</div>` : personnel.map(p => `
            <div class="px-4 py-3 flex items-center justify-between hover:bg-gray-700/50">
              <div>
                <div class="font-medium">${p.prenom} ${p.nom}</div>
                <div class="text-sm text-gray-500">${p.fonction || '-'} ${p.telephone ? `| ${p.telephone}` : ''}</div>
              </div>
              <div class="flex gap-2">
                <button onclick="editPersonnel('${p.id}')" class="p-2 text-blue-400 hover:bg-blue-400/10 rounded">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button onclick="deletePersonnel('${p.id}')" class="p-2 text-red-400 hover:bg-red-400/10 rounded">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </main>
    </div>
  `
}

function renderChantiersManagement() {
  return `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onclick="navigate('admin')" class="p-2 hover:bg-gray-700 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 class="text-lg font-bold">Gestion Chantiers</h1>
        </div>
      </header>

      <main class="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div class="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 class="text-lg font-semibold mb-4">Ajouter un chantier</h2>
          <form onsubmit="saveChantier(event)" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1">Nom *</label>
                <input type="text" id="chantier-nom" required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Couleur</label>
                <select id="chantier-couleur" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                  ${CHANTIER_COLORS.map(c => `<option value="${c.value}" style="color:${c.value}">${c.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Resp. Jour</label>
                <select id="chantier-resp-jour" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                  <option value="">-</option>
                  ${personnel.map(p => `<option value="${p.id}">${p.prenom} ${p.nom}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">Resp. Nuit</label>
                <select id="chantier-resp-nuit" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
                  <option value="">-</option>
                  ${personnel.map(p => `<option value="${p.id}">${p.prenom} ${p.nom}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm text-gray-400 mb-2">Points GPS / Adresses</label>
              <div id="gps-points-container" class="space-y-2"></div>
              <button type="button" onclick="addGpsPoint()" class="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">+ Ajouter un point</button>
            </div>

            <div>
              <label class="block text-sm text-gray-400 mb-1">Infos</label>
              <textarea id="chantier-infos" rows="2" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg"></textarea>
            </div>

            <button type="submit" class="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium">Ajouter</button>
          </form>
        </div>

        <div class="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
          <div class="px-4 py-3 text-sm text-gray-400">Liste (${chantiers.length})</div>
          ${chantiers.length === 0 ? `<div class="p-6 text-center text-gray-500">Aucun chantier</div>` : chantiers.map(c => `
            <div class="px-4 py-3 hover:bg-gray-700/50">
              <div class="flex items-start justify-between">
                <div>
                  <div class="font-medium flex items-center gap-2">
                    <span class="w-4 h-4 rounded-full" style="background:${c.couleur || '#3b82f6'}"></span>
                    ${c.nom}
                  </div>
                  <div class="text-sm text-gray-500 mt-1">${c.infos || ''}</div>
                  ${c.gpsPoints?.length > 0 ? `
                    <div class="text-xs text-gray-400 mt-2 space-y-1">
                      ${c.gpsPoints.slice(0, 3).map(p => `
                        <div class="flex items-center gap-1">
                          <a href="${formatGoogleMapsUrl(p.lat, p.lng)}" target="_blank" class="text-blue-400 hover:underline">${p.adresse}</a>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
                <div class="flex gap-2">
                  <button onclick="editChantier('${c.id}')" class="p-2 text-blue-400 hover:bg-blue-400/10 rounded">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  </button>
                  <button onclick="deleteChantier('${c.id}')" class="p-2 text-red-400 hover:bg-red-400/10 rounded">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </main>
    </div>
  `
}

function renderVisitorView() {
  const days = generateDays()

  return `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h1 class="text-lg font-bold">RER B ETF 2026 - Terrain</h1>
            <div class="flex items-center gap-2">
              <button id="refresh-btn" onclick="refreshData()" class="p-2 hover:bg-gray-700 rounded-lg" title="Rafraîchir">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
              </button>
              <button onclick="navigate('map')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">Carte</button>
              <button onclick="navigate('my-planning')" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm">Mon Planning</button>
              <button onclick="navigate('team')" class="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm">Équipe</button>
              <button onclick="navigate('home')" class="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">Accueil</button>
            </div>
          </div>
        </div>
      </header>

      <div class="bg-gray-800/50 border-b border-gray-700 px-4 py-3">
        <div class="flex flex-wrap items-center gap-3">
          <input type="text" id="personnel-name-filter" placeholder="Rechercher votre nom..." value="${selectedPersonnelFilter}"
            onkeyup="filterPersonnelName()" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg w-64">
          <select onchange="selectChantierFilter(this.value)" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg">
            <option value="">Tous les chantiers</option>
            ${chantiers.map(c => `<option value="${c.id}" ${selectedChantierFilter === c.id ? 'selected' : ''}>${c.nom}</option>`).join('')}
          </select>

          <div class="flex items-center gap-1 ml-auto">
            <button onclick="prevPeriod()" class="p-2 hover:bg-gray-700 rounded-lg"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>
            <button onclick="goToToday()" class="px-3 py-1 hover:bg-gray-700 rounded text-sm">Aujourd'hui</button>
            <button onclick="nextPeriod()" class="p-2 hover:bg-gray-700 rounded-lg"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button>
          </div>

          <div class="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button onclick="setViewMode('day')" class="px-3 py-1 rounded ${viewMode === 'day' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">Jour</button>
            <button onclick="setViewMode('week')" class="px-3 py-1 rounded ${viewMode === 'week' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">Semaine</button>
            <button onclick="setViewMode('2weeks')" class="px-3 py-1 rounded ${viewMode === '2weeks' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">2 sem.</button>
          </div>
        </div>
      </div>

      <div class="overflow-x-auto p-4">
        ${!selectedPersonnelFilter && !selectedChantierFilter ? `
          <div class="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
            <p>Recherchez votre nom ou sélectionnez un chantier pour voir le planning</p>
          </div>
        ` : `
          <div class="space-y-2">
            ${(() => {
              let filteredPersonnel = personnel
              if (selectedPersonnelFilter) {
                filteredPersonnel = personnel.filter(p =>
                  `${p.prenom} ${p.nom}`.toLowerCase().includes(selectedPersonnelFilter.toLowerCase())
                )
              }
              if (selectedChantierFilter) {
                const chantierAffectations = affectations.filter(a => a.id_chantier === selectedChantierFilter)
                const personIds = new Set(chantierAffectations.map(a => a.id_personne))
                filteredPersonnel = filteredPersonnel.filter(p => personIds.has(p.id))
              }

              if (filteredPersonnel.length === 0) {
                return `<div class="bg-gray-800 rounded-xl p-8 text-center text-gray-400">Aucun résultat</div>`
              }

              return filteredPersonnel.map(person => `
                <div class="bg-gray-800 rounded-lg p-4 border-l-4" style="border-color:${(() => {
                  const aff = affectations.find(a => a.id_personne === person.id && a.date === new Date().toISOString().split('T')[0])
                  if (aff?.id_chantier) {
                    const c = chantiers.find(c => c.id === aff.id_chantier)
                    return c?.couleur || '#3b82f6'
                  }
                  return '#4b5563'
                })()}">
                  <div class="flex items-center justify-between mb-2">
                    <div>
                      <span class="font-medium">${person.prenom} ${person.nom}</span>
                      <span class="text-gray-500 text-sm ml-2">${person.fonction || ''}</span>
                    </div>
                    ${person.telephone ? `<a href="tel:${person.telephone}" class="text-blue-400 hover:underline text-sm">Appeler</a>` : ''}
                  </div>
                  <div class="grid gap-2 mt-3">
                    ${days.map(date => {
                      const aff = affectations.find(a => a.id_personne === person.id && a.date === date)
                      const chantier = aff?.id_chantier ? chantiers.find(c => c.id === aff.id_chantier) : null
                      const colors = aff ? SHIFT_COLORS[aff.shift] : SHIFT_COLORS['Repos']
                      return `
                        <div class="flex items-center justify-between py-1 border-t border-gray-700">
                          <span class="text-sm text-gray-400">${formatDateFull(date)}</span>
                          <div class="text-right">
                            <span class="px-2 py-0.5 rounded text-sm ${colors.bg} ${colors.text}">${aff?.shift || '-'}</span>
                            ${chantier ? `<span class="text-xs text-gray-500 block mt-0.5">${chantier.nom}</span>` : ''}
                          </div>
                        </div>
                      `
                    }).join('')}
                  </div>
                </div>
              `).join('')
            })()}
          </div>
        `}
      </div>
    </div>
  `
}

function renderMapView() {
  return `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onclick="navigate('visitor')" class="p-2 hover:bg-gray-700 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 class="text-lg font-bold">Carte des Chantiers</h1>
        </div>
      </header>

      <div id="map" class="w-full h-[calc(100vh-64px)] bg-gray-800"></div>

      <div class="absolute bottom-4 left-4 right-4 sm:left-4 sm:right-auto sm:w-80 bg-gray-800/95 backdrop-blur rounded-xl p-4 border border-gray-700 max-h-[40vh] overflow-y-auto">
        <h3 class="font-semibold mb-3">Chantiers (${chantiers.length})</h3>
        <div class="space-y-2">
          ${chantiers.map(c => `
            <div class="p-2 bg-gray-700/50 rounded-lg flex items-center gap-2">
              <span class="w-3 h-3 rounded-full shrink-0" style="background:${c.couleur || '#3b82f6'}"></span>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">${c.nom}</div>
                ${c.gpsPoints?.length > 0 ? `
                  <a href="${formatGoogleMapsUrl(c.gpsPoints[0].lat, c.gpsPoints[0].lng)}" target="_blank"
                    class="text-xs text-blue-400 hover:underline">Ouvrir GPS</a>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderTeamView() {
  const today = new Date().toISOString().split('T')[0]
  const todayAffectations = affectations.filter(a => a.date === today && a.shift !== 'Repos')
  const byChantier = {}
  todayAffectations.forEach(aff => {
    const chantierId = aff.id_chantier || 'none'
    if (!byChantier[chantierId]) byChantier[chantierId] = []
    const person = personnel.find(p => p.id === aff.id_personne)
    if (person) {
      byChantier[chantierId].push({ person, shift: aff.shift })
    }
  })

  return `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onclick="navigate('visitor')" class="p-2 hover:bg-gray-700 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 class="text-lg font-bold">Vue Équipe - Aujourd'hui</h1>
        </div>
      </header>

      <main class="max-w-4xl mx-auto px-4 py-6">
        ${Object.keys(byChantier).length === 0 ? `
          <div class="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
            Aucune affectation aujourd'hui
          </div>
        ` : Object.entries(byChantier).map(([chantierId, members]) => {
          const chantier = chantierId === 'none' ? { nom: 'Sans chantier', couleur: '#6b7280' } : chantiers.find(c => c.id === chantierId) || { nom: 'Inconnu', couleur: '#6b7280' }

          return `
            <div class="bg-gray-800 rounded-xl mb-4 overflow-hidden border border-gray-700">
              <div class="px-4 py-3 flex items-center gap-3" style="background:${chantier.couleur || '#3b82f6'}33">
                <span class="w-4 h-4 rounded-full" style="background:${chantier.couleur || '#3b82f6'}"></span>
                <span class="font-semibold">${chantier.nom}</span>
                ${chantier.gpsPoints?.length > 0 ? `
                  <a href="${formatGoogleMapsUrl(chantier.gpsPoints[0].lat, chantier.gpsPoints[0].lng)}" target="_blank"
                    class="ml-auto text-sm text-blue-400 hover:underline">GPS</a>
                ` : ''}
              </div>
              <div class="divide-y divide-gray-700">
                ${members.map(({ person, shift }) => `
                  <div class="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div class="font-medium">${person.prenom} ${person.nom}</div>
                      <div class="text-sm text-gray-500">${person.fonction || ''} - ${shift}</div>
                    </div>
                    ${person.telephone ? `
                      <a href="tel:${person.telephone}" class="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                        Appeler
                      </a>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `
        }).join('')}
      </main>
    </div>
  `
}

function renderMyPlanningView() {
  const days = generateDays()

  return `
    <div class="min-h-screen bg-gray-900 text-white">
      <header class="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onclick="navigate('visitor')" class="p-2 hover:bg-gray-700 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h1 class="text-lg font-bold">Mon Planning</h1>
        </div>
      </header>

      <main class="max-w-4xl mx-auto px-4 py-6">
        <div class="mb-4">
          <input type="text" id="personnel-name-filter" placeholder="Entrez votre nom..." value="${selectedPersonnelFilter}"
            onkeyup="filterPersonnelName()" class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg">
        </div>

        <div class="flex items-center gap-4 mb-4 bg-gray-800 p-2 rounded-lg">
          <div class="flex items-center gap-1">
            <button onclick="prevPeriod()" class="p-2 hover:bg-gray-700 rounded-lg"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg></button>
            <button onclick="goToToday()" class="px-3 py-1 hover:bg-gray-700 rounded text-sm">Aujourd'hui</button>
            <button onclick="nextPeriod()" class="p-2 hover:bg-gray-700 rounded-lg"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></button>
          </div>
          <div class="flex items-center gap-1 bg-gray-700 rounded-lg p-1">
            <button onclick="setViewMode('day')" class="px-3 py-1 rounded ${viewMode === 'day' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">Jour</button>
            <button onclick="setViewMode('week')" class="px-3 py-1 rounded ${viewMode === 'week' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">Semaine</button>
            <button onclick="setViewMode('2weeks')" class="px-3 py-1 rounded ${viewMode === '2weeks' ? 'bg-blue-600' : 'hover:bg-gray-600'} text-sm">2 sem.</button>
          </div>
        </div>

        ${!selectedPersonnelFilter ? `
          <div class="bg-gray-800 rounded-xl p-8 text-center text-gray-400">
            Entrez votre nom pour voir votre planning
          </div>
        ` : (() => {
          const matchingPersonnel = personnel.filter(p =>
            `${p.prenom} ${p.nom}`.toLowerCase().includes(selectedPersonnelFilter.toLowerCase())
          )

          if (matchingPersonnel.length === 0) {
            return `<div class="bg-gray-800 rounded-xl p-8 text-center text-gray-400">Aucun collaborateur trouvé</div>`
          }

          return matchingPersonnel.map(person => `
            <div class="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div class="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
                <div class="font-semibold">${person.prenom} ${person.nom}</div>
                <div class="text-sm text-gray-400">${person.fonction || ''} ${person.telephone ? `| ${person.telephone}` : ''}</div>
              </div>
              <div class="divide-y divide-gray-700">
                ${days.map(date => {
                  const aff = affectations.find(a => a.id_personne === person.id && a.date === date)
                  const chantier = aff?.id_chantier ? chantiers.find(c => c.id === aff.id_chantier) : null
                  const colors = aff ? SHIFT_COLORS[aff.shift] : SHIFT_COLORS['Repos']
                  return `
                    <div class="px-4 py-3 flex items-center justify-between">
                      <div>
                        <div class="text-sm">${formatDateFull(date)}</div>
                        <div class="text-xs text-gray-500">${new Date(date).toLocaleDateString('fr-FR', { weekday: 'long' })}</div>
                      </div>
                      <div class="text-right">
                        <span class="px-3 py-1 rounded-lg text-sm ${colors.bg} ${colors.text}">${aff?.shift || 'Non planifié'}</span>
                        ${chantier ? `
                          <div class="mt-1 text-sm text-gray-400">${chantier.nom}</div>
                          ${chantier.gpsPoints?.length > 0 ? `
                            <a href="${formatGoogleMapsUrl(chantier.gpsPoints[0].lat, chantier.gpsPoints[0].lng)}" target="_blank"
                              class="text-xs text-blue-400 hover:underline">Ouvrir GPS</a>
                          ` : ''}
                        ` : ''}
                      </div>
                    </div>
                  `
                }).join('')}
              </div>
            </div>
          `).join('')
        })()}
      </main>
    </div>
  `
}

// Main render function
function render() {
  const app = document.getElementById('app')

  switch (currentView) {
    case 'home':
      app.innerHTML = renderLoginScreen()
      break
    case 'admin':
      app.innerHTML = isAuthenticated ? renderAdminDashboard() : renderLoginScreen()
      break
    case 'personnel':
      app.innerHTML = isAuthenticated ? renderPersonnelManagement() : renderLoginScreen()
      break
    case 'chantiers':
      app.innerHTML = isAuthenticated ? renderChantiersManagement() : renderLoginScreen()
      break
    case 'visitor':
      app.innerHTML = renderVisitorView()
      break
    case 'map':
      app.innerHTML = renderMapView()
      setTimeout(initMap, 100)
      break
    case 'my-planning':
      app.innerHTML = renderMyPlanningView()
      break
    case 'team':
      app.innerHTML = renderTeamView()
      break
    default:
      app.innerHTML = renderLoginScreen()
  }
}

// Subscribe to Firestore
function subscribeToData() {
  if (!db) return

  onSnapshot(query(collection(db, 'personnel'), orderBy('nom')), (snapshot) => {
    personnel = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    render()
  })

  onSnapshot(query(collection(db, 'chantiers'), orderBy('nom')), (snapshot) => {
    chantiers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    render()
  })

  onSnapshot(collection(db, 'affectations'), (snapshot) => {
    affectations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    render()
  })
}

// Start
render()
subscribeToData()
