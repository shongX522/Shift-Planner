// State
let currentDate = new Date();
let labels = JSON.parse(sessionStorage.getItem('workdayLabels')) || [
    { id: '1', name: '16:00 - 22:00', color: '#10b981', duration: 6 },
    { id: '2', name: '17:00 - 22:00', color: '#f59e0b', duration: 5 },
];
let calendarData = JSON.parse(sessionStorage.getItem('workdayData')) || {};
// Initialize with defaults if null/NaN, but allow 0
const storedRate = parseFloat(sessionStorage.getItem('workdayHourlyRate'));
let hourlyRate = isNaN(storedRate) ? 0 : storedRate;

const storedTransport = parseFloat(sessionStorage.getItem('workdayTransportFee')); // || 0 logic is fine but let's be consistent
let transportFee = isNaN(storedTransport) ? 0 : storedTransport;

const storedLimit = parseFloat(sessionStorage.getItem('workdayWeeklyLimit'));
let weeklyLimit = isNaN(storedLimit) ? 0 : storedLimit;
const storedLimitEnabled = sessionStorage.getItem('workdayWeeklyLimitEnabled');
let weeklyLimitEnabled = storedLimitEnabled === null ? false : (storedLimitEnabled === 'true');
let isDeleteMode = false;
let selectedLabelId = null;
let copyHeader = sessionStorage.getItem('workdayCopyHeader') || '';
let copyFooter = sessionStorage.getItem('workdayCopyFooter') || '';

// Mobile Dragging State
let touchDragElement = null;
let touchDragGhost = null;
let touchDragData = null;

// DOM Elements
const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYear = document.getElementById('current-month-year');
const labelsContainer = document.getElementById('labels-container');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const addLabelBtn = document.getElementById('add-label-btn');
const labelModal = document.getElementById('label-modal');
const closeModalBtn = document.getElementById('cancel-btn');
const saveLabelBtn = document.getElementById('save-label-btn');
const labelTextInput = document.getElementById('label-text');
const labelDurationInput = document.getElementById('label-duration');
const startTimeInput = document.getElementById('start-time');
const endTimeInput = document.getElementById('end-time');
const labelColorInput = document.getElementById('label-color');
const trashZone = document.getElementById('trash-zone');

const toggleDeleteBtn = document.getElementById('toggle-delete-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const exportBtn = document.getElementById('export-btn');
const copyBtn = document.getElementById('copy-btn');
const estimatedSalaryDisplay = document.getElementById('estimated-salary');
const clearActiveLabelBtn = document.getElementById('clear-active-label-btn');

// Sidebar Elements
const sidebar = document.getElementById('sidebar');
const menuToggleBtn = document.getElementById('menu-toggle-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const copySettingsBtn = document.getElementById('copy-settings-btn');
const copySettingsModal = document.getElementById('copy-settings-modal');
const closeCopySettingsBtn = document.getElementById('close-copy-settings-btn');
const saveCopySettingsBtn = document.getElementById('save-copy-settings-btn');
const copyHeaderInput = document.getElementById('copy-header-text');
const copyFooterInput = document.getElementById('copy-footer-text');

// Initialization
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
});

// Japan National Holidays are now in holidays.js

// Calendar Logic
function renderCalendar(date) {
    calendarGrid.innerHTML = '';
    const year = date.getFullYear();
    const month = date.getMonth();

    currentMonthYear.textContent = `${year}年 ${month + 1}月`;

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
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');

        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayDiv.dataset.date = dateString;

        // Weekend highlight
        const dayOfWeek = new Date(year, month, i).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            dayDiv.classList.add('weekend');
        }

        // Holiday highlight
        if (japanHolidays[dateString]) {
            dayDiv.classList.add('holiday');
            dayDiv.title = japanHolidays[dateString];

            const holidayName = document.createElement('div');
            holidayName.classList.add('holiday-name');
            holidayName.textContent = japanHolidays[dateString];
            dayDiv.appendChild(holidayName);
        }

        // Today highlight
        const today = new Date();
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            dayDiv.classList.add('today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.classList.add('day-number');
        dayNumber.textContent = i;
        dayDiv.insertBefore(dayNumber, dayDiv.firstChild);

        // Render events for this day
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

        // Drag events for Drop Zone
        dayDiv.addEventListener('dragover', handleDragOver);
        dayDiv.addEventListener('dragleave', handleDragLeave);
        dayDiv.addEventListener('drop', handleDropOnDay);

        // Click to apply selected label
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

        const currentDayOfWeek = new Date(year, month, i).getDay();
        if (currentDayOfWeek === 6) {
            const weekTotalDiv = document.createElement('div');
            weekTotalDiv.classList.add('calendar-week-total');
            let weeklyHours = 0;
            for (let k = 0; k < 7; k++) {
                const d = i - k;
                if (d > 0) { // Valid day in month
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
                weekTotalDiv.title = `週労働時間上限 ${weeklyLimit} 時間を超えています`;
            }
            calendarGrid.appendChild(weekTotalDiv);
        }
    }

    // Fill remaining cells if month doesn't end on Saturday
    // And add total for the last partial week
    const lastDayOfWeek = lastDay.getDay();
    if (lastDayOfWeek !== 6) {
        // Fill empty days
        for (let j = lastDayOfWeek + 1; j <= 6; j++) {
            const emptyDiv = document.createElement('div');
            emptyDiv.classList.add('calendar-day', 'other-month');
            calendarGrid.appendChild(emptyDiv);
        }
        // Add last week total
        const weekTotalDiv = document.createElement('div');
        weekTotalDiv.classList.add('calendar-week-total');
        let weeklyHours = 0;
        for (let k = 0; k <= lastDayOfWeek; k++) {
            const d = daysInMonth - k;
            const dString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if (calendarData[dString]) {
                calendarData[dString].forEach(lblId => {
                    const lbl = labels.find(l => l.id === lblId);
                    if (lbl && lbl.duration) weeklyHours += parseFloat(lbl.duration);
                });
            }
        }

        weekTotalDiv.textContent = weeklyHours > 0 ? `${weeklyHours}h` : '-';
        if (weeklyLimitEnabled && weeklyHours > weeklyLimit) {
            weekTotalDiv.classList.add('over-limit');
            weekTotalDiv.title = `週労働時間上限 ${weeklyLimit} 時間を超えています`;
        }
        calendarGrid.appendChild(weekTotalDiv);
    }

    updateMonthlyTotal();
}

// Sidebar Labels Logic
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
        if (label.id === selectedLabelId) {
            div.classList.add('selected');
        }
        div.addEventListener('click', () => {
            if (isDeleteMode) {
                // Confirm deletion similar to trash drop logic
                if (confirm('このラベルを削除してもよろしいですか？')) {
                    deleteSidebarLabel(label.id);
                }
            } else {
                selectLabel(label.id);
            }
        });
    }


    if (isCalendarItem) {
        div.dataset.date = dateString; // Store which date it belongs to

        div.addEventListener('click', (e) => {
            if (isDeleteMode) {
                e.preventDefault();
                e.stopPropagation();
                removeLabelFromDate(dateString, label.id);
            }
        });
    }

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

    // Touch Support for Mobile Dragging
    div.addEventListener('touchstart', (e) => handleTouchStart(e, label, isCalendarItem, dateString), { passive: false });
    div.addEventListener('touchmove', handleTouchMove, { passive: false });
    div.addEventListener('touchend', handleTouchEnd, { passive: false });

    return div;
}

// Touch Event Handlers
function handleTouchStart(e, label, isCalendarItem, dateString) {
    if (isDeleteMode) return; // Don't drag in delete mode

    // Check if we already have a drag in progress
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
    touchDragGhost.style.transform = 'translate(-50%, -50%)'; // Center on touch
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

    // Remove previous highlights
    document.querySelectorAll('.calendar-day.drag-over').forEach(el => el.classList.remove('drag-over'));

    if (dayDiv) {
        dayDiv.classList.add('drag-over');
    }

    e.preventDefault(); // Prevent scrolling while dragging
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
            if (confirm('このラベルを削除してもよろしいですか？')) {
                deleteSidebarLabel(touchDragData.id);
            }
        }
    } else if (touchDragData.from === 'calendar') {
        // Dropped outside - check if we should remove
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

// Drag and Drop Logic
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
    const dayDiv = e.currentTarget; // The calendar day div
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

// Data Management
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
                        // Check intersection: (StartA < EndB) && (EndA > StartB)
                        if (newRange.start < existingRange.end && newRange.end > existingRange.start) {
                            hasOverlap = true;
                            break;
                        }
                    }
                }
            }

            if (hasOverlap) {
                alert('時間が重複しています！このラベルは追加できません。');
                return;
            }
        }
    }

    // Check Weekly Limit
    // Calculate current weekly total manually or via helper
    const currentWeeklyTotal = calculateWeeklyHours(date);
    const newDuration = newLabel ? parseFloat(newLabel.duration || 0) : 0;

    if (weeklyLimitEnabled && currentWeeklyTotal + newDuration > weeklyLimit) {
        alert(`週労働時間上限 (${weeklyLimit}時間) を超えています！\nこのシフトを追加すると、週合計が ${currentWeeklyTotal + newDuration}時間 になります。`);
        return;
    }

    calendarData[date].push(labelId);
    saveData();
    renderCalendar(currentDate);
}

function calculateWeeklyHours(dateString) {
    // Parse manually to ensure local time consistency
    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayOfWeek = date.getDay(); // 0 (Sun) - 6 (Sat)

    // Clone date to adjust to start of week (Sunday)
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

function updateMonthlyTotal() {
    let total = 0;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        if (calendarData[dateString]) {
            calendarData[dateString].forEach(lblId => {
                const lbl = labels.find(l => l.id === lblId);
                if (lbl && lbl.duration) total += parseFloat(lbl.duration);
            });
        }
    }
    document.getElementById('monthly-total').textContent = total;

    // Update Salary
    // Calculate days worked (unique days with shifts)
    const daysWithShifts = new Set();
    const daysInMonthCount = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonthCount; i++) {
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        if (calendarData[dateString] && calendarData[dateString].length > 0) {
            daysWithShifts.add(dateString);
        }
    }

    // Salary = (Total Hours * Hourly Rate) + (Days Worked * Transport Fee)
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

function handleTrashDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    trashZone.classList.remove('drag-over');
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));

    if (data.from === 'calendar') {
        removeLabelFromDate(data.date, data.id);
    } else if (data.from === 'sidebar') {
        if (confirm('このラベルを削除してもよろしいですか？')) {
            deleteSidebarLabel(data.id);
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

// Event Listeners
function setupEventListeners() {
    prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });

    nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    // Modal
    addLabelBtn.addEventListener('click', () => {
        labelModal.classList.remove('hidden');
        labelTextInput.value = '';
        labelDurationInput.value = '';
        if (startTimeInput) startTimeInput.value = '';
        if (endTimeInput) endTimeInput.value = '';
    });

    // Start/End Time Inputs
    if (startTimeInput && endTimeInput) {
        const updateLabelFromTimes = () => {
            const start = startTimeInput.value;
            const end = endTimeInput.value;
            if (start && end) {
                // Determine format
                const autoName = `${start} - ${end}`;

                // Only update name if it satisfies time pattern or is empty
                const currentName = labelTextInput.value;
                const timeRegex = /(\d{1,2})[:：](\d{2})\s*[-~]\s*(\d{1,2})[:：](\d{2})/;
                if (!currentName || timeRegex.test(currentName)) {
                    labelTextInput.value = autoName;
                }

                // Calculate duration directly from inputs
                const startMins = timeStringToMinutes(start);
                // Pass startMins as reference to handle overnight
                const endMins = timeStringToMinutes(end, startMins);
                const duration = parseFloat(((endMins - startMins) / 60).toFixed(1));

                if (duration > 0) {
                    labelDurationInput.value = duration;
                }
            }
        };

        startTimeInput.addEventListener('input', updateLabelFromTimes);
        endTimeInput.addEventListener('input', updateLabelFromTimes);
    }

    closeModalBtn.addEventListener('click', () => {
        labelModal.classList.add('hidden');
    });

    saveLabelBtn.addEventListener('click', () => {
        const name = labelTextInput.value.trim();
        const duration = labelDurationInput.value;
        const color = labelColorInput.value;
        const startTime = startTimeInput.value;
        const endTime = endTimeInput.value;

        if (name) {
            const newLabel = {
                id: Date.now().toString(),
                name,
                duration: duration ? parseFloat(duration) : 0,
                color,
                startTime,
                endTime
            };
            labels.push(newLabel);
            saveData();
            renderLabels();
            labelModal.classList.add('hidden');
        }
    });

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



    // Delete Mode Toggle
    toggleDeleteBtn.addEventListener('click', toggleDeleteMode);

    // Export Button
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }

    // Copy Button
    if (copyBtn) {
        copyBtn.addEventListener('click', copyScheduleToClipboard);
    }

    // Clear All Button
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (confirm('スケジュールされたすべてのラベルを削除してもよろしいですか？')) {
                calendarData = {};
                saveData();
                renderCalendar(currentDate);
                updateMonthlyTotal();
            }
        });
    }

    // Global drop to remove if dragged from calendar and dropped outside
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    document.body.addEventListener('drop', (e) => {
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
            // Ignore invalid JSON or other drop data
        }
    });

    // Sidebar Toggling
    if (menuToggleBtn) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            document.body.classList.add('sidebar-open');
        });
    }

    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        });
    }

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (document.body.classList.contains('sidebar-open')) {
            if (!sidebar.contains(e.target) && !menuToggleBtn.contains(e.target) && !e.target.closest('.modal')) {
                sidebar.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        }
    });

    // Sidebar Interactve Slide to Close
    let sidebarTouchStartX = 0;
    let sidebarTouchStartY = 0;
    let isSidebarDragging = false;
    let isSidebarDirectionLocked = false;
    const sidebarWidth = 280; // Approximate width or we can read offsetWidth

    sidebar.addEventListener('touchstart', (e) => {
        if (!sidebar.classList.contains('active')) return;

        const touch = e.touches[0];
        sidebarTouchStartX = touch.clientX;
        sidebarTouchStartY = touch.clientY;
        isSidebarDragging = true;
        isSidebarDirectionLocked = false;

        sidebar.style.transition = 'none'; // Disable transition for direct follow
    }, { passive: false });

    sidebar.addEventListener('touchmove', (e) => {
        if (!isSidebarDragging) return;

        const touch = e.touches[0];
        const diffX = touch.clientX - sidebarTouchStartX;
        const diffY = touch.clientY - sidebarTouchStartY;

        // Determine intent on first move
        if (!isSidebarDirectionLocked) {
            // If scrolling vertically more than horizontally, let it scroll
            if (Math.abs(diffY) > Math.abs(diffX)) {
                isSidebarDragging = false;
                sidebar.style.transition = ''; // Restore
                return;
            }
            isSidebarDirectionLocked = true;
        }

        // Only allow dragging left (closing)
        if (diffX > 0) return;

        // Apply transform
        // diffX is negative. Max drag is -sidebarWidth.
        const translateX = Math.max(diffX, -sidebarWidth);
        sidebar.style.transform = `translateX(${translateX}px)`;

        e.preventDefault(); // Prevent page scroll while dragging sidebar
    }, { passive: false });

    sidebar.addEventListener('touchend', (e) => {
        if (!isSidebarDragging) return;
        isSidebarDragging = false;

        sidebar.style.transition = ''; // Restore transition for snap

        const touch = e.changedTouches[0];
        const diffX = touch.clientX - sidebarTouchStartX;

        // Determine snap
        // If dragged closed by more than 80px or quick flick? 
        // Let's just use threshold of 80px
        if (diffX < -80) {
            // Close
            sidebar.classList.remove('active');
            document.body.classList.remove('sidebar-open');
            sidebar.style.transform = ''; // Reset, let CSS -100% take over
        } else {
            // Snap back open
            sidebar.style.transform = ''; // Reset, let CSS 0 (active) take over
        }
    }, { passive: true });

    // Copy Settings Modal
    if (copySettingsBtn) {
        copySettingsBtn.addEventListener('click', () => {
            copySettingsModal.classList.remove('hidden');
            copyHeaderInput.value = copyHeader;
            copyFooterInput.value = copyFooter;
        });
    }

    const templateCopySettingsBtn = document.getElementById('template-copy-settings-btn');
    if (templateCopySettingsBtn) {
        templateCopySettingsBtn.addEventListener('click', () => {
            const currentMonth = currentDate.getMonth() + 1;
            const headerTemplate = `お疲れ様です。\n${currentMonth}月のシフト提出します。`;
            const footerTemplate = `ご確認よろしくお願いいたします。`;

            if (copyHeaderInput.value || copyFooterInput.value) {
                if (!confirm('現在の入力内容を上書きしてもよろしいですか？')) {
                    return;
                }
            }

            copyHeaderInput.value = headerTemplate;
            copyFooterInput.value = footerTemplate;
        });
    }

    if (closeCopySettingsBtn) {
        closeCopySettingsBtn.addEventListener('click', () => {
            copySettingsModal.classList.add('hidden');
        });
    }

    if (saveCopySettingsBtn) {
        saveCopySettingsBtn.addEventListener('click', () => {
            copyHeader = copyHeaderInput.value;
            copyFooter = copyFooterInput.value;
            sessionStorage.setItem('workdayCopyHeader', copyHeader);
            sessionStorage.setItem('workdayCopyFooter', copyFooter);

            // Visual feedback
            const originalText = saveCopySettingsBtn.textContent;
            saveCopySettingsBtn.textContent = '保存しました！';
            saveCopySettingsBtn.style.backgroundColor = '#10b981'; // Green for success
            saveCopySettingsBtn.disabled = true;

            setTimeout(() => {
                copySettingsModal.classList.add('hidden');
                // Reset button after modal closes
                setTimeout(() => {
                    saveCopySettingsBtn.textContent = originalText;
                    saveCopySettingsBtn.style.backgroundColor = '';
                    saveCopySettingsBtn.disabled = false;
                }, 300);
            }, 800);
        });
    }

    // Settings Modal
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const modalHourlyRateInput = document.getElementById('modal-hourly-rate');
    const modalTransportFeeInput = document.getElementById('modal-transport-fee');
    const modalWeeklyLimitInput = document.getElementById('modal-weekly-limit');
    const modalWeeklyLimitEnabledCheckbox = document.getElementById('modal-weekly-limit-enabled');


    if (openSettingsBtn) {
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
    }

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
        saveSettingsBtn.addEventListener('click', () => {
            if (modalHourlyRateInput) hourlyRate = parseFloat(modalHourlyRateInput.value) || 0;
            if (modalTransportFeeInput) transportFee = parseFloat(modalTransportFeeInput.value) || 0;
            if (modalWeeklyLimitInput) weeklyLimit = parseFloat(modalWeeklyLimitInput.value) || 0;
            if (modalWeeklyLimitEnabledCheckbox) weeklyLimitEnabled = modalWeeklyLimitEnabledCheckbox.checked;

            sessionStorage.setItem('workdayHourlyRate', hourlyRate);
            sessionStorage.setItem('workdayTransportFee', transportFee);
            sessionStorage.setItem('workdayWeeklyLimit', weeklyLimit);
            sessionStorage.setItem('workdayWeeklyLimitEnabled', weeklyLimitEnabled);

            settingsModal.classList.add('hidden');
            updateMonthlyTotal();
            renderCalendar(currentDate); // To update weekly limit warnings if changed
        });
    }
}

function toggleDeleteMode() {
    isDeleteMode = !isDeleteMode;
    toggleDeleteBtn.classList.toggle('active', isDeleteMode);
    document.body.classList.toggle('delete-mode', isDeleteMode);

    if (isDeleteMode) {
        selectLabel(null); // Turn off selection mode
    } else {
        updateActiveLabelDisplay(); // Update display for delete mode off
    }
}

// Clear Active Label Button Logic
if (clearActiveLabelBtn) {
    clearActiveLabelBtn.addEventListener('click', () => {
        selectLabel(null);
    });
}

function selectLabel(id) {
    if (selectedLabelId === id) {
        selectedLabelId = null; // Toggle off
    } else {
        selectedLabelId = id;
        if (selectedLabelId) {
            // If selecting a label, turn off delete mode
            if (isDeleteMode) toggleDeleteMode();
        }
    }

    // Update UI
    document.body.classList.toggle('apply-mode', !!selectedLabelId);
    renderLabels(); // Re-render to update selected class
    updateActiveLabelDisplay();
}

function updateActiveLabelDisplay() {
    const badge = document.getElementById('active-label-badge');
    if (!badge) return;

    if (isDeleteMode) {
        badge.textContent = '🗑️ 削除モード';
        badge.style.backgroundColor = '#ef4444'; // Red
        if (clearActiveLabelBtn) clearActiveLabelBtn.style.display = 'none';
    } else if (selectedLabelId) {
        const label = labels.find(l => l.id === selectedLabelId);
        if (label) {
            badge.textContent = label.name;
            badge.style.backgroundColor = label.color;
            if (clearActiveLabelBtn) clearActiveLabelBtn.style.display = 'inline-block';
        }
    } else {
        badge.textContent = 'な し';
        badge.style.backgroundColor = '#9ca3af'; // Gray
        if (clearActiveLabelBtn) clearActiveLabelBtn.style.display = 'none';
    }
}

function saveData() {
    sessionStorage.setItem('workdayLabels', JSON.stringify(labels));
    sessionStorage.setItem('workdayData', JSON.stringify(calendarData));
}

function parseDuration(text) {
    // Regex for "HH:MM - HH:MM" or "HH:MM ~ HH:MM"
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
            endTotalMinutes += 24 * 60; // Handle overnight (next day)
        }

        const durationMinutes = endTotalMinutes - startTotalMinutes;
        const durationHours = durationMinutes / 60;
        return parseFloat(durationHours.toFixed(1));
    }
    return 0;
}

function parseTimeRange(text) {
    // Regex for "HH:MM - HH:MM" or "HH:MM ~ HH:MM"
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
            endTotalMinutes += 24 * 60; // Handle overnight
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

    // Handle overnight if we have a reference start time and this time is smaller
    // This is a simple heuristic; strictly speaking we need to know if it's end time.
    // In getLabelTimeRange, we pass start time as reference for end time calculation.
    if (referenceStartMinutes > 0 && totalMinutes < referenceStartMinutes) {
        totalMinutes += 24 * 60;
    }
    return totalMinutes;
}

function exportToCSV() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // CSV Header
    let csvContent = '\uFEFF'; // BOM for UTF-8 in Excel
    csvContent += '日付,曜日,シフト,時間数,推定給与\n';

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

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
                    // Escape commas in label name if necessary
                    const name = label.name.replace(/,/g, '，');
                    csvContent += `${dateString},${dayOfWeek},${name},${duration},${cost}\n`;
                }
            });
        }
    }

    // Create download link
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
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dayOfWeek = dayNames[date.getDay()];
        const mmdd = `${String(month + 1).padStart(2, '0')}/${String(i).padStart(2, '0')}`;

        if (calendarData[dateString] && calendarData[dateString].length > 0) {
            calendarData[dateString].forEach(labelId => {
                const label = labels.find(l => l.id === labelId);
                if (label) {
                    textContent += `${mmdd} (${dayOfWeek}) ${label.name}\n`;
                }
            });
        }
    }



    if (!textContent.trim()) {
        alert('スケジュールが空です！コピーする内容はなにもないよ。');
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
        copyBtn.innerHTML = '✅ コピー完了！';
        setTimeout(() => {
            copyBtn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('コピーできませんでした: ', err);
        alert('コピーに失敗しました。手動でコピーしてください。');
    });
}
