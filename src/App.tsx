import { useEffect, useState } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { useAuthenticator } from "@aws-amplify/ui-react";

const client = generateClient<Schema>();

// Helpers
function formatDateLocal(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getTodayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// Constants
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_WEEKS = 6; // fixed rows to keep size constant

function App() {
  const { signOut } = useAuthenticator();

  // Todos from backend
  const [todos, setTodos] = useState<Array<Schema["Todo"]["type"]>>([]);

  // Calendar navigation state
  const today = new Date();
  const [calendarYear, setCalendarYear] = useState(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth() + 1); // 1-based month
  const [selectedDay, setSelectedDay] = useState(formatDateLocal(calendarYear, calendarMonth, today.getDate()));

  // UI states for todos on selected day
  const [expandedTodo, setExpandedTodo] = useState<string | null>(null);
  const [editingTodo, setEditingTodo] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({
    title: "",
    description: "",
    fromTime: "",
    toTime: "",
    allDay: false,
  });

  // Add todo popup for selected day
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState({
    title: "",
    description: "",
    fromTime: "",
    toTime: "",
    allDay: false,
  });

  // Unplanned todos = todos with no date or empty string date
  const unplannedTodos = todos.filter((t) => !t.date);

  // Filter todos for the selected day (date string equals selectedDay)
  const dayTodos = todos.filter((t) => t.date === selectedDay);

  // Unplanned todo popup state
  const [showUnplannedPopup, setShowUnplannedPopup] = useState(false);
  const [unplannedEditingTodo, setUnplannedEditingTodo] = useState<Schema["Todo"]["type"] | null>(null);
  const [unplannedPopupData, setUnplannedPopupData] = useState({
    title: "",
    description: "",
    date: "",
  });

  // Subscribe to todos from backend
  useEffect(() => {
    const sub = client.models.Todo.observeQuery().subscribe({
      next: (data) => setTodos([...data.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  // Calendar calculations
  const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
  const firstWeekday = firstDay.getDay(); // Sun=0..Sat=6
  const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();

  // Build calendar grid days array with fixed 6 weeks (42 days)
  // Days before month start are previous month's days (optional to show or blank)
  // Days after month end are next month's days
  // We'll show empty cells for simplicity on prev/next month days
  const calendarDays = [];
  for (let i = 0; i < CALENDAR_WEEKS * 7; i++) {
    const dayNumber = i - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      calendarDays.push(null);
    } else {
      calendarDays.push(dayNumber);
    }
  }

  // Helpers to navigate months and years
  function prevMonth() {
    if (calendarMonth === 1) {
      setCalendarMonth(12);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  }
  function nextMonth() {
    if (calendarMonth === 12) {
      setCalendarMonth(1);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  }
  function prevYear() {
    setCalendarYear(calendarYear - 1);
  }
  function nextYear() {
    setCalendarYear(calendarYear + 1);
  }

  // When calendar changes month/year, update selected day to first valid day of new month
  useEffect(() => {
    // Clamp selectedDay if month changed or year changed
    // If previously selected day is invalid or in past, pick today or first day of month whichever is later
    const todayStr = getTodayDateStr();
    const newSelectedDay = formatDateLocal(calendarYear, calendarMonth, 1);
    if (selectedDay && selectedDay.startsWith(`${calendarYear}-${String(calendarMonth).padStart(2, "0")}`)) {
      // Keep day if in current month and >= today
      const dayNum = parseInt(selectedDay.slice(8, 10));
      if (dayNum <= daysInMonth) {
        setSelectedDay(selectedDay);
        return;
      }
    }
    // Otherwise set to max(today, first day of month)
    if (newSelectedDay < todayStr) {
      setSelectedDay(todayStr);
    } else {
      setSelectedDay(newSelectedDay);
    }
  }, [calendarMonth, calendarYear]);

  // Select day on calendar click (only future or today)
  function onSelectDay(day: number | null) {
    if (!day) return;
    const dateStr = formatDateLocal(calendarYear, calendarMonth, day);
    const todayStr = getTodayDateStr();
    if (dateStr < todayStr) return; // block past days
    setSelectedDay(dateStr);
    setExpandedTodo(null);
    setEditingTodo(null);
  }

  // Delete todo
  function deleteTodo(id: string) {
    client.models.Todo.delete({ id });
    setExpandedTodo(null);
    setEditingTodo(null);
  }

  // Create todo for selected day from popup data
  async function createTodo() {
    if (!popupData.title.trim()) {
      alert("Title required");
      return;
    }
    await client.models.Todo.create({
      title: popupData.title.trim(),
      description: popupData.description.trim() || undefined,
      date: selectedDay,
      fromTime: popupData.allDay ? undefined : popupData.fromTime || undefined,
      toTime: popupData.allDay ? undefined : popupData.toTime || undefined,
      allDay: popupData.allDay,
    });
    setShowPopup(false);
    setPopupData({
      title: "",
      description: "",
      fromTime: "",
      toTime: "",
      allDay: false,
    });
  }

  // Save edit for todo
  async function saveEdit(id: string) {
    if (!editFields.title.trim()) {
      alert("Title required");
      return;
    }
    await client.models.Todo.update({
      id,
      title: editFields.title.trim(),
      description: editFields.description.trim() || undefined,
      fromTime: editFields.allDay ? undefined : editFields.fromTime || undefined,
      toTime: editFields.allDay ? undefined : editFields.toTime || undefined,
      allDay: editFields.allDay,
    });
    setEditingTodo(null);
    setExpandedTodo(null);
  }

  // Open unplanned todo popup for add
  function openAddUnplannedPopup() {
    setUnplannedEditingTodo(null);
    setUnplannedPopupData({ title: "", description: "", date: "" });
    setShowUnplannedPopup(true);
  }

  // Open unplanned todo popup for edit
  function openEditUnplannedPopup(todo: Schema["Todo"]["type"]) {
    setUnplannedEditingTodo(todo);
    setUnplannedPopupData({
      title: todo.title as string,
      description: todo.description || "",
      date: todo.date || "",
    });
    setShowUnplannedPopup(true);
  }

  // Save unplanned todo (create or update)
  async function saveUnplannedTodo() {
    if (!unplannedPopupData.title.trim()) {
      alert("Title required");
      return;
    }
    if (unplannedEditingTodo) {
      await client.models.Todo.update({
        id: unplannedEditingTodo.id,
        title: unplannedPopupData.title.trim(),
        description: unplannedPopupData.description.trim() || undefined,
        date: unplannedPopupData.date || null,
      });
    } else {
      await client.models.Todo.create({
        title: unplannedPopupData.title.trim(),
        description: unplannedPopupData.description.trim() || undefined,
        date: unplannedPopupData.date || null,
      });
    }
    setShowUnplannedPopup(false);
  }

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: 20,
        height: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header with calendar navigation */}
      <header
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 20,
          marginBottom: 10,
        }}
      >
        <button onClick={prevYear} aria-label="Previous Year" style={navBtnStyle}>
          «
        </button>
        <button onClick={prevMonth} aria-label="Previous Month" style={navBtnStyle}>
          ‹
        </button>
        <h2 style={{ margin: 0 }}>
          {calendarYear} - {String(calendarMonth).padStart(2, "0")}
        </h2>
        <button onClick={nextMonth} aria-label="Next Month" style={navBtnStyle}>
          ›
        </button>
        <button onClick={nextYear} aria-label="Next Year" style={navBtnStyle}>
          »
        </button>
      </header>

      {/* Main content area */}
      <div style={{ display: "flex", flex: 1, gap: 20 }}>
        {/* Calendar grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gridTemplateRows: `30px repeat(${CALENDAR_WEEKS}, 1fr)`,
            gap: 5,
            flex: 1,
            maxWidth: 700,
            minHeight: 420,
            border: "1px solid #ccc",
            borderRadius: 8,
            userSelect: "none",
          }}
        >
          {/* Weekday headers */}
          {WEEKDAYS.map((wd) => (
            <div
              key={wd}
              style={{
                fontWeight: "600",
                textAlign: "center",
                padding: "6px 0",
                backgroundColor: "#4f46e5",
                color: "white",
                borderRadius: "4px",
              }}
            >
              {wd}
            </div>
          ))}

          {/* Days */}
          {calendarDays.map((day, i) => {
            const isToday =
              day === today.getDate() &&
              calendarMonth === today.getMonth() + 1 &&
              calendarYear === today.getFullYear();
            const dateStr = day
              ? formatDateLocal(calendarYear, calendarMonth, day)
              : "";
            const isSelected = dateStr === selectedDay;
            const dayInPast = day ? dateStr < getTodayDateStr() : true;

            return (
              <div
                key={i}
                onClick={() => onSelectDay(day)}
                style={{
                  border: isSelected ? "2px solid #4f46e5" : "1px solid #ddd",
                  backgroundColor: isSelected
                    ? "#c7d2fe"
                    : dayInPast
                    ? "#f0f0f0"
                    : "white",
                  color: dayInPast ? "#aaa" : "black",
                  padding: 6,
                  cursor: dayInPast || !day ? "default" : "pointer",
                  height: 50,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  userSelect: "none",
                  borderRadius: 4,
                }}
                title={day ? dateStr : ""}
              >
                {day || ""}
              </div>
            );
          })}
        </div>

        {/* Todo list for selected day */}
        <section
          style={{
            flex: 1,
            maxWidth: 450,
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            height: 420,
          }}
        >
          <h3 style={{ marginTop: 0 }}>
            Todos for {selectedDay}
            {!dayTodos.length && (
              <span style={{ fontWeight: "normal", fontSize: 14, marginLeft: 10 }}>
                (No tasks)
              </span>
            )}
          </h3>

          <div
            style={{
              overflowY: "auto",
              flex: 1,
              paddingRight: 6,
            }}
          >
            {dayTodos.map((todo) => (
              <div
                key={todo.id}
                style={{
                  background: "#f9fafb",
                  padding: 10,
                  borderRadius: 8,
                  marginBottom: 10,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                  userSelect: "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <strong>{todo.title}</strong>
                  <div>
                    <button
                      onClick={() => {
                        if (expandedTodo === todo.id) {
                          setExpandedTodo(null);
                          setEditingTodo(null);
                        } else {
                          setExpandedTodo(todo.id);
                          setEditingTodo(null);
                          setEditFields({
                            title: todo.title as string,
                            description: todo.description || "",
                            fromTime: todo.fromTime || "",
                            toTime: todo.toTime || "",
                            allDay: todo.allDay || false,
                          });
                        }
                      }}
                      style={btnLinkStyle}
                      title={
                        expandedTodo === todo.id
                          ? editingTodo === todo.id
                            ? "Close"
                            : "Hide Details"
                          : "View More"
                      }
                    >
                      {expandedTodo === todo.id
                        ? editingTodo === todo.id
                          ? "Close"
                          : "Hide Details"
                        : "View More"}
                    </button>
                    {!editingTodo && (
                      <button
                        onClick={() => {
                          setEditingTodo(todo.id);
                          setEditFields({
                            title: todo.title as string,
                            description: todo.description || "",
                            fromTime: todo.fromTime || "",
                            toTime: todo.toTime || "",
                            allDay: todo.allDay || false,
                          });
                        }}
                        style={{ ...btnLinkStyle, color: "green", marginLeft: 8 }}
                        title="Edit"
                      >
                        ✎
                      </button>
                    )}
                    <button
                      style={{ ...btnLinkStyle, color: "red", marginLeft: 8 }}
                      onClick={() => deleteTodo(todo.id)}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {expandedTodo === todo.id && (
                  <div
                    style={{
                      background: "white",
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid #ddd",
                    }}
                  >
                    {editingTodo === todo.id ? (
                      <>
                        <input
                          value={editFields.title}
                          onChange={(e) =>
                            setEditFields({ ...editFields, title: e.target.value })
                          }
                          style={{ width: "100%", marginBottom: 8, padding: 6 }}
                        />
                        <textarea
                          value={editFields.description || ""}
                          onChange={(e) =>
                            setEditFields({ ...editFields, description: e.target.value })
                          }
                          style={{ width: "100%", marginBottom: 8, padding: 6 }}
                        />
                        <label style={{ userSelect: "none" }}>
                          <input
                            type="checkbox"
                            checked={editFields.allDay}
                            onChange={(e) =>
                              setEditFields({ ...editFields, allDay: e.target.checked })
                            }
                          />{" "}
                          All Day
                        </label>
                        {!editFields.allDay && (
                          <>
                            <input
                              type="time"
                              value={editFields.fromTime || ""}
                              onChange={(e) =>
                                setEditFields({ ...editFields, fromTime: e.target.value })
                              }
                              style={{ width: "100%", margin: "5px 0", padding: 6 }}
                            />
                            <input
                              type="time"
                              value={editFields.toTime || ""}
                              onChange={(e) =>
                                setEditFields({ ...editFields, toTime: e.target.value })
                              }
                              style={{ width: "100%", marginBottom: 8, padding: 6 }}
                            />
                          </>
                        )}
                        <div
                          style={{
                            marginTop: 10,
                            textAlign: "right",
                            display: "flex",
                            gap: 8,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            onClick={() => saveEdit(todo.id)}
                            style={btnPrimaryStyle}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTodo(null)}
                            style={btnSecondaryStyle}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>Description:</strong> {todo.description || "No description"}
                        </p>
                        {todo.allDay ? (
                          <p>
                            <strong>All Day</strong>
                          </p>
                        ) : (
                          <p>
                            <strong>From:</strong> {todo.fromTime || "N/A"} <strong>To:</strong>{" "}
                            {todo.toTime || "N/A"}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add todo button */}
          <button
            onClick={() => setShowPopup(true)}
            disabled={selectedDay < getTodayDateStr()}
            style={{
              ...btnPrimaryStyle,
              marginTop: 10,
              opacity: selectedDay < getTodayDateStr() ? 0.5 : 1,
              cursor: selectedDay < getTodayDateStr() ? "not-allowed" : "pointer",
            }}
            title={
              selectedDay < getTodayDateStr()
                ? "Cannot add todos for past days"
                : "Add Todo for selected day"
            }
          >
            + Add Todo
          </button>
        </section>

        {/* Unplanned tasks sidebar */}
        <aside
          style={{
            width: 280,
            borderLeft: "3px solid #4f46e5",
            backgroundColor: "#eef2ff",
            padding: "20px",
            overflowY: "auto",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h2 style={{ color: "#4f46e5", marginBottom: 12 }}>Unplanned Tasks</h2>
          <button
            onClick={openAddUnplannedPopup}
            style={{
              padding: "8px 12px",
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              marginBottom: "16px",
              alignSelf: "flex-start",
              transition: "background-color 0.3s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#4338ca")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#4f46e5")}
          >
            + Add Unplanned Todo
          </button>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {unplannedTodos.length === 0 && (
              <p style={{ color: "#555" }}>No unplanned tasks.</p>
            )}
            {unplannedTodos.map((todo) => (
              <div
                key={todo.id}
                style={{
                  background: "white",
                  padding: "10px",
                  borderRadius: "8px",
                  marginBottom: "10px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
                onClick={() => openEditUnplannedPopup(todo)}
                title="Click to edit"
              >
                <span>{todo.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTodo(todo.id);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "red",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Add Todo Popup for selected day */}
      {showPopup && (
        <div
          onClick={() => setShowPopup(false)}
          style={popupOverlayStyle}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={popupStyle}
          >
            <h3>Add Todo for {selectedDay}</h3>
            <input
              placeholder="Title"
              value={popupData.title}
              onChange={(e) => setPopupData({ ...popupData, title: e.target.value })}
              style={inputStyle}
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={popupData.description}
              onChange={(e) => setPopupData({ ...popupData, description: e.target.value })}
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
            <label style={{ userSelect: "none" }}>
              <input
                type="checkbox"
                checked={popupData.allDay}
                onChange={(e) => setPopupData({ ...popupData, allDay: e.target.checked })}
              />{" "}
              All Day
            </label>
            {!popupData.allDay && (
              <>
                <input
                  type="time"
                  value={popupData.fromTime || ""}
                  onChange={(e) => setPopupData({ ...popupData, fromTime: e.target.value })}
                  style={inputStyle}
                />
                <input
                  type="time"
                  value={popupData.toTime || ""}
                  onChange={(e) => setPopupData({ ...popupData, toTime: e.target.value })}
                  style={inputStyle}
                />
              </>
            )}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button onClick={() => setShowPopup(false)} style={btnSecondaryStyle}>
                Cancel
              </button>
              <button onClick={createTodo} style={btnPrimaryStyle}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unplanned Todo Popup Modal */}
      {showUnplannedPopup && (
        <div
          onClick={() => setShowUnplannedPopup(false)}
          style={popupOverlayStyle}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={popupStyle}
          >
            <h3>{unplannedEditingTodo ? "Edit" : "Add"} Unplanned Todo</h3>
            <input
              placeholder="Title"
              value={unplannedPopupData.title}
              onChange={(e) =>
                setUnplannedPopupData({ ...unplannedPopupData, title: e.target.value })
              }
              style={inputStyle}
              autoFocus
            />
            <textarea
              placeholder="Description (optional)"
              value={unplannedPopupData.description}
              onChange={(e) =>
                setUnplannedPopupData({ ...unplannedPopupData, description: e.target.value })
              }
              style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}
            />
            <label>
              Assign to date (optional):{" "}
              <input
                type="date"
                value={unplannedPopupData.date}
                onChange={(e) =>
                  setUnplannedPopupData({ ...unplannedPopupData, date: e.target.value })
                }
                style={{ marginTop: 4, width: "100%" }}
                min={getTodayDateStr()}
              />
            </label>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                onClick={() => setShowUnplannedPopup(false)}
                style={btnSecondaryStyle}
              >
                Cancel
              </button>
              <button onClick={saveUnplannedTodo} style={btnPrimaryStyle}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign out button */}
      <footer style={{ marginTop: 20 }}>
        <button onClick={signOut} style={{ ...btnPrimaryStyle, width: 100 }}>
          Sign out
        </button>
      </footer>

      {/* Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0 }
          to { transform: translateY(0); opacity: 1 }
        }
      `}</style>
    </div>
  );
}

// Button styles
const btnPrimaryStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "#4f46e5",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  transition: "background-color 0.3s ease",
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "#eee",
  color: "#333",
  border: "1px solid #ccc",
  borderRadius: 6,
  cursor: "pointer",
  transition: "background-color 0.3s ease",
};

const btnLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#4f46e5",
  cursor: "pointer",
  textDecoration: "underline",
  fontSize: 14,
  padding: 0,
};

const navBtnStyle: React.CSSProperties = {
  cursor: "pointer",
  border: "1px solid #4f46e5",
  background: "white",
  borderRadius: 6,
  padding: "4px 8px",
  fontWeight: "bold",
  userSelect: "none",
};

const popupOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 3000,
  animation: "fadeIn 0.3s ease forwards",
};

const popupStyle: React.CSSProperties = {
  background: "white",
  padding: 24,
  borderRadius: 10,
  width: 320,
  boxShadow: "0 4px 15px rgba(0,0,0,0.25)",
  animation: "slideDown 0.3s ease forwards",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  marginBottom: 12,
  borderRadius: 6,
  border: "1px solid #ccc",
  fontSize: 14,
};

export default App;
