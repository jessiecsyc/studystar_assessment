const nameInput = document.getElementById('Name');
const submitButton = document.getElementById('submitName');
const homeHeading = document.getElementById('homeHeading');
const hubHeading = document.getElementById('hubHeading');
const calendarHeading = document.getElementById('calendarHeading');
const analyticsHeading = document.getElementById('analyticsHeading');
const clearButton = document.querySelector('.clear-btn');
const navButtons = document.querySelectorAll('.nav-btn');
const calButton = document.getElementById('cal-btn');
const cancelEditButton = document.getElementById('cancel-edit-event');
const pages = document.querySelectorAll('.page');
const inputEvent = document.getElementById('input-event');
const clearAllButton = document.querySelector('.clearall-btn');
const toggleBtn = document.getElementById('toggleFont');
const darkToggle = document.getElementById('toggleDark');

function updateHeadings(name) {
    if (name) {
        homeHeading.textContent = `Welcome, ${name}!`;
        hubHeading.textContent = `${name}'s Study Hub`;
        calendarHeading.textContent = `${name}'s Week`;
        analyticsHeading.textContent = `${name}'s Analytics`;
    } else {
        homeHeading.textContent = 'Welcome to StudyStar!';
        hubHeading.textContent = 'Your Study Hub';
        calendarHeading.textContent = 'Your Week';
        analyticsHeading.textContent = 'Your Analytics';
    }
}

function loadSavedName() {
    const savedName = localStorage.getItem('studyStarName');
    
    if (savedName) {
        nameInput.value = savedName;
        nameInput.disabled = true;
        updateHeadings(savedName);
    }
}

function switchPage(targetId) {
    pages.forEach((page) => {
        page.classList.toggle('hidden', page.id !== targetId);
        page.classList.toggle('active', page.id === targetId);
    });

    navButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.target === targetId);
    });
}

function submitName() {
    const enteredName = nameInput.value.trim();

    if (enteredName !== '') {
        nameInput.disabled = true;
        localStorage.setItem('studyStarName', enteredName);
        updateHeadings(enteredName);
        switchPage('hub');
    }
}

submitButton.addEventListener('click', submitName);
nameInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitName();
    }
});

clearButton.addEventListener('click', function() {
    nameInput.value = '';
    nameInput.disabled = false;
    localStorage.removeItem('studyStarName');
    updateHeadings('');
});

navButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const targetId = button.dataset.target;
        switchPage(targetId);
    });
});

loadSavedName();
switchPage('home');

// Event Panel

const eventPanel = document.getElementById("event-panel");
const selectedDate = document.getElementById("selected-date");
const eventList = document.getElementById("event-list");
const closePanel = document.getElementById("close-panel");
const eventTitle = document.getElementById("event-title");
const hoursStudy = document.getElementById("hours-study");
const subjectSelect = document.getElementById("subject-select");
const recurrenceSelect = document.getElementById("recurrence-select");
const yourScore = document.getElementById("your-score");
const fullScore = document.getElementById("full-score");
const fileInput = document.getElementById("file-input");
const attachmentPreview = document.getElementById("attachment-preview");
let editingEvent = null;

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve("");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Unable to read selected file."));
        reader.readAsDataURL(file);
    });
}

async function getSelectedEventImageData(existingAttachment = null) {
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
        return existingAttachment;
    }

    try {
        const file = fileInput.files[0];
        const dataUrl = await readFileAsDataUrl(file);

        return {
            dataUrl,
            fileName: file.name || "attachment",
            mimeType: file.type || "application/octet-stream"
        };
    } catch (error) {
        console.error(error);
        return existingAttachment;
    }
}

function getLegacyEventAttachment(key) {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open("studyStarAttachmentDb", 1);
            request.onsuccess = function () {
                const db = request.result;
                if (!db.objectStoreNames.contains("studyStarAttachments")) {
                    resolve(null);
                    return;
                }
                const transaction = db.transaction("studyStarAttachments", "readonly");
                const getRequest = transaction.objectStore("studyStarAttachments").get(key);
                getRequest.onsuccess = () => resolve(getRequest.result || null);
                getRequest.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        } catch (error) {
            resolve(null);
        }
    });
}

async function migrateLegacyAttachments() {
    let migrated = false;

    for (const date of Object.keys(events)) {
        for (const event of events[date] || []) {
            const attachment = event.attachment;
            if (!attachment || !attachment.key || attachment.dataUrl) {
                continue;
            }

            const legacyFile = await getLegacyEventAttachment(attachment.key);
            if (!legacyFile) {
                continue;
            }

            event.attachment = {
                dataUrl: await readFileAsDataUrl(legacyFile),
                fileName: attachment.fileName || legacyFile.name || "attachment",
                mimeType: attachment.mimeType || legacyFile.type || "application/octet-stream"
            };
            migrated = true;
        }
    }

    if (migrated) {
        saveEvents();
    }
}

function renderAttachmentPreview(attachment) {
    if (!attachmentPreview) {
        return;
    }

    attachmentPreview.innerHTML = "";
    if (!attachment || !attachment.dataUrl) {
        attachmentPreview.classList.add("hidden");
        return;
    }

    attachmentPreview.classList.remove("hidden");
    const label = document.createElement("span");
    label.textContent = `Attached: ${attachment.fileName || "attachment"}`;
    attachmentPreview.appendChild(label);

    if ((attachment.mimeType || "").startsWith("image/")) {
        const image = document.createElement("img");
        image.src = attachment.dataUrl;
        image.alt = attachment.fileName || "Attached image";
        attachmentPreview.appendChild(image);
    }
}

const subjectLabels = {
    "1": "English",
    "2": "Maths",
    "3": "Science",
    "4": "History",
    "5": "Geography"
};

let customSubjectLabels = new Set(
    JSON.parse(localStorage.getItem("studyStarCustomSubjects") || "[]")
);

const defaultSubjectColourPalette = {
    "English": "#db808a",
    "Maths": "#daa592",
    "Science": "#fdd8a0",
    "History": "#87ab93",
    "Geography": "#8d99b9",
    "Unspecified": "#af98c3"
};

function getSubjectLabel(value) {
    return subjectLabels[value] || value || "Unspecified";
}

function getSubjectColourPalette() {
    const savedPalette = JSON.parse(localStorage.getItem("studyStarSubjectColours") || "null");
    return {
        ...defaultSubjectColourPalette,
        ...(savedPalette || {})
    };
}

function getSubjectColour(subject) {
    const palette = getSubjectColourPalette();
    return palette[subject] || palette["Unspecified"] || defaultSubjectColourPalette["Unspecified"];
}

function saveSubjectColourPalette(palette) {
    localStorage.setItem("studyStarSubjectColours", JSON.stringify(palette));
}

function buildSubjectColourControls() {
    const container = document.getElementById("subject-colour-settings");
    if (!container) {
        return;
    }

    const knownSubjects = Object.values(subjectLabels);
    const customSubjects = Array.from(customSubjectLabels);

    Object.keys(events).forEach((date) => {
        (events[date] || []).forEach((event) => {
            const subject = event.subjectLabel || getSubjectLabel(event.subject);
            if (!knownSubjects.includes(subject) && !customSubjects.includes(subject)) {
                customSubjects.push(subject);
            }
        });
    });

    const allSubjects = [...knownSubjects, ...customSubjects];

    container.innerHTML = "";

    allSubjects.forEach((subject) => {
        const row = document.createElement("div");
        row.className = "subject-colour-row";

        const label = document.createElement("label");
        label.textContent = subject;

        const picker = document.createElement("input");
        picker.type = "color";
        picker.value = getSubjectColour(subject);
        picker.setAttribute("aria-label", `Colour for ${subject}`);
        picker.addEventListener("change", function () {
            const updatedPalette = getSubjectColourPalette();
            updatedPalette[subject] = this.value;
            saveSubjectColourPalette(updatedPalette);
            refreshAnalyticsColours();
        });

        row.appendChild(label);
        row.appendChild(picker);
        container.appendChild(row);
    });
}

let events = JSON.parse(localStorage.getItem("studyStarEvents")) || {};

function normalizeEvents() {
    Object.keys(events).forEach((date) => {
        events[date] = (events[date] || []).map((event) => {
            if (!event.subjectLabel && event.subject) {
                event.subjectLabel = getSubjectLabel(event.subject);
            }
            return event;
        });
    });
}

function saveEvents() {
    try {
        localStorage.setItem("studyStarEvents", JSON.stringify(events));
        return true;
    } catch (error) {
        console.error("Unable to save events to localStorage:", error);
        alert("This PDF or image is too large to save in this browser. Please choose a smaller file or remove the attachment.");
        return false;
    }
}

function getEventsForDate(dateString) {
    const result = [...(events[dateString] || [])];
    const targetDate = new Date(dateString + "T00:00:00");

    Object.keys(events).forEach((sourceDateString) => {
        if (sourceDateString === dateString) {
            return;
        }

        const sourceDate = new Date(sourceDateString + "T00:00:00");
        if (sourceDate > targetDate) {
            return;
        }

        (events[sourceDateString] || []).forEach((event, sourceIndex) => {
            const recurrence = event.recurrence || "none";
            if (recurrence === "none") {
                return;
            }

            const diffDays = Math.round((targetDate - sourceDate) / (1000 * 60 * 60 * 24));

            if (recurrence === "daily") {
                result.push({ ...event, recurringSourceDate: sourceDateString, recurringSourceIndex: sourceIndex });
            } else if (recurrence === "weekly") {
                if (diffDays >= 0 && diffDays % 7 === 0) {
                    result.push({ ...event, recurringSourceDate: sourceDateString, recurringSourceIndex: sourceIndex });
                }
            } else if (recurrence === "monthly") {
                if (targetDate.getDate() === sourceDate.getDate()) {
                    result.push({ ...event, recurringSourceDate: sourceDateString, recurringSourceIndex: sourceIndex });
                }
            }
        });
    });

    return result;
}

normalizeEvents();
saveEvents();
migrateLegacyAttachments().then(() => {
    renderCalendar();
    renderTimeblockCalendar();
});

function showEvents(dateString) {
    eventPanel.classList.remove("hidden");

    const displayDate = new Date(dateString + "T00:00:00");

    selectedDate.textContent = displayDate.toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const dayEvents = getEventsForDate(dateString);

    if (dayEvents.length === 0) {
        eventList.innerHTML = "<p>No study planned, add some!</p>";
        return;
    }

    eventList.innerHTML = "";

dayEvents.forEach((event, index) => {
    const item = document.createElement("div");
    item.classList.add("event-item");

    const subjectLabel = event.subjectLabel || getSubjectLabel(event.subject);

    const sourceDate = event.recurringSourceDate || dateString;
    const sourceIndex = event.recurringSourceIndex ?? (events[dateString] ? events[dateString].indexOf(event) : -1);

    item.innerHTML = `
        <strong>${event.title}</strong><br>
        Subject: ${subjectLabel}<br>
        Time: ${formatEventTime(event.time)}<br>
        <button class="edit-event" data-source-date="${sourceDate}" data-source-index="${sourceIndex}">
            Edit
        </button>
        <button class="delete-event" data-index="${index}">
            Delete
        </button>
    `;

    eventList.appendChild(item);
});


document.querySelectorAll(".edit-event").forEach(button => {
    button.addEventListener("click", function() {
        const sourceDate = this.dataset.sourceDate;
        const sourceIndex = Number(this.dataset.sourceIndex);
        const event = events[sourceDate]?.[sourceIndex];

        if (!event) {
            return;
        }
        if (yourScore) {
            yourScore.value = event.yourScore || "";
        }
        if (fullScore) {
            fullScore.value = event.full || "";
        }
        if (fileInput) {
            fileInput.value = "";
        }
        renderAttachmentPreview(event.attachment);

        editingEvent = { sourceDate, sourceIndex };
        eventTitle.value = event.title || "";
        hoursStudy.value = event.hours || "";
        eventDate.value = sourceDate;
        eventTime.value = event.time || "09:00";
        subjectSelect.value = event.subject || "";
        recurrenceSelect.value = event.recurrence || "none";
        yourScore.value = event.yourScore || "";
        fullScore.value = event.full || "";
        calButton.textContent = "Save Changes";
        cancelEditButton.classList.remove("hidden");
        inputEvent.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
});

document.querySelectorAll(".delete-event").forEach(button => {
    button.addEventListener("click", function() {

        const confirmDelete = confirm("Are you sure you want to cancel this study session?");

        if (confirmDelete) {

            const index = Number(this.dataset.index);
            const sourceDate = dayEvents[index].recurringSourceDate || dateString;
            const sourceIndex = dayEvents[index].recurringSourceIndex ?? index;

            const deleteTarget = events[sourceDate]?.[sourceIndex];
            if (deleteTarget && deleteTarget.attachment && deleteTarget.attachment.key) {
                deleteEventAttachment(deleteTarget.attachment.key);
            }

            events[sourceDate].splice(sourceIndex, 1);

            if (events[sourceDate].length === 0) {
                delete events[sourceDate];
            }

            saveEvents();

            showEvents(dateString);

            renderCalendar();

            renderTimeblockCalendar();
            renderAnalytics();
        }
    });
});
}

function clearEventForm() {
    eventTitle.value = "";
    hoursStudy.value = "";

    if (eventTime) {
        eventTime.value = "09:00";
    }

    subjectSelect.value = "";

    if (recurrenceSelect) {
        recurrenceSelect.value = "none";
    }

    if (yourScore) {
        yourScore.value = "";
    }

    if (fullScore) {
        fullScore.value = "";
    }

    if (fileInput) {
        fileInput.value = "";
    }

    renderAttachmentPreview(null);

    eventDate.value = formattedDate;
    editingEvent = null;
    calButton.textContent = "Add to Your Calendar";
    cancelEditButton.classList.add("hidden");
}

// ---------- Calendar ----------

const monthYear = document.getElementById("monthYear");
const daysGrid = document.getElementById("daysGrid");

const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");

let currentDate = new Date();
let selectedCalendarDate = null;
const eventDate = document.getElementById("event-date");
const today = new Date();
const formattedDate = formatDateKey(today);

eventDate.value = formattedDate;
function renderCalendar() {

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();

    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNames = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];

    monthYear.textContent = `${monthNames[month]} ${year}`;

    daysGrid.innerHTML = "";

    // Empty spaces before first day
    for (let i = 0; i < firstDay; i++) {

        const empty = document.createElement("div");
        empty.classList.add("empty");
        daysGrid.appendChild(empty);

    }

    const today = new Date();


    // Create each day
for (let day = 1; day <= daysInMonth; day++) {

    const cell = document.createElement("div");
    cell.textContent = day;

    const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (
        day === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear()
    ) {
        cell.classList.add("today");
    }

    if (dateString === selectedCalendarDate) {
        cell.classList.add("selected-date");
    }

    // open event panel when a date is clicked
    cell.addEventListener("click", function() {
        selectedCalendarDate = dateString;
        showEvents(dateString);
        renderCalendar();
    });

    daysGrid.appendChild(cell);
}

}

prevMonth.addEventListener("click", () => {

    currentDate.setMonth(currentDate.getMonth() - 1);

    renderCalendar();

});

nextMonth.addEventListener("click", () => {

    currentDate.setMonth(currentDate.getMonth() + 1);

    renderCalendar();

});

renderCalendar();

customSubjectLabels.forEach((subject) => {
    if (!Array.from(subjectSelect.options).some((option) => option.value === subject)) {
        const option = document.createElement("option");
        option.value = subject;
        option.textContent = subject;
        subjectSelect.insertBefore(option, subjectSelect.lastElementChild);
    }
});

function promptForCustomSubject() {
    if (typeof window !== "undefined" && typeof window.prompt === "function") {
        try {
            const value = window.prompt("Enter your custom label:");
            return Promise.resolve(value);
        } catch (error) {
            console.warn("Native prompt unavailable, using in-app modal instead.", error);
        }
    }

    return new Promise((resolve) => {
        const modalId = "custom-subject-modal";
        let modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
        }

        modal = document.createElement("div");
        modal.id = modalId;
        modal.className = "custom-subject-modal";

        const dialog = document.createElement("div");
        dialog.className = "custom-subject-dialog";

        const title = document.createElement("h3");
        title.textContent = "Add custom subject";

        const label = document.createElement("label");
        label.textContent = "Subject name";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Enter your custom label";
        input.className = "custom-subject-input";

        const actions = document.createElement("div");
        actions.className = "custom-subject-actions";

        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.textContent = "Add";
        confirmButton.className = "custom-subject-confirm";

        const cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.textContent = "Cancel";
        cancelButton.className = "custom-subject-cancel";

        const finish = (value) => {
            resolve(value);
            modal.remove();
        };

        confirmButton.addEventListener("click", () => finish(input.value));
        cancelButton.addEventListener("click", () => finish(null));
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                finish(input.value);
            }
            if (event.key === "Escape") {
                event.preventDefault();
                finish(null);
            }
        });

        actions.appendChild(cancelButton);
        actions.appendChild(confirmButton);
        dialog.appendChild(title);
        dialog.appendChild(label);
        dialog.appendChild(input);
        dialog.appendChild(actions);
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        input.focus();
    });
}

document.getElementById('subject-select').addEventListener('change', async function() {
  if (this.value === 'custom-trigger') {

    const customValue = await promptForCustomSubject();

    if (customValue && customValue.trim() !== "") {
      const trimmedValue = customValue.trim();
            const existingOption = Array.from(this.options).find((option) => option.value === trimmedValue);
            if (!existingOption) {
                const newOption = document.createElement('option');
                newOption.value = trimmedValue;
                newOption.textContent = trimmedValue;
                this.insertBefore(newOption, this.lastElementChild);
            }
      this.value = trimmedValue;
            if (!Object.values(subjectLabels).includes(trimmedValue)) {
                customSubjectLabels.add(trimmedValue);
                localStorage.setItem("studyStarCustomSubjects", JSON.stringify(Array.from(customSubjectLabels)));
                buildSubjectColourControls();
            }
    } else {
      this.value = "";
    }
  }
});

calButton.addEventListener("click", async function() {

    if (Number(hoursStudy.value) > 12) {
        alert("Please lower the amount of study time, too much is bad for you.");
        hoursStudy.focus();
        return;
    }

    if (
    eventTitle.value.trim() === "" ||
    hoursStudy.value.trim() === "" ||
    eventTime.value === "" ||
    eventDate.value === "" ||
    subjectSelect.value === ""
    ) {
        alert("Please complete all required inputs before adding to your calendar.");
        return;
    }

    const date = eventDate.value;
    const existingEvent = editingEvent ? events[editingEvent.sourceDate]?.[editingEvent.sourceIndex] : null;
    const selectedAttachment = await getSelectedEventImageData(existingEvent?.attachment || null);

    const newEvent = {
        title: eventTitle.value.trim(),
        hours: hoursStudy.value.trim(),
        time: eventTime.value,
        subject: subjectSelect.value.trim(),
        subjectLabel: getSubjectLabel(subjectSelect.value.trim()),
        recurrence: recurrenceSelect ? recurrenceSelect.value : "none",
        yourScore: yourScore.value.trim(),
        full: fullScore.value.trim(),
        attachment: selectedAttachment || null
    };

    if (editingEvent) {
        const originalEvent = events[editingEvent.sourceDate]?.[editingEvent.sourceIndex];

        if (!originalEvent) {
            clearEventForm();
            return;
        }

        if (date === editingEvent.sourceDate) {
            events[date][editingEvent.sourceIndex] = newEvent;
        } else {
            events[editingEvent.sourceDate].splice(editingEvent.sourceIndex, 1);
            if (events[editingEvent.sourceDate].length === 0) {
                delete events[editingEvent.sourceDate];
            }
            events[date] = events[date] || [];
            events[date].push(newEvent);
        }
    } else {
        if (!events[date]) {
            events[date] = [];
        }

        events[date].push(newEvent);
    }
    if (!saveEvents()) {
        return;
    }
    buildSubjectColourControls();

    console.log("Event added:", newEvent);

    showEvents(date);

    clearEventForm();

    renderCalendar();
    renderTimeblockCalendar();
    renderAnalytics();
});

closePanel.addEventListener("click", function() {
    eventPanel.classList.add("hidden");
});

cancelEditButton.addEventListener("click", clearEventForm);

if (clearAllButton) {
    clearAllButton.addEventListener("click", function () {

        const confirmReset = confirm(
            "Are you sure you want to delete all StudyStar data?\nThis cannot be undone."
        );

        if (!confirmReset) {
            return;
        }

        localStorage.removeItem("studyStarName");
        localStorage.removeItem("studyStarEvents");
        localStorage.removeItem("studyStarSubjectColours");
        localStorage.removeItem("studyStarCustomSubjects");
        events = {};
        customSubjectLabels.clear();
        currentDate = new Date();
        currentWeekDate = new Date();
        selectedCalendarDate = null;
        darkToggle.checked = false;
        document.body.classList.remove("dark-mode");
        toggleBtn.value = "100";
        updateAppFontSize("100");
        Array.from(subjectSelect.options).forEach((option) => {
            if (!["", "1", "2", "3", "4", "5", "custom-trigger"].includes(option.value)) {
                option.remove();
            }
        });
        buildSubjectColourControls();
        renderAnalytics();
        nameInput.value = "";
        nameInput.disabled = false;
        updateHeadings("");

        clearEventForm();

        eventPanel.classList.add("hidden");

        if (calendarEventPanel) {
            calendarEventPanel.classList.add("hidden");
        }

        if (calendarEventTooltip) {
            calendarEventTooltip.classList.add("hidden");
        }

        alert("All StudyStar data has been deleted.");

        renderCalendar();
        renderTimeblockCalendar();

        switchPage("home");
    });
}

const updateAppFontSize = (value) => {
  document.documentElement.style.fontSize = `${value}%`;
  document.body.style.fontSize = `${value}%`;
};

toggleBtn.addEventListener('input', () => {
  updateAppFontSize(toggleBtn.value);
});

if (darkToggle) {
  darkToggle.addEventListener('change', () => {
    document.body.classList.toggle('dark-mode', darkToggle.checked);
  });
}

updateAppFontSize(toggleBtn.value);


// timeblock calendar

const timeblockBody = document.getElementById("timeblock-body");
const timeLabels = document.getElementById("time-labels");
const weekColumns = document.querySelectorAll(".week-column");
const weekRange = document.getElementById("weekRange");
const prevWeek = document.getElementById("prevWeek");
const nextWeek = document.getElementById("nextWeek");

const eventTime = document.getElementById("event-time");
const calendarEventPanel = document.getElementById("calendar-event-panel");
const calendarEventDetails = document.getElementById("calendar-event-details");
const closeCalendarPanel = document.getElementById("close-calendar-panel");
const calendarEventTooltip = document.getElementById("calendar-event-tooltip");

// Calendar settings

const START_HOUR = 6;
const END_HOUR = 23; 
const HOUR_HEIGHT = 68;


// Current week

let currentWeekDate = new Date();


// Set default event time

if (eventTime) {
    eventTime.value = "09:00";
}


// Get Sunday of current week

function getStartOfWeek(date) {

    const result = new Date(date);

    result.setHours(0, 0, 0, 0);

    result.setDate(result.getDate() - result.getDay());

    return result;
}


// Format date as YYYY-MM-DD

function formatCalendarDate(date) {

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;

}


// Format time

function formatEventTime(time) {

    if (!time) {
        return "09:00";
    }

    const [hours, minutes] = time.split(":");

    const date = new Date();
    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
    });
}


// Create time labels

function renderTimeLabels() {

    timeLabels.innerHTML = "";

    for (
        let hour = START_HOUR;
        hour <= END_HOUR;
        hour++
    ) {

        const label = document.createElement("div");

        label.classList.add("time-label");

        label.textContent = `${String(hour).padStart(2, "0")}:00`;

        timeLabels.appendChild(label);

    }

}


// Update week heading

function updateWeekHeading(startDate) {

    const endDate = new Date(startDate);

    endDate.setDate(startDate.getDate() + 6);

    const startText = startDate.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short"
    });

    const endText = endDate.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });

    weekRange.textContent = `${startText} - ${endText}`;

}


function buildDayEventLayout(dayEvents) {
    const sortedEvents = [...dayEvents]
        .map((event) => {
            const time = event.time || "09:00";
            const [eventHour, eventMinute] = time.split(":").map(Number);
            const startMinutes = eventHour * 60 + eventMinute;
            const hours = Number(event.hours) || 1;
            return {
                ...event,
                startMinutes,
                endMinutes: startMinutes + (hours * 60),
                hours
            };
        })
        .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

    const clusters = [];
    let currentCluster = [];

    sortedEvents.forEach((event) => {
        const overlapsCurrentCluster = currentCluster.some((existing) => 
            existing.startMinutes < event.endMinutes && event.startMinutes < existing.endMinutes
        );

        if (currentCluster.length > 0 && !overlapsCurrentCluster) {
            clusters.push(currentCluster);
            currentCluster = [event];
        } else {
            currentCluster.push(event);
        }
    });

    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    const layouts = [];

    clusters.forEach((cluster) => {
        const clusterColumns = [];

        const clusterColumnCount = cluster.reduce((maxColumns, event) => {
            let simultaneousEvents = 0;
            cluster.forEach((candidate) => {
                if (event.startMinutes < candidate.endMinutes && candidate.startMinutes < event.endMinutes) {
                    simultaneousEvents += 1;
                }
            });
            return Math.max(maxColumns, simultaneousEvents);
        }, 1);

        cluster.forEach((event) => {
            let columnIndex = 0;
            while (columnIndex < clusterColumns.length && clusterColumns[columnIndex] > event.startMinutes) {
                columnIndex += 1;
            }

            clusterColumns[columnIndex] = event.endMinutes;

            layouts.push({
                ...event,
                columnIndex,
                totalColumns: clusterColumnCount
            });
        });
    });

    return layouts.sort((a, b) => a.startMinutes - b.startMinutes || a.columnIndex - b.columnIndex);
}

// Render events

function renderTimeblockCalendar() {

    if (!weekColumns.length) {
        return;
    }

    const startDate = getStartOfWeek(currentWeekDate);

    updateWeekHeading(startDate);

    renderTimeLabels();

    weekColumns.forEach(column => {

        column.innerHTML = "";

        column.classList.remove("today-column");

    });

    const todayDate = formatCalendarDate(new Date());

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

        const column = weekColumns[dayIndex];

        const date = new Date(startDate);

        date.setDate(startDate.getDate() + dayIndex);

        const dateString = formatCalendarDate(date);

        if (dateString === todayDate) {
            column.classList.add("today-column");
        }

        const dayEvents = getEventsForDate(dateString);
        const scheduledEvents = buildDayEventLayout(dayEvents);

        scheduledEvents.forEach((event) => {
            const time = event.time || "09:00";
            const hours = Number(event.hours) || 1;

            const [eventHour, eventMinute] = time.split(":").map(Number);
            const startMinutes = eventHour * 60 + eventMinute;
            const calendarStartMinutes = START_HOUR * 60;
            const top = ((startMinutes - calendarStartMinutes) / 60) * HOUR_HEIGHT;
            const height = hours * HOUR_HEIGHT;

            if (top + height < 0 || top > (END_HOUR - START_HOUR) * HOUR_HEIGHT) {
                return;
            }

            const eventElement = document.createElement("div");
            eventElement.classList.add("timeblock-event");

            const gridWidth = Math.max(1, event.totalColumns || 1);
            const leftPercent = (event.columnIndex / gridWidth) * 100 + 1;
            const widthPercent = Math.max(20, 100 / gridWidth - 4);

            eventElement.style.top = `${Math.max(top, 0)}px`;
            eventElement.style.height = `${Math.max(height, 35)}px`;
            eventElement.style.left = `${leftPercent}%`;
            eventElement.style.width = `${widthPercent}%`;
            eventElement.style.right = "auto";
            eventElement.style.zIndex = String(10 + event.columnIndex);

            const subject = event.subjectLabel || getSubjectLabel(event.subject);

            eventElement.innerHTML = `
                <strong>${event.title}</strong>

                <span class="event-time">
                    ${formatEventTime(time)}
                </span>

                <span class="event-subject">
                    ${subject}
                </span>
            `;

            eventElement.addEventListener("mouseenter", function () {
                showCalendarEventTooltip(this, event, dateString);
            });

            eventElement.addEventListener("mouseleave", function () {
                hideCalendarEventTooltip();
            });

            eventElement.addEventListener("click", function () {
                openCalendarEventPanel(event, dateString);
            });

            column.appendChild(eventElement);
        });
    }
}


// Previous week

prevWeek.addEventListener("click", function () {

    currentWeekDate.setDate(
        currentWeekDate.getDate() - 7
    );

    renderTimeblockCalendar();

});


// Next week

nextWeek.addEventListener("click", function () {

    currentWeekDate.setDate(
        currentWeekDate.getDate() + 7
    );

    renderTimeblockCalendar();

});

function buildCalendarEventDetails(event, dateString) {
    const subjectLabel = event.subjectLabel || getSubjectLabel(event.subject);
    const displayDate = new Date(dateString + "T00:00:00");
    const recurrence = event.recurrence && event.recurrence !== "none" ? event.recurrence : null;
    const attachment = event.attachment && event.attachment.dataUrl ? event.attachment : null;
    const attachmentDetails = attachment
        ? (attachment.mimeType && attachment.mimeType.startsWith("image/")
            ? `<div class="calendar-attachment"><strong>Attachment:</strong><br><img src="${attachment.dataUrl}" alt="${attachment.fileName || "Attached image"}"></div>`
            : `<p class="calendar-attachment"><strong>Attachment:</strong> <a href="${attachment.dataUrl}" download="${attachment.fileName || "attachment"}" target="_blank" rel="noopener">${attachment.fileName || "View attachment"}</a></p>`)
        : "";

    return `
        <h3>${event.title}</h3>
        <p><strong>Date:</strong> ${displayDate.toLocaleDateString("en-AU")}</p>
        <p><strong>Time:</strong> ${formatEventTime(event.time)}</p>
        <p><strong>Subject:</strong> ${subjectLabel}</p>
        <p><strong>Hours:</strong> ${event.hours}</p>
        ${recurrence ? `<p><strong>Repeats:</strong> ${recurrence}</p>` : ""}
        <p><strong>Target Score:</strong> ${event.target || "N/A"}</p>
        <p><strong>Full Score:</strong> ${event.full || "N/A"}</p>
        ${attachmentDetails}
    `;
}

function showCalendarEventTooltip(eventElement, event, dateString) {
    if (!calendarEventTooltip) {
        return;
    }

    calendarEventTooltip.innerHTML = buildCalendarEventDetails(event, dateString);
    calendarEventTooltip.classList.remove("hidden");

    const eventRect = eventElement.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth * 0.92);
    const top = eventRect.top + window.scrollY;
    let left = eventRect.right + 8;

    if (left + tooltipWidth > window.innerWidth - 16) {
        left = eventRect.left - tooltipWidth - 8;
    }

    if (left < 8) {
        left = 8;
    }

    calendarEventTooltip.style.top = `${top}px`;
    calendarEventTooltip.style.left = `${left}px`;
    calendarEventTooltip.style.width = `${tooltipWidth}px`;
}

function hideCalendarEventTooltip() {
    if (!calendarEventTooltip) {
        return;
    }
    calendarEventTooltip.classList.add("hidden");
}

function openCalendarEventPanel(event, dateString) {
    if (!calendarEventPanel || !calendarEventDetails) {
        return;
    }

    calendarEventDetails.innerHTML = buildCalendarEventDetails(event, dateString);
    calendarEventPanel.classList.remove("hidden");
    hideCalendarEventTooltip();
}

if (closeCalendarPanel) {
    closeCalendarPanel.addEventListener("click", function () {
        if (calendarEventPanel) {
            calendarEventPanel.classList.add("hidden");
        }
    });
}

const scoreHoursCanvas = document.getElementById("scoreHoursChart");
const noScoreAnalyticsData = document.getElementById("noScoreAnalyticsData");
const hoursStudiedCanvas = document.getElementById("hoursStudiedChart");
const noHoursAnalyticsData = document.getElementById("noHoursAnalyticsData");
const weeklySummary = document.getElementById("weekly-summary");
const allDataSummary = document.getElementById("all-data-summary");

let scoreHoursChart = null;
let hoursStudiedChart = null;

function getWeekStart(dateString) {
    const date = new Date(dateString + "T00:00:00");
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(date.getDate() - date.getDay());
    return weekStart;
}

function getThisWeekSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekStart = getWeekStart(formatDateKey(today));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const sessions = [];
    const subjectScores = new Map();

    for (let date = new Date(today); date <= weekEnd; date.setDate(date.getDate() + 1)) {
        const dateString = formatDateKey(date);
        getEventsForDate(dateString).forEach((event) => {
            const hours = Number(event.hours);
            if (Number.isFinite(hours) && hours > 0) {
                sessions.push({ event, dateString });
            }

            const score = Number(event.yourScore ?? event.target);
            const fullScore = Number(event.full ?? event.fullScore);
            if (Number.isFinite(score) && Number.isFinite(fullScore) && fullScore > 0) {
                const subject = event.subjectLabel || getSubjectLabel(event.subject);
                const subjectData = subjectScores.get(subject) || { total: 0, count: 0 };
                subjectData.total += (score / fullScore) * 100;
                subjectData.count += 1;
                subjectScores.set(subject, subjectData);
            }
        });
    }

    return {
        sessionCount: sessions.length,
        totalHours: sessions.reduce((total, session) => total + Number(session.event.hours), 0),
        subjectAverages: Array.from(subjectScores.entries())
            .map(([subject, data]) => ({
                subject,
                average: data.total / data.count
            }))
            .sort((a, b) => a.subject.localeCompare(b.subject))
    };
}

function getAllDataSummary() {
    const sessions = [];
    const subjectScores = new Map();
    const today = new Date();
    const todayKey = formatDateKey(today);
    const currentTime = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;

    Object.keys(events).forEach((dateString) => {
        (events[dateString] || []).forEach((event) => {
            const isCompleted = dateString < todayKey ||
                (dateString === todayKey && event.time && event.time <= currentTime);
            if (!isCompleted) {
                return;
            }

            const hours = Number(event.hours);
            if (Number.isFinite(hours) && hours > 0) {
                sessions.push(event);
            }

            const score = Number(event.yourScore ?? event.target);
            const fullScore = Number(event.full ?? event.fullScore);
            if (Number.isFinite(score) && Number.isFinite(fullScore) && fullScore > 0) {
                const subject = event.subjectLabel || getSubjectLabel(event.subject);
                const subjectData = subjectScores.get(subject) || { total: 0, count: 0 };
                subjectData.total += (score / fullScore) * 100;
                subjectData.count += 1;
                subjectScores.set(subject, subjectData);
            }
        });
    });

    return {
        sessionCount: sessions.length,
        totalHours: sessions.reduce((total, event) => total + Number(event.hours), 0),
        subjectAverages: Array.from(subjectScores.entries())
            .map(([subject, data]) => ({
                subject,
                average: data.total / data.count
            }))
            .sort((a, b) => a.subject.localeCompare(b.subject))
    };
}

function renderSummary(container, summary, sessionLabel, hoursLabel) {
    if (!container) {
        return;
    }

    const averageMarkup = summary.subjectAverages.length > 0
        ? summary.subjectAverages.map(({ subject, average }) => `
            <div class="weekly-summary-subject">
                <span>${subject}</span>
                <strong>${average.toFixed(1)}%</strong>
            </div>
        `).join("")
        : '<p class="weekly-summary-empty">No scored sessions yet.</p>';

    container.innerHTML = `
        <div class="weekly-summary-stat">
            <strong>${summary.sessionCount}</strong>
            <span>${sessionLabel}</span>
        </div>
        <div class="weekly-summary-stat">
            <strong>${summary.totalHours.toFixed(1)}</strong>
            <span>${hoursLabel}</span>
        </div>
        <div class="weekly-summary-averages">
            <h3>Average score by subject</h3>
            ${averageMarkup}
        </div>
    `;
}

function renderWeeklySummary() {
    renderSummary(weeklySummary, getThisWeekSummary(), "Upcoming sessions", "Planned hours");
    renderSummary(allDataSummary, getAllDataSummary(), "Completed sessions", "Completed hours");
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getAllEventsForAnalytics() {
    const allEvents = [];
    const allDates = Object.keys(events).sort();

    allDates.forEach((dateString) => {
        const recurringMatches = getEventsForDate(dateString);
        recurringMatches.forEach((event) => {
            allEvents.push({
                ...event,
                date: dateString,
                subjectLabel: event.subjectLabel || getSubjectLabel(event.subject)
            });
        });
    });

    return allEvents;
}

function getAnalyticsData() {

    const subjectGroups = new Map();

    getAllEventsForAnalytics().forEach((event) => {
        const hours = Number(event.hours);
        const target = Number(event.yourScore ?? event.target);
        const full = Number(event.full ?? event.fullScore);
        const subject = event.subjectLabel || getSubjectLabel(event.subject);

        if (
            Number.isFinite(hours) &&
            hours > 0 &&
            Number.isFinite(target) &&
            Number.isFinite(full) &&
            full > 0
        ) {
            const percentage = (target / full) * 100;

            if (!subjectGroups.has(subject)) {
                subjectGroups.set(subject, []);
            }

            subjectGroups.get(subject).push({
                x: hours,
                y: percentage,
                title: event.title,
                subject: subject,
                colour: getSubjectColour(subject),
                date: event.date
            });
        }
    });

    const sortedSubjects = Array.from(subjectGroups.keys()).sort((a, b) => a.localeCompare(b));
    const sortedData = [];

    sortedSubjects.forEach((subject) => {
        const points = subjectGroups.get(subject)
            .sort((a, b) => a.x - b.x || a.date.localeCompare(b.date));

        points.forEach((point) => {
            sortedData.push(point);
        });
    });

    return sortedData;
}

function getSubjectHoursByWeekData() {
    const totalsByWeekAndSubject = new Map();
    const weekSet = new Set();
    const subjects = new Set();

    getAllEventsForAnalytics().forEach((event) => {
        const hours = Number(event.hours);
        if (!Number.isFinite(hours) || hours <= 0) {
            return;
        }

        const subject = event.subjectLabel || getSubjectLabel(event.subject);
        const weekStart = getWeekStart(event.date);
        const weekKey = formatDateKey(weekStart);
        const subjectKey = `${weekKey}|${subject}`;

        subjects.add(subject);
        weekSet.add(weekKey);

        const currentTotal = totalsByWeekAndSubject.get(subjectKey) || 0;
        totalsByWeekAndSubject.set(subjectKey, currentTotal + hours);
    });

    const sortedWeeks = Array.from(weekSet)
        .map(dateKey => new Date(dateKey + "T00:00:00"))
        .sort((a, b) => a - b)
        .map(date => formatDateKey(date));

    const subjectOrder = Array.from(subjects);

    const datasets = subjectOrder.map((subject) => ({
        label: subject,
        data: sortedWeeks.map(weekKey => {
            const value = totalsByWeekAndSubject.get(`${weekKey}|${subject}`) || 0;
            return Number(value.toFixed(1));
        }),
        backgroundColour: getSubjectColour(subject),
        borderColour: getSubjectColour(subject),
        borderWidth: 1,
        borderRadius: 6
    }));

    return {
        labels: sortedWeeks.map(weekKey => {
            const date = new Date(weekKey + "T00:00:00");
            return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
        }),
        datasets
    };
}

function refreshAnalyticsColours() {
    if (scoreHoursChart) {
        const scoreData = getAnalyticsData();
        if (scoreData.length === 0) {
            scoreHoursChart.destroy();
            scoreHoursChart = null;
            scoreHoursCanvas.style.display = "none";
            if (noScoreAnalyticsData) {
                noScoreAnalyticsData.classList.remove("hidden");
            }
            return;
        }

        scoreHoursChart.data.datasets[0].data = scoreData;
        scoreHoursChart.data.datasets[0].pointBackgroundColour = scoreData.map(point => point.colour);
        scoreHoursChart.data.datasets[0].pointBorderColour = scoreData.map(point => point.colour);
        scoreHoursChart.update();
    }

    if (hoursStudiedChart) {
        const hoursData = getSubjectHoursByWeekData();
        if (!hoursData.datasets.length || hoursData.labels.length === 0) {
            hoursStudiedChart.destroy();
            hoursStudiedChart = null;
            hoursStudiedCanvas.style.display = "none";
            if (noHoursAnalyticsData) {
                noHoursAnalyticsData.classList.remove("hidden");
            }
            return;
        }

        hoursStudiedChart.data.labels = hoursData.labels;
        hoursStudiedChart.data.datasets = hoursData.datasets;
        hoursStudiedChart.update();
    }
}

function renderScoreAnalytics() {
    if (!scoreHoursCanvas) {
        return;
    }

    const data = getAnalyticsData();

    if (scoreHoursChart) {
        scoreHoursChart.destroy();
        scoreHoursChart = null;
    }

    if (data.length === 0) {
        scoreHoursCanvas.style.display = "none";

        if (noScoreAnalyticsData) {
            noScoreAnalyticsData.classList.remove("hidden");
        }

        return;
    }

    scoreHoursCanvas.style.display = "block";

    if (noScoreAnalyticsData) {
        noScoreAnalyticsData.classList.add("hidden");
    }

    const subjectDataSets = Array.from(
        new Map(
            data.reduce((groups, point) => {
                const key = point.subject;
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(point);
                return groups;
            }, new Map())
        ).entries()
    )
        .sort(([subjectA], [subjectB]) => subjectA.localeCompare(subjectB))
        .map(([subject, points]) => ({
            label: subject,
            data: points.sort((a, b) => a.x - b.x),
            showLine: false,
            borderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColour: points.map(point => point.colour),
            pointBorderColour: points.map(point => point.colour),
            pointBorderWidth: 1,
            borderColor: getSubjectColour(subject),
            backgroundColor: getSubjectColour(subject)
        }));

    scoreHoursChart = new Chart(scoreHoursCanvas, {
        type: "line",
        data: {
            datasets: subjectDataSets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "nearest",
                intersect: false
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = context.raw;
                            return [
                                `Hours Studied: ${point.x}`,
                                `Task Score: ${point.y.toFixed(1)}%`
                            ];
                        },
                        afterLabel: function(context) {
                            const point = context.raw;
                            return [
                                `Task: ${point.title}`,
                                `Subject: ${point.subject}`,
                                `Date: ${point.date}`
                            ];
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: "linear",
                    title: {
                        display: true,
                        text: "Hours Studied"
                    },
                    beginAtZero: true
                },
                y: {
                    title: {
                        display: true,
                        text: "Task Score (%)"
                    },
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + "%";
                        }
                    }
                }
            }
        }
    });
}

function renderHoursStudiedChart() {
    if (!hoursStudiedCanvas) {
        return;
    }

    if (hoursStudiedChart) {
        hoursStudiedChart.destroy();
        hoursStudiedChart = null;
    }

    const hoursData = getSubjectHoursByWeekData();

    if (!hoursData.datasets.length || hoursData.labels.length === 0) {
        hoursStudiedCanvas.style.display = "none";

        if (noHoursAnalyticsData) {
            noHoursAnalyticsData.classList.remove("hidden");
        }

        return;
    }

    hoursStudiedCanvas.style.display = "block";

    if (noHoursAnalyticsData) {
        noHoursAnalyticsData.classList.add("hidden");
    }

    hoursStudiedChart = new Chart(hoursStudiedCanvas, {
        type: "bar",
        data: {
            labels: hoursData.labels,
            datasets: hoursData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: "bottom"
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} hours`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Week"
                    },
                    ticks: {
                        maxRotation: 0,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Hours Studied"
                    },
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function renderAnalytics() {
    renderWeeklySummary();
    renderScoreAnalytics();
    renderHoursStudiedChart();
}

renderAnalytics();
buildSubjectColourControls();
renderTimeblockCalendar();





// Downloading Weekly Calendar as PDF

const printCalendarButton = document.querySelector('.print-btn');

if (printCalendarButton) {
    printCalendarButton.addEventListener('click', generateCalendarPDF);
}

function generateCalendarPDF() {

    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("The PDF library has not loaded yet. Please refresh the page and try again.");
        return;
    }

    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const margin = 12;

    const savedName = localStorage.getItem("studyStarName");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);

    if (savedName) {
        doc.text(`${savedName}'s Study Calendar`, margin, margin + 4);
    } else {
        doc.text("StudyStar Calendar", margin, margin + 4);
    }

    const startDate = getStartOfWeek(currentWeekDate);
    const endDate = new Date(startDate);

    endDate.setDate(startDate.getDate() + 6);

    const startText = startDate.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    const endText = endDate.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric"
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    doc.text(
        `${startText} - ${endText}`,
        margin,
        margin + 11
    );

    const calendarTop = 32;
    const timeColumnWidth = 20;
    const calendarWidth = pageWidth - (margin * 2);
    const dayColumnWidth =
        (calendarWidth - timeColumnWidth) / 7;

    const headerHeight = 12;
    const calendarBottom = pageHeight - margin;

    const hourStart = START_HOUR;
    const hourEnd = END_HOUR;

    const totalHours = hourEnd - hourStart + 1;

    const availableHeight =
        calendarBottom - calendarTop - headerHeight;

    const hourHeight = availableHeight / totalHours;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    // time column header
    doc.setFillColor(232, 217, 190);
    doc.rect(
        margin,
        calendarTop,
        timeColumnWidth,
        headerHeight,
        "F"
    );

    doc.setDrawColor(180, 170, 150);

    doc.rect(
        margin,
        calendarTop,
        timeColumnWidth,
        headerHeight
    );

    // day headers
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

        const x =
            margin +
            timeColumnWidth +
            (dayIndex * dayColumnWidth);

        const date = new Date(startDate);

        date.setDate(startDate.getDate() + dayIndex);

        const dayName = date.toLocaleDateString("en-AU", {
            weekday: "short"
        });

        const dateNumber = date.getDate();

        doc.setFillColor(232, 217, 190);

        doc.rect(
            x,
            calendarTop,
            dayColumnWidth,
            headerHeight,
            "F"
        );

        doc.rect(
            x,
            calendarTop,
            dayColumnWidth,
            headerHeight
        );

        doc.text(
            `${dayName} ${dateNumber}`,
            x + (dayColumnWidth / 2),
            calendarTop + 7,
            {
                align: "center"
            }
        );
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);

    for (
        let hour = hourStart;
        hour <= hourEnd;
        hour++
    ) {

        const rowIndex = hour - hourStart;

        const y =
            calendarTop +
            headerHeight +
            (rowIndex * hourHeight);

        // time label
        doc.setTextColor(90, 90, 90);

        doc.text(
            `${String(hour).padStart(2, "0")}:00`,
            margin + timeColumnWidth - 2,
            y + 4,
            {
                align: "right"
            }
        );

        // horizontal grid line
        doc.setDrawColor(220, 220, 220);

        doc.line(
            margin + timeColumnWidth,
            y,
            pageWidth - margin,
            y
        );
    }

    // vertical lines
    for (let dayIndex = 0; dayIndex <= 7; dayIndex++) {

        const x =
            margin +
            timeColumnWidth +
            (dayIndex * dayColumnWidth);

        doc.setDrawColor(220, 220, 220);

        doc.line(
            x,
            calendarTop + headerHeight,
            x,
            calendarBottom
        );
    }

// render events
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {

        const date = new Date(startDate);

        date.setDate(startDate.getDate() + dayIndex);

        const dateString = formatCalendarDate(date);

        const dayEvents = getEventsForDate(dateString);

        const columnX =
            margin +
            timeColumnWidth +
            (dayIndex * dayColumnWidth);

        dayEvents.forEach((event) => {

            const time = event.time || "09:00";
            const hours = Number(event.hours) || 1;

            const [eventHour, eventMinute] =
                time.split(":").map(Number);

            const startMinutes =
                (eventHour * 60) + eventMinute;

            const calendarStartMinutes =
                START_HOUR * 60;

            const topOffset =
                ((startMinutes - calendarStartMinutes) / 60)
                * hourHeight;

            const eventHeight =
                hours * hourHeight;

            // Ignore events outside the calendar
            if (
                topOffset + eventHeight < 0 ||
                topOffset > availableHeight
            ) {
                return;
            }

            const eventY =
                calendarTop +
                headerHeight +
                Math.max(topOffset, 0);

            const eventX = columnX + 1;

            const eventWidth = dayColumnWidth - 2;

            const safeHeight =
                Math.max(
                    Math.min(
                        eventHeight,
                        calendarBottom - eventY
                    ),
                    5
                );

            const subject =
                event.subjectLabel ||
                getSubjectLabel(event.subject);

            // Event colour
            const colour = getSubjectColour(subject);

            const rgb = hexToRgb(colour);

            if (rgb) {
                doc.setFillColor(
                    rgb.r,
                    rgb.g,
                    rgb.b
                );
            } else {
                doc.setFillColor(
                    196,
                    164,
                    132
                );
            }

            doc.setDrawColor(90, 59, 30);

            doc.roundedRect(
                eventX,
                eventY,
                eventWidth,
                safeHeight,
                1.5,
                1.5,
                "FD"
            );

            // Event text
            doc.setTextColor(59, 33, 8);

            doc.setFont("helvetica", "bold");
            doc.setFontSize(6.5);

            const title =
                event.title || "Study Session";

            const titleLines =
                doc.splitTextToSize(
                    title,
                    eventWidth - 4
                );

            doc.text(
                titleLines.slice(0, 2),
                eventX + 2,
                eventY + 4
            );

            if (safeHeight >= 12) {

                doc.setFont("helvetica", "normal");
                doc.setFontSize(5.5);

                doc.text(
                    formatEventTime(time),
                    eventX + 2,
                    eventY + 8
                );

                doc.text(
                    subject,
                    eventX + 2,
                    eventY + 11
                );
            }

            if (safeHeight >= 18) {

                doc.text(
                    `${hours} hr${hours === 1 ? "" : "s"}`,
                    eventX + 2,
                    eventY + 14
                );
            }

            if (
                safeHeight >= 24 &&
                event.yourScore !== "" &&
                event.full
            ) {

                const score =
                    Number(event.yourScore);

                const full =
                    Number(event.full);

                if (
                    Number.isFinite(score) &&
                    Number.isFinite(full) &&
                    full > 0
                ) {

                    const percentage =
                        (score / full) * 100;

                    doc.text(
                        `Score: ${score}/${full} (${percentage.toFixed(1)}%)`,
                        eventX + 2,
                        eventY + 18
                    );
                }
            }
        });
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);

    doc.text(
        "Generated by StudyStar. You're a Star!",
        pageWidth - margin,
        pageHeight - 5,
        {
            align: "right"
        }
    );

// actually downloading
    const filename =
        savedName
            ? `${savedName}-StudyStar-Calendar.pdf`
            : "StudyStar-Calendar.pdf";

    doc.save(filename);
}

function hexToRgb(hex) {

    if (!hex) {
        return null;
    }

    const cleanHex =
        hex.replace("#", "");

    if (cleanHex.length !== 6) {
        return null;
    }

    return {
        r: parseInt(cleanHex.substring(0, 2), 16),
        g: parseInt(cleanHex.substring(2, 4), 16),
        b: parseInt(cleanHex.substring(4, 6), 16)
    };
}
