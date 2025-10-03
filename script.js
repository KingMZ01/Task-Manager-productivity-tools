// Enhanced State Management
const STORAGE_KEYS = {
	tasks: 'tm_tasks',
	theme: 'tm_theme',
	waterInterval: 'tm_waterInterval',
	eyeInterval: 'tm_eyeInterval', // legacy (seconds)
	eyeIntervalMin: 'tm_eyeIntervalMin',
	eyeRestSec: 'tm_eyeRestSec',
	waterLast: 'tm_waterLast',
	eyeLast: 'tm_eyeLast',
	waterActive: 'tm_waterActive',
	eyeActive: 'tm_eyeActive',
	waterCount: 'tm_waterCount',
	eyeBreakCount: 'tm_eyeBreakCount',
	pomodoro: 'tm_pomodoro',
	stats: 'tm_stats'
};

let tasks = [];
let currentTheme = 'light';
let filteredTasks = [];
let waterTimer = null;
let eyeTimer = null;
let pomodoroTimer = null;
let notificationPermission = 'default';

// Pomodoro State
let pomodoroState = {
	isRunning: false,
	isPaused: false,
	currentSession: 'focus', // 'focus', 'break', 'longBreak'
	timeLeft: 25 * 60, // seconds
	cycle: 1,
	totalCycles: 4,
	settings: {
		focus: 25,
		break: 5,
		longBreak: 15
	}
};

// Stats State
let stats = {
	tasksToday: 0,
	tasksThisWeek: 0,
	currentStreak: 0,
	pomodorosToday: 0,
	dailyHistory: {}, // date: taskCount
	achievements: ['🎯 First task completed!']
};

// DOM Elements
const taskInput = document.getElementById('task-input');
const addBtn = document.getElementById('add-btn');
const taskList = document.getElementById('task-list');
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');
const themeBtn = document.getElementById('theme-btn');
const themeMenu = document.getElementById('theme-menu');
const bgCanvas = document.getElementById('bg-canvas');
const ctx = bgCanvas ? bgCanvas.getContext('2d') : null;
const bgDom = document.getElementById('bg-dom');

// Phase 2 Elements
const taskPriority = document.getElementById('task-priority');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const priorityFilter = document.getElementById('priority-filter');
const sortTasks = document.getElementById('sort-tasks');

// Pomodoro Elements
const timerTime = document.getElementById('timer-time');
const timerSession = document.getElementById('timer-session');
const timerCycle = document.getElementById('timer-cycle');
const timerStart = document.getElementById('timer-start');
const timerPause = document.getElementById('timer-pause');
const timerReset = document.getElementById('timer-reset');
const focusDuration = document.getElementById('focus-duration');
const breakDuration = document.getElementById('break-duration');
const longBreakDuration = document.getElementById('long-break-duration');
const cycleCount = document.getElementById('cycle-count');
const timerDesc = document.getElementById('timer-desc');

// Stats Elements
const tasksToday = document.getElementById('tasks-today');
const tasksWeek = document.getElementById('tasks-week');
const currentStreak = document.getElementById('current-streak');
const pomodorosToday = document.getElementById('pomodoros-today');
const statsChart = document.getElementById('stats-chart');
const achievementsList = document.getElementById('achievements-list');

// Health Elements
const waterInterval = document.getElementById('water-interval');
const waterCustomInterval = document.getElementById('water-custom-interval');
const waterStart = document.getElementById('water-start');
const waterStop = document.getElementById('water-stop');
const waterStatus = document.getElementById('water-status');
const waterNext = document.getElementById('water-next');
const eyeInterval = document.getElementById('eye-interval');
const eyeCustomInterval = document.getElementById('eye-custom-interval');
const eyeRest = document.getElementById('eye-rest');
const eyeRestCustom = document.getElementById('eye-rest-custom');
const eyeStart = document.getElementById('eye-start');
const eyeStop = document.getElementById('eye-stop');
const eyeStatus = document.getElementById('eye-status');
const eyeNext = document.getElementById('eye-next');
const waterCount = document.getElementById('water-count');
const waterPlus = document.getElementById('water-plus');
const waterMinus = document.getElementById('water-minus');
const eyeBreaksCount = document.getElementById('eye-breaks-count');

// Dashboard Widget Elements (for index.html)
const waterWidgetStatus = document.getElementById('water-widget-status');
const waterWidgetTimer = document.getElementById('water-widget-timer');
const eyeWidgetStatus = document.getElementById('eye-widget-status');
const eyeWidgetTimer = document.getElementById('eye-widget-timer');

// Test notification button
const toggleWaterBtn = document.getElementById('toggle-water');
const toggleEyeBtn = document.getElementById('toggle-eye');

// Notification Elements
const notificationModal = document.getElementById('notification-modal');
const notificationTitle = document.getElementById('notification-title');
const notificationMessage = document.getElementById('notification-message');
const notificationClose = document.getElementById('notification-close');

// Utility Functions
function saveTasks() {
	localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(tasks));
}

function loadTasks() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.tasks);
		if (raw) {
			tasks = JSON.parse(raw);
			// Ensure all tasks have priority property
			tasks.forEach(task => {
				if (!task.priority) task.priority = 'medium';
				if (!task.order) task.order = tasks.indexOf(task);
			});
		}
	} catch (e) {
		console.error('Failed to parse tasks', e);
		tasks = [];
	}
}

function saveTheme(theme) {
	localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function loadTheme() {
	const saved = localStorage.getItem(STORAGE_KEYS.theme);
	return saved || 'light';
}

function savePomodoro() {
	localStorage.setItem(STORAGE_KEYS.pomodoro, JSON.stringify(pomodoroState));
}

function loadPomodoro() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.pomodoro);
		if (raw) {
			const saved = JSON.parse(raw);
            pomodoroState = { ...pomodoroState, ...saved };
            // Clamp to sane values in case of corrupted storage
            pomodoroState.settings = {
                focus: Math.min(60, Math.max(1, parseInt(pomodoroState.settings.focus) || 25)),
                break: Math.min(30, Math.max(1, parseInt(pomodoroState.settings.break) || 5)),
                longBreak: Math.min(60, Math.max(1, parseInt(pomodoroState.settings.longBreak) || 15))
            };
            pomodoroState.totalCycles = Math.min(10, Math.max(1, parseInt(pomodoroState.totalCycles) || 4));
            pomodoroState.cycle = Math.min(pomodoroState.totalCycles, Math.max(1, parseInt(pomodoroState.cycle) || 1));
		}
	} catch (e) {
		console.error('Failed to parse pomodoro state', e);
	}
}

function saveStats() {
	localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
}

function loadStats() {
	try {
		const raw = localStorage.getItem(STORAGE_KEYS.stats);
		if (raw) {
			stats = { ...stats, ...JSON.parse(raw) };
		}
	} catch (e) {
		console.error('Failed to parse stats', e);
	}
}

function uid() { 
	return Math.random().toString(36).slice(2, 9); 
}

function formatTime(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getToday() {
	return new Date().toDateString();
}

// Priority and Badge Functions
function getPriorityValue(priority) {
	const values = { high: 3, medium: 2, low: 1 };
	return values[priority] || 2;
}

function createPriorityBadge(priority) {
	const badges = {
		high: { emoji: '🔴', text: 'High', class: 'priority-high' },
		medium: { emoji: '🟡', text: 'Medium', class: 'priority-medium' },
		low: { emoji: '🟢', text: 'Low', class: 'priority-low' }
	};
	const badge = badges[priority] || badges.medium;
	const span = document.createElement('span');
	span.className = `priority-badge ${badge.class}`;
	span.innerHTML = `${badge.emoji} ${badge.text}`;
	return span;
}

// Task Management Functions
function addTaskFromInput() {
	const title = taskInput.value.trim();
	if (!title) return;
	
	const priority = taskPriority ? taskPriority.value : 'medium';
	const newTask = { 
		id: uid(), 
		title, 
		completed: false, 
		createdAt: Date.now(),
		priority: priority,
		order: tasks.length
	};
	
	tasks.unshift(newTask);
	saveTasks();
	applyFiltersAndSort();
	updateProgress();
	updateStats();
	taskInput.value = '';
	if (taskInput) taskInput.focus();
}

function deleteTask(taskId) {
	const idx = tasks.findIndex(t => t.id === taskId);
	if (idx !== -1) {
		tasks.splice(idx, 1);
		saveTasks();
		applyFiltersAndSort();
		updateProgress();
		updateStats();
	}
}

function toggleTask(taskId) {
	const task = tasks.find(t => t.id === taskId);
	if (task) {
		task.completed = !task.completed;
		
		// Update stats when task is completed
		if (task.completed) {
			stats.tasksToday++;
			const today = getToday();
			stats.dailyHistory[today] = (stats.dailyHistory[today] || 0) + 1;
			
			// Check for achievements
			if (stats.tasksToday === 1 && !stats.achievements.includes('🌟 First task of the day completed!')) {
				stats.achievements.push('🌟 First task of the day completed!');
			}
			if (stats.tasksToday === 5 && !stats.achievements.includes('💪 5 tasks completed today!')) {
				stats.achievements.push('💪 5 tasks completed today!');
			}
			if (stats.tasksToday === 10 && !stats.achievements.includes('🚀 10 tasks completed today!')) {
				stats.achievements.push('🚀 10 tasks completed today!');
			}
		} else {
			stats.tasksToday = Math.max(0, stats.tasksToday - 1);
		}
		
		saveTasks();
		saveStats();
		applyFiltersAndSort();
		updateProgress();
		updateStats();
	}
}

function editTask(taskId) {
	const task = tasks.find(t => t.id === taskId);
	if (task) {
		const newTitle = prompt('Edit task', task.title);
		if (newTitle !== null) {
			const trimmed = newTitle.trim();
			if (trimmed.length > 0) {
				task.title = trimmed;
				saveTasks();
				applyFiltersAndSort();
			}
		}
	}
}

// Search, Filter & Sort Functions
function applyFiltersAndSort() {
	let filtered = [...tasks];
	
	// Apply search filter
	const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
	if (searchTerm) {
		filtered = filtered.filter(task => 
			task.title.toLowerCase().includes(searchTerm)
		);
	}
	
	// Apply priority filter
	const priorityFilterValue = priorityFilter ? priorityFilter.value : 'all';
	if (priorityFilterValue !== 'all') {
		filtered = filtered.filter(task => task.priority === priorityFilterValue);
	}
	
	// Apply sorting
	const sortValue = sortTasks ? sortTasks.value : 'created';
	switch (sortValue) {
		case 'priority':
			filtered.sort((a, b) => getPriorityValue(b.priority) - getPriorityValue(a.priority));
			break;
		case 'status':
			filtered.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));
			break;
		case 'alphabetical':
			filtered.sort((a, b) => a.title.localeCompare(b.title));
			break;
		case 'created':
		default:
			filtered.sort((a, b) => b.createdAt - a.createdAt);
			break;
	}
	
	filteredTasks = filtered;
	renderTasks();
}

// Task Rendering
function renderTasks() {
	if (!taskList) return;
	
	taskList.innerHTML = '';
	for (const task of filteredTasks) {
		const li = document.createElement('li');
        li.className = 'task-item';
		li.dataset.id = task.id;
		li.draggable = true;

        // Assign a shade class cycling to 12 variants for multicolor theme visuals
		li.classList.add('shade-' + ((filteredTasks.indexOf(task) % 12) + 1));

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!task.completed;
        checkbox.addEventListener('click', (ev) => {
            ev.stopPropagation();
			toggleTask(task.id);
        });

		const contentDiv = document.createElement('div');
		contentDiv.className = 'task-content';
		
		const priorityBadge = createPriorityBadge(task.priority);

		const title = document.createElement('div');
		title.className = 'task-title' + (task.completed ? ' completed' : '');
		title.textContent = task.title;
		
		contentDiv.appendChild(priorityBadge);
		contentDiv.appendChild(title);

		const actions = document.createElement('div');
		actions.className = 'task-actions';

		const editBtn = document.createElement('button');
		editBtn.className = 'icon-btn';
		editBtn.title = 'Edit task';
		editBtn.textContent = '✏️';
        editBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
			editTask(task.id);
		});

		const deleteBtn = document.createElement('button');
		deleteBtn.className = 'icon-btn';
		deleteBtn.title = 'Delete task';
		deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
			deleteTask(task.id);
		});

		actions.appendChild(editBtn);
		actions.appendChild(deleteBtn);

        li.appendChild(checkbox);
		li.appendChild(contentDiv);
		li.appendChild(actions);
		taskList.appendChild(li);

        // Toggle complete when clicking the whole row (excluding buttons)
		li.addEventListener('click', (e) => {
			if (e.target === li || e.target === contentDiv || e.target === title) {
				toggleTask(task.id);
			}
		});

		// Add drag and drop event listeners
		li.addEventListener('dragstart', handleDragStart);
		li.addEventListener('dragover', handleDragOver);
		li.addEventListener('drop', handleDrop);
		li.addEventListener('dragend', handleDragEnd);
	}
}

// Drag and Drop Functions
let draggedElement = null;

function handleDragStart(e) {
	draggedElement = this;
	this.classList.add('dragging');
	e.dataTransfer.effectAllowed = 'move';
	e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
	if (e.preventDefault) {
		e.preventDefault();
	}
	e.dataTransfer.dropEffect = 'move';
	
	const afterElement = getDragAfterElement(taskList, e.clientY);
	if (afterElement == null) {
		taskList.appendChild(draggedElement);
	} else {
		taskList.insertBefore(draggedElement, afterElement);
	}
	
	return false;
}

function handleDrop(e) {
	if (e.stopPropagation) {
		e.stopPropagation();
	}
	
	// Update task order based on new DOM order
	const newOrder = Array.from(taskList.children).map(li => li.dataset.id);
	newOrder.forEach((taskId, index) => {
		const task = tasks.find(t => t.id === taskId);
		if (task) task.order = index;
	});
	
	// Re-order the tasks array to match new order
	tasks.sort((a, b) => a.order - b.order);
	saveTasks();
	
	return false;
}

function handleDragEnd(e) {
	this.classList.remove('dragging');
	draggedElement = null;
}

function getDragAfterElement(container, y) {
	const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
	
	return draggableElements.reduce((closest, child) => {
		const box = child.getBoundingClientRect();
		const offset = y - box.top - box.height / 2;
		
		if (offset < 0 && offset > closest.offset) {
			return { offset: offset, element: child };
		} else {
			return closest;
		}
	}, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Progress Functions
function updateProgress() {
	if (!progressBar || !progressLabel) return;
	
	if (tasks.length === 0) {
		progressBar.style.width = '0%';
		progressLabel.textContent = '0% completed';
		return;
	}
	const done = tasks.filter(t => t.completed).length;
	const percent = Math.round((done / tasks.length) * 100);
	progressBar.style.width = percent + '%';
	progressLabel.textContent = percent + '% completed';
}

// Pomodoro Timer Functions
function updateTimerDisplay() {
	if (!timerTime) return;
	
	timerTime.textContent = formatTime(pomodoroState.timeLeft);
	
	if (timerSession) {
		const sessionNames = {
			focus: 'Focus Session',
			break: 'Short Break',
			longBreak: 'Long Break'
		};
		timerSession.textContent = sessionNames[pomodoroState.currentSession];
	}
	
	if (timerCycle) {
		timerCycle.textContent = `Cycle ${pomodoroState.cycle} of ${pomodoroState.totalCycles}`;
	}
}

function startPomodoro() {
	if (pomodoroState.isPaused) {
		pomodoroState.isPaused = false;
	} else {
		pomodoroState.isRunning = true;
	}
	
	updateTimerControls();
	
	pomodoroTimer = setInterval(() => {
		pomodoroState.timeLeft--;
		updateTimerDisplay();
		
		if (pomodoroState.timeLeft <= 0) {
			pomodoroSessionComplete();
		}
	}, 1000);
	
	savePomodoro();
}

function pausePomodoro() {
	pomodoroState.isPaused = true;
	pomodoroState.isRunning = false;
	clearInterval(pomodoroTimer);
	updateTimerControls();
	savePomodoro();
}

function resetPomodoro() {
	pomodoroState.isRunning = false;
	pomodoroState.isPaused = false;
	pomodoroState.currentSession = 'focus';
	pomodoroState.timeLeft = pomodoroState.settings.focus * 60;
	pomodoroState.cycle = 1;
	
	clearInterval(pomodoroTimer);
	updateTimerDisplay();
	updateTimerControls();
	savePomodoro();
}

function pomodoroSessionComplete() {
	clearInterval(pomodoroTimer);
	pomodoroState.isRunning = false;
	
	if (pomodoroState.currentSession === 'focus') {
		stats.pomodorosToday++;
		saveStats();
		updateStats();
		
		// Determine next session
		if (pomodoroState.cycle >= pomodoroState.totalCycles) {
			pomodoroState.currentSession = 'longBreak';
			pomodoroState.timeLeft = pomodoroState.settings.longBreak * 60;
			pomodoroState.cycle = 1; // Reset cycle after long break
			showNotification('Long Break Time!', `Great job! Take a ${pomodoroState.settings.longBreak}-minute long break.`);
		} else {
			pomodoroState.currentSession = 'break';
			pomodoroState.timeLeft = pomodoroState.settings.break * 60;
			showNotification('Break Time!', `Focus session complete! Take a ${pomodoroState.settings.break}-minute break.`);
		}
	} else {
		// Break finished
		pomodoroState.currentSession = 'focus';
		pomodoroState.timeLeft = pomodoroState.settings.focus * 60;
		if (pomodoroState.currentSession !== 'longBreak') {
			pomodoroState.cycle++;
		}
		showNotification('Focus Time!', `Break is over! Time for a ${pomodoroState.settings.focus}-minute focus session.`);
	}
	
	updateTimerDisplay();
	updateTimerControls();
	savePomodoro();
}

function updateTimerControls() {
	if (!timerStart || !timerPause) return;
	
	if (pomodoroState.isRunning) {
		timerStart.disabled = true;
		timerPause.disabled = false;
	} else {
		timerStart.disabled = false;
		timerPause.disabled = true;
	}
}

function updateTimerSettings() {
	if (focusDuration) pomodoroState.settings.focus = parseInt(focusDuration.value) || 25;
	if (breakDuration) pomodoroState.settings.break = parseInt(breakDuration.value) || 5;
	if (longBreakDuration) pomodoroState.settings.longBreak = parseInt(longBreakDuration.value) || 15;
    if (cycleCount) pomodoroState.totalCycles = Math.max(1, parseInt(cycleCount.value) || 4);
	
	// Update current timer if in focus and not running
	if (!pomodoroState.isRunning && pomodoroState.currentSession === 'focus') {
		pomodoroState.timeLeft = pomodoroState.settings.focus * 60;
		updateTimerDisplay();
	}
	
    savePomodoro();
    updateTimerDescription();
}

function updateTimerDescription() {
    if (!timerDesc) return;
    const f = pomodoroState.settings.focus;
    const b = pomodoroState.settings.break;
    const lb = pomodoroState.settings.longBreak;
    const c = pomodoroState.totalCycles;
    timerDesc.textContent = `${f} min focus • ${b} min break • ${lb} min long break (every ${c} cycles)`;
}

function initHealthControlsFromStorage() {
    // Water interval minutes
    if (waterInterval) {
        const savedWater = parseInt(localStorage.getItem(STORAGE_KEYS.waterInterval) || '60');
        const isCustomWater = !['30','60'].includes(String(savedWater));
        waterInterval.value = isCustomWater ? 'custom' : String(savedWater);
        if (waterCustomInterval) {
            waterCustomInterval.style.display = isCustomWater ? 'block' : 'none';
            if (isCustomWater) waterCustomInterval.value = String(savedWater);
        }
    }

    // Eye reminder minutes
    if (eyeInterval) {
        const savedEyeMin = parseInt(localStorage.getItem(STORAGE_KEYS.eyeIntervalMin) || '20');
        const isCustomEyeMin = !['20','40'].includes(String(savedEyeMin));
        eyeInterval.value = isCustomEyeMin ? 'custom' : String(savedEyeMin);
        if (eyeCustomInterval) {
            eyeCustomInterval.style.display = isCustomEyeMin ? 'block' : 'none';
            if (isCustomEyeMin) eyeCustomInterval.value = String(savedEyeMin);
        }
    }

    // Eye rest seconds
    if (eyeRest) {
        const savedRest = parseInt(localStorage.getItem(STORAGE_KEYS.eyeRestSec) || '20');
        const isCustomRest = !['20','30'].includes(String(savedRest));
        eyeRest.value = isCustomRest ? 'custom' : String(savedRest);
        if (eyeRestCustom) {
            eyeRestCustom.style.display = isCustomRest ? 'block' : 'none';
            if (isCustomRest) eyeRestCustom.value = String(savedRest);
        }
    }
}

// Stats Functions
function updateStats() {
	if (tasksToday) tasksToday.textContent = stats.tasksToday;
	if (tasksWeek) tasksWeek.textContent = stats.tasksThisWeek;
	if (currentStreak) currentStreak.textContent = stats.currentStreak;
	if (pomodorosToday) pomodorosToday.textContent = stats.pomodorosToday;
	
	updateChart();
	updateAchievements();
}

function updateChart() {
	if (!statsChart) return;
	
	const canvas = statsChart;
	const ctx = canvas.getContext('2d');
	
	// Clear canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// Get last 7 days data
	const today = new Date();
	const last7Days = [];
	for (let i = 6; i >= 0; i--) {
		const date = new Date(today);
		date.setDate(date.getDate() - i);
		const dateStr = date.toDateString();
		last7Days.push({
			day: date.toLocaleDateString('en', { weekday: 'short' }),
			count: stats.dailyHistory[dateStr] || 0
		});
	}
	
	// Chart settings
	const padding = 20;
	const barWidth = (canvas.width - padding * 2) / 7;
	const maxHeight = canvas.height - padding * 2;
	const maxCount = Math.max(...last7Days.map(d => d.count), 5);
	
	// Draw bars
	ctx.fillStyle = '#3b82f6';
	last7Days.forEach((day, index) => {
		const barHeight = (day.count / maxCount) * maxHeight;
		const x = padding + index * barWidth + barWidth * 0.1;
		const y = canvas.height - padding - barHeight;
		const width = barWidth * 0.8;
		
		ctx.fillRect(x, y, width, barHeight);
		
		// Draw day labels
		ctx.fillStyle = '#64748b';
		ctx.font = '12px Inter';
		ctx.textAlign = 'center';
		ctx.fillText(day.day, x + width / 2, canvas.height - 5);
		
		// Draw count labels
		if (day.count > 0) {
			ctx.fillStyle = '#1e293b';
			ctx.fillText(day.count.toString(), x + width / 2, y - 5);
		}
		
		ctx.fillStyle = '#3b82f6';
	});
}

function updateAchievements() {
	if (!achievementsList) return;
	
	achievementsList.innerHTML = '';
	stats.achievements.slice(-3).forEach(achievement => {
		const div = document.createElement('div');
		div.className = 'achievement';
		div.textContent = achievement;
		achievementsList.appendChild(div);
	});
}

// Health Reminder Functions
function getWaterInterval() {
	if (!waterInterval) return 60;
	
	if (waterInterval.value === 'custom') {
        return Math.max(1, parseInt(waterCustomInterval.value) || 60);
	}
    return Math.max(1, parseInt(waterInterval.value) || 60);
}

function getEyeReminderMs() {
    // eye reminder interval in MINUTES
    if (!eyeInterval) return 20 * 60 * 1000;
    let mins;
    if (eyeInterval.value === 'custom') {
        mins = Math.max(1, parseInt(eyeCustomInterval.value) || 20);
    } else {
        mins = Math.max(1, parseInt(eyeInterval.value) || 20);
    }
    return mins * 60 * 1000;
}

function getEyeRestSeconds() {
    if (!eyeRest) return 20;
    if (eyeRest.value === 'custom') {
        return Math.max(5, parseInt(eyeRestCustom.value) || 20);
    }
    return Math.max(5, parseInt(eyeRest.value) || 20);
}

function startWaterReminder() {
    const intervalMinutes = getWaterInterval();
	const interval = intervalMinutes * 60 * 1000; // Convert to milliseconds
	
	waterTimer = setInterval(() => {
		showNotification('Water Reminder 💧', 'Time to drink some water! Stay hydrated for better focus.');
    localStorage.setItem(STORAGE_KEYS.waterLast, Date.now().toString());
    if (waterStatus) waterStatus.textContent = 'Water reminders are active';
    if (waterStart) waterStart.textContent = 'Modify Reminders';
	}, interval);
	
	localStorage.setItem(STORAGE_KEYS.waterActive, 'true');
	localStorage.setItem(STORAGE_KEYS.waterInterval, intervalMinutes.toString());
	localStorage.setItem(STORAGE_KEYS.waterLast, Date.now().toString());
	
	updateWaterStatus();
}

function stopWaterReminder() {
	clearInterval(waterTimer);
	localStorage.setItem(STORAGE_KEYS.waterActive, 'false');
	updateWaterStatus();
}

function startEyeReminder() {
    const interval = getEyeReminderMs();
	
	eyeTimer = setInterval(() => {
        const restSec = getEyeRestSeconds();
        showNotification('Eye Rest Reminder 👁️', `Time for a short eye break! Rest your eyes for ${restSec} seconds.`);
		stats.eyeBreakCount = (stats.eyeBreakCount || 0) + 1;
		localStorage.setItem(STORAGE_KEYS.eyeBreakCount, stats.eyeBreakCount.toString());
    localStorage.setItem(STORAGE_KEYS.eyeLast, Date.now().toString());
    if (eyeStatus) eyeStatus.textContent = 'Eye rest reminders are active';
    if (eyeStart) eyeStart.textContent = 'Modify Reminders';
		if (eyeBreaksCount) eyeBreaksCount.textContent = stats.eyeBreakCount;
	}, interval);
	
	localStorage.setItem(STORAGE_KEYS.eyeActive, 'true');
    // store minutes + rest seconds
    localStorage.setItem(STORAGE_KEYS.eyeIntervalMin, String(interval / (60*1000)));
    localStorage.setItem(STORAGE_KEYS.eyeRestSec, String(getEyeRestSeconds()));
	localStorage.setItem(STORAGE_KEYS.eyeLast, Date.now().toString());
	
	updateEyeStatus();
}

function stopEyeReminder() {
	clearInterval(eyeTimer);
	localStorage.setItem(STORAGE_KEYS.eyeActive, 'false');
	updateEyeStatus();
}

function updateWaterStatus() {
	if (!waterStatus || !waterStart || !waterStop) return;
	
	const isActive = localStorage.getItem(STORAGE_KEYS.waterActive) === 'true';
	if (isActive) {
		waterStatus.textContent = 'Water reminders are active';
        waterStart.disabled = false;
        waterStop.disabled = false;
        if (waterStart) waterStart.textContent = 'Modify Reminders';
		
		const lastDrank = parseInt(localStorage.getItem(STORAGE_KEYS.waterLast) || Date.now().toString());
		const interval = parseInt(localStorage.getItem(STORAGE_KEYS.waterInterval) || '60');
		const minsAgo = Math.floor((Date.now() - lastDrank) / (1000 * 60));
		const nextIn = Math.max(0, interval - minsAgo);
		
		if (waterNext) {
			if (minsAgo > 0) {
				waterNext.textContent = `Last drank water: ${minsAgo} mins ago • Next reminder in ${nextIn} mins`;
			} else {
				waterNext.textContent = `Next reminder in ${interval} minutes`;
			}
		}
	} else {
		waterStatus.textContent = 'Water reminders are off';
        waterStart.disabled = false;
		waterStop.disabled = true;
        if (waterStart) waterStart.textContent = 'Start Reminders';
		if (waterNext) waterNext.textContent = '';
	}
}

function updateEyeStatus() {
	if (!eyeStatus || !eyeStart || !eyeStop) return;
	
	const isActive = localStorage.getItem(STORAGE_KEYS.eyeActive) === 'true';
	if (isActive) {
		eyeStatus.textContent = 'Eye rest reminders are active';
        eyeStart.disabled = false;
        eyeStop.disabled = false;
        if (eyeStart) eyeStart.textContent = 'Modify Reminders';
		
		const lastBreak = parseInt(localStorage.getItem(STORAGE_KEYS.eyeLast) || Date.now().toString());
        const minsStored = parseInt(localStorage.getItem(STORAGE_KEYS.eyeIntervalMin) || '20');
        const secsAgo = Math.floor((Date.now() - lastBreak) / 1000);
        const nextInSec = Math.max(0, minsStored * 60 - secsAgo);
		
        if (eyeNext) {
            const minsAgo = Math.floor(secsAgo / 60);
            const minsNext = Math.ceil(nextInSec / 60);
            eyeNext.textContent = `Last eye break: ${minsAgo} mins ago • Next reminder in ${minsNext} mins`;
        }
	} else {
		eyeStatus.textContent = 'Eye rest reminders are off';
        eyeStart.disabled = false;
		eyeStop.disabled = true;
        if (eyeStart) eyeStart.textContent = 'Start Reminders';
		if (eyeNext) eyeNext.textContent = '';
	}
}


function updateWaterCount(delta) {
	const current = parseInt(localStorage.getItem(STORAGE_KEYS.waterCount) || '0');
	const newCount = Math.max(0, current + delta);
	localStorage.setItem(STORAGE_KEYS.waterCount, newCount.toString());
	if (waterCount) waterCount.textContent = newCount;
}

// Dashboard Widget Update Functions
function updateDashboardWidgets() {
	updateWaterWidget();
	updateEyeWidget();
}

function updateWaterWidget() {
	if (!waterWidgetStatus || !waterWidgetTimer) return;
	
	const isActive = localStorage.getItem(STORAGE_KEYS.waterActive) === 'true';
	if (isActive) {
		waterWidgetStatus.textContent = 'Active';
		
		const lastDrank = parseInt(localStorage.getItem(STORAGE_KEYS.waterLast) || Date.now().toString());
		const interval = parseInt(localStorage.getItem(STORAGE_KEYS.waterInterval) || '60');
		const minsAgo = Math.floor((Date.now() - lastDrank) / (1000 * 60));
		const nextIn = Math.max(0, interval - minsAgo);
		
        waterWidgetTimer.textContent = `Last: ${minsAgo}m ago • Next: ${nextIn}m`;
	} else {
		waterWidgetStatus.textContent = 'Not active';
		waterWidgetTimer.textContent = 'Configure in Health Helpers';
	}
}

function updateEyeWidget() {
	if (!eyeWidgetStatus || !eyeWidgetTimer) return;
	
	const isActive = localStorage.getItem(STORAGE_KEYS.eyeActive) === 'true';
	if (isActive) {
		eyeWidgetStatus.textContent = 'Active';
		
        const lastBreak = parseInt(localStorage.getItem(STORAGE_KEYS.eyeLast) || Date.now().toString());
        const intervalMin = parseInt(localStorage.getItem(STORAGE_KEYS.eyeIntervalMin) || '20');
        const minsAgo = Math.floor((Date.now() - lastBreak) / (1000 * 60));
        const nextIn = Math.max(0, intervalMin - minsAgo);
		
        eyeWidgetTimer.textContent = `Last: ${minsAgo}m ago • Next: ${nextIn}m`;
	} else {
		eyeWidgetStatus.textContent = 'Not active';
		eyeWidgetTimer.textContent = 'Configure in Health Helpers';
	}
}

// Notification Functions
function requestNotificationPermission() {
	if ('Notification' in window) {
		if (Notification.permission === 'default') {
			Notification.requestPermission().then(permission => {
				notificationPermission = permission;
				console.log('Notification permission:', permission);
			});
		} else {
			notificationPermission = Notification.permission;
			console.log('Notification permission already set:', notificationPermission);
		}
	} else {
		console.log('Notifications not supported');
		notificationPermission = 'denied';
	}
}

function showNotification(title, message) {
	console.log('Showing notification:', title, message);
	
	// Try browser notification first
	if (notificationPermission === 'granted' && 'Notification' in window) {
		try {
			const notification = new Notification(title, {
				body: message,
				icon: 'Logo/Tab-logo.png',
				requireInteraction: false,
				tag: 'task-manager'
			});
			
			// Auto close after 5 seconds
			setTimeout(() => {
				notification.close();
			}, 5000);
			
			console.log('Browser notification sent');
		} catch (error) {
			console.error('Error creating notification:', error);
			showInAppNotification(title, message);
		}
	} else {
		console.log('Using fallback notification, permission:', notificationPermission);
		// Fallback to in-app modal
		showInAppNotification(title, message);
	}
}

function showInAppNotification(title, message) {
	if (!notificationModal) {
		console.error('Notification modal not found');
		return;
	}
	
	if (notificationTitle) notificationTitle.textContent = title;
	if (notificationMessage) notificationMessage.textContent = message;
	notificationModal.classList.add('show');
	
	// Auto-close after 5 seconds
	setTimeout(() => {
		hideInAppNotification();
	}, 5000);
	
	console.log('In-app notification shown:', title);
}

function hideInAppNotification() {
	if (notificationModal) {
		notificationModal.classList.remove('show');
	}
}

// Theme Handling
function applyTheme(theme) {
	document.body.classList.remove('theme-light', 'theme-dark', 'theme-multicolor');
	const cls = theme === 'dark' ? 'theme-dark' : theme === 'multicolor' ? 'theme-multicolor' : 'theme-light';
	document.body.classList.add(cls);
	currentTheme = theme;
	saveTheme(theme);
	startBackground(theme);
}

// Event Listeners
if (addBtn) addBtn.addEventListener('click', addTaskFromInput);
if (taskInput) {
	taskInput.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') addTaskFromInput();
	});
}

// Search and filter events
if (searchInput) {
	searchInput.addEventListener('input', applyFiltersAndSort);
}

if (clearSearchBtn) {
	clearSearchBtn.addEventListener('click', () => {
		if (searchInput) searchInput.value = '';
		applyFiltersAndSort();
	});
}

if (priorityFilter) {
	priorityFilter.addEventListener('change', applyFiltersAndSort);
}

if (sortTasks) {
	sortTasks.addEventListener('change', applyFiltersAndSort);
}

// Pomodoro events
if (timerStart) timerStart.addEventListener('click', startPomodoro);
if (timerPause) timerPause.addEventListener('click', pausePomodoro);
if (timerReset) timerReset.addEventListener('click', resetPomodoro);

if (focusDuration) focusDuration.addEventListener('change', updateTimerSettings);
if (breakDuration) breakDuration.addEventListener('change', updateTimerSettings);
if (longBreakDuration) longBreakDuration.addEventListener('change', updateTimerSettings);
if (cycleCount) cycleCount.addEventListener('change', updateTimerSettings);

// Health reminder events
if (waterStart) waterStart.addEventListener('click', startWaterReminder);
if (waterStop) waterStop.addEventListener('click', stopWaterReminder);
if (eyeStart) eyeStart.addEventListener('click', startEyeReminder);
if (eyeStop) eyeStop.addEventListener('click', stopEyeReminder);

if (waterPlus) waterPlus.addEventListener('click', () => updateWaterCount(1));
if (waterMinus) waterMinus.addEventListener('click', () => updateWaterCount(-1));

// Test notification button
function refreshToggleLabels() {
    const waterOn = localStorage.getItem(STORAGE_KEYS.waterActive) === 'true';
    const eyeOn = localStorage.getItem(STORAGE_KEYS.eyeActive) === 'true';
    if (toggleWaterBtn) {
        toggleWaterBtn.textContent = waterOn ? '💧 Water: On' : '💧 Water: Off';
        toggleWaterBtn.classList.toggle('on', waterOn);
        toggleWaterBtn.classList.toggle('off', !waterOn);
    }
    if (toggleEyeBtn) {
        toggleEyeBtn.textContent = eyeOn ? '👁️ Eye: On' : '👁️ Eye: Off';
        toggleEyeBtn.classList.toggle('on', eyeOn);
        toggleEyeBtn.classList.toggle('off', !eyeOn);
    }
}

if (toggleWaterBtn) {
    toggleWaterBtn.addEventListener('click', () => {
        const isActive = localStorage.getItem(STORAGE_KEYS.waterActive) === 'true';
        if (isActive) {
            stopWaterReminder();
        } else {
            startWaterReminder();
        }
        refreshToggleLabels();
    });
}

if (toggleEyeBtn) {
    toggleEyeBtn.addEventListener('click', () => {
        const isActive = localStorage.getItem(STORAGE_KEYS.eyeActive) === 'true';
        if (isActive) {
            stopEyeReminder();
        } else {
            startEyeReminder();
        }
        refreshToggleLabels();
    });
}

// Custom interval handling
if (waterInterval) {
	waterInterval.addEventListener('change', () => {
		if (waterCustomInterval) {
			waterCustomInterval.style.display = waterInterval.value === 'custom' ? 'block' : 'none';
		}
        // Persist water interval selection immediately
        const mins = getWaterInterval();
        localStorage.setItem(STORAGE_KEYS.waterInterval, String(mins));
        updateWaterStatus();
        updateDashboardWidgets();
	});
}

if (eyeInterval) {
	eyeInterval.addEventListener('change', () => {
		if (eyeCustomInterval) {
			eyeCustomInterval.style.display = eyeInterval.value === 'custom' ? 'block' : 'none';
		}
        // Persist eye interval (minutes)
        const ms = getEyeReminderMs();
        localStorage.setItem(STORAGE_KEYS.eyeIntervalMin, String(ms / (60*1000)));
        updateEyeStatus();
        updateDashboardWidgets();
	});
}

if (eyeRest) {
    eyeRest.addEventListener('change', () => {
        if (eyeRestCustom) {
            eyeRestCustom.style.display = eyeRest.value === 'custom' ? 'block' : 'none';
        }
        localStorage.setItem(STORAGE_KEYS.eyeRestSec, String(getEyeRestSeconds()));
    });
}

// Persist on custom input changes as well
if (waterCustomInterval) {
    ['change','blur','keyup'].forEach(ev => waterCustomInterval.addEventListener(ev, () => {
        const mins = getWaterInterval();
        localStorage.setItem(STORAGE_KEYS.waterInterval, String(mins));
        updateWaterStatus();
        updateDashboardWidgets();
    }));
}

if (eyeCustomInterval) {
    ['change','blur','keyup'].forEach(ev => eyeCustomInterval.addEventListener(ev, () => {
        const ms = getEyeReminderMs();
        localStorage.setItem(STORAGE_KEYS.eyeIntervalMin, String(ms / (60*1000)));
        updateEyeStatus();
        updateDashboardWidgets();
    }));
}

if (eyeRestCustom) {
    ['change','blur','keyup'].forEach(ev => eyeRestCustom.addEventListener(ev, () => {
        localStorage.setItem(STORAGE_KEYS.eyeRestSec, String(getEyeRestSeconds()));
    }));
}

// Notification events
if (notificationClose) {
	notificationClose.addEventListener('click', hideInAppNotification);
}

if (notificationModal) {
	notificationModal.addEventListener('click', (e) => {
		if (e.target === notificationModal) hideInAppNotification();
	});
}

// Theme events
if (themeBtn) {
themeBtn.addEventListener('click', () => {
	const open = themeMenu.classList.toggle('open');
	themeBtn.setAttribute('aria-expanded', String(open));
	themeMenu.setAttribute('aria-hidden', String(!open));
});
}

if (themeMenu) {
themeMenu.addEventListener('click', (e) => {
	const btn = e.target.closest('.theme-option');
	if (!btn) return;
	const theme = btn.getAttribute('data-theme');
	applyTheme(theme);
	themeMenu.classList.remove('open');
	themeBtn.setAttribute('aria-expanded', 'false');
	themeMenu.setAttribute('aria-hidden', 'true');
});
}

document.addEventListener('click', (e) => {
	if (themeMenu && !themeMenu.contains(e.target) && e.target !== themeBtn) {
		themeMenu.classList.remove('open');
		if (themeBtn) themeBtn.setAttribute('aria-expanded', 'false');
		themeMenu.setAttribute('aria-hidden', 'true');
	}
});

// Background Animation Code (keeping original functionality)
let animationHandle = null;
let honeycomb = null;
let bubbles = null;
let aurora = null;
let honeyContainer = null;
let resizeTimer = null;
let lastActiveHex = null;

function resizeCanvas() {
	if (bgCanvas) {
	bgCanvas.width = window.innerWidth;
	bgCanvas.height = window.innerHeight;
}
}

window.addEventListener('resize', () => {
	resizeCanvas();
});

function clearAnimation() {
	if (animationHandle) cancelAnimationFrame(animationHandle);
	animationHandle = null;
}

function startBackground(theme) {
	if (!bgCanvas || !ctx) return;
	
	resizeCanvas();
	clearAnimation();
	ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
	
	// Toggle DOM/canvas layers
	if (theme === 'dark') {
		bgCanvas.style.display = 'none';
		bgDom.style.display = 'block';
		startHoneycombDom();
		// rebuild on resize (debounced)
		window.removeEventListener('resize', onResizeRebuild);
		window.addEventListener('resize', onResizeRebuild);
		window.removeEventListener('mousemove', onMouseMoveHoney);
		window.addEventListener('mousemove', onMouseMoveHoney);
	} else {
		bgDom.innerHTML = '';
		bgDom.style.display = 'none';
		bgCanvas.style.display = 'block';
		if (theme === 'multicolor') startAurora(); else startBubbles();
		window.removeEventListener('resize', onResizeRebuild);
		window.removeEventListener('mousemove', onMouseMoveHoney);
	}
}

function onResizeRebuild() {
	if (resizeTimer) clearTimeout(resizeTimer);
	resizeTimer = setTimeout(() => {
		if (currentTheme === 'dark') startHoneycombDom();
	}, 120);
}

function onMouseMoveHoney(e) {
	if (currentTheme !== 'dark' || !honeyContainer) return;
	const rect = honeyContainer.getBoundingClientRect();
	const x = e.clientX - rect.left;
	const y = e.clientY - rect.top;
	const hexes = honeyContainer.querySelectorAll('.hexagon');
	let nearest = null;
	let nearestDist = Infinity;
	for (const hx of hexes) {
		const r = hx.getBoundingClientRect();
		const cx = r.left - rect.left + r.width / 2;
		const cy = r.top - rect.top + r.height / 2;
		const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
		if (d < nearestDist) { nearestDist = d; nearest = hx; }
	}
	if (nearest && nearest !== lastActiveHex) {
		if (lastActiveHex) lastActiveHex.classList.remove('active');
		nearest.classList.add('active');
		lastActiveHex = nearest;
		// remove the glow after a short fade to simulate trail
		clearTimeout(nearest._glowTimer);
		nearest._glowTimer = setTimeout(() => { nearest.classList.remove('active'); }, 300);
	}
}

// Light – Bubbles
function startBubbles() {
	if (!bgCanvas || !ctx) return;
	
    const area = bgCanvas.width * bgCanvas.height;
    const baseCount = Math.floor(area / 22000); // denser field
    const count = Math.min(140, Math.max(40, baseCount));
    const HUES = Array.from({ length: 20 }, (_, i) => (i * 18) % 360);
    bubbles = new Array(count).fill(0).map(() => ({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * bgCanvas.height,
        r: 6 + Math.random() * 28,
        speed: 0.25 + Math.random() * 1.1,
        vx: (Math.random() - 0.5) * 0.6,
        hue: HUES[Math.floor(Math.random() * HUES.length)],
        hueJitter: (Math.random() - 0.5) * 8,
        lightness: 58 + Math.random() * 22, // shade variations
        alpha: 0.5 + Math.random() * 0.35
    }));

    let mouseX = bgCanvas.width / 2;
    let mouseY = bgCanvas.height / 2;

    function onMouseMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
    }
    window.addEventListener('mousemove', onMouseMove);

    function spawnBubble(x, y) {
        const baseHue = HUES[Math.floor(Math.random() * HUES.length)];
        bubbles.push({
            x, y,
            r: 10 + Math.random() * 26,
            speed: 0.6 + Math.random() * 1.1,
            vx: (Math.random() - 0.5) * 0.9,
            hue: baseHue,
            hueJitter: (Math.random() - 0.5) * 10,
            lightness: 55 + Math.random() * 25,
            alpha: 0.65
        });
        if (bubbles.length > 120) bubbles.shift();
    }
    bgCanvas.addEventListener('click', (e) => spawnBubble(e.clientX, e.clientY));

	function frame() {
        ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        const parallaxX = (mouseX - bgCanvas.width / 2) * 0.005;
        const parallaxY = (mouseY - bgCanvas.height / 2) * 0.003;
        ctx.globalCompositeOperation = 'lighter';
        for (const b of bubbles) {
            b.y -= b.speed;
            b.x += b.vx + parallaxX;
			if (b.y + b.r < 0) { b.y = bgCanvas.height + b.r; }
			if (b.x - b.r > bgCanvas.width) { b.x = -b.r; }
			if (b.x + b.r < 0) { b.x = bgCanvas.width + b.r; }

            // gentle hue shift
            b.hue = (b.hue + 0.08) % 360;

            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
            const hueInner = (b.hue + b.hueJitter) % 360;
            grad.addColorStop(0, `hsla(${hueInner}, 90%, ${b.lightness}%, ${b.alpha})`);
			grad.addColorStop(1, 'rgba(255,255,255,0)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
			ctx.fill();
		}
        ctx.globalCompositeOperation = 'source-over';
		animationHandle = requestAnimationFrame(frame);
	}
	frame();
}

// Dark – Honeycomb grid
// DOM-based Honeycomb for dark theme
function startHoneycombDom() {
	if (!bgDom) return;
	
	bgDom.innerHTML = '';
	const w = window.innerWidth;
	const h = window.innerHeight;

	// Choose hex size responsive to screen
	const base = Math.min(w, h);
	const size = base > 1400 ? 56 : base > 1100 ? 50 : base > 800 ? 44 : base > 560 ? 38 : 32;
	const hexW = size * 1.0 + 68; // tuned for clip-path hex
	const hexH = size * 1.1 + 70;
	const gap = 2; // tight spacing

	const rowOverlap = hexH * 0.29; // overlap like the example
	const stepX = hexW + gap; // each cell width with gap
	const stepY = hexH - rowOverlap; // vertical staggering amount
	const cols = Math.ceil(w / stepX) + 3;
	const rows = Math.ceil(h / stepY) + 3;

	honeyContainer = document.createElement('div');
	honeyContainer.className = 'container';
	bgDom.appendChild(honeyContainer);

	// CSS variables to control sizes
	honeyContainer.style.setProperty('--hex-w', hexW + 'px');
	honeyContainer.style.setProperty('--hex-h', hexH + 'px');
	honeyContainer.style.setProperty('--hex-gap', gap + 'px');
	honeyContainer.style.setProperty('--row-overlap', rowOverlap + 'px');

	for (let r = 0; r < rows; r++) {
		const rowEl = document.createElement('div');
		rowEl.className = 'row';
		// offset even rows like example (CSS also handles base offset)
		if (r % 2 === 1) rowEl.style.marginLeft = Math.round(hexW * 0.5) + 'px';
		honeyContainer.appendChild(rowEl);
		for (let c = 0; c < cols; c++) {
			const hex = document.createElement('div');
			hex.className = 'hexagon';
			rowEl.appendChild(hex);
		}
	}

	// enable interactive hover glow via pointer events on children
	bgDom.style.pointerEvents = 'none';
	honeyContainer.style.pointerEvents = 'none';
	const hexes = honeyContainer.querySelectorAll('.hexagon');
	hexes.forEach(hx => { hx.style.pointerEvents = 'auto'; });
}

// Multicolor – Aurora gradient with neon orbs
function startAurora() {
	if (!bgCanvas || !ctx) return;
	
    const orbs = 10;
    aurora = new Array(orbs).fill(0).map((_, i) => ({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * bgCanvas.height,
        r: 160 + Math.random() * 240,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        hue: (i * 36 + Math.random() * 36) % 360,
        sat: 80 + Math.random() * 20,
        light: 45 + Math.random() * 20,
        alpha: 0.28 + Math.random() * 0.14
    }));

	function frame() {
        ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        ctx.globalCompositeOperation = 'lighter';
        for (const o of aurora) {
            o.x += o.vx; o.y += o.vy;
			if (o.x < -o.r) o.x = bgCanvas.width + o.r; if (o.x > bgCanvas.width + o.r) o.x = -o.r;
			if (o.y < -o.r) o.y = bgCanvas.height + o.r; if (o.y > bgCanvas.height + o.r) o.y = -o.r;
            o.hue = (o.hue + 0.12) % 360;
            const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
            grad.addColorStop(0, `hsla(${o.hue}, ${o.sat}%, ${o.light}%, ${o.alpha})`);
            grad.addColorStop(0.5, `hsla(${(o.hue + 40) % 360}, ${o.sat}%, ${Math.max(30, o.light - 10)}%, ${o.alpha * 0.7})`);
            grad.addColorStop(1, 'rgba(0,0,0,0)');
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalCompositeOperation = 'source-over';
		animationHandle = requestAnimationFrame(frame);
	}
	frame();
}

// Initialize everything
function init() {
	// Request notification permission
	requestNotificationPermission();
	
	// Load data
	loadTasks();
	loadPomodoro();
	loadStats();
	
	// Load health reminder states
	const waterCountStored = parseInt(localStorage.getItem(STORAGE_KEYS.waterCount) || '0');
	const eyeBreakCountStored = parseInt(localStorage.getItem(STORAGE_KEYS.eyeBreakCount) || '0');
	if (waterCount) waterCount.textContent = waterCountStored;
	if (eyeBreaksCount) eyeBreaksCount.textContent = eyeBreakCountStored;
	
	// Update daily stats
	const today = getToday();
	if (!stats.dailyHistory[today]) {
		stats.dailyHistory[today] = 0;
	}
	
	// Calculate tasks completed today
	const todayTasks = tasks.filter(task => {
		const taskDate = new Date(task.createdAt).toDateString();
		return taskDate === today && task.completed;
	}).length;
	stats.tasksToday = todayTasks;
	
	// Calculate weekly tasks
	const weekAgo = new Date();
	weekAgo.setDate(weekAgo.getDate() - 7);
	stats.tasksThisWeek = tasks.filter(task => {
		return task.completed && task.createdAt > weekAgo.getTime();
	}).length;
	
	// Update streak (simplified calculation)
	stats.currentStreak = stats.tasksToday > 0 ? Math.max(1, stats.currentStreak) : 0;
	
	// Reset daily pomodoro count
	const lastPomodoroDate = localStorage.getItem('tm_lastPomodoroDate');
	if (lastPomodoroDate !== today) {
		stats.pomodorosToday = 0;
		localStorage.setItem('tm_lastPomodoroDate', today);
	}
	
	// Render and update everything
	applyFiltersAndSort();
	updateProgress();
	updateStats();
    updateTimerDisplay();
	updateTimerControls();
    updateTimerDescription();
	updateWaterStatus();
	updateEyeStatus();
	
    // Apply theme
	applyTheme(loadTheme());

	// Initialize Health page controls from saved values (if present)
	initHealthControlsFromStorage();

    // Reflect persisted pomodoro settings into inputs (avoid showing corrupted values)
    if (focusDuration) focusDuration.value = pomodoroState.settings.focus;
    if (breakDuration) breakDuration.value = pomodoroState.settings.break;
    if (longBreakDuration) longBreakDuration.value = pomodoroState.settings.longBreak;
    if (cycleCount) cycleCount.value = pomodoroState.totalCycles;
	
	// Restore health reminders if they were active
	if (localStorage.getItem(STORAGE_KEYS.waterActive) === 'true') {
		console.log('Restoring water reminder');
		startWaterReminder();
	}
	if (localStorage.getItem(STORAGE_KEYS.eyeActive) === 'true') {
		console.log('Restoring eye reminder');
		startEyeReminder();
	}
	
	// Log notification permission status
	console.log('Initial notification permission:', notificationPermission);
	
    // Start live updates for health status (update every minute)
	setInterval(() => {
		updateWaterStatus();
		updateEyeStatus();
		updateDashboardWidgets();
    refreshToggleLabels();
	}, 60000); // Update every minute
	
	// Initial dashboard update
	updateDashboardWidgets();
	
	// Save initial state
	saveStats();
}

// About page accordion initialization
function initAboutPage() {
    const acc = document.getElementById('about-accordion');
    if (!acc) return;
    try { localStorage.setItem('tm_about_last_visited', String(Date.now())); } catch {}

    const headers = acc.querySelectorAll('.accordion-header');
    headers.forEach(h => {
        h.addEventListener('click', () => toggleAccordion(h, acc));
        h.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleAccordion(h, acc); }
        });
    });
}

function toggleAccordion(header, container) {
    const expanded = header.getAttribute('aria-expanded') === 'true';
    // optional: close others
    container.querySelectorAll('.accordion-item').forEach(item => {
        const btn = item.querySelector('.accordion-header');
        const body = item.querySelector('.accordion-body');
        if (btn !== header) {
            btn.setAttribute('aria-expanded', 'false');
            item.classList.remove('open');
            if (body) body.hidden = true;
        }
    });
    // toggle current
    header.setAttribute('aria-expanded', String(!expanded));
    const item = header.closest('.accordion-item');
    const body = item ? item.querySelector('.accordion-body') : null;
    if (item && body) {
        if (expanded) { item.classList.remove('open'); body.hidden = true; }
        else { item.classList.add('open'); body.hidden = false; }
    }
}

// Start the application
init();