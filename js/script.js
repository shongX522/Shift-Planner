/* =========================================
   1. STATE MANAGEMENT & CONSTANTS
   ========================================= */
const DEFAULT_LABELS = [
    //{ id: '1', name: '16:00 - 22:00', color: '#10b981', duration: 6, startTime: '16:00', endTime: '22:00' }
];

let currentDate = new Date();
let labels = JSON.parse(localStorage.getItem('workdayLabels')) || [...DEFAULT_LABELS];
let calendarData = JSON.parse(localStorage.getItem('workdayData')) || {};

// Settings
const storedRate = parseFloat(localStorage.getItem('workdayHourlyRate'));
let hourlyRate = isNaN(storedRate) ? 0 : storedRate;

const storedTransport = parseFloat(localStorage.getItem('workdayTransportFee'));
let transportFee = isNaN(storedTransport) ? 0 : storedTransport;

const storedLimit = parseFloat(localStorage.getItem('workdayWeeklyLimit'));
let weeklyLimit = isNaN(storedLimit) ? 0 : storedLimit;
const storedLimitEnabled = localStorage.getItem('workdayWeeklyLimitEnabled');
let weeklyLimitEnabled = storedLimitEnabled === null ? false : (storedLimitEnabled === 'true');

let isDeleteMode = false;
let selectedLabelId = null;
let copyHeader = localStorage.getItem('workdayCopyHeader') || '';
let copyFooter = localStorage.getItem('workdayCopyFooter') || '';
let editingLabelId = null;

// I18n State
let currentLanguage = localStorage.getItem('workdayLanguage') || 'ja';
if (!translations[currentLanguage]) currentLanguage = 'ja';

function t(key, params = {}) {
    let text = (translations[currentLanguage] && translations[currentLanguage][key]) || key;
    for (const [k, v] of Object.entries(params)) {
        text = text.replace(`{${k}}`, v);
    }
    return text;
}

// Mobile Dragging State
let touchDragElement = null;
let touchDragGhost = null;
let touchDragData = null;


/* =========================================
   2. DOM ELEMENTS
   ========================================= */
// Main Layout
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYear = document.getElementById('current-month-year');
const labelsContainer = document.getElementById('labels-container');
const trashZone = document.getElementById('trash-zone');
const estimatedSalaryDisplay = document.getElementById('estimated-salary');

// Controls
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const toggleDeleteBtn = document.getElementById('toggle-delete-btn');
const clearActiveLabelBtn = document.getElementById('clear-active-label-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const exportBtn = document.getElementById('export-btn');
const copyBtn = document.getElementById('copy-btn');

// Label Modal
const addLabelBtn = document.getElementById('add-label-btn');
const labelModal = document.getElementById('label-modal');
const closeModalBtn = document.getElementById('cancel-btn');
const saveLabelBtn = document.getElementById('save-label-btn');
const labelTextInput = document.getElementById('label-text');
const labelDurationInput = document.getElementById('label-duration');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const labelColorInput = document.getElementById('label-color');
const labelModalTitle = document.getElementById('label-modal-title');

// Sidebar & Settings
const sidebar = document.getElementById('sidebar');
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');

// Copy Settings Modal
const copySettingsBtn = document.getElementById('copy-settings-btn');
const copySettingsModal = document.getElementById('copy-settings-modal');
const closeCopySettingsBtn = document.getElementById('close-copy-settings-btn');
const saveCopySettingsBtn = document.getElementById('save-copy-settings-btn');
const copyHeaderInput = document.getElementById('copy-header-text');
const copyFooterInput = document.getElementById('copy-footer-text');
const templateCopySettingsBtn = document.getElementById('template-copy-settings-btn');

// General Settings Modal
const openSettingsBtn = document.getElementById('open-settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const modalHourlyRateInput = document.getElementById('modal-hourly-rate');
const modalTransportFeeInput = document.getElementById('modal-transport-fee');
const modalWeeklyLimitInput = document.getElementById('modal-weekly-limit');
const modalWeeklyLimitEnabledCheckbox = document.getElementById('modal-weekly-limit-enabled');
const resetLabelsBtn = document.getElementById('reset-labels-btn');
const langBtns = document.querySelectorAll('.lang-btn');


/* =========================================
   3. INITIALIZATION
   ========================================= */
document.addEventListener('DOMContentLoaded', () => {
    // Check and update existing labels duration if 0
    labels.forEach(l => {
        if (!l.duration || l.duration === 0) {
            const parsed = parseDuration(l.name);
            if (parsed > 0) l.duration = parsed;
        }
    });
    saveData(); // Save updated durations

    renderCalendar(currentDate);
    renderLabels();
    setupEventListeners();
    updateMonthlyTotal(); // Initial calc
    updateActiveLabelDisplay();
    updatePageLanguage();
});


/* =========================================
   4. EVENT LISTENERS
   ========================================= */
function setupEventListeners() {
    // Calendar Navigation
    prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });

    nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    // --- Label Management ---
    addLabelBtn.addEventListener('click', () => {
        editingLabelId = null;
        if (labelModalTitle) {
            labelModalTitle.textContent = t('newLabelTitle');
            labelModalTitle.setAttribute('data-i18n', 'newLabelTitle');
        }
        labelModal.classList.remove('hidden');
        labelTextInput.value = '';
        labelDurationInput.value = '';
        if (startTimeInput) startTimeInput.value = '';
        if (endTimeInput) endTimeInput.value = '';
    });

    closeModalBtn.addEventListener('click', () => {
        labelModal.classList.add('hidden');
    });

    saveLabelBtn.addEventListener('click', handleSaveLabel);

    // Auto-calculate duration from start/end time
    if (startTimeInput && endTimeInput) {
        startTimeInput.addEventListener('input', updateLabelFromTimes);
        endTimeInput.addEventListener('input', updateLabelFromTimes);
    }

    // --- Drag & Drop Zones ---
    // Trash Zone
    trashZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        trashZone.classList.add('drag-over');
    });
    trashZone.addEventListener('dragleave', () => {
        trashZone.classList.remove('drag-over');
    });
    trashZone.addEventListener('drop', handleTrashDrop);

    // Global Drop (for removing from calendar when dropped outside)
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    document.body.addEventListener('drop', handleGlobalDrop);


    // --- Actions & Modes ---
    toggleDeleteBtn.addEventListener('click', toggleDeleteMode);

    if (clearActiveLabelBtn) {
        clearActiveLabelBtn.addEventListener('click', () => selectLabel(null));
    }

    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    if (copyBtn) copyBtn.addEventListener('click', copyScheduleToClipboard);

    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', handleClearAll);
    }

    if (resetLabelsBtn) {
        resetLabelsBtn.addEventListener('click', handleResetLabels);
    }


    // --- Sidebar & Modals ---
    setupSidebarEvents();
    setupCopySettingsEvents();
    setupGeneralSettingsEvents();

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentLanguage = btn.dataset.lang;
            localStorage.setItem('workdayLanguage', currentLanguage);
            document.documentElement.lang = currentLanguage;
            updatePageLanguage();
            renderCalendar(currentDate);
            updateMonthlyTotal();
            updateActiveLabelDisplay();
        });
    });
}

function setupSidebarEvents() {
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            document.body.classList.add('sidebar-open');
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('sidebar-open')) {
            if (!sidebar.contains(e.target) && !menuToggleBtn.contains(e.target) && !e.target.closest('.modal')) {
                closeSidebar();
            }
        }
    });

    // Touch Swipe to Close
    setupSidebarSwipe();
}

function setupCopySettingsEvents() {
    if (!copySettingsBtn) return;

    copySettingsBtn.addEventListener('click', () => {
        copySettingsModal.classList.remove('hidden');
        copyHeaderInput.value = copyHeader;
        copyFooterInput.value = copyFooter;
    });

    if (templateCopySettingsBtn) {
        templateCopySettingsBtn.addEventListener('click', () => {
            if ((copyHeaderInput.value || copyFooterInput.value) &&
                !confirm(t('deleteConfirm'))) { // Using deleteConfirm for simple "Overwrite?" here as well, or define new
                return;
            }

            const currentMonth = currentDate.getMonth() + 1;
            copyHeaderInput.value = t('templateHeader', { month: currentMonth });
            copyFooterInput.value = t('templateFooter');
        });
    }

    if (closeCopySettingsBtn) {
        closeCopySettingsBtn.addEventListener('click', () => {
            copySettingsModal.classList.add('hidden');
        });
    }

    if (saveCopySettingsBtn) {
        saveCopySettingsBtn.addEventListener('click', handleSaveCopySettings);
    }
}

function setupGeneralSettingsEvents() {
    if (!openSettingsBtn) return;

    openSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        if (modalHourlyRateInput) modalHourlyRateInput.value = hourlyRate;
        if (modalTransportFeeInput) modalTransportFeeInput.value = transportFee;
        if (modalWeeklyLimitInput) modalWeeklyLimitInput.value = weeklyLimit;
        if (modalWeeklyLimitEnabledCheckbox) {
            modalWeeklyLimitEnabledCheckbox.checked = weeklyLimitEnabled;
            if (modalWeeklyLimitInput) modalWeeklyLimitInput.disabled = !weeklyLimitEnabled;
        }
    });

    if (modalWeeklyLimitEnabledCheckbox && modalWeeklyLimitInput) {
        modalWeeklyLimitEnabledCheckbox.addEventListener('change', () => {
            modalWeeklyLimitInput.disabled = !modalWeeklyLimitEnabledCheckbox.checked;
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', handleSaveGeneralSettings);
    }
}


/* =========================================
   5. CALENDAR LOGIC
   ========================================= */
function renderCalendar(date) {
    calendarGrid.innerHTML = '';
    const year = date.getFullYear();
    const month = date.getMonth();

    const monthName = t('monthNames')[month];
    currentMonthYear.textContent = t('dateYearMonth', { year, month: monthName });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 (Sunday) to 6 (Saturday)

    // Previous month filler days
    for (let i = 0; i < startDayOfWeek; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day', 'other-month');
        calendarGrid.appendChild(dayDiv);
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        renderCalendarDay(year, month, i);
    }

    // Fill remaining cells & Last Week Total
    const lastDayOfWeek = lastDay.getDay();
    if (lastDayOfWeek !== 6) {
        // Fill empty days
        for (let j = lastDayOfWeek + 1; j <= 6; j++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('calendar-day', 'other-month');
            calendarGrid.appendChild(emptyDiv);
        }
        renderWeeklyTotal(year, month, daysInMonth, lastDayOfWeek, true);
    }

    updateMonthlyTotal();
}

function renderCalendarDay(year, month, day) {
    const dayDiv = document.createElement('div');
    dayDiv.classList.add('calendar-day');

    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dayDiv.dataset.date = dateString;

    // Weekend highlight
    const dayOfWeek = new Date(year, month, day).getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        dayDiv.classList.add('weekend');
    }

    // Holiday highlight (japanHolidays is global/external)
    if (typeof japanHolidays !== 'undefined' && japanHolidays[dateString]) {
        dayDiv.classList.add('holiday');
        dayDiv.title = japanHolidays[dateString];

        const holidayName = document.createElement('div');
        holidayName.classList.add('holiday-name');
        holidayName.textContent = japanHolidays[dateString];
        dayDiv.appendChild(holidayName);
    }

    // Today highlight
    const today = new Date();
    if (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
        dayDiv.classList.add('today');
    }

    const dayNumber = document.createElement('div');
    dayNumber.classList.add('day-number');
    dayNumber.textContent = day;
    dayDiv.insertBefore(dayNumber, dayDiv.firstChild);

    // Render events
    const dayLabelsContainer = document.createElement('div');
    dayLabelsContainer.classList.add('day-labels');
    if (calendarData[dateString]) {
        calendarData[dateString].forEach(labelId => {
            const label = labels.find(l => l.id === labelId);
            if (label) {
                const labelDiv = createDraggableLabel(label, true, dateString);
                dayLabelsContainer.appendChild(labelDiv);
            }
        });
    }
    dayDiv.appendChild(dayLabelsContainer);

    // Event Listeners for Day Cell
    dayDiv.addEventListener('dragover', handleDragOver);
    dayDiv.addEventListener('dragleave', handleDragLeave);
    dayDiv.addEventListener('drop', handleDropOnDay);
    dayDiv.addEventListener('click', (e) => {
        if (selectedLabelId && !isDeleteMode) {
            if (calendarData[dateString] && calendarData[dateString].includes(selectedLabelId)) {
                removeLabelFromDate(dateString, selectedLabelId);
            } else {
                addLabelToDate(dateString, selectedLabelId);
            }
        }
    });

    calendarGrid.appendChild(dayDiv);

    // Weekly Total (if Saturday)
    if (dayOfWeek === 6) {
        renderWeeklyTotal(year, month, day);
    }
}

function renderWeeklyTotal(year, month, refDay, lastDayOfWeek = 6, isPartialEndWeek = false) {
    const weekTotalDiv = document.createElement('div');
    weekTotalDiv.classList.add('calendar-week-total');
    let weeklyHours = 0;

    const daysToCheck = isPartialEndWeek ? lastDayOfWeek + 1 : 7;

    for (let k = 0; k < daysToCheck; k++) {
        const d = refDay - k;
        if (d > 0) {
            const dString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if (calendarData[dString]) {
                calendarData[dString].forEach(lblId => {
                    const lbl = labels.find(l => l.id === lblId);
                    if (lbl && lbl.duration) weeklyHours += parseFloat(lbl.duration);
                });
            }
        }
    }

    weekTotalDiv.textContent = weeklyHours > 0 ? `${weeklyHours}h` : '-';
    if (weeklyLimitEnabled && weeklyHours > weeklyLimit) {
        weekTotalDiv.classList.add('over-limit');
        weekTotalDiv.title = t('overLimit', { limit: weeklyLimit });
    }
    calendarGrid.appendChild(weekTotalDiv);
}


/* =========================================
   6. LABEL LOGIC & DRAGGABLE ITEMS
   ========================================= */
function renderLabels() {
    labelsContainer.innerHTML = '';
    labels.forEach(label => {
        const labelDiv = createDraggableLabel(label, false);
        labelsContainer.appendChild(labelDiv);
    });
}

function createDraggableLabel(label, isCalendarItem, dateString = null) {
    const div = document.createElement('div');
    div.classList.add(isCalendarItem ? 'calendar-label' : 'time-label');
    div.textContent = label.name;
    div.style.backgroundColor = label.color;
    div.draggable = true;
    div.dataset.id = label.id;

    if (!isCalendarItem) {
        // Edit Button (Pen emoji)
        const editBtn = document.createElement('span');
        editBtn.className = 'edit-label-btn';
        editBtn.textContent = '✏️';
        editBtn.title = t('editLabelTitle');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditLabelModal(label.id);
        });
        div.appendChild(editBtn);

        if (label.id === selectedLabelId) {
            div.classList.add('selected');
        }
        div.addEventListener('click', () => {
            if (isDeleteMode) {
                if (confirm(t('deleteConfirm'))) {
                    deleteSidebarLabel(label.id);
                }
            } else {
                selectLabel(label.id);
            }
        });
    } else {
        // Calendar Item Specifics
        div.dataset.date = dateString;
        div.addEventListener('click', (e) => {
            if (isDeleteMode) {
                e.preventDefault();
                e.stopPropagation();
                removeLabelFromDate(dateString, label.id);
            }
        });
    }

    // Drag Start
    div.addEventListener('dragstart', (e) => {
        if (isDeleteMode && isCalendarItem) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', JSON.stringify({
            id: label.id,
            from: isCalendarItem ? 'calendar' : 'sidebar',
            date: dateString
        }));
        e.dataTransfer.effectAllowed = isCalendarItem ? 'move' : 'copy';
        setTimeout(() => div.style.opacity = '0.5', 0);
    });

    div.addEventListener('dragend', () => {
        div.style.opacity = '1';
    });

    // Touch Support
    div.addEventListener('touchstart', (e) => handleTouchStart(e, label, isCalendarItem, dateString), { passive: false });
    div.addEventListener('touchmove', handleTouchMove, { passive: false });
    div.addEventListener('touchend', handleTouchEnd, { passive: false });

    return div;
}


/* =========================================
   7. DRAG & DROP LOGIC
   ========================================= */
// Mouse Drag Handlers
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('drag-over');
    e.dataTransfer.dropEffect = 'copy';
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDropOnDay(e) {
    e.preventDefault();
    const dayDiv = e.currentTarget;
    dayDiv.classList.remove('drag-over');
    e.stopPropagation();

    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const targetDate = dayDiv.dataset.date;

    if (!targetDate) return;

    if (data.from === 'sidebar') {
        addLabelToDate(targetDate, data.id);
    } else if (data.from === 'calendar') {
        if (data.date !== targetDate) {
            removeLabelFromDate(data.date, data.id);
            addLabelToDate(targetDate, data.id);
        }
    }
}

function handleTrashDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    trashZone.classList.remove('drag-over');
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));

    if (data.from === 'calendar') {
        removeLabelFromDate(data.date, data.id);
    } else if (data.from === 'sidebar') {
        if (confirm(t('deleteConfirm'))) {
            deleteSidebarLabel(data.id);
        }
    }
}

function handleGlobalDrop(e) {
    e.preventDefault();
    try {
        const dataString = e.dataTransfer.getData('text/plain');
        if (dataString) {
            const data = JSON.parse(dataString);
            if (data.from === 'calendar') {
                removeLabelFromDate(data.date, data.id);
            }
        }
    } catch (error) {
        // Ignore invalid drop
    }
}

// Touch Event Handlers
function handleTouchStart(e, label, isCalendarItem, dateString) {
    if (isDeleteMode) return;
    if (touchDragElement) return;

    touchDragElement = e.currentTarget;
    touchDragData = {
        id: label.id,
        from: isCalendarItem ? 'calendar' : 'sidebar',
        date: dateString
    };

    const touch = e.touches[0];

    // Create Ghost
    touchDragGhost = touchDragElement.cloneNode(true);
    touchDragGhost.classList.add('ghost-label');
    touchDragGhost.style.backgroundColor = label.color;
    touchDragGhost.style.left = `${touch.clientX}px`;
    touchDragGhost.style.top = `${touch.clientY}px`;
    touchDragGhost.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(touchDragGhost);
}

function handleTouchMove(e) {
    if (!touchDragGhost) return;

    const touch = e.touches[0];
    touchDragGhost.style.left = `${touch.clientX}px`;
    touchDragGhost.style.top = `${touch.clientY}px`;

    // Highlight target day
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const dayDiv = target?.closest('.calendar-day');

    document.querySelectorAll('.calendar-day.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (dayDiv) {
        dayDiv.classList.add('drag-over');
    }

    e.preventDefault(); // Prevent scrolling
}

function handleTouchEnd(e) {
    if (!touchDragGhost) return;

    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const dayDiv = target?.closest('.calendar-day');
    const trash = target?.closest('#trash-zone');

    if (dayDiv) {
        const targetDate = dayDiv.dataset.date;
        if (targetDate) {
            if (touchDragData.from === 'sidebar') {
                addLabelToDate(targetDate, touchDragData.id);
            } else if (touchDragData.from === 'calendar' && touchDragData.date !== targetDate) {
                removeLabelFromDate(touchDragData.date, touchDragData.id);
                addLabelToDate(targetDate, touchDragData.id);
            }
        }
        dayDiv.classList.remove('drag-over');
    } else if (trash) {
        if (touchDragData.from === 'calendar') {
            removeLabelFromDate(touchDragData.date, touchDragData.id);
        } else if (touchDragData.from === 'sidebar') {
            if (confirm(t('deleteConfirm'))) {
                deleteSidebarLabel(touchDragData.id);
            }
        }
    } else if (touchDragData.from === 'calendar') {
        // Dropped outside - remove
        removeLabelFromDate(touchDragData.date, touchDragData.id);
    }

    // Cleanup
    if (touchDragGhost) {
        document.body.removeChild(touchDragGhost);
        touchDragGhost = null;
    }
    touchDragElement = null;
    touchDragData = null;

    document.querySelectorAll('.calendar-day.drag-over').forEach(el => el.classList.remove('drag-over'));
}


/* =========================================
   8. DATA & STATE MANIPULATION
   ========================================= */
function addLabelToDate(date, labelId) {
    if (!calendarData[date]) {
        calendarData[date] = [];
    }

    // Overlap Detection
    const newLabel = labels.find(l => l.id === labelId);
    if (newLabel) {
        const newRange = getLabelTimeRange(newLabel);
        if (newRange) {
            let hasOverlap = false;
            for (const existingLabelId of calendarData[date]) {
                const existingLabel = labels.find(l => l.id === existingLabelId);
                if (existingLabel) {
                    const existingRange = getLabelTimeRange(existingLabel);
                    if (existingRange) {
                        // Check intersection
                        if (newRange.start < existingRange.end && newRange.end > existingRange.start) {
                            hasOverlap = true;
                            break;
                        }
                    }
                }
            }
            if (hasOverlap) {
                alert(t('overlapError'));
                return;
            }
        }
    }

    // Weekly Limit Check
    const currentWeeklyTotal = calculateWeeklyHours(date);
    const newDuration = newLabel ? parseFloat(newLabel.duration || 0) : 0;

    if (weeklyLimitEnabled && currentWeeklyTotal + newDuration > weeklyLimit) {
        alert(t('weeklyLimitError', { limit: weeklyLimit, total: currentWeeklyTotal + newDuration }));
        return;
    }

    calendarData[date].push(labelId);
    saveData();
    renderCalendar(currentDate);
}

function removeLabelFromDate(date, labelId) {
    if (calendarData[date]) {
        const index = calendarData[date].indexOf(labelId);
        if (index > -1) {
            calendarData[date].splice(index, 1);
            if (calendarData[date].length === 0) {
                delete calendarData[date];
            }
            saveData();
            renderCalendar(currentDate);
            updateMonthlyTotal();
        }
    }
}

function deleteSidebarLabel(id) {
    labels = labels.filter(l => l.id !== id);
    // Cleanup deleted label from calendar
    for (let date in calendarData) {
        calendarData[date] = calendarData[date].filter(lid => lid !== id);
        if (calendarData[date].length === 0) delete calendarData[date];
    }
    saveData();
    renderLabels();
    renderCalendar(currentDate);
}

function toggleDeleteMode() {
    isDeleteMode = !isDeleteMode;
    toggleDeleteBtn.classList.toggle('active', isDeleteMode);
    document.body.classList.toggle('delete-mode', isDeleteMode);

    if (isDeleteMode) {
        selectLabel(null);
    } else {
        updateActiveLabelDisplay();
    }
}

function selectLabel(id) {
    if (selectedLabelId === id) {
        selectedLabelId = null;
    } else {
        selectedLabelId = id;
        if (selectedLabelId) {
            if (isDeleteMode) toggleDeleteMode();
        }
    }
    document.body.classList.toggle('apply-mode', !!selectedLabelId);
    renderLabels();
    updateActiveLabelDisplay();
}

function updateActiveLabelDisplay() {
    const badge = document.getElementById('active-label-badge');
    if (!badge) return;

    if (isDeleteMode) {
        badge.textContent = `🗑️ ${t('deleteMode')}`;
        badge.style.backgroundColor = '#ef4444';
        if (clearActiveLabelBtn) clearActiveLabelBtn.style.display = 'none';
    } else if (selectedLabelId) {
        const label = labels.find(l => l.id === selectedLabelId);
        if (label) {
            badge.textContent = label.name;
            badge.style.backgroundColor = label.color;
            if (clearActiveLabelBtn) clearActiveLabelBtn.style.display = 'inline-block';
        }
    } else {
        badge.textContent = t('none');
        badge.style.backgroundColor = '#9ca3af';
        if (clearActiveLabelBtn) clearActiveLabelBtn.style.display = 'none';
    }
}

function updateMonthlyTotal() {
    let total = 0;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysWithShifts = new Set();

    for (let i = 1; i <= daysInMonth; i++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        if (calendarData[dateString] && calendarData[dateString].length > 0) {
            daysWithShifts.add(dateString);
            calendarData[dateString].forEach(lblId => {
                const lbl = labels.find(l => l.id === lblId);
                if (lbl && lbl.duration) total += parseFloat(lbl.duration);
            });
        }
    }
    document.getElementById('monthly-total').textContent = total;

    // Calculate Salary
    const salary = Math.round((total * hourlyRate) + (daysWithShifts.size * transportFee));

    if (estimatedSalaryDisplay) {
        const salaryDisplayContainer = estimatedSalaryDisplay.closest('.salary-display');
        if (hourlyRate === 0 && transportFee === 0) {
            if (salaryDisplayContainer) salaryDisplayContainer.style.display = 'none';
        } else {
            if (salaryDisplayContainer) salaryDisplayContainer.style.display = '';
            estimatedSalaryDisplay.textContent = salary.toLocaleString();
        }
    }
}

function openEditLabelModal(id) {
    const label = labels.find(l => l.id === id);
    if (!label) return;

    editingLabelId = id;
    if (labelModalTitle) {
        labelModalTitle.textContent = t('editLabelTitle');
        labelModalTitle.setAttribute('data-i18n', 'editLabelTitle');
    }

    labelTextInput.value = label.name;
    labelDurationInput.value = label.duration || '';
    if (startTimeInput) startTimeInput.value = label.startTime || '';
    if (endTimeInput) endTimeInput.value = label.endTime || '';
    if (labelColorInput) labelColorInput.value = label.color || '#3b82f6';

    labelModal.classList.remove('hidden');
}

function handleSaveLabel() {
    const name = labelTextInput.value.trim();
    const duration = labelDurationInput.value;
    const color = labelColorInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    if (name) {
        if (editingLabelId) {
            // Update existing
            const labelIndex = labels.findIndex(l => l.id === editingLabelId);
            if (labelIndex > -1) {
                labels[labelIndex] = {
                    ...labels[labelIndex],
                    name,
                    duration: duration ? parseFloat(duration) : 0,
                    color,
                    startTime,
                    endTime
                };
            }
        } else {
            // Create new
            const newLabel = {
                id: Date.now().toString(),
                name,
                duration: duration ? parseFloat(duration) : 0,
                color,
                startTime,
                endTime
            };
            labels.push(newLabel);
        }
        editingLabelId = null;
        saveData();
        renderLabels();
        renderCalendar(currentDate); // Re-render calendar to update existing label colors/names
        labelModal.classList.add('hidden');
    }
}

function handleClearAll() {
    if (confirm(t('clearAllConfirm'))) {
        calendarData = {};
        saveData();
        renderCalendar(currentDate);
        updateMonthlyTotal();
    }
}

function handleResetLabels() {
    if (confirm(t('resetLabelsConfirm'))) {
        labels = [...DEFAULT_LABELS];
        calendarData = {};
        saveData();
        renderLabels();
        renderCalendar(currentDate);
        updateMonthlyTotal();
        selectLabel(null);
        alert(t('resetLabesuccess'));
    }
}

function handleSaveCopySettings() {
    copyHeader = copyHeaderInput.value;
    copyFooter = copyFooterInput.value;
    localStorage.setItem('workdayCopyHeader', copyHeader);
    localStorage.setItem('workdayCopyFooter', copyFooter);

    // Visual feedback
    const originalText = saveCopySettingsBtn.innerHTML;
    saveCopySettingsBtn.textContent = t('saveSuccess');
    saveCopySettingsBtn.style.backgroundColor = '#10b981';
    saveCopySettingsBtn.disabled = true;

    setTimeout(() => {
        copySettingsModal.classList.add('hidden');
        setTimeout(() => {
            saveCopySettingsBtn.textContent = originalText;
            saveCopySettingsBtn.style.backgroundColor = '';
            saveCopySettingsBtn.disabled = false;
        }, 300);
    }, 800);
}

function handleSaveGeneralSettings() {
    if (modalHourlyRateInput) hourlyRate = parseFloat(modalHourlyRateInput.value) || 0;
    if (modalTransportFeeInput) transportFee = parseFloat(modalTransportFeeInput.value) || 0;
    if (modalWeeklyLimitInput) weeklyLimit = parseFloat(modalWeeklyLimitInput.value) || 0;
    if (modalWeeklyLimitEnabledCheckbox) weeklyLimitEnabled = modalWeeklyLimitEnabledCheckbox.checked;

    localStorage.setItem('workdayHourlyRate', hourlyRate);
    localStorage.setItem('workdayTransportFee', transportFee);
    localStorage.setItem('workdayWeeklyLimit', weeklyLimit);
    localStorage.setItem('workdayWeeklyLimitEnabled', weeklyLimitEnabled);

    settingsModal.classList.add('hidden');
    updateMonthlyTotal();
    renderCalendar(currentDate);
}

function saveData() {
    localStorage.setItem('workdayLabels', JSON.stringify(labels));
    localStorage.setItem('workdayData', JSON.stringify(calendarData));
}


/* =========================================
   9. UTILITY FUNCTIONS
   ========================================= */
function updateLabelFromTimes() {
    const start = startTimeInput.value;
    const end = endTimeInput.value;
    if (start && end) {
        const autoName = `${start} - ${end}`;
        const currentName = labelTextInput.value;
        const timeRegex = /(\d{1,2})[:：](\d{2})\s*[-~]\s*(\d{1,2})[:：](\d{2})/;

        // Only update name if it matches time pattern or is empty
        if (!currentName || timeRegex.test(currentName)) {
            labelTextInput.value = autoName;
        }

        const startMins = timeStringToMinutes(start);
        const endMins = timeStringToMinutes(end, startMins);
        const duration = parseFloat(((endMins - startMins) / 60).toFixed(1));

        if (duration > 0) {
            labelDurationInput.value = duration;
        }
    }
}

function parseDuration(text) {
    const timeRegex = /(\d{1,2})[:：](\d{2})\s*[-~]\s*(\d{1,2})[:：](\d{2})/;
    const match = text.match(timeRegex);

    if (match) {
        const startHour = parseInt(match[1]);
        const startMinute = parseInt(match[2]);
        const endHour = parseInt(match[3]);
        const endMinute = parseInt(match[4]);

        let startTotalMinutes = startHour * 60 + startMinute;
        let endTotalMinutes = endHour * 60 + endMinute;

        if (endTotalMinutes < startTotalMinutes) {
            endTotalMinutes += 24 * 60;
        }

        const durationMinutes = endTotalMinutes - startTotalMinutes;
        return parseFloat((durationMinutes / 60).toFixed(1));
    }
    return 0;
}

function parseTimeRange(text) {
    const timeRegex = /(\d{1,2})[:：](\d{2})\s*[-~]\s*(\d{1,2})[:：](\d{2})/;
    const match = text.match(timeRegex);

    if (match) {
        const startHour = parseInt(match[1]);
        const startMinute = parseInt(match[2]);
        const endHour = parseInt(match[3]);
        const endMinute = parseInt(match[4]);

        let startTotalMinutes = startHour * 60 + startMinute;
        let endTotalMinutes = endHour * 60 + endMinute;

        if (endTotalMinutes < startTotalMinutes) {
            endTotalMinutes += 24 * 60;
        }
        return { start: startTotalMinutes, end: endTotalMinutes };
    }
    return null;
}

function getLabelTimeRange(label) {
    if (label.startTime && label.endTime) {
        return {
            start: timeStringToMinutes(label.startTime),
            end: timeStringToMinutes(label.endTime, timeStringToMinutes(label.startTime))
        };
    }
    return parseTimeRange(label.name);
}

function timeStringToMinutes(timeStr, referenceStartMinutes = 0) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    let totalMinutes = hours * 60 + minutes;

    if (referenceStartMinutes > 0 && totalMinutes < referenceStartMinutes) {
        totalMinutes += 24 * 60;
    }
    return totalMinutes;
}

function calculateWeeklyHours(dateString) {
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)

    // Adjust to start of week (Sunday)
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - dayOfWeek);

    let total = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dString = `${year}-${month}-${day}`;

        if (calendarData[dString]) {
            calendarData[dString].forEach(lId => {
                const l = labels.find(lab => lab.id === lId);
                if (l && l.duration) {
                    total += parseFloat(l.duration);
                }
            });
        }
    }
    return total;
}

function exportToCSV() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let csvContent = '\uFEFF';
    csvContent += t('csvHeader') + '\n';
    const dayNames = [t('sunShort'), t('monShort'), t('tueShort'), t('wedShort'), t('thuShort'), t('friShort'), t('satShort')];

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayOfWeek = dayNames[date.getDay()];

        if (calendarData[dateString] && calendarData[dateString].length > 0) {
            calendarData[dateString].forEach(labelId => {
                const label = labels.find(l => l.id === labelId);
                if (label) {
                    const duration = label.duration || 0;
                    const cost = Math.round(duration * hourlyRate);
                    let name = label.name;
                    if (label.startTime && label.endTime) {
                        name = `${label.startTime} - ${label.endTime}`;
                    }
                    name = name.replace(/,/g, '，');
                    csvContent += `${dateString},${dayOfWeek},${name},${duration},${cost}\n`;
                }
            });
        }
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `workday_schedule_${year}_${month + 1}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function copyScheduleToClipboard() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let textContent = '';
    const dayNames = [t('sunShort'), t('monShort'), t('tueShort'), t('wedShort'), t('thuShort'), t('friShort'), t('satShort')];

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayOfWeek = dayNames[date.getDay()];
        const mmdd = `${String(month + 1).padStart(2, '0')}/${String(i).padStart(2, '0')}`;

        if (calendarData[dateString] && calendarData[dateString].length > 0) {
            calendarData[dateString].forEach(labelId => {
                const label = labels.find(l => l.id === labelId);
                if (label) {
                    let timeText = label.name;
                    if (label.startTime && label.endTime) {
                        timeText = `${label.startTime} - ${label.endTime}`;
                    }
                    textContent += `${mmdd} (${dayOfWeek}) ${timeText}\n`;
                }
            });
        }
    }

    if (!textContent.trim()) {
        alert(t('emptyScheduleError'));
        return;
    }

    if (copyHeader) {
        textContent = copyHeader + '\n' + textContent;
    }

    if (copyFooter) {
        textContent += copyFooter + '\n';
    }

    navigator.clipboard.writeText(textContent).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = t('copySuccess');
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Copy failed: ', err);
        alert(t('copyError'));
    });
}

// Sidebar Interactive Swipe (Helper for Event Listeners)
function setupSidebarSwipe() {
    let sidebarTouchStartX = 0;
    let sidebarTouchStartY = 0;
    let isSidebarDragging = false;
    let isSidebarDirectionLocked = false;
    const sidebarWidth = 280;

    sidebar.addEventListener('touchstart', (e) => {
        if (!sidebar.classList.contains('active')) return;

        const touch = e.touches[0];
        sidebarTouchStartX = touch.clientX;
        sidebarTouchStartY = touch.clientY;
        isSidebarDragging = true;
        isSidebarDirectionLocked = false;

        sidebar.style.transition = 'none';
    }, { passive: false });

    sidebar.addEventListener('touchmove', (e) => {
        if (!isSidebarDragging) return;

        const touch = e.touches[0];
        const diffX = touch.clientX - sidebarTouchStartX;
        const diffY = touch.clientY - sidebarTouchStartY;

        if (!isSidebarDirectionLocked) {
            if (Math.abs(diffY) > Math.abs(diffX)) {
                isSidebarDragging = false;
                sidebar.style.transition = '';
                return;
            }
            isSidebarDirectionLocked = true;
        }

        if (diffX > 0) return;

        const translateX = Math.max(diffX, -sidebarWidth);
        sidebar.style.transform = `translateX(${translateX}px)`;

        e.preventDefault();
    }, { passive: false });

    sidebar.addEventListener('touchend', (e) => {
        if (!isSidebarDragging) return;
        isSidebarDragging = false;

        sidebar.style.transition = '';

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - sidebarTouchStartX;

        if (diffX < -80) {
            closeSidebar();
            sidebar.style.transform = '';
        } else {
            sidebar.style.transform = '';
        }
    }, { passive: true });
}

function closeSidebar() {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
}

function updatePageLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[currentLanguage][key]) {
            el.textContent = translations[currentLanguage][key];
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (translations[currentLanguage][key]) {
            el.title = translations[currentLanguage][key];
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[currentLanguage][key]) {
            el.placeholder = translations[currentLanguage][key];
        }
    });

    // Update active button state
    langBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
    });

    // Handle currency unit specially if needed
    const currencyUnitEls = document.querySelectorAll('.currency-unit');
    currencyUnitEls.forEach(el => {
        el.textContent = t('currencyUnit');
    });

    const hoursUnitEls = document.querySelectorAll('.hours-unit');
    hoursUnitEls.forEach(el => {
        el.textContent = t('hoursUnit');
    });
}

